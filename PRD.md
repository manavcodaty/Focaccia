# Focaccia Product Requirements

## Goal

Deliver a complete AQA EPQ artifact where a real attendee can discover a listed event, claim a free ticket, enroll locally on iOS, receive a signed encrypted pass, and be admitted by an offline gate without central biometric storage.

## Actors

- Attendee: public browsing, account, ticket, enrollment, pass, cancellation
- Organizer: allowlisted onboarding and owned-event administration
- Door staff: prepared gate provisioning, pre-door refresh, offline verification, sync monitoring

## Functional Requirements

### Ticketing

- listed public event catalogue/detail
- email/password attendee signup/login
- trusted profile name/email
- GBP ticket display
- free checkout only; paid visible but unavailable
- one ticket per attendee/event
- global and optional type capacity without oversell
- confirmation, claim code, My tickets, detail, cancellation, cross-device login recovery

### Organizer

- server-only allowlist onboarding
- role and event ownership enforcement
- event create/edit/soft-delete/list toggle
- default General Admission and additional ticket types
- lifecycle/capacity/status/gate/sync totals
- search/filter, ticket table, activity, revocations
- reset/revoke with confirmation and audit
- sensitive-field-safe CSV

### Enrollment

- authenticated owned-ticket list and claim-code selection
- consent and camera permission
- local capture, FaceNet inference, cancelable template
- encryption to gate and server-signed issuance
- account-scoped secure pass/pending state
- generation allowance, idempotent issuance, regeneration, reset reconciliation
- prepared shared-device switching

### Gate

- separate encryption and sync keys during provisioning
- SecureStore private keys and SQLite operational state
- mandatory revocation refresh and visible age
- complete offline signature/event/time/replay/revocation/liveness/match decision
- typed/paste signed-token fallback
- atomic acceptance plus durable signed queue
- bounded retries, manual Retry, duplicate-as-success
- automatic dashboard update and local CSV

## Security And Privacy Requirements

- no central raw image/video, reusable embedding, template, decrypted template, full pass token, gate private key, or password
- server-derived attendee identity
- organizer allowlist plus ownership
- schema validation, exact CORS, rate limits, non-enumerating code errors
- UUID-v4 idempotency and request-hash conflict detection
- Ed25519 pass signatures, X25519 sealed templates, separate Ed25519 gate sync
- no service-role/organizer token in autonomous gate queue

## Network Requirements

- exactly local or tunnel mode
- local needs no tunnel and uses Mac LAN IP
- constrained proxy; no LAN/public PostgreSQL or Studio
- tunnel requires HTTPS zrok and host Mac
- optional separate Vercel ticket deployment
- exact Auth redirects/CORS and native no-Origin support
- mode changes require Metro restart; native config changes require rebuild

## State And Retention

- ticket states and generation rules follow `docs/TRUTH_BASE.md`
- disconnected remote revocations apply after refresh
- server evidence retained indefinitely for EPQ
- gate replay/cache/log/queue survives restart

## Distribution

- prepared devices guaranteed
- audience-owned iPhones conditional on verified Apple distribution
- current TestFlight status: not configured

## Acceptance

Acceptance evidence is defined in `docs/EVALUATION_PLAN.md` and operational steps in `docs/EPQ_OPERATIONS_MANUAL.md`. No mode/device/distribution path is considered available without objective verification.
