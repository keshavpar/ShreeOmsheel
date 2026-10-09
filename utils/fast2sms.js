// utils/fast2sms.js

const axios = require('axios');

/**
 * Send an OTP through Fast2SMS's OTP route.
 *
 * route=otp fills `variables_values` into Fast2SMS's pre-approved DLT template
 * ("Your OTP is {#var#}..."); it ignores free-text `message`/`sender_id`, which
 * is what this used to send. The key goes in the `authorization` header rather
 * than the query string so it never lands in proxy or access logs.
 *
 * Fast2SMS can answer HTTP 200 with `return: false` on failure, so the body is
 * checked as well as the status.
 */
exports.sendOtpViaFast2SMS = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) throw new Error('FAST2SMS_API_KEY is not set');

  const payload = {
    route: 'otp',
    variables_values: String(otp),
    flash: 0,
    numbers: phone,
  };

  const headers = {
    authorization: apiKey,
    'Content-Type': 'application/json',
    'cache-control': 'no-cache',
  };

  try {
    const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, { headers });
    console.log(`[Fast2SMS] Response:`, response.data);
    if (!response.data?.return) {
      throw new Error(`Fast2SMS rejected send: ${JSON.stringify(response.data?.message)}`);
    }
  } catch (error) {
    console.error('[Fast2SMS] Error:', error.response?.data || error.message);
    throw error;
  }
};
