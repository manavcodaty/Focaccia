# Evaluation Plan And EPQ Evidence Checklist

## Purpose

Evaluation must demonstrate the complete real workflow, privacy boundary, security failures, offline behavior, and operational limitations. A screenshot alone is insufficient where a database state, retry, or second-device behavior is the claim.

## Controlled Environments

### Local Classroom

- host Mac and physical devices on the same Wi-Fi
- `FOCACCIA_NETWORK_MODE=local`
- every zrok process stopped
- devices use Mac LAN IP
- `pnpm verify:local-network` passes

### Tunnel / Remote

- host Mac remains active
- `FOCACCIA_NETWORK_MODE=tunnel`
- three active HTTPS zrok shares or Vercel tickets plus zrok API/web
- exact Auth/CORS origins
- `pnpm verify:tunnel-network` passes without an interstitial

Current evidence status: local mode is verified; tunnel/Vercel are not configured on this workstation and must be recorded as a limitation until rerun.

## Evidence Checklist

| Evidence item | Screen/function/command | Objective pass evidence |
| --- | --- | --- |
| Event creation | web `/events/new`, `create-event` | event row, General Admission, organizer activity |
| Public listing | tickets `/` and `/events/[eventId]`, `get-public-events` | listed event visible; unlisted absent |
| Attendee Auth | tickets signup/login, Supabase Auth | session persists; identity matches profile |
| Free checkout | event detail, `claim-free-ticket` | GBP 0 confirmation, one ticket, claim code |
| Capacity/idempotency | checkout tests/Phase 2 | final-seat race cannot oversell; replay no duplicate |
| My tickets recovery | tickets `/tickets` and detail | ticket recovered on second browser after login |
| Enrollment ownership | enrollment My tickets/claim code, `get-enrollment-bundle` | foreign code rejected; owned ticket selected |
| Consent/local processing | enrollment consent/capture | consent screen plus no central biometric row/log |
| Pass issuance | `issue-pass`, pass screen | generation 1 signed pass and secure local record |
| Regeneration limit | enrollment pass flow | generations 1-3; fourth rejected; old pass revoked |
| Offline acceptance | gate scanner/result with networking disabled | valid pass accepted without network |
| Replay rejection | second scan of accepted pass | local `REPLAY_USED` rejection |
| Revocation cache | gate status/settings | refresh timestamp, fresh/stale/critical warning |
| Queued sync | gate status and SQLite tests | pending accepted item survives restart with original time |
| Signed synchronization | `record-gate-checkin` | valid accepted; tamper/replay/stale/wrong event rejected |
| Dashboard update | web event workspace | checked-in status/count updates without file upload |
| Reset/revocation | organizer ticket actions | old pass revoked; reset returns ticket to claimed/0 |
| Offline revocation limitation | disconnected gate then refresh | newly revoked pass may use old cache, then rejects after refresh |
| Organizer CSV | event export | expected seven columns; no sensitive field |
| Gate CSV | gate Export | non-biometric reason/timing evidence |
| Local verification | `verify:network-config`, `verify:local-network` | all PASS, no secrets printed, hidden DB/Studio |
| Tunnel verification | `verify:tunnel-network` | HTTPS services and no zrok interstitial |
| Automated tests | phase verification commands | tests/build/typecheck/coverage meet thresholds |
| Privacy | source/database/CSV inspection | no central image/embedding/template/token/private key |
| Limitations | report/operations | offline revocation and Apple/tunnel status stated honestly |

## Quantitative Evaluation

### Ticketing And Reliability

Record:

- checkout success/failure and latency
- duplicate/idempotent result
- sold-out behavior
- concurrent final-seat outcome
- pass generation count
- queue retry count and sync completion time

### Gate Performance

Gate CSV records:

```text
recorded_at,event_id,pass_ref,outcome,reason_code,
scan_ms,decode_ms,verify_ms,replay_ms,revocation_ms,decrypt_ms,
liveness_ms,match_ms,total_ms,hamming_distance
```

Analyze median, minimum, maximum, and p95 where sample size permits. Separate human liveness time from machine stages. Do not infer an unrecorded standalone inference metric.

### Accuracy Protocol

Use consented participants and controlled trials:

- genuine attempts for false rejection observations
- different-person attempts for false acceptance observations
- printed/displayed image attempts for spoof observations
- varied lighting and distance, recorded with device/model/OS

Report counts and denominators, not only percentages. Prototype results are not certification claims.

## Security Evaluation

Run or cite tests for:

- organizer allowlist and event ownership isolation
- attendee data isolation and foreign claim codes
- paid blocking, capacity race, duplicate checkout
- cancellation/revocation/reset state transitions
- generation cap and regeneration revocation
- malformed/oversized/tampered/expired/wrong-event pass
- offline replay persistence
- signed sync tampering, nonce replay, stale time, wrong event, unknown key
- revocation age and pre-door refresh
- CSV formula protection and sensitive-field exclusion

## Privacy Evaluation

Static evidence:

- capture/crop deletion in `finally`
- buffer wiping after embedding/template/key use
- no biometric columns in migrations
- no biometric/sensitive queue fields
- CSV allowlists
- public/server environment separation

Dynamic evidence:

- inspect Supabase rows after enrollment/check-in
- inspect gate/enrollment logs for sensitive values
- account-switch prepared-device cleanup
- verify terminal/reset reconciliation removes obsolete local passes

## Required Automated Commands

```bash
pnpm db:verify
pnpm verify:network-config
pnpm verify:local-network
pnpm verify:phase2
pnpm verify:phase3
pnpm verify:phase4
pnpm verify:phase5
pnpm verify:phase6
```

Run `pnpm verify:tunnel-network` only when tunnel configuration is active. Record a fail/not-configured result rather than presenting local evidence as tunnel evidence.

## Success Criteria

The artifact succeeds when the complete attendee journey is real, organizer/attendee authority is enforced, free checkout cannot oversell, enrollment stores no central biometric, the gate accepts valid passes offline and blocks replay, signed queued synchronization updates the dashboard, revocation staleness is visible/honest, exports exclude sensitive data, and all claimed deployment/device modes have objective evidence.
