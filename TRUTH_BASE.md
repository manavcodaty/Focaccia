
You are a senior full-stack engineer specialising in mobile security, cryptography, and privacy-preserving biometrics. Your task is to build an end-to-end production-quality prototype (EPQ artefact) called “One-Time Face Pass” consisting of THREE components: (1) Organizer Web Dashboard, (2) Enrollment iOS App, (3) Gate Verifier iOS App, plus a shared package. You must generate a complete monorepo with all code, configuration, migrations, and documentation. The final system must work exactly as specified below.

CRITICAL RULES
1) Do not ask me questions. If anything is unspecified, choose the safest default, document it in /docs/ASSUMPTIONS.md, and proceed.
2) Do not take shortcuts (no fake checks, no stubbed security, no “TODO: implement crypto”). All crypto, obfuscation, and verification flows must actually work.
3) Do not store biometric data (images or embeddings) anywhere. No disk, no logs, no analytics.
4) The gate app MUST verify passes fully offline during scanning (no network requirement for entry decision).
5) The pass must be useless if stolen (QR theft must not expose biometrics).
6) iOS only. Expo Dev Builds only. One gate phone only. Single-entry only. Server signing only. Attendee enrolls pre-event on their phone. A typed/paste fallback must exist.

PROJECT GOAL (what this artefact must prove)
Implement privacy-preserving event entry where the attendee generates a facial template on-device, obfuscates it into a cancelable form, encrypts it to the gate device, and gets the payload server-signed. At the gate, an offline verifier scans the QR, verifies signature, decrypts the protected template, performs active liveness, computes a live template, and matches using Hamming distance. Log timings + reason codes (non-biometric) for evaluation.

LOCKED CONSTRAINTS (DO NOT CHANGE)
- Platform: iOS only.
- Mobile: React Native with Expo, using Expo Dev Build (EAS build). NOT Expo Go.
- Web: Next.js 16 (App Router).
- Signing: server signing only (private signing key never leaves server).
- Gate: exactly one gate phone per event.
- Entry policy: single entry only (replays are rejected).
- Enrollment: attendee enrolls on their own phone before the event.
- Manual fallback: typed/paste code/token (see fallback section).
- Face model: use an existing pre-trained on-device face embedding model (no training).
- Privacy: face data must be obfuscated into a cancelable template and never stored; template must be encrypted inside QR.

STACK + VERSION PINS
Web:
- Node 24
- pnpm 10.33.0
- next 16.2.1
- react 19.2.4
- react-dom 19.2.4
- tailwindcss 4.2.2
- @supabase/supabase-js 2.100.0
- typescript 6.0.2
Mobile:
- expo 55.0.8
- expo-dev-client 55.0.18
- expo-router 55.0.7
- react 19.2.4
- react-native 0.84.1
- expo-linking 55.0.8
- expo-constants 55.0.9
- @expo/metro-runtime 55.0.6
- react-native-vision-camera 4.7.3
- react-native-fast-tflite 2.0.0
- @more-tech/react-native-libsodium 1.5.6
- @ashleysmart/react-native-vision-camera-face-detector 1.0.8
- react-native-gesture-handler 2.30.0
- react-native-reanimated 4.2.3
- react-native-safe-area-context 5.7.0
- react-native-screens 4.24.0
Shared:
- libsodium-wrappers 0.8.2
NOTE: Use VisionCamera’s built-in code scanning API for QR scanning (do not use archived code-scanner packages).

REPO STRUCTURE (MUST MATCH)
face-pass/
  apps/
    web/                      # Next.js 16 organizer dashboard
    enrollment/               # Expo iOS enrollment app
    gate/                     # Expo iOS gate verifier app
  packages/
    shared/                   # shared TS types + crypto + template utils
  supabase/
    functions/
      create-event/
      provision-gate/
      get-enrollment-bundle/
      issue-pass/
      revoke-pass/
      gate-sync/
      upload-gate-logs/       # optional but implemented
    migrations/
  docs/
    ARCHITECTURE.md
    THREAT_MODEL.md
    PRIVACY_BY_DESIGN.md
    EVALUATION_PLAN.md
    ASSUMPTIONS.md
  pnpm-workspace.yaml
  package.json
  README.md

DELIVERABLE FORMAT (VERY IMPORTANT)
- Output a file tree.
- Then output EVERY FILE’S FULL CONTENT.
- For each file: start with a header like “FILE: /path/to/file” and then include a fenced code block of its contents.
- Include complete working code, not pseudo-code.

──────────────────────────────────────────────────────────────────────────────
SYSTEM DESIGN (AUTHORITATIVE)
──────────────────────────────────────────────────────────────────────────────

A) CRYPTOGRAPHY (NON-NEGOTIABLE)
Use libsodium primitives (via RN binding on mobile, and libsodium or equivalent on server). Do NOT invent crypto.
- Signatures: Ed25519
- Encryption: X25519 sealed boxes (crypto_box_seal / crypto_box_seal_open)
- Hash/KDF: BLAKE2b / HKDF (implement HKDF using libsodium generichash if necessary)

Canonical encoding:
- JSON payload must be canonicalised: UTF-8, lexicographically sorted keys, no whitespace.
- QR token: TOKEN = base64url(payload_bytes) + "." + base64url(signature_bytes)

Event-scoped key hierarchy (per event_id):
1) Server signing keypair:
   - SK_SIGN_EVENT: stored ONLY as Supabase Edge Function secret (never in DB)
   - PK_SIGN_EVENT: stored in events table and distributed to gate
2) Gate encryption keypair:
   - SK_GATE_EVENT: generated on gate device; stored in iOS Keychain (SecureStore)
   - PK_GATE_EVENT: stored in DB; distributed to enrollment devices
3) Event salt:
   - EVENT_SALT: random 32 bytes; stored in DB; distributed to both apps
4) Optional fallback secret:
   - K_CODE_EVENT: random 32 bytes; stored as Edge secret + on gate; used for optional 8-digit code generation

B) CANCELABLE BIOMETRIC TEMPLATE (MANDATORY)
Goal: Convert a floating embedding vector e (length d) into a 256-bit cancelable template t (32 bytes) that is deterministic per event but unlinkable across events.

Implement cancelableTemplateV1(e, EVENT_SALT):
- e is L2-normalized.
- For each bit i in 0..255:
  s = Σ_j ( e[j] * sgn(i, j) )
  where sgn(i, j) = +1 or -1 derived deterministically from a hash:
    h = BLAKE2b(EVENT_SALT || uint16(i) || uint16(j))
    sgn = (first_bit(h) == 0) ? +1 : -1
  bit_i = (s >= 0) ? 1 : 0
- Pack 256 bits into 32 bytes.
Matching uses Hamming distance:
  dist = popcount(t_pass XOR t_live)
Accept if dist <= MATCH_THRESHOLD (start with 80, expose in gate settings but lock behind organizer auth).

C) FACE PIPELINE (REAL, ON-DEVICE)
- Use VisionCamera + face detector plugin for bounding box + landmarks.
- Align face crop using eye landmarks.
- Run TFLite face embedding model (MobileFaceNet / ArcFace compatible). Include the model file in repo under apps/*/assets/models/ and document licensing/provenance in /docs/PRIVACY_BY_DESIGN.md.
- Raw frames are processed in memory only.
- Raw embedding e must never be persisted; zero out typed arrays where possible after template creation.

D) PASS PAYLOAD + QR FORMAT
Payload JSON (before canonical encoding/signing):
{
  "v": 1,
  "event_id": "TEXT",
  "iat": UNIX_SECONDS,
  "exp": UNIX_SECONDS,
  "pass_id": "base64url(16 random bytes)",
  "nonce": "base64url(12 random bytes)",
  "enc_template": "base64url(crypto_box_seal(template32, PK_GATE_EVENT))",
  "single_use": true
}
Server signs payload_bytes with SK_SIGN_EVENT.
Enrollment app assembles TOKEN string and displays as QR.

E) OFFLINE GATE VERIFICATION FLOW (MUST WORK)
On scan:
1) Parse TOKEN into payload_b64 + sig_b64
2) payload_bytes = base64url_decode(payload_b64)
3) Verify Ed25519 signature with PK_SIGN_EVENT
4) Parse JSON payload; validate:
   - event_id matches the provisioned event
   - iat <= now <= exp
   - single_use true
5) Check local SQLite:
   - used_passes contains pass_id -> reject REPLAY_USED
6) Check cached revocations list:
   - if revoked -> reject REVOKED
7) Decrypt template:
   - template32 = crypto_box_seal_open(enc_template, PK_GATE_EVENT, SK_GATE_EVENT)
8) Run active liveness challenge (below). Fail -> LIVENESS_FAIL
9) Capture live face -> embedding -> cancelableTemplateV1 -> t_live
10) Compare dist; if dist <= threshold -> ACCEPT else MATCH_FAIL
11) On ACCEPT: insert pass_id into used_passes and show green accept UI + haptic
12) Log timings + reason code (non-biometric), exportable CSV

F) ACTIVE LIVENESS (BASIC BUT REAL)
Randomly choose one prompt per attempt:
- Blink twice (use eye landmarks/EAR + two closed-open cycles)
- Turn head left then centre (yaw threshold crossed and returns)
- Look up then centre (pitch threshold crossed and returns)
Constraints:
- Must succeed within 4 seconds
- Face must remain tracked continuously
- If tracking lost -> prompt resets
Record liveness_ms and fail reason.

G) FALLBACK (“TYPED CODE” REQUIREMENT)
The fallback must not pretend an 8-digit code can reconstruct a pass offline without pre-sync.
Authoritative implementation:
- Gate app includes a “Paste token” screen where staff can paste the TOKEN string (typed/pasted) if camera scanning fails.
- Enrollment app shows a short “token snippet” UI to assist manual entry (e.g., first/last 12 chars) but the full token must be accessible (copy button).
Optional secondary:
- Generate an 8-digit “queue code” for human handling; gate can accept it only via manual override (logged as MANUAL_OVERRIDE). Document this clearly.

H) LOGGING + EVALUATION (NON-BIOMETRIC ONLY)
Gate logs to SQLite a row per attempt:
- timestamp, event_id, outcome, reason_code
- scan_ms, sig_verify_ms, decrypt_ms, liveness_ms, inference_ms, template_ms, match_ms, total_ms
- dist (number)
- pass_id_hash = BLAKE2b(pass_id) truncated (e.g., 8 bytes base64url)
Export CSV via share sheet; optionally upload to Supabase Storage and show link in dashboard.

I) ORGANIZER WEB DASHBOARD (REQUIRED FEATURES)
- Supabase Auth login for organizers
- Create event: name, event_id (string), starts_at, ends_at
- Display join_code for attendees
- Gate provisioning page:
  - show whether gate is provisioned
  - show PK_SIGN_EVENT and EVENT_SALT
  - show “Provision Gate” instructions (gate app does the keygen; web just displays state)
- Revocations page: list revoked pass_ids and add/remove
- Gate logs page (optional): list uploaded CSV links and download

J) SUPABASE DATABASE + FUNCTIONS (MUST IMPLEMENT)
Tables:
events:
- id uuid pk default gen_random_uuid()
- event_id text unique not null
- name text not null
- starts_at timestamptz not null
- ends_at timestamptz not null
- join_code text unique not null
- event_salt text not null (base64url 32 bytes)
- pk_sign_event text not null
- pk_gate_event text null until provisioned
- created_by uuid not null (auth.users)
- created_at timestamptz default now()

gate_devices:
- id uuid pk
- event_id text references events(event_id) unique (enforce one gate)
- device_name text
- pk_gate_event text
- provisioned_at timestamptz default now()

revocations:
- id uuid pk
- event_id text references events(event_id)
- pass_id text
- revoked_at timestamptz default now()
- unique(event_id, pass_id)

gate_logs (optional):
- id uuid pk
- event_id text
- uploaded_at timestamptz
- csv_url text

RLS:
- Only created_by can modify their events, revocations, and view gate logs.
- Enrollment bundle is served via Edge Function and does not expose secrets.

Edge Functions (Deno TS) EXACT BEHAVIOUR:
1) create-event (auth required)
   - generate join_code (8 chars)
   - generate EVENT_SALT 32 bytes
   - generate Ed25519 signing keypair
   - store SK_SIGN_EVENT as an Edge secret keyed by event_id (or stored in a secure KV pattern; document approach)
   - store PK_SIGN_EVENT in events table
2) provision-gate (auth required)
   - accept PK_GATE_EVENT from gate app
   - ensure no gate already exists for event
   - set events.pk_gate_event and create gate_devices row
   - generate K_CODE_EVENT 32 bytes secret and store server-side (optional)
   - return GateBundle (PK_SIGN_EVENT, EVENT_SALT, policy config, and K_CODE_EVENT if used)
3) get-enrollment-bundle (public)
   - input: join_code
   - refuse if pk_gate_event is null
   - return EnrollmentBundle including pk_gate_event, pk_sign_event, event_salt, times, event_id
4) issue-pass (public)
   - validate times and event existence
   - canonicalize payload
   - sign with SK_SIGN_EVENT
   - optionally compute 8-digit queue code using K_CODE_EVENT
   - return signature + queue_code
5) revoke-pass (auth required)
6) gate-sync (auth required)
   - return revocations list + policy config
7) upload-gate-logs (auth required)
   - upload CSV to Storage and store URL in gate_logs

K) APPS UI + ROUTES (MUST MATCH)
Enrollment routes:
- / (join code)
- /consent
- /capture
- /pass
- /help

Gate routes:
- / (organizer login status + event select)
- /provision
- /scan
- /liveness
- /result
- /fallback
- /settings
- /export

Shared package:
- Canonical JSON, base64url, libsodium init wrappers, cancelableTemplateV1, hammingDistance, timing helpers, shared types.

──────────────────────────────────────────────────────────────────────────────
IMPLEMENTATION REQUIREMENTS
──────────────────────────────────────────────────────────────────────────────

1) Use strict TypeScript everywhere. No “any” unless justified and documented.
2) Provide a robust error system: every rejection must have a specific reason code and a human-readable hint.
3) Provide tests:
   - shared: cancelableTemplateV1 determinism, hammingDistance correctness, base64url roundtrip
   - backend: signature verification test vector
4) Provide developer experience:
   - root README with setup instructions for Supabase + running web + building Dev Builds with EAS
   - scripts in root package.json to run all apps and lint/test
5) Provide documentation:
   - ARCHITECTURE.md with a Mermaid diagram for data flow
   - THREAT_MODEL.md with T1–T6 and mitigations
   - PRIVACY_BY_DESIGN.md explaining why templates are cancelable and why QR is encrypted
   - EVALUATION_PLAN.md describing metrics + tests to run + how to interpret results

──────────────────────────────────────────────────────────────────────────────
BUILD & RUN COMMANDS (MUST INCLUDE IN README)
──────────────────────────────────────────────────────────────────────────────

- pnpm install
- supabase init (if needed) / supabase start (local)
- supabase db push (apply migrations)
- supabase functions deploy <fn>
- apps/web: pnpm dev
- apps/enrollment + apps/gate:
  - npx expo prebuild
  - eas build --profile development --platform ios
  - npx expo start --dev-client

──────────────────────────────────────────────────────────────────────────────
ACCEPTANCE CRITERIA (DEFINITION OF DONE)
──────────────────────────────────────────────────────────────────────────────

The build is successful only if:
1) Organizer can create an event and see join_code.
2) Gate can be provisioned exactly once and stores its SK in Keychain.
3) Enrollment can join via join_code, capture face, generate template, encrypt, request signature, and display QR token.
4) Gate can scan QR offline, verify signature, decrypt, run liveness, compute live template, match, and show accept/reject with reason codes.
5) Replay attempts are rejected after first accept.
6) Logs export as CSV with timings and reason codes, without biometric data.
7) No face images or embeddings are stored in apps or backend.

Now build the entire monorepo accordingly and output every file.
