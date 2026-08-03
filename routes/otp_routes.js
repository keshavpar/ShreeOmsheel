const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const otpController = require('../controllers/otp_controller');

/**
 * Rate limiting for the OTP endpoints.
 *
 * Every /send-otp call bills Fast2SMS, so before this the endpoint was an
 * uncapped spend channel: unauthenticated, unlimited, and trivial to loop.
 *
 * The primary controls are keyed on the PHONE NUMBER, not the IP, and that is
 * deliberate. `trust proxy` is not configured on this app, so if it sits
 * behind nginx / an ALB then req.ip is the proxy's address and is identical
 * for every real client — an IP-keyed limit would then throttle the whole
 * clinic as a single bucket. Phone-keyed limits are unaffected by that, and
 * they map directly onto the thing being spent: one SMS per number.
 *
 * The IP limit is kept as a deliberately generous backstop against someone
 * cycling through many numbers. It is loose enough not to break a
 * proxy-collapsed deployment.
 *
 * skipFailedRequests means a rejected request (invalid number, Fast2SMS
 * error) does not consume the caller's quota — only requests that actually
 * sent a message count against it.
 */

// Falls back to the IP when no phone is supplied; the controller rejects those
// anyway, but the limiter runs first and still needs a key.
// ipKeyGenerator normalises IPv6 to a /56 subnet so a single client cannot
// sidestep the limit by rotating addresses within its own prefix.
const phoneKey = (req) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  return phone || ipKeyGenerator(req.ip);
};

const tooMany = (message) => (req, res) =>
  res.status(429).json({ status: 'error', message });

// 1. Cooldown — one OTP per number per minute. Stops resend-button hammering.
const otpCooldown = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  keyGenerator: phoneKey,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Please wait a minute before requesting another OTP.'),
});

// 2. Daily cap — bounds total spend per number.
const otpDailyCap = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 5,
  keyGenerator: phoneKey,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Daily OTP limit reached for this number. Please try again tomorrow.'),
});

// 3. Backstop — catches one source cycling through many numbers.
//    Generous on purpose: see the note about `trust proxy` above.
const otpIpBurst = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many OTP requests. Please try again later.'),
});

// Verification is cheap and does not bill, so this only needs to be loose
// enough to blunt scripted guessing. The real defence is the five-attempt
// limit per issued OTP enforced in utils/otpStore.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many verification attempts. Please try again later.'),
});

router.post('/send-otp', otpCooldown, otpDailyCap, otpIpBurst, otpController.sendOtp);
router.post('/verify-otp', verifyLimiter, otpController.verifyOtp);

module.exports = router;
