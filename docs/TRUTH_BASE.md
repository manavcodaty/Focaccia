# Focaccia Truth Base

This document is the concise source of truth for implemented behavior. Historical phase plans and audit reports may describe earlier states; they are not current operating instructions.

## Product

- Four apps: public tickets, organizer dashboard, attendee enrollment, offline gate.
- Supabase email/password Auth with confirmation disabled for the controlled EPQ deployment.
- Organizer access requires a server-only allowlist plus event ownership.
- Public users see listed events. Authenticated attendees can claim one real free ticket per event.
- Paid ticket types are visible but blocked.
- Claim codes are ticket-scoped selectors/recovery values; ownership is mandatory.

## Ticket And Pass State

```text
claimed -> enrolled -> checked_in
claimed|enrolled -> cancelled|revoked
enrolled -> claimed only by organizer reset
```

- `checked_in`, `cancelled`, and `revoked` are terminal.
- Event/type capacity is enforced transactionally.
- Initial pass generation is 1; maximum is 3 per reset cycle.
- Regeneration, cancellation, revocation, and reset revoke the previous active pass where applicable.

## Privacy And Crypto

- No central raw face image/video, reusable embedding, cancelable template, decrypted template, full pass token, gate private key, or attendee password.
- Face processing and comparison occur on iOS.
- Pass signatures: Ed25519 server key per event.
- Encrypted template: X25519 sealed box to the gate.
- Gate synchronization: separate Ed25519 keypair generated during provisioning.
- Canonical JSON and base64url are used for signed values.

## Gate

- One active gate per event.
- Mandatory successful revocation refresh before opening scanner.
- Cache fresh <=5 minutes, stale <=30, critical >30 or never refreshed.
- Complete entry decision is offline.
- Acceptance atomically marks replay state, logs, and queues a signed check-in.
- Queue survives restart and retries with bounded backoff.
- A remote revocation made during disconnection applies after refresh.

## Networking

- Exactly `FOCACCIA_NETWORK_MODE=local|tunnel`.
- Local mode needs no tunnel; physical devices use Mac LAN IP.
- Local web/tickets bind `0.0.0.0`; constrained Supabase proxy uses `LAN_IP:54331`.
- PostgreSQL and Studio are not exposed.
- Tunnel mode requires HTTPS zrok shares and the active host Mac.
- Ticket web may use Vercel, but no Vercel/tunnel deployment is currently configured.
- Auth redirects and CORS use exact selected organizer/ticket origins; native no-Origin requests are supported.

## Distribution

- Prepared organizer-owned devices are the guaranteed path.
- EAS/TestFlight are not configured.
- Audience-owned iPhone installation is conditional on verified Apple distribution.

## Retention

- Ticket/pass/revocation/check-in/audit evidence is retained indefinitely for the EPQ.
- Gate local replay/cache/log/queue state persists until deliberate app-data reset.
- Enrollment local pass/pending state is account-scoped and can be cleared during prepared-device switching.
