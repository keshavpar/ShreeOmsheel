const { sendOtpViaFast2SMS } = require('../utils/fast2sms');
const otpStore = require('../utils/otpStore');

// The patient app sends `phonenumber`; the original /otp callers send `phone`.
// Accept either so both mount points share one handler and one rate-limit key.
const phoneFrom = (req) => {
  const raw = req.body?.phonenumber ?? req.body?.phone;
  return typeof raw === 'string' ? raw.trim() : raw;
};
exports.phoneFrom = phoneFrom;

// POST /send-otp
exports.sendOtp = async (req, res) => {
  try {
    const phone = phoneFrom(req);
    console.log(`[sendOtp] Received request for phone: ${phone}`);

    if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      console.warn(`[sendOtp] Invalid phone number: ${phone}`);
      return res.status(400).json({ status: 'error', message: 'Invalid phone number' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore.set(phone, otp);
    // The OTP itself is deliberately not logged. It was previously written in
    // plaintext to both the console and logs/app.log, which meant anyone with
    // log access could complete a verification without the handset.
    console.log(`[sendOtp] OTP generated for phone: ${phone}`);

    await sendOtpViaFast2SMS(phone, otp);
    console.log(`[sendOtp] OTP sent successfully to ${phone}`);

    return res.status(200).json({ status: 'success', message: 'OTP sent successfully' });

  } catch (err) {
    console.error(`[sendOtp] Error sending OTP to ${phoneFrom(req)}:`, err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to send OTP. Try again.' });
  }
};

// POST /verify-otp
exports.verifyOtp = (req, res) => {
  try {
    const phone = phoneFrom(req);
    const { otp } = req.body;
    console.log(`[verifyOtp] Verifying OTP for phone: ${phone}`);

    if (!phone || !otp) {
      console.warn('[verifyOtp] Missing phone or OTP');
      return res.status(400).json({ status: 'error', message: 'Phone and OTP are required' });
    }

    // Neither the stored nor the submitted OTP is logged — see sendOtp.
    const result = otpStore.verify(phone, otp);

    if (result.ok) {
      console.log(`[verifyOtp] OTP verified successfully for ${phone}`);
      return res.status(200).json({ status: 'success', message: 'OTP verified successfully' });
    }

    if (result.reason === 'too_many_attempts') {
      console.warn(`[verifyOtp] Attempt limit reached for phone: ${phone}`);
      return res.status(429).json({
        status: 'error',
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // 'not_found' and 'expired' intentionally share the response of the
    // original code path, which did not distinguish them either.
    if (result.reason === 'not_found' || result.reason === 'expired') {
      console.warn(`[verifyOtp] OTP not found or expired for phone: ${phone}`);
      return res.status(400).json({ status: 'error', message: 'OTP expired or not found' });
    }

    console.warn(`[verifyOtp] Incorrect OTP for phone: ${phone}`);
    return res.status(400).json({ status: 'error', message: 'Incorrect OTP' });

  } catch (err) {
    console.error(`[verifyOtp] Error verifying OTP for ${phoneFrom(req)}:`, err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to verify OTP' });
  }
};
