# Focaccia Threat Model

## Scope And Assets

This model covers public ticketing, organizer administration, attendee enrollment, offline gate verification, revocation refresh, and signed check-in synchronization.

Protected assets include:

- organizer/attendee accounts and event ownership
- tickets, claim codes, passes, check-ins, and audit evidence
- event signing private keys and wrapping key
- gate X25519 and Ed25519 private keys
- face captures, embeddings, cancelable templates, and encrypted pass templates
- gate replay/revocation state and synchronization queue
- exact network origins and server-only credentials

## Trust Boundaries

1. Anonymous browser to public catalogue
2. Authenticated attendee to owned ticket/pass operations
3. Authenticated organizer to allowlist and owned-event operations
4. Public clients to Supabase Auth/Edge Functions through exact CORS
5. Enrollment device temporary camera/memory boundary
6. Gate SecureStore/SQLite/offline verifier boundary
7. Edge Functions to service-role data and encrypted event secrets
8. Gate signed synchronization to the server

## Threats And Controls

### T1: Unauthorized Organizer Access

Risk: an ordinary authenticated attendee attempts event administration or access to another organizer's data.

Controls:

- server-only exact email allowlist in `ensure-organizer`
- separate organizer profile
- organizer check plus event ownership in Edge Functions/RLS
- no allowlist value in public bundles, logs, or responses
- audited organizer mutations

Residual risk: compromise of an allowlisted organizer account grants that account's owned-event authority.

### T2: Ticket Theft Or Claim-Code Brute Force

Risk: an attacker uses a leaked/guessed code to enroll or recover another attendee's pass.

Controls:

- 64 bits of random claim-code input
- HMAC-SHA256 digest with server-only pepper and encrypted display value
- non-enumerating errors and rate-limited lookup
- authenticated ownership is mandatory even with a valid code
- four active tickets per attendee/event

Residual risk: an attacker controlling the attendee account can use its tickets.

### T3: Capacity Oversell Or Duplicate Mutations

Risk: concurrent checkout oversells an event/type, or retries create duplicate tickets/passes/check-ins.

Controls:

- transactional PostgreSQL capacity checks/locks
- event and ticket-type capacity constraints
- unique attendee/event ticket identity
- UUID-v4 idempotency keys bound to canonical request hashes
- unique active pass, ticket generation, event/pass, nonce, and check-in identities

Residual risk: denial of service can delay legitimate requests without violating capacity.

### T4: Central Biometric Theft

Risk: backend/database compromise exposes reusable face data.

Controls:

- local capture, inference, template generation, liveness, and comparison
- no central image, embedding, reusable template, or decrypted template storage
- cancelable event-scoped template
- X25519 sealed-box encryption to the gate public key
- temporary files deleted and sensitive buffers wiped

Residual risk: a compromised enrollment/gate device can access values during active processing.

### T5: Stolen Or Copied Pass

Risk: a screenshot/copy is presented by another person.

Controls:

- canonical server Ed25519 signature
- event and validity binding
- encrypted template readable only by the provisioned gate
- active liveness and local face match
- single-entry replay marker

Residual risk: prototype-grade liveness can be weaker than commercial presentation-attack detection.

### T6: Replay After Entry

Risk: an accepted pass is used again, including while offline.

Controls:

- composite `(event_id, pass_id)` SQLite replay key
- atomic used-pass insertion before accepted sync
- database unique gate check-in identity
- server idempotency treats duplicate receipt as success

Residual risk: deleting/corrupting gate app data removes local replay evidence; prepared-device controls are required.

### T7: Gate Tampering Or Key Theft

Risk: an attacker extracts private keys, alters cached state, or fabricates check-ins.

Controls:

- separate X25519 and Ed25519 private keys in device-only SecureStore
- only public keys stored server-side
- signed canonical check-in/refresh requests
- server validation of key, event, timestamp, nonce, idempotency, and request hash
- no service-role credential or organizer token in autonomous queue rows

Residual risk: a fully compromised unlocked gate device remains a high-impact threat.

### T8: Synchronization Tampering Or Replay

Risk: queued check-ins are modified, replayed, or assigned to the wrong event.

Controls:

- Ed25519 detached signature over canonical payload
- event-bound active public key
- five-minute server freshness check and provisioned-at bound
- nonce ledger and idempotency conflict detection
- server resolves ticket ID from event/pass
- permanent validation failures blocked rather than retried forever

Residual risk: synchronization availability depends on the selected backend, but offline decisions do not.

### T9: Stale Revocation Cache

Risk: a pass revoked after the last refresh is accepted while the gate is disconnected.

Controls:

- mandatory successful refresh before scanner opening
- visible age and fresh/stale/critical states
- automatic refresh while online
- clear operator warning and runbook
- eventual application after connectivity returns

Residual risk: this limitation is fundamental. There is no instant remote revocation for a disconnected gate.

### T10: Network Exposure Or Origin Confusion

Risk: server secrets leak, clients mix local/tunnel URLs, or LAN services expose PostgreSQL/Studio.

Controls:

- typed explicit `local|tunnel` parsing and fail-fast URL validation
- loopback rejection for physical local selection
- HTTPS required for tunnel mode
- constrained proxy and hidden database/Studio ports
- exact Auth redirects and browser CORS; native no-Origin support
- no mode fallback or URL inference

Residual risk: tunnel/host outages stop online ticketing/enrollment/refresh/sync until recovery.

### T11: CSV Formula Or Sensitive-Field Leakage

Risk: exported data executes spreadsheet formulas or includes credentials/biometrics.

Controls:

- fixed organizer CSV fields
- spreadsheet formula prefix neutralization
- no claim code, token, biometric, credential, or private-key fields
- audited/rate-limited export

Residual risk: attendee names/emails are personal data and exports must be handled as evidence with restricted access.

### T12: Distribution Misrepresentation

Risk: simulator/development success is presented as arbitrary audience-owned iPhone support.

Controls:

- prepared devices are the guaranteed fallback
- explicit EAS/TestFlight status
- audience-owned installation claimed only after Apple credentials, App Store Connect, distribution, and any external beta review are verified

Current residual status: TestFlight is not configured.

## Security Conclusions

Focaccia's strongest properties are server-derived authority, transactional ticket/pass state, no central biometric comparison, encrypted event-scoped templates, and offline replay-aware gate decisions. The principal residual risks are device compromise, prototype liveness strength, personal-data handling in evidence exports, service availability for online stages, and unavoidable revocation staleness while disconnected.
