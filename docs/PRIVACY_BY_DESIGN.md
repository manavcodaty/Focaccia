# Privacy By Design

## Data-Minimization Boundary

Focaccia does not centrally store raw face images/video, reusable embeddings, cancelable templates, decrypted templates, full signed pass tokens, gate private keys, attendee passwords, or ordinary-row event signing private keys.

The backend does not perform biometric comparison. Enrollment and gate comparison run locally on iOS.

## Enrollment Processing

1. The attendee signs in and proves ownership of the selected ticket.
2. The app presents explicit consent before camera access.
3. VisionCamera captures a temporary local image.
4. The app aligns the face and runs the bundled FaceNet model locally.
5. The embedding is transformed into a 256-bit event-scoped cancelable template.
6. The template is sealed to the gate X25519 public key.
7. Only the encrypted template inside the pass payload is sent for server signing.
8. Temporary source/crop files are deleted in `finally`; embedding/template buffers are wiped after use.

The native camera API is transiently file-backed. The accurate claim is immediate best-effort deletion after inference, not that the camera never creates a temporary file.

## Ticket And Profile Data

Supabase stores the minimum identity and operational data needed for the artifact:

- organizer profile: authenticated user ID and normalized email
- attendee profile: authenticated user ID, normalized email, and full name
- event/ticket/pass state and timestamps
- encrypted claim code, HMAC digest, and four-character hint
- non-biometric activity, revocation, check-in, and idempotency records

Attendee identity is server-derived. Claim-code errors are non-enumerating, and possession of a code does not transfer ticket ownership.

## Gate Data

The gate stores locally:

- public event/signing information
- X25519 and Ed25519 private keys in iOS SecureStore
- used-pass replay records
- the latest revocation cache and refresh timestamp
- non-biometric decision timings/reason codes
- signed accepted-check-in queue items

The synchronization payload contains only `event_id`, `pass_id`, `decision`, original `gate_timestamp`, `nonce`, `idempotency_key`, and signature. Ticket identity is resolved server-side. No face value, access token, password, or private key enters the queue.

## Exports

Organizer ticket CSV contains attendee name/email, ticket type, status, generation, check-in time, and ticket ID. It excludes biometric data, pass tokens, claim codes, authentication credentials, service-role keys, and private keys. Spreadsheet-formula prefixes are neutralized.

Gate evaluation CSV contains non-biometric outcome, reason, timing, and distance metadata. It does not include images, embeddings, decrypted templates, authentication credentials, or private keys.

## Retention And Recovery

Server ticket, pass, revocation, check-in, and audit records are retained indefinitely for EPQ evidence. Event deletion is soft deletion. This retention is explicit in the ticket privacy screen and operations documentation.

Enrollment SecureStore is account-scoped. On a prepared shared device, the account-switch flow can clear the current attendee's locally saved passes and pending issuance before sign-out.

Gate local state persists so replay protection and queued synchronization survive restart. Deliberately clearing app data removes that local evidence and must not occur during an active event/evaluation session.

## Offline Limitation

Offline verification protects availability and data minimization, but it cannot provide instant remote revocation. A gate uses the latest successfully refreshed cache. A cancellation or revocation made while disconnected applies after refresh.

## Model Provenance

- asset: `apps/enrollment/assets/models/facenet_512.tflite`
- reused by enrollment and gate to keep embeddings compatible
- source repository: `shubham0204/OnDevice-Face-Recognition-Android`
- source licence: Apache License 2.0
