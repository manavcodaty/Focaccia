# Evaluation Plan

## 1. Purpose

This document defines how the completed **One-Time Face Pass** prototype will be evaluated for the EPQ. It is written against three sources of truth:

- `TRUTH_BASE.md`
- `ARCHITECTURE.md`
- `docs/PRIVACY_BY_DESIGN.md`

The aim is not just to show that the apps run. It is to show that the system proves the specific academic claim set out in the truth base:

> an attendee can enroll on their own phone, receive a server-signed pass containing an encrypted cancelable biometric template, and then be verified offline at the gate with active liveness, replay protection, and non-biometric evaluation logs.

This plan therefore mixes three kinds of evidence:

- code inspection, where the implementation itself already proves a property,
- controlled device trials, where the claim depends on real-world camera and user behavior,
- exported telemetry analysis, where the gate app’s SQLite log is used to explain system performance.

## 2. What Will Be Evaluated

The evaluation is designed to answer five questions.

1. Does the gate app still make the correct entry decision when the phone is offline?
2. Does active liveness remain usable under realistic lighting conditions?
3. Does the manual fallback path work without weakening the security model?
4. Do the exported timings show where the mobile hardware is spending time?
5. Does the implementation actually preserve privacy by avoiding biometric storage and by using a non-invertible cancelable template?

## 3. Evidence Set

The evaluation will use the following artefacts.

| Evidence source                   | What it proves                                                                                                        | Primary files                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Shared template implementation    | The cancelable transform is deterministic, event-scoped, and based on signed random projections with Hamming matching | `packages/shared/src/template.ts`            |
| Enrollment embedding pipeline     | Temporary enrollment photo files are deleted after inference                                                          | `apps/enrollment/src/lib/embedding-model.ts` |
| Gate embedding pipeline           | Temporary gate liveness photo files are deleted after inference                                                       | `apps/gate/src/lib/embedding-model.ts`       |
| Offline verifier                  | The gate verifies signature, checks replay and revocation, decrypts locally, and logs non-biometric results           | `apps/gate/src/lib/offline-verifier.ts`      |
| Gate SQLite schema and CSV export | The exact timing and outcome columns used for quantitative analysis                                                   | `apps/gate/src/lib/gate-db.ts`               |
| Privacy statement                 | The intended privacy claim and model provenance                                                                       | `docs/PRIVACY_BY_DESIGN.md`                  |

## 4. Test Environment

Unless a test explicitly says otherwise, use this setup:

- one iPhone running the gate Expo dev build,
- one iPhone running the enrollment Expo dev build,
- one organizer session on the web dashboard,
- one provisioned event with a valid gate bundle already synced,
- one enrolled genuine participant whose pass was issued before testing begins.

To keep the evidence consistent, the following controls should stay fixed across one batch of tests:

- same gate phone for the entire batch,
- same event and event salt for the entire batch,
- same participant distance from the camera, targeted at roughly 45 to 55 cm,
- same device orientation, portrait mode,
- same iOS version if repeat runs are compared.

Where lighting is part of the methodology, record approximate lux using a phone light meter app or a handheld meter. The number does not need lab precision, but it must place each trial clearly into the intended lighting band.

## 5. Physical Testing Methodology

## 5.1 Active Liveness Under Environmental Stress

The gate app uses three active challenges:

- blink twice,
- turn head left then centre,
- look up then centre.

The goal of physical testing is to find out whether liveness remains usable when the camera is exposed to lighting conditions that are normal for real event entry.

### Mandatory lighting scenarios

| Scenario ID | Condition               | Setup                                                                                                                 |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| L0          | Baseline indoor control | Even indoor light, about 300 to 500 lux, no strong backlight                                                          |
| L1          | Bright sunlight         | Outdoors or directly beside a bright entrance, about 10,000 lux or higher, face front-lit or side-lit                 |
| L2          | Backlit room            | Subject indoors with a bright window or doorway behind them, face at 50 to 150 lux, background substantially brighter |
| L3          | Low light               | Indoor entrance area or evening test at about 20 to 80 lux                                                            |

### Trial structure

For each lighting scenario:

1. Run genuine-user trials until at least **five successful attempts per challenge type** have been collected.
2. Because the app chooses challenges randomly, continue scanning until each challenge has appeared five times and has either passed or failed.
3. Then run **three deliberate failure attempts per challenge type**:
   - wrong motion,
   - no motion,
   - tracking loss by moving out of frame.
4. Then run **three static presentation attacks** using a printed face photo or a second phone screen showing the enrolled participant.

This produces a minimum of:

- 15 genuine attempts per lighting condition,
- 9 deliberate liveness failures per lighting condition,
- 3 photo-attack attempts per lighting condition.

Across the four lighting scenarios, the minimum full liveness dataset is 108 attempts.

### What to record

For every liveness attempt, record:

- scenario ID,
- challenge shown by the app,
- outcome,
- reason code,
- whether tracking was lost,
- `liveness_ms`,
- `match_ms`,
- `total_ms`,
- operator notes on glare, autofocus delay, or landmark instability.

### Interpretation

The liveness subsystem is considered operationally credible if:

- every lighting condition yields genuine successful accepts,
- photo attacks do not produce false accepts,
- most failures in hard lighting are classified as `LIVENESS_FAIL` or `MATCH_FAIL`, not unexplained `SYSTEM_ERROR`,
- the low-light and backlit conditions show where the camera pipeline becomes fragile rather than hiding it.

This is an EPQ prototype, not a commercial biometric benchmark. The purpose is to characterize limits honestly, not to claim universal robustness.

## 5.2 Offline Verification Protocol

The truth base makes one requirement non-negotiable: the gate must verify passes fully offline during scanning.

The protocol below is designed to prove that claim in a way that is easy to repeat and document.

### Precondition

Before entering offline mode:

1. Provision the gate while online.
2. Sync revocations while online.
3. Confirm that the gate already holds:
   - `PK_SIGN_EVENT`,
   - `EVENT_SALT`,
   - `SK_GATE_EVENT`,
   - cached revocations,
   - local replay state.

### Offline procedure

1. Force-close the gate app.
2. Put the gate phone into **Airplane Mode**.
3. Manually confirm that:
   - cellular is off,
   - Wi-Fi is off,
   - Bluetooth is off unless needed for unrelated device control, and if so note it in the test log.
4. Relaunch the gate app while the phone remains in Airplane Mode.
5. Start iOS screen recording.
6. Run the following cases without reconnecting the phone.

### Offline cases

| Case ID | Input                                              | Expected result                |
| ------- | -------------------------------------------------- | ------------------------------ |
| O1      | Valid token from the enrolled participant          | `ACCEPT`                       |
| O2      | Same token scanned again after O1                  | `REPLAY_USED`                  |
| O3      | Token with one altered character                   | `BAD_TOKEN` or `BAD_SIGNATURE` |
| O4      | Token from a different event                       | `WRONG_EVENT`                  |
| O5      | Revoked token that was synced before Airplane Mode | `REVOKED`                      |
| O6      | Expired token                                      | `EXPIRED`                      |

### Evidence required

For each offline case, capture:

- screenshot or screen recording showing Airplane Mode on,
- the gate result screen,
- the exported CSV row for that attempt,
- optional Xcode console or proxy evidence showing no outbound requests during the scan window.

### Why this is a valid proof

If the phone is in Airplane Mode and the gate still verifies the token correctly, the decision path cannot depend on live server access. This does not merely show graceful degradation. It shows that the cryptographic verification, local replay check, local revocation check, decryption, liveness, and match are all happening on-device.

## 5.3 Manual Fallback Protocol

The truth base is clear on this point: an 8-digit queue code must not pretend to reconstruct a pass offline. The authoritative fallback is the **paste-token** route.

### Fallback cases

| Case ID | Method                                                            | Expected result                                     |
| ------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| F1      | Copy full token from enrollment app and paste it into `/fallback` | Same result as QR scan path                         |
| F2      | Paste a truncated token or only the visible snippet               | `BAD_TOKEN`                                         |
| F3      | Present only an 8-digit queue code                                | Must not produce automatic cryptographic acceptance |

### F1: Paste-token protocol

1. On the enrollment phone, open the issued pass.
2. Use the copy action to copy the full token string.
3. On the gate phone, open `/fallback`.
4. Paste the full token.
5. Run verification.
6. Compare the result and timing profile with a normal QR scan of the same token.

The expectation is that the fallback route enters the same offline verifier and produces the same decision, except without optical scan time.

### F3: 8-digit queue code protocol

If a queue code is present in the event flow, it must be evaluated as an **operational aid**, not as a cryptographic credential.

The test should confirm that:

- the queue code alone cannot reconstruct the token offline,
- it does not bypass signature verification,
- any staff action based on the queue code is recorded as a manual override rather than a normal biometric accept.

This distinction matters academically because it shows the project did not weaken the security claim just to satisfy the fallback requirement.

## 6. Quantitative Metrics Dictionary

## 6.1 Exact CSV Columns Exported by the Gate App

The current SQLite CSV export in `apps/gate/src/lib/gate-db.ts` writes the following columns, in this exact order:

| Column             | Exact meaning in the current implementation                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recorded_at`      | ISO timestamp when the log row was written                                                                                                                     |
| `event_id`         | Event identifier for the provisioned gate                                                                                                                      |
| `pass_ref`         | Short hashed pass reference used for analysis without exposing raw `pass_id`                                                                                   |
| `outcome`          | `ACCEPT` or `REJECT`                                                                                                                                           |
| `reason_code`      | Outcome reason such as `ACCEPT`, `REPLAY_USED`, `BAD_SIGNATURE`, `LIVENESS_FAIL`, or `MATCH_FAIL`                                                              |
| `scan_ms`          | Time from the gate scanner becoming ready to the moment a token enters the offline verifier                                                                    |
| `decode_ms`        | Time to base64url-decode and canonical-JSON-validate the token payload                                                                                         |
| `verify_ms`        | Time to verify the Ed25519 signature                                                                                                                           |
| `replay_ms`        | Time to check the local `used_passes` store                                                                                                                    |
| `revocation_ms`    | Time to check the local revocation cache                                                                                                                       |
| `decrypt_ms`       | Time to open the sealed template with the gate X25519 private key                                                                                              |
| `liveness_ms`      | Time spent in the liveness phase before match finalization; in the current build this includes the active challenge and the still-capture-plus-embedding stage |
| `match_ms`         | Time to derive the live cancelable template and compute Hamming distance                                                                                       |
| `total_ms`         | Sum of the stage timings recorded by the verifier                                                                                                              |
| `hamming_distance` | Final Hamming distance when a match stage was reached                                                                                                          |

Important implementation note:

- the CSV does **not** currently export `inference_ms`,
- it also does **not** currently export a separate `template_ms`.

Those names appear in the truth base as ideal evaluation fields, but the current code collapses those costs into broader stages, especially `liveness_ms` and `match_ms`.

## 6.2 How the Timing Columns Should Be Analyzed

The aim is to identify where the gate spends time and whether the bottleneck is:

- operator interaction,
- local cryptography,
- local database checks,
- camera plus TFLite work,
- template matching.

### Step 1: Separate human-in-the-loop time from machine time

Treat these two columns carefully:

- `scan_ms` is primarily an **interaction metric**, not a compute metric,
- `liveness_ms` is a **mixed metric** in the current implementation because it includes both user action and image-processing work.

This means neither column should be used on its own as a pure hardware benchmark.

### Step 2: Compute stage groups

For each successful attempt, calculate:

```text
crypto_ms = decode_ms + verify_ms + decrypt_ms
policy_ms = replay_ms + revocation_ms
template_compare_ms = match_ms
interaction_ms = scan_ms + liveness_ms
```

Then compare the median of each group across all successful attempts and across each lighting condition.

### Step 3: Identify the bottleneck correctly

The computational bottleneck should be defined as the largest median contributor among the **machine-bound** stages:

- `crypto_ms`,
- `policy_ms`,
- `template_compare_ms`,
- inferred TFLite cost within `liveness_ms`.

If `crypto_ms` is consistently small and `match_ms` is also small, then the likely bottleneck is the camera plus inference path hidden inside `liveness_ms`.

### Step 4: Deal honestly with the missing `inference_ms`

Because `inference_ms` is not exported separately in the current build, the evaluation should state this explicitly rather than inventing precision that the data does not support.

For the EPQ write-up, use this wording:

> The gate log can identify whether cryptography or local database checks are negligible compared with the full liveness stage, but it cannot fully isolate TFLite inference time because inference is currently folded into `liveness_ms`.

If stricter separation is required, collect one of these supporting datasets:

- a debug build that splits `liveness_ms` into `challenge_ms`, `capture_ms`, `inference_ms`, and `template_ms`,
- a screen-recorded stopwatch study where the prompt-completion point and the final match decision are manually timed frame by frame.

### Step 5: Compare conditions, not just absolute values

The most useful quantitative analysis is comparative:

- baseline indoor vs bright sunlight,
- baseline indoor vs backlit room,
- baseline indoor vs low light.

If `decrypt_ms` and `verify_ms` stay flat while `liveness_ms` rises sharply in low light or backlight, the bottleneck is not cryptography. It is the camera plus face-tracking pipeline.

## 7. Security and Privacy Validation

## 7.1 How the Cancelable Template Will Be Shown to Be Non-Invertible

The correct claim is not that the template is magically unrecoverable under every imaginable prior model. The correct and defensible claim is narrower:

> `cancelableTemplateV1` is a non-injective, many-to-one transform from a normalized embedding to a 256-bit sign pattern, so the template does not uniquely determine either the original embedding or the original face image.

### Mathematical argument

The implemented transform in `packages/shared/src/template.ts` works as follows:

1. Start with a normalized embedding `e ∈ R^d`, where `d` is the model output size.
2. For each bit `i` from `0` to `255`, compute the sign of a dot product against a salt-derived random hyperplane.
3. Store only that sign bit.

So the output is not the embedding itself. It is a 256-bit record of which side of 256 hyperplanes the embedding lies on.

Formally, each bit gives only one inequality:

```text
sign(r_i · e) = b_i
```

where `r_i` is derived from `EVENT_SALT`.

That means the template defines a region of feasible embeddings, not a unique point. In this project the embedding dimension is larger than the number of exported bits, and the transform keeps only sign information, not the original projection magnitudes. The mapping is therefore many-to-one.

There is a second many-to-one stage before that:

```text
face image -> embedding -> cancelable template
```

Even if someone could guess one embedding compatible with a template, that would still not give them a unique original face image.

### What will be written in the evaluation

The EPQ evaluation should say:

- the template is not a stored face image,
- the template is not a stored raw embedding,
- the template only preserves sign decisions from event-scoped random projections,
- the same participant enrolled under a different `EVENT_SALT` produces a different template,
- the transform is therefore cancelable and event-scoped.

### Supporting empirical check

To support the mathematical argument, include a simple empirical appendix:

- generate the same participant template under two different event salts,
- show that the resulting 32-byte outputs differ,
- explain that cross-event matching is therefore not a direct equality test.

This does not prove non-invertibility by itself, but it supports the privacy claim that the template is event-scoped and not globally reusable.

## 7.2 How We Will Prove Temporary Files Are Not Left Behind

The privacy documents already note one platform caveat:

- Expo plus VisionCamera still expose still capture through temporary file URIs,
- the apps delete those temporary files immediately after they are consumed.

### Static proof from source inspection

The deletion points are explicit in both pipelines:

- `apps/enrollment/src/lib/embedding-model.ts`
- `apps/gate/src/lib/embedding-model.ts`

In both files:

- the aligned crop file is deleted immediately after its bytes are read,
- the source photo file is deleted inside a `finally` block so cleanup still runs if inference throws.

That proves the intended cleanup behavior is present in the code.

### Dynamic proof on iOS

The empirical validation should be done in two passes.

#### A. Simulator pass

1. Install the dev build on iOS Simulator.
2. Before capture, inspect the app container’s temporary and cache directories.
3. Run one enrollment attempt and one gate liveness attempt.
4. Inspect the same directories again immediately after each attempt.
5. Relaunch the app and inspect once more.

Success condition:

- no JPEG or aligned-crop artefact remains in the sandbox after the flow completes.

#### B. Physical device pass

1. Run the same flows on a real iPhone.
2. Use Xcode’s device container inspection after the run.
3. Download the container and inspect the relevant temporary and cache locations.

Success condition:

- no residual image file attributable to VisionCamera capture or aligned-crop generation remains after the run.

### Correct claim to make

The evaluation must use careful wording:

> The system does not achieve a pure in-memory still-capture path because the current Expo and VisionCamera interface is file-backed. What it does prove is that those temporary files are deleted immediately and are not intentionally retained after the biometric step finishes.

That is the academically accurate privacy claim for the current implementation.

## 8. Mapping Back to the Project Goal and Locked Constraints

## 8.1 Project Goal Mapping

| Project-goal clause from the truth base     | Evaluation evidence                                                      | Pass condition                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Attendee generates template on-device       | Enrollment device trial plus source inspection of local TFLite pipeline  | Enrollment succeeds without backend biometric processing                |
| Template is obfuscated into cancelable form | Mathematical review of `cancelableTemplateV1` plus cross-salt comparison | Different salts produce different templates; no raw embedding is stored |
| Template is encrypted to the gate           | Offline verifier and X25519 decryption path                              | Gate can decrypt; other clients cannot verify entry without gate secret |
| Payload is server-signed                    | Offline bad-signature test                                               | Tampered token is rejected offline                                      |
| Gate verifies fully offline                 | Airplane Mode protocol O1 to O6                                          | Correct decisions made with radios disabled                             |
| Active liveness is part of the decision     | Lighting matrix L0 to L3                                                 | Real users can complete challenge; photo attacks do not pass            |
| Match uses Hamming distance                 | Gate result rows with `hamming_distance`                                 | Accept and reject decisions align with distance threshold               |
| Non-biometric logs are exported             | CSV export inspection                                                    | Export contains timings and reasons, but no biometric content           |

## 8.2 Locked Constraint Mapping

| Locked constraint                            | How it is evaluated                                                       | Evidence                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| iOS only                                     | Run all physical tests on iPhone dev builds                               | Test log and screenshots                                    |
| Expo Dev Build only                          | Use the built Expo dev clients, not Expo Go                               | Build notes and device screenshots                          |
| Server signing only                          | Tamper test and code inspection of signing secret location                | Edge function design plus offline `BAD_SIGNATURE` rejection |
| One gate phone per event                     | Provision one event, then attempt second provisioning and confirm refusal | Provisioning test record                                    |
| Single-entry only                            | O1 then O2 replay trial                                                   | `REPLAY_USED` row in CSV                                    |
| Enrollment on attendee’s own phone           | Standard enrollment flow before gate trials                               | Enrollment screenshots and issued token                     |
| Typed or paste fallback must exist           | F1 and F2 fallback tests                                                  | `/fallback` route outcome                                   |
| Face model must be pre-trained and on-device | Model provenance in privacy document plus local inference flow            | `docs/PRIVACY_BY_DESIGN.md` and device trials               |
| No biometric storage                         | Source inspection, sandbox inspection, CSV inspection                     | No images, embeddings, or templates in backend or export    |

## 8.3 Definition of Done for the Evaluation Phase

For the EPQ report, the artefact should be described as having met the truth-base definition of done when the following evidence has been collected:

1. One organizer event was created and provisioned exactly once.
2. One attendee enrolled successfully and displayed a signed pass.
3. The gate accepted a valid pass in Airplane Mode.
4. The same gate rejected the replay of that pass.
5. The gate rejected a tampered or wrong-event token offline.
6. The gate completed the paste-token fallback path.
7. The gate exported a CSV containing timing and reason fields only.
8. Source inspection and sandbox inspection showed no retained biometric image files after processing.

## 9. Reporting Guidance for the Final EPQ Write-Up

When this evaluation is written up, the conclusions section should stay disciplined.

It is reasonable to claim:

- the prototype demonstrates offline biometric event entry,
- the biometric representation is transformed and event-scoped rather than stored directly,
- replay protection works locally on the gate,
- the system exports enough timing data to discuss operational latency,
- lighting conditions materially affect the liveness and capture stage more than the cryptographic stage.

It is not reasonable to claim:

- that the system is production-ready for all lighting conditions,
- that the template is cryptographically impossible to attack in every theoretical sense,
- that the current CSV fully isolates TFLite inference cost,
- that the Expo camera path is purely in-memory.

That distinction strengthens the EPQ rather than weakening it. It shows that the evaluation is tied to the actual artefact, not to marketing language.
