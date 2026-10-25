# Asterisk local SIP setup

Mock mode requires no provider, API key, trunk or public number.

For optional local Asterisk:
1. Choose unique passwords ASTERISK_ARI_PASSWORD, SIP_1001_PASSWORD, SIP_1002_PASSWORD in .env.
2. Set ASTERISK_CALLER_ID to an authorized caller ID you control for the test environment.
3. Record real voice prompts and convert to 8 kHz, mono 16-bit WAV. Name them hros_intro_en.wav, hros_role_en.wav and hros_question_en.wav.
4. Put audio in asterisk/sounds so it is mounted into Asterisk. Confirm the sound: prefix path and actual installed sound path agree with the ARI playback URI; adjust dialplan/sound names if necessary.
5. Run docker compose --profile sip up --build -d.
6. Register a local softphone to SIP extension 1001 at 127.0.0.1:5060 with SIP_1001_PASSWORD.
7. Confirm registration: docker compose exec asterisk asterisk -rx "pjsip show contacts".
8. Set TELEPHONY_MODE=asterisk, MOCK_ONLY=true, PUBLIC_CALLING_ENABLED=false in .env and recreate api. Import a consented local test candidate with phone 1001 (validation permits local extensions in asterisk+mock-only mode).
9. Run one local campaign; answer the softphone and press 1 or 2. Inspect API logs and exported XLSX.

ARI connection: internal http://asterisk:8088/ari and an authenticated Stasis websocket. ARI originate endpoint POST /channels with app=hros and endpoint PJSIP/<local-extension>. Up-state ChannelStateChange / StasisStart indicates answered; ChannelDtmfReceived supplies digits. ChannelDestroyed/hangup cause determines un-answered result.

Never report live calls as verified merely because the originate request succeeded. Test real answer, prompt playback, digits, disconnects, cancellation, and call duration on actual registered devices.

Important remaining Asterisk work before production:
- Synchronize all audio playback on PlaybackFinished events, not a 3-second delay.
- Implement websocket reconnect, idempotent event reconciliation and durable recovery of interrupted calls.
- Secure Asterisk with TLS/WSS, firewall ACLs, secret rotation and an approved provider.
- Confirm local audio path (mounted at /var/lib/asterisk/sounds/hros; ARI currently requests sound:hros_intro_en).
- Add safe per-country dial routing, DND and time-of-day policy; do not allow arbitrary E.164 dialling.
- Only set PUBLIC_CALLING_ENABLED=true and MOCK_ONLY=false after legal, security and carrier approval.

The current Asterisk adapter is for development integration and is not a production-certified telephony provider.
