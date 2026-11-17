# SC1–SC5 Cloud Evaluation Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reproducible, claim-bounded cloud evidence receipt for SC1–SC5 of the Focaccia EPQ evaluation at one pinned repository commit.

**Architecture:** A preflight gate first establishes the target commit, free execution allowance, and whether remote workflow changes are authorised. A controlled cloud workflow then creates isolated event journeys, exercises the gate while connectivity is unavailable, records machine-readable per-run evidence, and checks authoritative backend state after reconnection. A separate reducer aggregates the target of ten independent observations without converting simulator evidence into claims about real participants, physical cameras, biometric accuracy, or production readiness.

**Tech Stack:** GitHub Actions, Ubuntu/macOS runners, Supabase, Next.js, Playwright, React Native/Expo iOS Simulator, Baguette simulator control, Node.js, JSON/Markdown evidence manifests.

---

## Mission

Act as an evidence-producing evaluation agent. Complete SC1–SC5 against the Focaccia artifact, retain raw outcomes, and return a defensible evidence receipt. The objective is not to make the report sound successful. The objective is to establish exactly which controlled software behaviours passed, failed, or remain untested.

The final result must distinguish:

- `PASS`: the criterion’s stated threshold is met and the required raw and authoritative evidence exists;
- `PARTIAL`: some required scenarios passed but the threshold or evidence requirement was not met;
- `FAIL`: a required scenario produced the wrong result;
- `NOT_TESTED`: the workflow could not exercise the scenario;
- `BLOCKED`: the environment or workflow prevented a valid run.

Never convert `PARTIAL`, `NOT_TESTED`, or `BLOCKED` into `PASS` by inference.

## Authoritative scope and evidence boundary

Use these materials as the scope authority:

- [Canonical EPQ report](https://app.notion.com/p/3c3d326c13fb800aaa5cf5e30728220f)
- [EPQ log book](https://app.notion.com/p/289d326c13fb805cbdf9eff550b7d662)
- [`docs/EVALUATION_PLAN.md`](../../EVALUATION_PLAN.md)
- [`docs/EPQ_ARTIFACT_REPORT.md`](../../EPQ_ARTIFACT_REPORT.md)
- [`docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md`](../../PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md)

The current cloud implementation is on `origin/codex/ios-simulator-verification-next` at the time this plan was written (`d3bf4eeda9f2db139804495afb24c008c1a40445`). The current checkout used to write this plan is detached at `67553116026acd39b9d06f3a20cc9fe5c7468c40` and does not contain the cloud workflow files. Resolve and record the actual target commit before running anything; do not silently evaluate a different checkout.

The existing workflow has already demonstrated a useful but limited controlled path. Its evidence records include `native-report.json`, `evidence-manifest.json`, screenshots, and an authoritative backend result. The current path records `provisioning_mode: e2e_payload_injection`, `provisioning_qr_camera_scan: false`, `network_loss_method: stopped_macOS_relay`, and a fixed `face_fixture_sha256`. Those fields are mandatory claim-boundary metadata, not details to hide.

Prior run references are baselines only, not a substitute for the final receipt:

- [Successful cloud run](https://github.com/manavcodaty/Focaccia/actions/runs/32640901882)
- [Failed reconnect rerun](https://github.com/manavcodaty/Focaccia/actions/runs/32646556551)

## Execution modes and zero-cost gate

Select one mode before any remote action:

- **Existing-workflow mode:** use the already-published workflow and a pinned ref. This requires no code push. It is the default when remote changes are not authorised.
- **Optimised-workflow mode:** make a narrowly scoped local optimisation, then remotely validate it only from a commit or branch that GitHub Actions can access. A push requires explicit approval and must use a temporary branch. Without that approval, the local optimisation is an unvalidated proposal, not evidence.
- **Evidence-only mode:** if a valid prior run at the exact target commit already contains the required artefacts, reuse it as the baseline and avoid a duplicate baseline run. It cannot substitute for the requested ten-run batch.

The zero-cost gate is binary. Proceed with remote execution only when all of the following are verified:

- the repository, runner, cache, artifact, and service path use existing free allowances;
- no billing activation, paid runner, paid third-party service, paid storage, paid quota, trial conversion, or billable API is needed;
- the optimisation does not increase total quota-consuming runner time merely to reduce wall-clock time;
- the cost basis and allowance evidence are recorded in `preflight.json`.

Public repository visibility or a provider’s “free” label is not proof of zero cost. If the actual allowance, runner multiplier, cache/artifact policy, or service billing state cannot be established, mark the run `BLOCKED` and produce the evidence gap. Do not infer that a service is free from its marketing language.

## Refined success criteria

These are software-validation criteria for the controlled cloud environment. They are not production guarantees and they do not close the report’s untested biometric-performance or human-acceptance criteria.

| ID | Criterion to evaluate | Required threshold for `PASS` | Evidence required |
| --- | --- | --- | --- |
| **SC1** | Complete authorised event journey | Ten independent runs each create a unique event and attendee context, complete organiser creation/listing, attendee authentication and free ticket claim, owned-ticket enrolment/pass issuance, gate verification, and an authoritative dashboard check-in | Per-run IDs, pinned commit, browser/native reports, screenshots, and backend state showing exactly one accepted check-in and one checked-in ticket per successful run |
| **SC2** | Offline gate decision | In every run, a valid pass is accepted after the gate has a fresh revocation state and while the decision path has no live backend connectivity | Native report, offline UI evidence, network-state evidence, pass outcome, and the explicit network-loss method; a relay stop is labelled as simulation, not physical radio isolation |
| **SC3** | Central biometric minimisation | Across the run and post-run audit, zero forbidden reusable biometric artefacts are found in central schema/rows, API responses, logs, CSV exports, or retained evidence | Automated schema/row/API/log/export audit showing no raw face image, reusable embedding, searchable biometric index, decrypted template, or cross-event reusable template; any encrypted gate-bound payload is classified accurately rather than called “no biometric bytes” |
| **SC4** | Copied, modified, replayed, and invalid-pass controls | The security matrix records the expected rejection for replayed, modified/tampered, wrong-event, expired, cancelled/revoked, and duplicate-synchronisation cases, while a genuine unused pass is accepted | A row per scenario with input identity, expected outcome, observed outcome, reason code, timestamp, and backend consequence; unsupported scenarios remain `NOT_TESTED` |
| **SC5** | Offline recovery and synchronisation | Every run queues the accepted decision, preserves it through gate restart while offline, drains it after reconnection, and updates the dashboard exactly once | Queue-before-restart, queue-after-restart, reconnect, and dashboard evidence; authoritative backend count; original gate time; retry/idempotency result; no latency values inferred from missing or zero fields |

Ten runs provide repeated controlled observations. They do not represent ten people, ten unique faces, demographic coverage, or a statistically reliable biometric error rate. The repeated fixture must be reported as repeated fixture-driven software testing.

## Evidence and privacy contract

Each run must produce a safe, machine-readable record containing at least:

```json
{
  "run_id": "unique-run-id",
  "workflow_run_url": "https://github.com/...",
  "commit_sha": "pinned-commit",
  "event_id": "isolated-event-id",
  "organizer_id_hash": "non-reversible-identifier-or-null",
  "attendee_id_hash": "non-reversible-identifier-or-null",
  "ticket_id": "isolated-ticket-id",
  "gate_key_fingerprint": "public-key-fingerprint-or-null",
  "mutable_state_isolated": true,
  "runner_os": "...",
  "started_at": "RFC-3339 timestamp",
  "fixture_sha256": "hash-or-null",
  "provisioning_mode": "...",
  "provisioning_qr_camera_scan": false,
  "network_loss_method": "...",
  "checks": {},
  "security_matrix": [],
  "privacy_audit": {},
  "authoritative_backend": {},
  "artifact_paths": [],
  "status": "PASS|PARTIAL|FAIL|NOT_TESTED|BLOCKED",
  "failure": null
}
```

The retained evidence bundle must contain no passwords, service-role keys, private keys, full pass tokens, unredacted provisioning payloads, or other reusable credentials. Working secrets may exist only in the ephemeral execution context and must not be uploaded as evidence. A screenshot or log is not acceptable evidence if it leaks a secret.

Do not claim that a central biometric audit passed merely because a screenshot contains no face data. The audit must cover the actual schema, relevant rows, API payloads, logs, exports, and evidence bundle. Classify an event-specific encrypted gate-bound payload separately from a central searchable or reusable biometric record.

## GPT-6 agent contract

Use the supplied OpenAI prompting guidance as an execution policy:

- Keep the task prompt lean. State the goal, evidence boundary, autonomy limits, required output schema, and stopping conditions once each. Do not repeat generic instructions.
- Expose only the tools needed for repository inspection, workflow execution, artifact download, deterministic parsing, and final evidence review.
- Use programmatic tool calling only for bounded deterministic fan-out, filtering, joining, validation, and aggregation of run artefacts. Keep semantic claim classification, ambiguity decisions, and final caveat review as direct model work.
- Run independent read-only inspections concurrently where safe. Do not repeat completed runs or discard failed runs.
- If a required field, scenario, or artifact is missing, return an explicit structured gap. Do not fill it with a plausible value.
- Keep all required facts, caveats, failure reasons, and next actions in the final response; omit generic reassurance.

Autonomy boundaries:

- Allowed: inspect the pinned repository, run the authorised cloud workflow, make scoped local workflow/test/evidence changes, download and validate CI artefacts, and write the local receipt.
- Not allowed without explicit approval: edit the Notion report or log book, change the EPQ title, push or publish code, create persistent repository/provider secrets, alter production data, delete prior evidence, or claim physical/human testing. Ephemeral runner-local test keys already required by the existing isolated workflow are allowed only when they are not uploaded as artefacts.
- One commit-pinned native build may be reused for a batch when the target workflow requires it. Do not rebuild the native apps for every run. If a native build is unavailable and cannot be produced within the verified free allowance, mark the task `BLOCKED`.
- Follow repository policy: do not spawn subagents unless separately authorised.

## Work surface

Use the target-ref paths below as the controlled work surface. Do not broaden the task into product redesign or cryptographic redesign.

- `.github/workflows/cloud-ios-full-flow.yml`: the full backend/native cloud orchestration and artifact publication.
- `.github/workflows/cloud-full-flow.yml`: the browser/backend baseline and its retained evidence.
- `scripts/cloud-browser-e2e.mjs`: isolated organiser, attendee, ticket, and provisioning journey.
- `scripts/cloud-ios-e2e.mjs`: native enrollment, gate, offline, replay, restart, reconnect, and dashboard evidence.
- `scripts/lib/baguette-client.mjs`: simulator-control support only where the evidence contract cannot otherwise be met.
- `scripts/aggregate-sc1-sc5-evidence.mjs`: new deterministic reducer for per-run manifests and criterion results.
- `docs/EVALUATION_PLAN.md`: align the written checklist with the final evidence fields if required; do not rewrite its claim boundaries.
- `preflight.json`, `baseline.json`, and `optimization.json`: execution-mode, cost, baseline, optimisation, and authorisation records.
- `sc1-sc5-evidence-receipt.json` and `sc1-sc5-evidence-receipt.md`: final receipt outputs, retained with the run evidence rather than presented as application features.

If implementation changes are required, keep them limited to this surface, validate them against the pinned ref, and create local logical commits with descriptive messages. Do not push those commits without explicit approval.

Run independence means a unique run ID, organiser identity or isolated backend instance, event, attendee, ticket, pass, gate key/device identity, and fresh mutable simulator state. Shared immutable dependencies and a commit-pinned native build are allowed. Shared database rows, local SQLite state, app data containers, credentials, pass tokens, or gate keys are not.

## Implementation and evaluation tasks

### Task 1 — Preflight cost, authority, and baseline

**Files:** `.github/workflows/cloud-ios-full-flow.yml`, `.github/workflows/cloud-full-flow.yml`, `baseline.json`, `preflight.json`

- [ ] Resolve the exact target ref and confirm that the cloud workflow files exist on it.
- [ ] Confirm the repository visibility, runner class, artifact/cache path, and service path using read-only metadata. Record the evidence used to establish zero cost.
- [ ] Select `existing-workflow`, `optimised-workflow`, or `evidence-only` mode. Record whether a temporary branch push is authorised; default to not authorised.
- [ ] Reuse an existing successful run as the baseline when its commit and evidence contract match the target. Run one baseline only when no valid matching run exists or timing data is missing.
- [ ] Confirm the five criteria and their claim boundaries against the report, log book, and local evaluation documents.

Read-only checks include:

```bash
git rev-parse origin/codex/ios-simulator-verification-next
git show --stat --oneline <resolved-commit>
gh repo view manavcodaty/Focaccia --json nameWithOwner,visibility,url
gh workflow view cloud-ios-full-flow.yml --repo manavcodaty/Focaccia
```

Expected result: the target commit, workflow, environment, cost basis, authorization state, and limitations are recorded. A missing workflow, unverified zero-cost basis, or detached checkout is `BLOCKED`; it is not silently repaired by switching to another ref.

**Completion check:** `preflight.json` and `baseline.json` identify one evaluated commit, one workflow definition, one cost verdict, one authorization verdict, one baseline source, and one explicit limitation list. No remote workflow has run before this check passes.

### Task 2 — Optimise the free CI path without changing evidence

**Files:** `.github/workflows/cloud-ios-full-flow.yml`, `.github/workflows/cloud-full-flow.yml`, `scripts/cloud-browser-e2e.mjs`, `scripts/cloud-ios-e2e.mjs`, `optimization.json`

- [ ] Measure the baseline’s critical-path wall time and total runner-minute/quota consumption from existing logs or the single approved baseline run.
- [ ] Limit optimisation to free setup overhead: dependency/cache reuse where already free, one commit-pinned native build reused by the batch, artifact reuse, and safe scheduling.
- [ ] Keep each run’s unique organiser identity or isolated backend instance, event, attendee, ticket, pass, gate key/device identity, and fresh mutable simulator state. Shared immutable dependencies are the only permitted reuse.
- [ ] Keep all security scenarios, privacy audits, backend-authoritative checks, screenshots, diagnostics, and failure artefacts.
- [ ] Do not remotely validate local workflow changes without an accessible commit. If a push is required, stop and request explicit approval for a temporary branch; do not push automatically.
- [ ] Run one complete optimised validation only after the zero-cost gate passes and the optimised workflow is available on an authorised, accessible commit. If push approval is unavailable, record the optimisation as local-only and use the existing published workflow for evidence.

The optimised validation must preserve the evidence schema and expected behaviour. A faster workflow is not an improvement if it consumes more quota, introduces state leakage, removes checks, or changes the claim boundary.

**Completion check:** `optimization.json` records baseline and optimised workflow URLs or the explicit local-only status, wall time, runner-minute/quota evidence, cost verdict, isolation verdict, and schema/behaviour comparison. If there is no meaningful free improvement, record `NO_MEANINGFUL_GAIN` and use the existing workflow rather than expanding the optimisation scope.

### Task 3 — Make evidence output safe and repeatable

**Files:** `scripts/cloud-browser-e2e.mjs`, `scripts/cloud-ios-e2e.mjs`, `scripts/aggregate-sc1-sc5-evidence.mjs`, `.github/workflows/cloud-ios-full-flow.yml`

- [ ] Emit the evidence fields in the contract above, including public gate-key fingerprint, mutable-state isolation, fixture hash, network method, and provisioning mode.
- [ ] Redact passwords, service-role keys, private keys, full pass tokens, and unredacted provisioning payloads from uploaded artefacts.
- [ ] Preserve each failed run’s report, workflow URL, failure reason, and diagnostics. A rerun is an additional observation.
- [ ] Make the reducer reject duplicate run IDs, missing commit/run metadata, secret-bearing artefacts, missing failure records, and mismatched authoritative counts.

**Completion check:** The validator accepts a valid success fixture and a deliberately failed fixture, rejects unsafe or incomplete fixtures, and produces no secret-bearing output.

### Task 4 — Produce the ten target observations

**Files:** `.github/workflows/cloud-ios-full-flow.yml`, per-run CI artefacts, `sc1-sc5-evidence-receipt.json`

- [ ] Run the complete controlled workflow ten times only after Tasks 1–3 pass and zero cost is verified.
- [ ] Use limited parallelism only when it does not increase total quota-consuming time and isolation is proven. Sequential execution is preferable when the cost comparison is uncertain.
- [ ] Preserve all successes, failures, retries, timeouts, and partial outcomes.
- [ ] Record workflow URL and exact artefact bundle for every run.

Ten is a repeatability target, not a biometric sample size. If ten valid observations cannot be obtained within the verified free allowance, report `PARTIAL` or `BLOCKED` with the exact count; do not substitute repeated attempts or claim statistical biometric validity.

**Completion check:** The receipt contains ten distinct run IDs, organiser identities or isolated-backend proofs, events, attendees, tickets, pass contexts, gate fingerprints, and fresh mutable-state confirmations, reconciled with workflow history. Any missing isolation field makes the affected run `NOT_TESTED`.

### Task 5 — Close SC1: complete journey and authority

**Files:** `scripts/cloud-browser-e2e.mjs`, `scripts/cloud-ios-e2e.mjs`, authoritative backend artefact, `sc1-sc5-evidence-receipt.json`

- [ ] Verify organiser creation/listing, attendee authentication, intended free-ticket claim, owned-ticket recovery, enrolment/pass issuance, gate verification, and dashboard update.
- [ ] Verify that a foreign ticket or claim code cannot become owned by another account.
- [ ] Reconcile UI/native evidence with authoritative backend state.
- [ ] Require exactly one accepted check-in and one checked-in ticket per successful isolated run.

**Completion check:** SC1 has one denominator-backed result per run and no screenshot-only success claim.

### Task 6 — Close SC2: offline acceptance

**Files:** `scripts/cloud-ios-e2e.mjs`, native report, network diagnostics, `sc1-sc5-evidence-receipt.json`

- [ ] Verify a fresh revocation state before connectivity loss.
- [ ] Verify valid-pass acceptance with no live backend dependency in the decision path.
- [ ] Record whether the network loss is relay/simulator evidence or physical radio evidence; never merge those categories.
- [ ] Preserve the offline UI result and native report.

**Completion check:** Every SC2 result includes offline state, valid-pass outcome, network method, and raw evidence. Missing physical-radio testing remains an explicit limitation.

### Task 7 — Close SC3: central biometric minimisation

**Files:** schema/migrations, relevant Edge Functions, database/API/log/export evidence, `privacy_audit`, `sc1-sc5-evidence-receipt.json`

- [ ] Audit schema, rows, API responses, server logs, CSV exports, and retained CI artefacts after enrolment and check-in.
- [ ] Confirm that no raw face, reusable embedding, searchable facial index, decrypted template, or cross-event reusable template is present.
- [ ] Classify any event-specific encrypted gate-bound payload accurately.
- [ ] Scan the evidence receipt itself for credentials and reusable biometric material.

**Completion check:** `privacy_audit` lists every inspected surface, scan scope, forbidden-field count, and encrypted-payload classification. Source-only evidence is `PARTIAL`.

### Task 8 — Close SC4: security rejection matrix

**Files:** `scripts/cloud-ios-e2e.mjs`, security-matrix artefact, relevant backend test harness, `sc1-sc5-evidence-receipt.json`

- [ ] Record genuine unused-pass acceptance and local replay rejection.
- [ ] Record modified/tampered, wrong-event, expired/out-of-window, cancelled/revoked-after-refresh, and duplicate-synchronisation outcomes.
- [ ] Record the stale-revocation-cache limitation separately when a disconnected gate has not refreshed.
- [ ] Preserve expected result, observed result, reason code, timestamp, and backend consequence for every scenario.

**Completion check:** Every matrix row is `PASS`, `FAIL`, or `NOT_TESTED` with a reason. Missing scenarios are excluded from the SC4 pass claim.

### Task 9 — Close SC5: durable recovery

**Files:** `scripts/cloud-ios-e2e.mjs`, queue/reconnect artefacts, authoritative backend artefact, `sc1-sc5-evidence-receipt.json`

- [ ] Verify one pending offline decision with its original gate time.
- [ ] Verify queue persistence through app restart while still offline.
- [ ] Verify signed synchronisation, queue clearance, dashboard update, and idempotent no-duplicate backend state after reconnection.
- [ ] Record timings only from reliable start/end timestamps; treat zero or missing timing fields as unavailable.

**Completion check:** Every SC5 run has before-restart, after-restart, reconnect, authoritative backend, and dashboard evidence, with exactly one accepted check-in per isolated ticket.

### Task 10 — Aggregate and produce the handoff receipt

**Files:** `scripts/aggregate-sc1-sc5-evidence.mjs`, `sc1-sc5-evidence-receipt.json`, `sc1-sc5-evidence-receipt.md`

- [ ] Produce criterion counts, numerators, denominators, failure categories, blocked/not-tested scenarios, and evidence completeness.
- [ ] Link every result to a raw artefact and workflow URL.
- [ ] State that ten repeated fixture-driven runs assess controlled workflow repeatability only.
- [ ] Explicitly state that real-camera capture, camera QR scanning, physical radio loss, participant FAR/FRR, demographic fairness, sophisticated PAD, user acceptance, and public deployment remain unestablished.
- [ ] Do not edit the Notion report, log book, or EPQ title.

Validate the reducer with the actual validated-run and receipt directories substituted for the placeholders:

```bash
node --check scripts/aggregate-sc1-sc5-evidence.mjs
node scripts/aggregate-sc1-sc5-evidence.mjs --input <validated-run-directory> --output <receipt-directory>
```

Expected result: both receipt files are written, every summary number has a denominator, every claim traces to raw evidence, and unsafe artefacts are rejected.

**Completion check:** A fresh reader can trace every SC1–SC5 conclusion from the Markdown receipt to a raw artefact and authoritative backend result. A blocked zero-cost gate still produces a truthful blocked receipt rather than an empty success report.

## Final validation gate

Before reporting completion, validate the preflight, optimisation, run manifests, security matrix, privacy audit, and receipt. Run the relevant repository checks for the pinned ref, scan the final bundle for secrets and forbidden biometric fields, and review the diff. Report exact commands, workflow URLs, cost evidence, and outcomes.

The task is complete only when:

- the zero-cost verdict is `CONFIRMED` or the overall result is explicitly `BLOCKED`;
- the evaluated commit and workflow are recorded;
- the optimisation is remotely validated or explicitly labelled local-only;
- ten independent run records exist or the result is explicitly `PARTIAL`/`BLOCKED`;
- SC1–SC5 each have a criterion-level status and denominator-backed results;
- raw failures are retained and explained;
- authoritative backend state supports every claimed successful check-in and synchronisation;
- privacy and secret scans cover the retained evidence bundle;
- simulator/fixture evidence is not described as physical, human, biometric-performance, or production evidence;
- the two receipt files are present and readable.

The cloud workflow’s suitability for SC1–SC5 software evidence is approximately **8/10** after a truthful receipt exists. Its suitability for the complete EPQ evaluation, including FAR/FRR, fairness, presentation-attack testing, stakeholder acceptance, and physical demonstration, remains approximately **3/10**. Ten fixture-driven runs do not change that. Claiming otherwise would be wrong.
