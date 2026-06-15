# Assumptions And Current Status

This file records implementation assumptions and externally dependent status as of 2026-06-15.

## Product Scope

- The artifact is iOS-only for enrollment and gate operation.
- There is one active gate device per event and single-entry enforcement per pass.
- Only GBP zero-price ticket types can be checked out. Paid types remain visible but unavailable.
- One authenticated attendee can own at most one ticket per event.
- Ticket states are `claimed`, `enrolled`, `checked_in`, `cancelled`, and `revoked`; `checked_in`, `cancelled`, and `revoked` are terminal.
- Initial issuance is generation 1. A ticket permits at most three pass generations until an organizer reset returns it to `claimed` with generation 0.
- Event deletion is a soft delete and unlists the event; retained evidence rows are not removed.

## Identity And Authority

- Supabase email/password Auth is used with email confirmation disabled for the controlled demonstration.
- Authentication alone does not grant organizer access. `ensure-organizer` checks `FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST`, and organizer operations enforce event ownership.
- Attendee email and user ID come from the authenticated Supabase user. Request bodies do not choose identity.
- A ticket claim code is a recovery/selection aid, not a bearer credential. The signed-in account must own the ticket.

## Biometric And Cryptographic Assumptions

- Enrollment and gate use the same bundled `facenet_512.tflite` model with a `160x160x3` float32 input and 512-float output.
- VisionCamera exposes still captures through temporary file URIs. Source and aligned crop files are deleted in `finally` after inference; this is transient native file backing, not a claim of a purely memory-only camera API.
- Cancelable template indices are encoded big-endian, BLAKE2b uses a 64-byte digest, and bit selection uses the most significant bit of the first digest byte.
- Event signing private keys are encrypted with a runtime wrapping key before service-role-only database storage because local Supabase does not provide the Vault extension used by some hosted deployments.
- The gate X25519 encryption private key and Ed25519 synchronization private key are separate and stored in iOS SecureStore with device-only accessibility.

## Networking

- Local mode needs no tunnel and requires the Mac and physical devices on the same LAN.
- Physical devices use the Mac LAN IPv4, never loopback.
- At-home remote operation needs the host Mac and active zrok HTTPS shares; a separately deployed Vercel ticket app is supported but not linked in this checkout.
- The constrained LAN/tunnel proxy exists because the local Supabase gateway is treated as host-only. PostgreSQL and Studio are never exposed to the LAN or public internet.
- Gate decisions remain offline. Enrollment, ticketing, revocation refresh, and synchronization require the selected backend to be reachable.

## Revocations And Synchronization

- The gate must successfully refresh revocations at least once before the scanner opens.
- Cache state is fresh through 5 minutes, stale after 5 minutes, and critical after 30 minutes or when never refreshed.
- A disconnected gate cannot know about later revocations. Those revocations apply after the next successful refresh.
- Accepted check-ins are persisted with the original gate timestamp and a signed idempotent queue item. Retriable failures use bounded backoff; duplicate server receipt is success.
- Manual file upload is not part of the normal dashboard update path.

## Distribution Status

- Prepared organizer-owned devices are the guaranteed fallback.
- A local Apple Development profile has been generated for the enrollment bundle and a development build was installed on the paired iPhone, but the device owner must explicitly trust that developer profile before first launch.
- EAS reports `Not logged in`; neither mobile app has an EAS project ID in `app.json`.
- No App Store Connect application, external beta review, or installed TestFlight build has been verified.
- TestFlight status is **not configured**. Audience-owned iPhone installation is conditional on verified Apple distribution and must not be promised from simulator/development evidence alone.

## External Service Status

- `zrok2` and `.env.tunnel.local` are absent on the current workstation.
- No Vercel CLI or `.vercel/project.json` link is present.
- Therefore local mode is the currently verified demonstration path; tunnel and Vercel instructions describe implemented configuration paths, not a current deployment claim.

## Retention

- Tickets, passes, revocations, gate check-ins, ticket activity, organizer activity, and non-biometric audit records are retained indefinitely for EPQ evidence unless a future documented deletion procedure is implemented.
- Gate SQLite logs, replay state, revocation cache, and pending/synced queue records persist on the prepared gate device until the local application data is deliberately reset.
- Enrollment passes and pending issuance records are account-scoped in SecureStore. Prepared-device account switching can explicitly remove that attendee's local records.
