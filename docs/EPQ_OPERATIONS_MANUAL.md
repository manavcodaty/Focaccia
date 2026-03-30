# EPQ Operations Manual

This manual is the operator reference for the final Face Pass prototype. It covers two things:

1. How to boot and operate the system end to end on a local development stack.
2. How to run the EPQ evaluation in a way that is repeatable, measurable, and aligned with the implemented codebase.

This document reflects the repository as built, not the original design intent. The current local baseline is Node 24, pnpm 10.33.0, Next.js 16, Expo 55, Supabase local development, and the gate's offline SQLite verifier.

## Part 1: User Guide

### Local Boot Sequence

Use separate terminals for each long-running process.

#### Terminal 1: install dependencies

```bash
cd /Users/manavcodaty/repos/Focaccia
pnpm install
```

#### Terminal 2: start the local Supabase stack

Standard command:

```bash
cd /Users/manavcodaty/repos/Focaccia
supabase start
```

Verified command for this workstation and Colima setup:

```bash
cd /Users/manavcodaty/repos/Focaccia
DOCKER_HOST=ssh://colima supabase start -x logflare,studio,vector
```

#### Terminal 3: serve the Edge Functions locally

The functions import the local shared package through `supabase/functions/import_map.json`.

Verified local command:

```bash
cd /Users/manavcodaty/repos/Focaccia
DOCKER_HOST=ssh://colima supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local --import-map supabase/functions/import_map.json
```

Notes:

- `supabase/functions/.env.local` must already exist locally and contain the Supabase keys plus `FACE_PASS_SECRET_WRAPPING_KEY_B64URL`.
- `--no-verify-jwt` is a local runtime workaround documented in [docs/ASSUMPTIONS.md](/Users/manavcodaty/repos/Focaccia/docs/ASSUMPTIONS.md).

#### Terminal 4: configure and start the web dashboard

Create the local web env file once:

```bash
cd /Users/manavcodaty/repos/Focaccia
cp apps/web/.env.local.example apps/web/.env.local
```

Then read the local Supabase values:

```bash
cd /Users/manavcodaty/repos/Focaccia
DOCKER_HOST=ssh://colima supabase status -o env
```

Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local`, then start the dashboard:

```bash
cd /Users/manavcodaty/repos/Focaccia/apps/web
pnpm dev
```

The organizer dashboard will be available at [http://localhost:3000](http://localhost:3000).

#### Terminal 5: start the Enrollment app dev client

```bash
cd /Users/manavcodaty/repos/Focaccia/apps/enrollment
npx expo start --dev-client --clear
```

#### Terminal 6: start the Gate app dev client

```bash
cd /Users/manavcodaty/repos/Focaccia/apps/gate
npx expo start --dev-client --clear
```

### iOS Dev Build Commands

Run these from each app directory.

#### Enrollment iOS dev build

```bash
cd /Users/manavcodaty/repos/Focaccia/apps/enrollment
npx eas build --profile development --platform ios
```

#### Gate iOS dev build

```bash
cd /Users/manavcodaty/repos/Focaccia/apps/gate
npx eas build --profile development --platform ios
```

Operational note:

- The repository does not currently check in an `eas.json`. On a first run, EAS may prompt to create project metadata or confirm default build settings. Accept the prompt, then continue with the same command.

### Happy Path Walkthrough

#### 1. Organizer creates an event

1. Open [http://localhost:3000/login](http://localhost:3000/login).
2. Sign up or log in as the Event Organizer.
3. On the dashboard, click `Create Event`.
4. Fill in `Event name`, `Event ID`, `Starts at`, and `Ends at`.
5. Submit `Create event`.
6. Record the generated `join_code`.
7. Open the new event detail page and confirm the public values:
   `PK_SIGN_EVENT` and `EVENT_SALT`.

What the system does at this step:

- The `create-event` Edge Function creates the event row.
- It generates an event-specific signing keypair.
- It generates the attendee `join_code`.
- It stores the event private signing key through the wrapped secret storage pattern documented in [docs/ASSUMPTIONS.md](/Users/manavcodaty/repos/Focaccia/docs/ASSUMPTIONS.md).

#### 2. Gate device is provisioned

1. On the web event detail page, click `Open provisioning page`.
2. Leave the provisioning QR visible on the organizer dashboard.
3. On the Gate app, open the provisioning flow.
4. Sign in with the organizer email and password.
5. Scan the provisioning QR using the device camera.
6. Review the decoded public values on the phone:
   `event_id`, `PK_SIGN_EVENT`, `EVENT_SALT`, `starts_at`, and `ends_at`.
7. Confirm provisioning.
8. Wait for the Gate app to transition to the `Scan` screen.

What the system does at this step:

- The Gate app generates its own X25519 keypair locally.
- `SK_GATE_EVENT` is stored in `expo-secure-store`.
- Only `PK_GATE_EVENT` is sent to the `provision-gate` Edge Function.
- The one-gate-per-event rule is enforced server-side.
- The Gate app stores the offline bundle in local SQLite.

#### 3. Attendee enrolls on their own phone

1. Open the Enrollment app.
2. Enter the 8-character `join_code`.
3. Continue to the consent screen and approve the enrollment flow.
4. Capture the attendee face when prompted.
5. Wait for the app to process the face locally.
6. When the pass screen appears, keep the QR token visible.
7. If needed, copy the full token for manual fallback.

What the system does at this step:

- The Enrollment app fetches the public enrollment bundle with `get-enrollment-bundle`.
- A local FaceNet model extracts an embedding from the captured image.
- `cancelableTemplateV1` derives an event-scoped template from the embedding and `EVENT_SALT`.
- The template is encrypted to `PK_GATE_EVENT`.
- The app sends only the signed pass payload request to `issue-pass`.
- The final attendee QR contains canonical JSON plus an Ed25519 signature.
- The temporary image files are deleted immediately after inference, as documented in [docs/PRIVACY_BY_DESIGN.md](/Users/manavcodaty/repos/Focaccia/docs/PRIVACY_BY_DESIGN.md).

#### 4. Gate verifies the attendee pass

1. On the Gate app, stay on the `Scan` screen.
2. Scan the attendee QR token.
3. If the token passes the pre-checks, complete the active liveness prompt.
4. Let the device capture the verification frame.
5. Read the final decision on the `Result` screen.

What the gate checks before liveness:

- QR token decodes correctly.
- Canonical JSON payload is valid.
- Ed25519 signature verifies against `PK_SIGN_EVENT`.
- `event_id` matches the provisioned event.
- `iat` and `exp` are valid for the current event window.
- The pass is not already marked used in local SQLite.
- The pass is not in the local revocation cache.
- The encrypted template can be opened with `SK_GATE_EVENT`.

What the gate checks after liveness:

- The attendee completes the active liveness challenge.
- A live embedding is extracted with the same FaceNet model used by Enrollment.
- A live event-scoped template is derived with the same `cancelableTemplateV1`.
- The gate computes the Hamming distance.
- If the distance is less than or equal to the displayed gate threshold, the pass is accepted and `pass_id` is written to local SQLite to block replay.

#### 5. Manual fallback if optical QR scanning fails

1. On the Enrollment app pass screen, tap `Copy full token`.
2. On the Gate app, open `Manual fallback`.
3. Paste the full token text.
4. Run the same offline verification flow.

Important:

- The queue code or token snippet is not enough to reconstruct a pass.
- The gate fallback screen requires the full token string.

## Part 2: EPQ Evaluation Protocol

### Test Session Controls

Apply these controls to every EPQ trial set.

- Provision one gate device to one event before collecting data.
- Record the displayed match threshold on the Gate app at the start of the session. The current local default is `80`, derived from `FACE_PASS_MATCH_THRESHOLD`, but the protocol should always use the value actually provisioned to the device.
- Use a fresh pass token for every biometric trial that is intended to measure FAR, FRR, or SAR. This avoids contaminating the metric with the gate's legitimate single-entry replay protection.
- Keep lighting condition, device model, participant identity, and trial outcome in a separate lab notebook or spreadsheet.
- Export the gate CSV after each session block so the biometric outcomes and timing data are preserved.

### False Acceptance Rate (FAR) Protocol

#### Objective

Measure how often an impostor can present a valid stolen QR token but their own face and still be incorrectly accepted.

#### Required scenario

- One genuine attendee completes enrollment and receives a valid pass.
- A different participant presents that genuine attendee's QR code at the gate.
- The impostor attempts to complete the liveness prompt honestly using their own face.

#### Minimum trial plan

- 10 genuine tokens.
- 3 impostors per genuine token.
- 2 attempts per impostor.
- Minimum dataset: 60 impostor trials.

#### Procedure

1. Enroll the genuine attendee and issue a fresh pass token.
2. Hand that token to an impostor participant.
3. On the Gate app, scan the stolen token.
4. Ask the impostor to complete the liveness prompt normally.
5. Record the final reason code and Hamming distance.
6. Repeat with a fresh token for the next trial.

#### Scoring rule

- Count a `false accept` only when the final gate decision is `ACCEPT`.
- Count a `true reject` when the final decision is `MATCH_FAIL`, `LIVENESS_FAIL`, `DECRYPT_FAIL`, or another reject outcome caused by the gate.
- Do not include operator errors such as scanning the wrong event QR in the FAR denominator.

#### Formula

```text
FAR = false_accepts / valid_impostor_trials * 100
```

### False Rejection Rate (FRR) Protocol

#### Objective

Measure how often a genuine attendee is incorrectly rejected even though they present their own valid pass and real face.

#### Required conditions

Run genuine-user trials under all of the following conditions:

| Condition group | Exact scenario                                             |
| --------------- | ---------------------------------------------------------- |
| Baseline        | Neutral indoor lighting, no accessories, front-facing pose |
| Bright light    | Bright sunlight or strong daylight from the front          |
| Backlit         | Strong light source behind the participant                 |
| Low light       | Dim room with reduced facial contrast                      |
| Glasses         | Same participant wearing glasses if they normally use them |
| Angle stress    | Slight left yaw, slight right yaw, slight pitch up         |

#### Minimum trial plan

- 10 genuine participants.
- 1 fresh pass per condition group.
- Minimum dataset: 60 genuine trials.

#### Procedure

1. Issue a fresh pass for the participant.
2. Run the scan and liveness flow in the target condition.
3. Record the final reason code, Hamming distance, and any operator notes.
4. Repeat for each required condition.

#### Scoring rule

- Count a `false reject` when a genuine participant is rejected despite following instructions and presenting a valid pass.
- `MATCH_FAIL` and `LIVENESS_FAIL` are both relevant to overall system FRR because the gate experience includes both stages.
- Analyze the reject distribution by condition to identify the most fragile scenario.

#### Formula

```text
FRR = false_rejects / valid_genuine_trials * 100
```

Interpretation note:

- If `MATCH_FAIL` rises in low light or angle stress, the template threshold is likely the limiting factor.
- If `LIVENESS_FAIL` rises while Hamming distances stay low on successful runs, the liveness UX is the limiting factor.

### Spoof Acceptance Rate (SAR) Protocol

#### Objective

Measure how often the active liveness system can be bypassed using a presentation attack such as a printed photo or another screen.

#### Attack media

Test all of these presentation attack types:

| Attack type             | Exact setup                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Printed photo           | High-resolution face print held in front of the gate camera       |
| Phone replay            | The genuine attendee's face photo or video shown on another phone |
| Tablet or laptop replay | The same media shown on a larger bright display                   |

#### Minimum trial plan

- 10 attempts per attack type.
- Run at least 30 spoof trials in total.
- Use a fresh valid pass token for each spoof attempt.

#### Procedure

1. Enroll a genuine attendee and create a fresh valid pass token.
2. Present the token to the gate.
3. Instead of the real person, present the spoof medium.
4. Try to satisfy the active challenge using only the spoof medium.
5. Record the result and reason code.

#### Scoring rule

- Count a `spoof accept` only when the gate returns `ACCEPT`.
- A `LIVENESS_FAIL` is a successful defense.
- A `MATCH_FAIL` after liveness is also a successful defense because the attack still fails to gain entry.

#### Formula

```text
SAR = spoof_accepts / spoof_trials * 100
```

### Hardware Performance Audit

#### Objective

Use the gate's SQLite-backed CSV export to identify the mobile bottleneck in the offline verify loop.

#### Exact CSV columns exported by the Gate app

The current build exports these columns in this order:

```text
recorded_at,event_id,pass_ref,outcome,reason_code,scan_ms,decode_ms,verify_ms,replay_ms,revocation_ms,decrypt_ms,liveness_ms,match_ms,total_ms,hamming_distance
```

#### How to export the CSV

1. Open the Gate app.
2. Navigate to the `Export` screen.
3. Use `Copy CSV to clipboard` or `Share CSV file`.
4. Save the export as `gate-logs.csv`.

#### How to analyze the timings

Use only rows that represent complete runs for the question you are asking.

- For accepted-path performance, filter to `reason_code = ACCEPT`.
- For liveness stress analysis, inspect both `ACCEPT` and `LIVENESS_FAIL`.
- For replay protection analysis, inspect `REPLAY_USED` rows separately because they stop before matching.

Example calculation script:

```bash
cd /Users/manavcodaty/repos/Focaccia
python - <<'PY'
import csv
import statistics

with open("gate-logs.csv", newline="") as handle:
    rows = list(csv.DictReader(handle))

accepted = [row for row in rows if row["reason_code"] == "ACCEPT"]

for column in ("decrypt_ms", "liveness_ms", "match_ms", "total_ms"):
    values = [int(row[column]) for row in accepted if row[column]]
    if not values:
        continue
    print(
        column,
        "mean=", round(statistics.fmean(values), 2),
        "median=", round(statistics.median(values), 2),
        "max=", max(values),
    )
PY
```

#### Bottleneck interpretation

- `decrypt_ms` isolates the X25519 sealed-box open path.
- `match_ms` isolates the Hamming-distance comparison and decision stage.
- `liveness_ms` is the current exported end-to-end live stage. In this build it includes challenge completion time plus capture and on-device inference.
- The current CSV does not expose a standalone `inference_ms` column. If the EPQ write-up needs inference as a separate measured value, add temporary debug instrumentation before data collection. Do not claim that the current CSV already contains it.

Use this ratio to identify the dominant stage:

```text
stage_share = average_stage_ms / average_total_ms
```

The largest stage share is the current hardware bottleneck.

### Offline Constraint Test

#### Objective

Prove that the gate can verify passes without network access and that replay attacks are blocked locally.

#### Preconditions

- The gate must already be provisioned.
- The gate must already have a revocation sync for the event.
- At least one attendee must already hold a valid pass.

#### Procedure

1. While the system is still online, complete provisioning and enrollment normally.
2. On the gate device, open the `Scan` screen and confirm the event bundle is already present.
3. Put the gate device into Airplane Mode.
4. Disable Wi-Fi manually if the iPhone leaves Wi-Fi enabled during Airplane Mode.
5. Stop the local backend services on the host machine:

```bash
pkill -f "supabase functions serve" || true
pkill -f "next dev" || true
pkill -f "supabase start" || true
```

6. Scan a valid attendee QR on the offline gate.
7. Complete liveness and confirm the first scan returns `ACCEPT`.
8. Without issuing a new pass, scan the same QR a second time.
9. Confirm the second scan returns `REPLAY_USED`.
10. Export the gate CSV immediately after the two scans.

#### Expected evidence

- The first scan succeeds while the gate has no backend connectivity.
- The second scan is rejected locally as `REPLAY_USED`.
- The CSV shows both events with the same `pass_ref`, proving that replay blocking is enforced from local SQLite rather than the network.

### Recommended Evidence Pack for the EPQ Write-Up

Collect these artifacts for the final report:

- Screenshot of the organizer dashboard showing the event and provisioning page.
- Screenshot of the Enrollment app showing the issued QR token.
- Screenshot of the Gate app result screen for `ACCEPT`, `MATCH_FAIL`, `LIVENESS_FAIL`, and `REPLAY_USED`.
- Exported `gate-logs.csv`.
- A trial sheet listing participant ID, condition, outcome, and notes.
- A short paragraph in the report explaining that the current production CSV exports `liveness_ms` rather than a separate `inference_ms`.

### Definition of a Successful EPQ Demonstration

For the final EPQ demonstration, the system should show all of the following:

- The organizer can create a new event and recover the `join_code`.
- The gate can be provisioned exactly once for that event.
- An attendee can enroll and receive a signed QR pass.
- The gate can verify the pass fully offline.
- A second scan of the same pass is rejected as a replay.
- The exported CSV provides enough timing data to discuss computational cost and identify the dominant stage in the mobile verify loop.
