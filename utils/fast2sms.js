

// utils/fast2sms.js

const axios = require('axios');
exports.sendOtpViaFast2SMS = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  const payload = {
    sender_id: 'FSTSMS',
    message: `Your OTP is ${otp}`,
    language: 'english',
    route: 'otp',
    numbers: phone,
  };

  const headers = {
    authorization: apiKey,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, { headers });
    console.log(`[Fast2SMS] Response:`, response.data);
  } catch (error) {
    console.error('[Fast2SMS] Error:', error.response?.data || error.message);
    throw error;
  }
};


