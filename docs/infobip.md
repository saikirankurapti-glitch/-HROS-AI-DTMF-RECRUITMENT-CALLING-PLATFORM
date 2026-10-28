# Infobip Calls API integration

HROS supports Infobip Calls API as an opt-in provider. Mock remains the default. Use this adapter only for a single, consented test before any rollout.

## Required Infobip setup

1. In Infobip, create a Calls configuration with ID matching `INFOBIP_CALLS_CONFIGURATION_ID` (the existing test ID can be used).
2. Create an event subscription for channel `VOICE_VIDEO`, scoped by that calls configuration ID. Include at least `CALL_ESTABLISHED`, `CALL_FAILED`, `CALL_FINISHED`, `SAY_FINISHED`, and `DTMF_COLLECTED`.
3. Configure its notification profile to send events to the public HTTPS URL `https://YOUR-HROS-HOST/api/telephony/infobip/events`. A localhost URL is not reachable by Infobip; use an HTTPS deployment or secure temporary tunnel for development.
4. Configure HTTP Basic authentication for the notification profile using `INFOBIP_WEBHOOK_USERNAME` and `INFOBIP_WEBHOOK_PASSWORD`. Do not reuse the Infobip API key.
5. Associate the subscription with the Calls configuration. The Infobip console should no longer show zero subscription associations.
6. Confirm Calls API outbound traffic and the India route/caller-ID are enabled for your account. Some routes require an Infobip-leased or otherwise authorized voice number.

## Test the trial's Voice Messaging API separately

The onboarding page's `/tts/3/advanced` example sends a one-way text-to-speech voice message. It is **not** the interactive Calls API used by the HROS recruitment call flow.

1. Revoke any API key that was pasted into a chat, ticket, or other shared place, then create a replacement in Infobip. Store it only in your local `.env`.
2. Verify your own recipient number in Infobip.
3. Set these local environment variables using a sender value that Infobip explicitly authorizes for your account. Do not assume the example sender in the portal is assigned to your account:
   - `INFOBIP_API_KEY`
   - `INFOBIP_TEST_TO` (your verified phone number, digits only, including country code)
   - `INFOBIP_TEST_FROM` (authorized sender value from your account)
   - Optional: `INFOBIP_BASE_URL` and `INFOBIP_LANGUAGE`
4. From the repository root, run with Node.js 22+:
   ```powershell
   node --env-file=.env scripts/infobip-voice-message-test.mjs
   ```
5. An HTTP success means the request was accepted, not necessarily delivered. Check Infobip Logs for the final message status. The script exits nonzero for HTTP errors.

The script never embeds API credentials or a recipient number in source control. Use only your own verified number for this test. This test consumes a trial voice message/call allowance and does not verify Calls API configuration, event webhooks, or DTMF handling.

## Server environment

Set these on the server only; never put API keys in the browser or commit them:

- `TELEPHONY_MODE=infobip`
- `INFOBIP_BASE_URL=https://ndlev2.api.infobip.com` (use the exact API base URL displayed in your Infobip account)
- `INFOBIP_API_KEY`
- `INFOBIP_CALLS_CONFIGURATION_ID=hros-outbound-test-01`
- `INFOBIP_FROM_NUMBER` only if Infobip provides an authorized caller ID for the route
- `INFOBIP_WEBHOOK_USERNAME` and `INFOBIP_WEBHOOK_PASSWORD`
- `PUBLIC_CALLING_ENABLED=true` and `MOCK_ONLY=false` only for the explicitly authorized test

Keep concurrency at 1. Import only your own verified phone as the test candidate, record your explicit consent, and set the campaign retry limit to 0. Existing consent and opt-out checks remain in force. The provider rejects public calls unless both server-side safety gates are explicitly enabled.

## Test sequence

1. Configure the public HTTPS webhook and subscription first.
2. Start HROS and confirm `GET /health` reports `mode: infobip`.
3. Import one candidate using your own verified E.164 number, with consent explicitly checked and role matching the test campaign.
4. Create a campaign with retry limit 0, verify exactly one candidate is assigned, and start it once.
5. Confirm the mobile rings, answer, listen to the AI-disclosed prompt, press 1 or 2, and verify the call status and DTMF result in HROS and Infobip Logs.
6. If actions time out, check subscription association, webhook reachability/authentication, event types, API base URL, and Infobip route/account permissions.

## Limits

- CI can verify adapter request payloads and event handling, but cannot prove a live carrier call. A live test requires the account API key, account eligibility, public HTTPS webhook and authorized route/caller ID.
- This is text-to-speech + DTMF, not a streaming conversational AI agent. Real-time spoken answers require separate speech capture/transcription or WebSocket media streaming work and account enablement.
- Never use this for unsolicited recruitment calls; document consent, respect opt-outs, and follow applicable Indian telecom rules.
