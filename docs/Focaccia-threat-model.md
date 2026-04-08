# Focaccia Threat Model Addendum

Audit date: 2026-04-08

This addendum records the trust boundaries and abuse paths validated during the April 2026 security audit.

## Assets

- Organizer accounts and event ownership
- Event-scoped signing keys and queue-code secrets
- Event salts and gate public keys
- Gate private keys stored on-device
- Enrollment-captured images, crops, embeddings, and cancelable templates
- Signed QR payloads and replay ledger state

## Trust Boundaries

1. Browser organizer session vs SSR cookies
2. Anonymous attendee enrollment API vs organizer-only APIs
3. Enrollment device memory and temp file system
4. Gate device local SQLite and secure storage
5. Supabase public tables protected by RLS
6. Supabase edge secret store protected by service-role only access

## Abuse Paths Reviewed

### AP-1: Anonymous pass issuance without enrollment proof

- Status before audit:
  `issue-pass` trusted `event_id` alone.
- Status after audit:
  `issue-pass` now requires `join_code` and matches both `event_id` and `join_code`.

### AP-2: Query-string leakage of enrollment capability

- Status before audit:
  `get-enrollment-bundle` accepted `GET` with `join_code` in the URL.
- Status after audit:
  POST-only body transport.

### AP-3: Secret/config detail leakage through edge-function failures

- Status before audit:
  Raw env and secret-store messages could be reflected to clients.
- Status after audit:
  Hidden internal errors log server-side while clients receive generic responses.

### AP-4: Biometric artifact retention on mobile devices

- Status before audit:
  Exceptional paths could leave aligned crop files on disk.
- Status after audit:
  Both source and aligned temp files are deleted in `finally`, and raw tensor buffers are zeroed.

### AP-5: Replay ledger ambiguity in local gate persistence

- Status before audit:
  `used_passes` used a single-column key and `insert or replace`.
- Status after audit:
  Composite `(event_id, pass_id)` key plus `insert or ignore`, with duplicate inserts mapped to `REPLAY_USED`.

### AP-6: Oversized offline token abuse

- Status before audit:
  Malformed payloads were rejected, but there was no explicit pre-decode length cap.
- Status after audit:
  Tokens larger than the configured ceiling are rejected as `BAD_TOKEN`.

## Residual Risks

- Device compromise remains the highest-impact residual risk.
- Offline gate trust still depends on the integrity of the deployed gate app and device controls.
- Presentation-attack resistance remains prototype-grade rather than enterprise-grade.
