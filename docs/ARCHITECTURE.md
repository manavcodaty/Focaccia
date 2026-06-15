# Focaccia Architecture

## Purpose

Focaccia proves that event entry can bind a one-time signed pass to local face verification without creating a central biometric database. The architecture separates public ticketing, organizer authority, attendee enrollment, offline gate verification, and eventual synchronization.

## Components

| Component | Responsibility |
| --- | --- |
| `apps/tickets` | Listed-event catalogue, attendee signup/login, free checkout, claim-code display, My tickets, cancellation, privacy information |
| `apps/web` | Allowlisted organizer onboarding, owned-event CRUD, ticket types, ticket operations, gate provisioning, activity, revocations, CSV export |
| `apps/enrollment` | Authenticated owned-ticket lookup, consent, local capture/inference, encrypted-template pass issuance, secure pass wallet, regeneration |
| `apps/gate` | Gate provisioning, revocation refresh, offline scan/liveness/match/replay decision, durable signed queue, sync status, gate CSV |
| `packages/shared` | Canonical JSON/base64url, Ed25519/X25519 helpers, cancelable template, pass types, typed network parsing |
| Supabase | Email/password Auth, PostgreSQL/RLS, transactional RPCs, Realtime, Edge Functions, encrypted event-secret storage |

## Trust Boundaries

### Public Browser Boundary

Anonymous users may read listed public events. Checkout, My tickets, cancellation, and profile recovery require an authenticated attendee session. Browser bundles receive only selected public URLs and the Supabase anon key.

### Organizer Boundary

Authentication is not organizer authority. `ensure-organizer` normalizes the authenticated email and checks the server-only `FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST`. Organizer RLS and Edge Functions then require both organizer role and event ownership.

### Enrollment Boundary

Enrollment is an authenticated attendee operation. The backend derives the user ID/email from the access token and verifies that the ticket belongs to that user and event. A claim code can select only an already-owned ticket.

### Gate Boundary

The provisioned gate is trusted to hold event-local private keys and replay state. The complete entry decision happens on-device. Networking is used before/after decisions for revocation refresh and signed synchronization.

### Server Secret Boundary

Service-role credentials, the event-secret wrapping key, organizer allowlist, and claim-code pepper exist only in the generated mode-`0600` function environment. Per-event signing private keys are encrypted before service-role-only database storage.

## Identity And Ticket Model

`organizer_profiles` and `attendee_profiles` are independently owned by `auth.users`. One user may have an attendee profile without organizer authority.

Each event has:

- one owning organizer
- name, description, location, start/end times, capacity, and listed state
- General Admission by default
- zero or more additional active ticket types in GBP
- one active gate device

Paid ticket types remain publicly visible but checkout is rejected while payment is unimplemented.

Database constraints and transactional RPCs enforce:

- one ticket per attendee/event
- event and optional ticket-type capacities without final-seat oversell
- unique claim-code digest
- one active pass per ticket
- unique event/pass and gate check-in identities
- maximum three pass generations
- legal state transitions

```text
claimed -> enrolled -> checked_in
claimed -> cancelled | revoked
enrolled -> cancelled | revoked
enrolled -> claimed only through organizer reset
```

`checked_in`, `cancelled`, and `revoked` are terminal. Cancellation/revocation of an enrolled ticket revokes its active pass. Regeneration revokes the prior pass. Reset revokes the pass, clears `current_pass_id`, resets generation to zero, and returns the ticket to `claimed`.

## Claim Codes And Idempotency

Checkout generates eight random bytes and encodes them as a human-readable ticket claim code. The server stores:

- an encrypted display value for owner recovery
- an HMAC-SHA256 digest using `FOCACCIA_CLAIM_CODE_PEPPER`
- the final four-character hint

Lookup returns non-enumerating `Ticket not found` errors and still requires authenticated ownership.

Mutation requests use a lowercase RFC 4122 UUID v4 `Idempotency-Key`. The server stores actor scope, operation, request hash, state, response/resource information, and timestamps. Reuse with a different request hash is rejected; identical completed work returns the existing result.

## Public And Privileged APIs

Public catalogue:

- `get-public-events`
- `get-public-event`

Authenticated attendee:

- `ensure-attendee`
- `claim-free-ticket`
- `cancel-ticket`
- `list-my-tickets`
- `get-enrollment-bundle`
- `issue-pass`

Organizer and owned event:

- `ensure-organizer`
- `create-event`, `update-event`, `delete-event`
- `manage-ticket-type`
- `organizer-ticket-summaries`
- `reset-attendee-pass`, `revoke-ticket`, `revoke-pass`
- `provision-gate`
- `export-organizer-tickets`

Gate device:

- `get-gate-revocations`
- `record-gate-checkin`

All active functions use schema validation and consistent JSON success/error envelopes. Individual operations enforce role, ownership, rate limits, and idempotency as appropriate.

## Cryptographic Architecture

### Server Pass Signing

Each event has an Ed25519 signing keypair. The public key is distributed to the gate. The private key remains in the server secret boundary and signs canonical pass payload bytes.

### Gate Template Encryption

Provisioning creates an X25519 keypair on the gate. The public key is stored for enrollment. The private key remains in iOS SecureStore. Enrollment seals the cancelable template to this key so a copied QR does not reveal biometric material.

### Gate Synchronization

Provisioning separately creates an Ed25519 synchronization keypair. The public key is stored in `gate_devices`; the private key remains in SecureStore.

Canonical accepted-check-in payload:

```json
{
  "decision": "ACCEPT",
  "event_id": "...",
  "gate_timestamp": "...",
  "idempotency_key": "uuid-v4",
  "nonce": "base64url",
  "pass_id": "..."
}
```

The server verifies signature, active gate/key, event binding, timestamp, nonce, request hash, and idempotency before resolving the ticket from `event_id + pass_id`.

Revocation refresh uses a separately signed canonical request containing event, gate time, idempotency key, key version, and nonce. The server authenticates the gate and returns a versioned snapshot.

## Biometric Pipeline

Both mobile apps use the same FaceNet TFLite model.

```text
temporary capture -> face alignment -> local embedding
-> L2 normalization -> event-scoped signed projection
-> 256-bit cancelable template -> wipe raw values
```

Enrollment encrypts the template; the server never compares biometrics. At the gate, the encrypted template is decrypted locally only after token/event/time/replay/revocation checks and is compared with the locally derived live template using Hamming distance after active liveness.

## Offline Gate Decision

Before doors open, the gate must provision successfully and refresh revocations at least once. Cache age is visible: fresh through 5 minutes, stale through 30 minutes, critical after 30 minutes or when never refreshed.

Offline verification order:

1. token shape and size
2. event and validity window
3. server Ed25519 signature
4. local replay lookup
5. cached revocation lookup
6. X25519 sealed-box decryption
7. active liveness
8. local face-template comparison
9. atomic used-pass marker, accepted log, and signed queue row
10. display `ACCEPT`

Network failure cannot reverse an entry decision. A new remote revocation cannot affect a disconnected gate until refresh.

## Durable Synchronization

Gate SQLite stores the accepted payload, original gate time, nonce, idempotency key, signature, attempt count, next attempt, status, and error code. It contains no biometric or credential fields.

Retry delays are bounded at 5 seconds, 15 seconds, 1 minute, 5 minutes, and 15 minutes with up to 20% jitter. Network, timeout, rate-limit, and server failures retry. Permanent signature/validation failures become blocked until manual Retry. Duplicate receipt is treated as success.

`ticket_activity_log` and `gate_checkins` Realtime changes refresh the organizer dashboard, with a five-second polling fallback. No manual log upload is required.

## Data Storage

Server records include profiles, events, ticket types, tickets, pass metadata/hashes, revocations, gate public keys, nonces, check-ins, idempotency/rate-limit state, and activity logs. RLS separates attendees and organizer-owned events.

The gate stores provisioned public context, private keys in SecureStore, used-pass replay state, cached revocations, non-biometric logs, and sync queue rows. Enrollment stores account-scoped pass tokens and pending idempotent issuance in SecureStore.

Server evidence records are retained indefinitely for the EPQ. Event deletion is soft deletion.

## Network Topologies

### Local

```text
physical device -> Mac LAN IP :3000/:3001/:54331
:54331 constrained proxy -> 127.0.0.1:54321 Supabase
```

No tunnel is needed. PostgreSQL and Studio stay off the LAN.

### Tunnel

```text
HTTPS zrok shares -> host 127.0.0.1:3000/:3001/:54331
:54331 proxy -> host-only Supabase
```

The host Mac must remain active. `apps/tickets` can instead use a separate Vercel deployment with the same exact selected origin. This checkout currently has no zrok/Vercel deployment configured.

## Architecture Invariants

- Authentication does not imply organizer authority.
- Claim-code possession does not imply ticket ownership.
- Paid checkout cannot silently succeed.
- Public/private and local/tunnel origins cannot mix.
- Browser CORS is exact; native no-Origin requests remain supported.
- Raw/reusable biometrics and private keys never enter server logs/CSV/sync rows.
- Gate decisions remain offline; synchronization is eventual.
- Revocations created during disconnection apply after refresh, not instantly.
- Audience-owned iPhone support is conditional on verified Apple distribution.
