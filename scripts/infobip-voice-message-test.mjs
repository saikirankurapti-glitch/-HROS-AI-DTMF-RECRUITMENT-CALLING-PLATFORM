/**
 * Sends one Infobip text-to-speech test message.
 *
 * Run with Node.js 22+:
 *   node --env-file=.env scripts/infobip-voice-message-test.mjs
 *
 * Configure INFOBIP_API_KEY, INFOBIP_TEST_TO, and INFOBIP_TEST_FROM in your
 * local .env file. The sender must be authorized by your Infobip account.
 */
const baseUrl = (process.env.INFOBIP_BASE_URL || 'https://ndlev2.api.infobip.com').replace(/\/+$/, '');
const apiKey = process.env.INFOBIP_API_KEY?.trim();
const recipient = process.env.INFOBIP_TEST_TO?.replace(/\D/g, '');
const sender = process.env.INFOBIP_TEST_FROM?.trim();
const language = process.env.INFOBIP_LANGUAGE || 'en';

if (!apiKey) throw new Error('Missing INFOBIP_API_KEY in local environment');
if (!recipient || recipient.length < 8 || recipient.length > 15) {
  throw new Error('Set INFOBIP_TEST_TO to your own verified number in international format, digits only (country code included)');
}
if (!sender) throw new Error('Set INFOBIP_TEST_FROM to a sender value authorized by your Infobip account');

const response = await fetch(`${baseUrl}/tts/3/advanced`, {
  method: 'POST',
  headers: {
    Authorization: `App ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({
    messages: [{
      destinations: [{ to: recipient }],
      from: sender,
      language,
      text: 'This is a test voice message for the HROS recruitment platform.',
      voice: { name: 'Joanna', gender: 'female' },
    }],
  }),
});

const responseText = await response.text();
let responseBody;
try {
  responseBody = responseText ? JSON.parse(responseText) : {};
} catch {
  responseBody = { message: responseText.slice(0, 1000) };
}

console.log('Infobip HTTP status:', response.status);
console.log('Infobip response:', JSON.stringify(responseBody, null, 2));

if (!response.ok) {
  process.exitCode = 1;
} else {
  console.log('Request accepted by Infobip. Check Infobip Logs for final delivery status.');
}
