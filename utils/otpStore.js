'use strict';

/**
 * In-memory OTP store with expiry and verification-attempt limiting.
 *
 * Replaces the bare `new Map()` that previously held OTPs, which had two
 * problems: entries were never removed (an unbounded memory leak, since a
 * failed or abandoned verification left its entry behind forever), and a
 * stored OTP stayed valid indefinitely.
 *
 * Attempt limiting matters as much as expiry here: a 6-digit OTP is one of
 * only 900,000 values, so unlimited guesses against a known phone number is a
 * few minutes of scripted work. Five attempts per issued OTP makes that
 * infeasible.
 *
 * Still process-local. That is fine for the current single-process deployment
 * (`node server.js`), but it means OTPs do not survive a restart and would not
 * be shared across instances if this is ever scaled horizontally or put behind
 * a load balancer with more than one backend. Moving to Redis is the fix at
 * that point; this module's surface is deliberately small so that swap is
 * contained to this file.
 */

const OTP_TTL_MS = 5 * 60 * 1000;   // OTP is valid for 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;      // per issued OTP
const SWEEP_INTERVAL_MS = 60 * 1000;

const store = new Map();

/** Store a freshly generated OTP, replacing any previous one for this phone. */
const set = (phone, otp) => {
  store.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
};

/**
 * Verify a candidate OTP.
 *
 * Consumes an attempt on every call. On success, expiry, or attempt
 * exhaustion the entry is deleted, so an OTP is single-use in all outcomes.
 *
 * @returns {{ ok: true } | { ok: false, reason: 'not_found'|'expired'|'too_many_attempts'|'incorrect' }}
 */
const verify = (phone, candidate) => {
  const entry = store.get(phone);

  if (!entry) return { ok: false, reason: 'not_found' };

  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return { ok: false, reason: 'expired' };
  }

  entry.attempts += 1;

  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    store.delete(phone);
    return { ok: false, reason: 'too_many_attempts' };
  }

  // Numeric comparison preserves the previous parseInt-based behaviour;
  // generated OTPs are 100000-999999 so there are no leading zeros to lose.
  if (Number(candidate) === Number(entry.otp)) {
    store.delete(phone);
    return { ok: true };
  }

  return { ok: false, reason: 'incorrect' };
};

/** Drop every expired entry. Bounds memory even if nothing is ever verified. */
const sweep = () => {
  const now = Date.now();
  for (const [phone, entry] of store) {
    if (now > entry.expiresAt) store.delete(phone);
  }
};

// unref() so this timer never holds the process open on shutdown.
const sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

module.exports = {
  set,
  verify,
  sweep,
  size: () => store.size,
  OTP_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
};
