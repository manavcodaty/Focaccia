# Phase 8 Documentation And EPQ Evidence

Verified on 15 June 2026 from `/Users/manavcodaty/repos/Focaccia`.

## Documentation Result

The current README, architecture, network, privacy, threat-model, assumptions, operations, evaluation, product, UI, and artifact documents now describe the implemented four-application flow. Historical planning and audit documents are labelled as historical where their join-code-era wording is retained for traceability.

The current documents explicitly state:

- local mode needs no tunnel;
- physical devices use the Mac LAN IP, not loopback;
- remote use needs the host Mac and active zrok shares;
- gate entry decisions remain offline;
- revocations made while a gate is disconnected apply after its next successful refresh; and
- audience-owned iPhone installation depends on verified Apple distribution.

## Verification Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Documentation links | PASS | Every relative Markdown link resolves. |
| Commands and variables | PASS | Documented root scripts and 26 documented environment variables map to the current package scripts, examples, or runtime adapters. |
| Screens and functions | PASS | Documented ticket, organizer, enrollment, gate, and Edge Function routes map to current source files. |
| Stale claims | PASS | Current operational documents contain no join-code-only flow, required manual gate-log upload, or instant disconnected-revocation claim. |
| Local network configuration | PASS | `pnpm verify:network-config`; 32 shared tests, seven foundation checks, and three CORS tests passed. Network helper coverage was 89.39% lines and 87.69% branches. |
| Live local mode | PASS | `pnpm demo:local` and `pnpm verify:local-network` reached Auth, the organizer app, and the ticket app at `192.168.0.141`; allowed-origin CORS returned 204, unauthorized-origin CORS returned 403, and PostgreSQL/Studio were not exposed. |
| Backend and organizer | PASS | `pnpm verify:phase4` included the Phase 2 database/RLS/integration flow, 41 organizer tests, CSV tests, a production build, and the organizer integration flow. |
| Ticket application | PASS | `pnpm verify:phase3` passed ticket tests, typecheck, coverage, and the production build. |
| Enrollment application | PASS | Coverage passed with 93.05% lines and 81.76% branches; typecheck and the iOS Expo export passed. |
| Offline gate and synchronization | PASS | Coverage passed with 98.97% lines and 87.16% branches; typecheck, offline verification, provisioning integration, and the iOS Expo export passed. |
| Dependency audit | PASS | `pnpm audit --prod --audit-level high` reported no known vulnerabilities. |
| Tunnel network | NOT CONFIGURED | `pnpm verify:tunnel-network` failed closed because `.env.tunnel.local` is absent. No zrok share is active, so remote tunnel behavior is not claimed as verified. |
| Vercel | NOT CONFIGURED | No Vercel project is linked in this checkout. |
| EAS/TestFlight | NOT CONFIGURED | EAS is not authenticated and no linked EAS project or App Store Connect/TestFlight build is present. Prepared development devices remain the verified installation path. |

## EPQ Demonstration Checklist

- [ ] Create an organizer event and capture the completed dashboard screen.
- [ ] Toggle the event to listed and capture it in the public catalogue.
- [ ] Create an attendee account and capture authenticated recovery after sign-in.
- [ ] Complete free checkout and capture the ticket, claim code, and GBP 0 total.
- [ ] Enroll the owned ticket and capture consent, local processing, and issuance states.
- [ ] Display the signed pass and record its generation allowance.
- [ ] Disconnect gate networking and record valid offline acceptance.
- [ ] Scan the same pass again and record replay rejection.
- [ ] Restore networking and record the durable queue synchronizing automatically.
- [ ] Capture the organizer dashboard check-in update without manual upload.
- [ ] Reset or revoke the ticket and capture the audit trail and attendee recovery state.
- [ ] Refresh gate revocations, record cache age, and demonstrate the disconnected-revocation limitation.
- [ ] Export organizer CSV and gate diagnostics CSV; confirm neither contains biometric data, tokens, credentials, or private keys.
- [x] Record local network verification with all tunnels stopped.
- [ ] Record tunnel verification after zrok and `.env.tunnel.local` are configured.
- [x] Record builds, typechecks, integration tests, coverage, offline verification, and dependency audit.
- [x] Include privacy controls, data retention, recovery, and known limitations in the written evidence.

Unchecked demonstration items require screenshots or physical-device recordings from the final EPQ run. They are not converted to passes merely because their automated source and integration tests pass.
