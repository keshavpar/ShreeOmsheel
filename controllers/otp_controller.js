const { sendOtpViaFast2SMS } = require('../utils/fast2sms');

const otpStore = new Map(); // Use Redis in production

// POST /send-otp
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    console.log(`[sendOtp] Received request for phone: ${phone}`);

    if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      console.warn(`[sendOtp] Invalid phone number: ${phone}`);
      return res.status(400).json({ status: 'error', message: 'Invalid phone number' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore.set(phone, otp);
    console.log(`[sendOtp] Generated OTP: ${otp} for phone: ${phone}`);

    await sendOtpViaFast2SMS(phone, otp);
    console.log(`[sendOtp] OTP sent successfully to ${phone}`);

    return res.status(200).json({ status: 'success', message: 'OTP sent successfully' });

  } catch (err) {
    console.error(`[sendOtp] Error sending OTP to ${req.body.phone}:`, err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to send OTP. Try again.' });
  }
};

// POST /verify-otp
exports.verifyOtp = (req, res) => {
  try {
    const { phone, otp } = req.body;
    console.log(`[verifyOtp] Verifying OTP for phone: ${phone}`);

    if (!phone || !otp) {
      console.warn('[verifyOtp] Missing phone or OTP');
      return res.status(400).json({ status: 'error', message: 'Phone and OTP are required' });
    }

    if (!otpStore.has(phone)) {
      console.warn(`[verifyOtp] OTP not found or expired for phone: ${phone}`);
      return res.status(400).json({ status: 'error', message: 'OTP expired or not found' });
    }

    const storedOtp = otpStore.get(phone);
    console.log(`[verifyOtp] Stored OTP: ${storedOtp}, Received OTP: ${otp}`);

    if (parseInt(otp) === storedOtp) {
      otpStore.delete(phone);
      console.log(`[verifyOtp] OTP verified successfully for ${phone}`);
      return res.status(200).json({ status: 'success', message: 'OTP verified successfully' });
    } else {
      console.warn(`[verifyOtp] Incorrect OTP for phone: ${phone}`);
      return res.status(400).json({ status: 'error', message: 'Incorrect OTP' });
    }

  } catch (err) {
    console.error(`[verifyOtp] Error verifying OTP for ${req.body.phone}:`, err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to verify OTP' });
  }
};
