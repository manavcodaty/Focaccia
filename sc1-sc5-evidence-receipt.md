# SC1–SC5 Cloud Evaluation Evidence Receipt

Overall status: **BLOCKED**

The evaluated commit is `a082c488eb8aa07be5d8748e393704ddc27acb4b` on the dedicated checkout `/private/tmp/Focaccia-sc1-sc5-live`. The expected baseline `origin/codex/ios-simulator-verification-next` remains `d3bf4eeda9f2db139804495afb24c008c1a40445`. The workflow was executed only in GitHub Actions; no local Xcode build was performed.

## Target and validation gate

| Measure | Result |
| --- | ---: |
| Required target observations | 10 |
| Valid target observations | 0 |
| Remaining observations | 10 |
| Ten-run batch dispatched | No |
| Validation attempts retained | 16 |

The ten-run batch was gated on one complete optimised validation. That gate did not pass. In the latest three validations, the hosted iOS native agent failed before `Provision this gate`: credential text-input teardown produced an iOS responder/session error, `backboardd` respawned, and RunningBoard terminated `FacePassGate`. The latest native failure is preserved in [native-report.json](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-report.json), [native-simulator-log.txt](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-simulator-log.txt), and [native-failure-ui.json](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-failure-ui.json); the captured [native-failure.png](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-failure.png) shows the simulator on the Home screen.

The corresponding workflow is [run 33000283974](https://github.com/manavcodaty/Focaccia/actions/runs/33000283974). Its native job failed, and its authoritative synchronized-backend job failed because native completion was not signalled. No exact-one check-in or synchronisation claim is made.

## Criterion results

Each criterion has numerator `0`, observed denominator `0`, and required denominator `10`. The validation failures are not target observations.

| Criterion | Status | Numerator / observed denominator | Evidence and authority |
| --- | --- | ---: | --- |
| SC1 complete authorised event journey | **BLOCKED** | 0 / 0 (required 10) | Latest [native report](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-report.json), [manifest](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/evidence-manifest.json), and [browser report](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-backend/browser/browser-report.json); authoritative synchronized backend: **FAIL**. |
| SC2 offline gate decision | **BLOCKED** | 0 / 0 (required 10) | Latest [native report](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-report.json), [native log](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-simulator-log.txt), and [failure screenshot](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-failure.png); `stopped_macOS_relay` was never reached by the native decision path. |
| SC3 central biometric minimisation | **BLOCKED** | 0 / 0 (required 10) | [Evidence manifest](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/evidence-manifest.json); the workflow privacy audit was skipped, so no central schema/row/API/log/export audit is claimed. |
| SC4 invalid-pass and replay controls | **BLOCKED** | 0 / 0 (required 10) | [Security matrix](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/cloud-security-matrix.json) has six supporting offline-harness PASS rows, but no backend write, duplicate synchronisation, or complete per-run matrix; authoritative target evidence: **NOT_TESTED**. |
| SC5 offline recovery and synchronisation | **BLOCKED** | 0 / 0 (required 10) | [Native report](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-report.json), [native log](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-simulator-log.txt), and [manifest](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/evidence-manifest.json); authoritative synchronized backend: **FAIL**. |

## Retained validation failures

All six post-fix validation attempts below are excluded from the target denominator and retain a raw artifact directory, workflow URL, failure stage, wall-clock measurement, and zero billable runner time.

| Workflow run | Commit | Wall time | Result | Raw evidence |
| --- | --- | ---: | --- | --- |
| [32964250760](https://github.com/manavcodaty/Focaccia/actions/runs/32964250760) | `9a0a80f…` | 5,321,000 ms | FAIL before Gate provisioning; `backboardd` respawn/RunningBoard termination | [/private/tmp/sc1-sc5-validation-32964250760](/private/tmp/sc1-sc5-validation-32964250760) |
| [32973925793](https://github.com/manavcodaty/Focaccia/actions/runs/32973925793) | `1c0217b…` | 3,219,000 ms | FAIL before Gate provisioning; device-name responder handoff followed auth | [/private/tmp/sc1-sc5-validation-32973925793](/private/tmp/sc1-sc5-validation-32973925793) |
| [32980236575](https://github.com/manavcodaty/Focaccia/actions/runs/32980236575) | `8a90f1a…` | 4,700,000 ms | FAIL before Gate provisioning; static device-name fix did not resolve lifecycle failure | [/private/tmp/sc1-sc5-validation-32980236575](/private/tmp/sc1-sc5-validation-32980236575) |
| [32986280450](https://github.com/manavcodaty/Focaccia/actions/runs/32986280450) | `85dfd47…` | 4,781,000 ms | FAIL before Gate provisioning; credential teardown followed by `backboardd` respawn | [/private/tmp/sc1-sc5-validation-32986280450](/private/tmp/sc1-sc5-validation-32986280450) |
| [32993239100](https://github.com/manavcodaty/Focaccia/actions/runs/32993239100) | `ab4e44b…` | 4,317,000 ms | FAIL before Gate provisioning; mounted credential inputs did not resolve responder/session failure | [/private/tmp/sc1-sc5-validation-32993239100](/private/tmp/sc1-sc5-validation-32993239100) |
| [33000283974](https://github.com/manavcodaty/Focaccia/actions/runs/33000283974) | `a082c48…` | 5,202,000 ms | FAIL before Gate provisioning; latest blur/dismiss/settle fix did not resolve responder/session failure | [/private/tmp/sc1-sc5-validation-33000283974](/private/tmp/sc1-sc5-validation-33000283974) |

Earlier partial and failed attempts remain in `/private/tmp/sc1-sc5-validation-32853012600` through `/private/tmp/sc1-sc5-validation-32942505379` and are listed in the JSON receipt. They were not deleted or converted into target observations.

## Supporting evidence from the latest run

- Browser/backend fixture: **PASS, 1/1 supporting fixture**, with `mutable_state_isolated=true`, unique organiser and attendee hashes, event ID `cloud_e2e_ca0a5126f304`, and ticket ID `6641169e-5ca9-48c1-8639-fa68947b4743`. See [browser-report.json](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-backend/browser/browser-report.json). This is not a complete SC1 target observation because native Gate completion and authoritative synchronisation failed.
- Security harness: **PARTIAL, 6/6 offline-harness rows PASS** for genuine unused acceptance, replay, tampering, wrong event, expiry, and revocation. Stale revocation cache is `NOT_TESTED`. See [cloud-security-matrix.json](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/cloud-security-matrix.json). These rows use `offline_harness_*_no_backend_write` consequences and do not close SC4.
- Native evidence: **FAIL**. Native checks for Gate provisioning, offline acceptance, queue persistence, replay rejection, reconnect, and dashboard check-in are false in [native-report.json](/private/tmp/sc1-sc5-validation-33000283974/focaccia-cloud-ios-full-flow-proof/native-report.json).
- Authority: **FAIL**. The synchronized backend check could not run after native completion failed. No exact-one check-in result is asserted.
- Privacy audit: **NOT_TESTED**. The runner skipped the privacy step after native completion failed; the manifest is not a central schema/row/API/log/export audit.

## Cost and optimisation evidence

The preflight cost verdict is **CONFIRMED** from the account billing UI at [GitHub billing](https://github.com/settings/billing): Pro subscription `$0`, included Actions allowance 3,000 minutes, Actions billable `$0`, and Actions storage within the 2 GB allowance. The authenticated billing API returned 404 because the token lacks user-plan scope; the UI was the controlling evidence. No paid runner, paid service, persistent provider secret, hosted Supabase project, or billable API was used.

Measured wall-clock time across the six post-fix validation attempts was 27,540,000 ms (459 minutes). GitHub timing reports show 0 billable Ubuntu ms and 0 billable macOS ms for each; the latest timing record is [run 33000283974 timing](https://github.com/manavcodaty/Focaccia/actions/runs/33000283974/timing). The optimisation decision is `NO_MEANINGFUL_GAIN`: the candidate failed before completing the native workflow, so a speed comparison is invalid, and the repeated lifecycle failure is not an improvement.

## Security and privacy boundary

- No persistent repository/provider secrets were created.
- Ephemeral runner-local keys required by the existing isolated workflow were not uploaded; the encrypted `handoff.json` was not opened or printed.
- No production backend or production data was used or mutated.
- Safe reports, manifests, logs, screenshots, browser evidence, and the security matrix were retained, including failures.
- `e2e_payload_injection` was used for provisioning and `provisioning_qr_camera_scan=false`; `stopped_macOS_relay` is simulator/relay evidence, not physical radio isolation.
- The final bounded scan covered 203 source/workflow/receipt/safe-evidence text files, excluding `node_modules` and encrypted `handoff.json`: zero non-fixture high-risk hits. Five secret-like matches were confined to synthetic security-test fixtures and were not copied into evidence.

## Explicit limitations

This receipt does not claim ten people, ten unique faces, FAR, FRR, EER, demographic fairness, sophisticated presentation-attack resistance, user acceptance, physical camera operation, camera QR scanning, physical radio loss, or production readiness. The repeated fixture attempts are controlled software-validation attempts only. The latest receipt therefore remains `BLOCKED`, not `PASS` or `PARTIAL` for the requested ten-observation result.

No Notion report, log book, or EPQ title was edited. No failed evidence was deleted. The machine-readable receipt is [sc1-sc5-evidence-receipt.json](/private/tmp/Focaccia-sc1-sc5-live/sc1-sc5-evidence-receipt.json).
