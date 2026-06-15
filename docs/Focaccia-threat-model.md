# Focaccia Threat Model Addendum

This addendum records implementation-specific abuse cases that complement [THREAT_MODEL.md](./THREAT_MODEL.md).

## Verified Abuse Cases

| Abuse case | Implemented response | Evidence |
| --- | --- | --- |
| Attendee attempts organizer onboarding | Server-only allowlist rejects the account | `ensure-organizer`, Phase 2 integration tests |
| Organizer accesses another organizer's event | RLS and ownership checks reject access | Phase 2/4 ownership tests |
| Claim code is foreign, malformed, or terminal | Non-enumerating owner-bound response | enrollment and Edge Function tests |
| Concurrent final-seat claims | Transaction permits at most remaining capacity | Phase 2 concurrency tests |
| Paid ticket checkout | Type remains visible; checkout is blocked | public ticketing tests |
| Duplicate checkout/issuance/check-in | Idempotent replay returns existing result | Phase 2/5/6 tests |
| Fourth pass generation | Server rejects generation above three | issuance tests |
| Regeneration or reset | Prior pass is revoked before replacement/reset | pass-flow tests |
| Oversized/malformed QR | Rejected before expensive decode/crypto | gate offline tests |
| Used pass replay | Atomic local replay marker rejects second use | gate database/offline tests |
| Tampered sync payload/signature | Server rejects signature/request hash | gate sync integration tests |
| Replayed nonce or conflicting idempotency key | Nonce ledger rejects conflict | gate sync tests |
| Stale/wrong-event/unknown gate key | Server rejects request | gate sync tests |
| Offline remote revocation | Documented limitation; applies after refresh | cache-age UI and revocation tests |
| Spreadsheet formula value | Export prefixes dangerous cells | organizer CSV tests |

## Legacy Findings

Earlier prototype audits found anonymous event-wide enrollment capability and query-string capability leakage. The implemented flow no longer authorizes enrollment from an event-wide code. Enrollment requires an authenticated attendee-owned ticket; the optional ticket claim code is sent in a POST body and cannot replace ownership.

Legacy `gate-sync` and `upload-gate-logs` directories remain in the repository for migration compatibility, but the operational flow uses `get-gate-revocations` and `record-gate-checkin`. The dashboard does not require manual log upload.

## Remaining Risks

- A compromised prepared gate device can undermine local keys/state.
- Liveness is suitable for prototype evaluation, not certified production presentation-attack resistance.
- A disconnected gate cannot receive new revocations.
- External tunnel, Vercel, and Apple distribution availability are not currently verified.
- Retained attendee names/emails and exported CSV files require controlled handling.
