# EPQ Artifact Report: Focaccia

## Project Aim

Focaccia investigates whether event entry can use face verification without building a central database of face images or reusable embeddings. The artifact combines real ticketing, on-device enrollment, a signed encrypted pass, offline gate verification, and eventual operational synchronization.

## Implemented Artifact

The repository contains:

- a public ticket website for listed events, attendee accounts, free checkout, confirmation, My tickets, cancellation, and recovery
- an organizer dashboard protected by an email allowlist, role checks, and event ownership
- an iOS enrollment app for owned-ticket selection, consent, local face processing, pass issuance, regeneration, and secure display
- an iOS gate app for provisioning, mandatory revocation refresh, offline verification, replay prevention, local liveness/matching, durable queueing, and signed synchronization
- Supabase migrations/RLS/Edge Functions for roles, events, capacities, ticket/pass state, audit, revocations, gate devices, nonces, and check-ins

## User Journey

1. An allowlisted organizer creates and lists an event with General Admission and optional ticket types.
2. A gate device is provisioned. It creates separate encryption and synchronization keypairs and retains both private keys locally.
3. An attendee browses the public website, creates an account, and checks out a real free ticket.
4. The attendee receives a ticket-scoped claim code and can recover the ticket by signing in on another device.
5. The attendee signs into the enrollment app with the same account and selects the owned ticket, optionally using its claim code as a selector.
6. After consent, the app captures and processes the face locally, creates an event-scoped cancelable template, encrypts it to the gate, and requests a server-signed pass.
7. The gate refreshes revocations before doors open and can then disconnect.
8. The gate verifies signature, event/time, replay, cached revocation, liveness, and face match locally.
9. An accepted decision is atomically recorded and queued with its original gate time.
10. When connectivity returns, the signed queue synchronizes and the organizer dashboard updates automatically.

## Design Decisions

### Identity And Authorization

Supabase Auth provides email/password identity. Attendee profiles derive email/user ID from Auth. Organizer authority requires a server-only allowlisted email and event ownership. This prevents an authenticated attendee from becoming an organizer by client request.

### Ticketing

Events have global capacity; ticket types may have optional capacity. Checkout is transactional and one attendee can hold one ticket per event. Paid types are shown but blocked. UUID-v4 idempotency keys prevent duplicate tickets, passes, resets, cancellations, and check-ins.

Ticket lifecycle:

```text
claimed -> enrolled -> checked_in
claimed|enrolled -> cancelled|revoked
enrolled -> claimed only through organizer reset
```

### Privacy-Preserving Biometric Flow

Face detection, alignment, embedding, cancelable transformation, liveness, and comparison occur on iOS. Supabase never receives a raw face image, reusable embedding, cancelable template, decrypted template, or full pass token. The encrypted template is useful only to the provisioned gate.

### Offline Security

The gate verifies the server Ed25519 signature and decrypts with its X25519 private key. It checks replay and the last downloaded revocation cache in SQLite. This provides offline availability but creates a deliberate limitation: a remote revocation created during disconnection applies only after refresh.

### Signed Synchronization

The gate has a separate Ed25519 sync key. Accepted check-ins use canonical signed payloads with event, pass, decision, original gate time, nonce, and idempotency key. The server validates them and derives the ticket; the gate does not carry a service-role or organizer credential in the queue.

## Network Modes

### Local

Local mode needs no tunnel. The host Mac runs Supabase, Edge Functions, organizer web, ticket web, and a constrained LAN proxy. Physical devices use the Mac LAN IP. PostgreSQL and Studio are not exposed.

### Tunnel

At-home mode needs the active host Mac and reserved zrok HTTPS shares. The ticket website may alternatively run on Vercel with identical selected public configuration. The current workstation has no zrok, tunnel env, Vercel link, or verified remote deployment.

## Operations And Evidence

The organizer dashboard exposes event lifecycle, capacity, claimed/enrolled/checked-in/cancelled/revoked totals, gate state, last seen/sync context, ticket generation/pass status, activity, revocations, reset/revoke controls, and CSV export.

Organizer CSV includes attendee name/email, type, status, generation, check-in time, and ticket ID. Gate CSV contains non-biometric outcome/reason/timing evidence. Neither export contains biometric values, credentials, tokens, or private keys.

The complete evidence checklist is maintained in [EVALUATION_PLAN.md](./EVALUATION_PLAN.md), and the demonstration runbook is [EPQ_OPERATIONS_MANUAL.md](./EPQ_OPERATIONS_MANUAL.md).

## Evaluation Against Success Criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| Real listed-event browsing and free checkout | Implemented and automated-test verified | `apps/tickets`, Phase 3 tests |
| Organizer role/ownership separation | Implemented and integration-test verified | Phase 2/4 tests |
| No central biometric storage/comparison | Implemented and source/schema verified | privacy document, mobile tests |
| Signed encrypted event pass | Implemented and crypto regression tested | shared/pass-flow tests |
| Offline valid acceptance | Implemented and headless/simulator verified | gate offline tests |
| Replay rejection survives restart | Implemented and tested | gate database/offline tests |
| Signed durable queued sync | Implemented and tested | gate sync tests |
| Dashboard automatic update | Implemented and integration/source verified | Realtime/polling dashboard code |
| Reset/revocation consequences | Implemented and integration tested | Phase 2/4/5 tests |
| Local LAN mode | Verified | network verifier and simulator/browser evidence |
| Tunnel/Vercel mode | Implemented configuration, not currently configured | explicit limitation |
| Audience-owned iPhone/TestFlight | Not configured | explicit Apple-distribution limitation |

## Limitations

- Revocations are not instant while a gate is disconnected.
- Active liveness is prototype-grade, not a certified commercial PAD system.
- Temporary captures are native file-backed before immediate deletion.
- A compromised prepared gate device can undermine local trust.
- Tunnel/Vercel availability depends on external configuration and the host Mac.
- TestFlight and arbitrary audience-owned iPhone installation are not configured.
- Server and local evidence records are retained indefinitely for the EPQ and therefore require controlled handling.

## Ethical Reflection

The design avoids central biometric retention and makes biometric use explicit through consent. It still processes sensitive characteristics and must use voluntary participants, prepared fallback access, restricted evidence storage, and honest communication about false rejection, liveness strength, offline revocation delay, and distribution limits.

## Conclusion

Focaccia demonstrates a complete privacy-oriented event-entry workflow rather than an isolated face-recognition demo. Its central result is that ticket authority and server signing can be combined with event-scoped encrypted templates and an offline gate, while keeping reusable biometric data out of the backend. The remaining limitations are documented rather than hidden.
