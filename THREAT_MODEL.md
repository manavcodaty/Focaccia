# THREAT_MODEL.md

## One-Time Face Pass — Threat Model

## 1. Purpose and Scope

This threat model identifies six concrete security threats, labelled **T1–T6**, that are directly relevant to the One-Time Face Pass design. The focus is not on generic web risk alone, but on the high-value security properties claimed by the system:
- no reusable biometric storage,
- resistance to QR interception,
- resistance to replay,
- offline enforcement integrity,
- liveness assurance,
- bounded damage under backend compromise.

The analysis assumes the locked architecture defined in the truth base and the PRD.

---

## 2. Security Objectives

The threat model evaluates whether the architecture preserves the following objectives:

1. **Biometric confidentiality** — raw face images, embeddings, and templates must not be centrally exposed.
2. **Pass authenticity** — only the trusted server may issue valid passes.
3. **Gate-only decryptability** — only the gate device may decrypt the protected template.
4. **Single-use enforcement** — a successful pass must not be reusable.
5. **Offline correctness** — entry decisions must remain trustworthy even without a live network connection.
6. **Operational auditability** — failure and override paths must remain visible in logs.

---

## 3. Threat Inventory

## T1. Biometric Theft from Enrollment or Backend Systems

### Threat Description
An attacker attempts to extract raw biometric material, reusable embeddings, or usable template data from the enrollment device, backend, or server-side storage. The goal is to steal identity-linked biometric material for future impersonation or cross-event tracking.

### Attack Surface
- camera frames during capture,
- aligned face crops,
- intermediate embedding vectors,
- backend request/response bodies,
- logs or analytics,
- database rows.

### Why This Matters
This is the most serious privacy threat. If the system stored reusable biometric data centrally, it would fail its core academic and architectural claim.

### Implemented Mitigations
1. **On-device inference only**
   - The face embedding model runs locally on the attendee phone and gate phone.
   - Raw face data never needs to be uploaded to the backend.

2. **No biometric persistence policy**
   - Raw images, crops, embeddings, and templates are not stored in database tables, logs, analytics, or exported CSV files.

3. **Cancelable template transformation**
   - The biometric representation is transformed into a 256-bit event-scoped template using `EVENT_SALT`.
   - This prevents direct reuse of the raw embedding.

4. **Template encryption in token**
   - Even the transformed template is sealed to the gate public key before it leaves the enrollment device.

5. **Non-biometric log design**
   - Logs contain only timing values, reason codes, Hamming distance, and truncated pass-hash metadata.

### Residual Risk
A fully compromised attendee device could still inspect transient in-memory data during enrollment. The architecture reduces server-side and at-rest risk strongly, but cannot completely eliminate endpoint compromise risk on an untrusted personal phone.

---

## T2. QR Interception or Screenshot Theft

### Threat Description
An attacker steals the QR token by screenshotting it, shoulder-surfing it, or intercepting it while it is displayed or manually shared. The attacker then attempts to use the token to gain entry or recover biometric material.

### Attack Surface
- QR display on attendee phone,
- copied token text,
- fallback paste flow,
- visible device screen in public queues.

### Why This Matters
A plain signed QR alone would be transferable. If the token could be reused directly, the system would provide little additional security over ordinary digital tickets.

### Implemented Mitigations
1. **Encrypted template payload**
   - `enc_template` is protected using X25519 sealed-box encryption to `PK_GATE_EVENT`.
   - A stolen QR does not reveal the underlying template unless the attacker also compromises the gate private key.

2. **Biometric binding at the gate**
   - The token alone is not enough.
   - The attacker must also pass liveness and facial matching against the encrypted template.

3. **Single-use policy**
   - Even a valid token is intended for one successful acceptance only.

4. **Event-specific signing and timing checks**
   - The token is valid only for the correct event and validity window.

5. **Manual fallback uses the same token**
   - The paste-token fallback does not weaken the trust model because it validates the same signed payload.

### Residual Risk
If an attacker steals a token before the legitimate user enters and also resembles the legitimate face closely enough to pass the threshold, some risk remains. The architecture substantially reduces transferability, but like all face-based systems it remains probabilistic rather than mathematically perfect.

---

## T3. Replay Attack After Successful Entry

### Threat Description
An attacker or legitimate attendee attempts to reuse a previously accepted token to gain entry a second time. This may involve repeated scanning, copied token reuse, or deliberate queue re-entry.

### Attack Surface
- repeated QR presentation,
- copied token presented by another device,
- multiple attempts against the same gate.

### Why This Matters
The truth base explicitly requires single-entry only. Failure here would violate a locked product constraint.

### Implemented Mitigations
1. **Local `used_passes` store**
   - After a successful accept, the gate inserts `pass_id` into local SQLite.

2. **Replay check before biometric evaluation**
   - During verification, the gate checks `used_passes` before liveness and matching.

3. **Offline authoritative enforcement**
   - Replay resistance does not depend on backend connectivity.

4. **Explicit reason code**
   - Reuse attempts are rejected as `REPLAY_USED`, creating measurable evidence in evaluation logs.

### Residual Risk
Because the architecture is intentionally single-gate only, replay enforcement is reliable within that design. A multi-gate event would require distributed used-pass synchronisation, but that is explicitly out of scope.

---

## T4. Offline Gate Tampering or Local State Manipulation

### Threat Description
An attacker with physical or software access to the gate device attempts to tamper with local verification logic, extract `SK_GATE_EVENT`, modify the revocation cache, disable replay checks, or force false accepts while offline.

### Attack Surface
- compromised gate device,
- jailbroken iPhone or debug instrumentation,
- tampered local SQLite files,
- modified app binary.

### Why This Matters
The gate is the final enforcement point. If it can be bypassed locally, the offline trust claim breaks down.

### Implemented Mitigations
1. **Gate private key stored only on-device**
   - `SK_GATE_EVENT` is generated on the gate phone and stored in secure iOS storage rather than in the backend.

2. **One gate per event**
   - The architecture deliberately limits decryption capability to one device, reducing exposure surface.

3. **Signed payload verification**
   - Even a tampered local state store cannot forge a valid server signature.

4. **Separation of powers**
   - The gate can decrypt templates, but cannot mint new valid tokens because it lacks `SK_SIGN_EVENT`.

5. **Audit log requirement**
   - Acceptance, rejection, and manual override paths are logged, making suspicious patterns reviewable after the event.

6. **Revocation and policy sync before offline operation**
   - The gate takes a snapshot of revocations and policy before disconnection, reducing reliance on mutable live state.

### Residual Risk
A fully compromised gate device remains a serious endpoint risk. This architecture reduces blast radius by making the compromise event-scoped and single-device-scoped, but it cannot guarantee security against a malicious gate operator with deep device-level control.

---

## T5. Active Liveness Spoofing

### Threat Description
An attacker presents a static photo, replayed video, mask, or another presentation attack to satisfy the face match without being the enrolled attendee.

### Attack Surface
- phone or tablet screens showing a face,
- printed photos,
- pre-recorded head movement clips,
- low-effort presentation attacks at the entry point.

### Why This Matters
If the system only matched face appearance and ignored presentation attacks, a copied token plus a spoofed face could defeat the design.

### Implemented Mitigations
1. **Active liveness challenge**
   - The gate requires one randomly selected action such as blink twice, turn head left then centre, or look up then centre.

2. **Time-bounded completion**
   - The user must satisfy the challenge within four seconds.

3. **Continuous tracking requirement**
   - The face must remain tracked during the challenge; tracking loss resets the prompt.

4. **Challenge randomness**
   - Because the challenge is chosen per attempt, a static image or simple deterministic replay is less likely to succeed.

5. **Biometric matching still required afterward**
   - Liveness alone does not grant entry; the live face must still match the protected template.

### Residual Risk
The liveness subsystem is intentionally basic rather than enterprise-grade. Sophisticated spoofing attacks using high-quality video or advanced masks may still present residual risk. This is acceptable within the prototype scope, but should be acknowledged explicitly in academic evaluation.

---

## T6. Backend Compromise or Secret Exposure

### Threat Description
An attacker compromises backend infrastructure, reads database tables, or attempts to obtain event signing secrets. The attacker’s goal is to mint fraudulent passes, inspect event metadata, or weaken privacy guarantees.

### Attack Surface
- Supabase project environment,
- Edge Functions,
- secret storage,
- database rows,
- function logs.

### Why This Matters
The backend is the signing authority. If its signing secrets were handled badly, an attacker could forge passes that appear valid to the gate.

### Implemented Mitigations
1. **Private signing key never stored in database**
   - `SK_SIGN_EVENT` is kept only in secure Edge secret infrastructure, not in relational tables.

2. **Public/private separation**
   - Only `PK_SIGN_EVENT` is stored in the events table and distributed outward.

3. **Server-signing only architecture**
   - Enrollment and gate clients cannot self-sign or reissue tokens.

4. **Minimal public enrollment bundle**
   - The public enrollment bundle exposes only what is needed: public keys, event salt, and event metadata.

5. **Encrypted template design**
   - Even backend compromise of public tables does not reveal usable template plaintext because the template is sealed to the gate public key before submission.

6. **RLS and organizer scoping**
   - Database access to event rows, revocations, and logs is restricted to the organizer who owns the event.

### Residual Risk
A catastrophic backend-secret compromise involving `SK_SIGN_EVENT` would allow fraudulent pass issuance for that event. However, it still would not automatically reveal raw biometrics because biometric data is never centrally stored, and the token’s template remains encrypted to the gate key.

---

## 4. Cross-Threat Mitigation Matrix

| Threat | Primary Security Goal at Risk | Main Mitigation Category |
|---|---|---|
| T1 Biometric theft | Biometric confidentiality | On-device inference, no persistence, cancelable template, encrypted token |
| T2 QR interception | Token transfer resistance | Gate-only encryption, liveness, face match, single-use policy |
| T3 Replay attack | Single-use enforcement | Local used-pass store, offline replay check |
| T4 Gate tampering | Offline integrity | Secure key storage, one gate per event, signed payloads, auditability |
| T5 Liveness spoofing | Presentation attack resistance | Active challenge-response liveness with tracking and time window |
| T6 Backend compromise | Pass authenticity and event control | Server-side secret isolation, no DB private keys, minimal public bundles |

---

## 5. Architectural Security Conclusions

The One-Time Face Pass design does not claim perfect biometric security. Instead, it makes a narrower and more defensible claim: that **biometric event entry can be implemented with materially stronger privacy and theft resistance than ordinary QR tickets or centrally stored face-recognition systems**.

Across T1–T6, the architecture’s strongest security decisions are:
- not storing biometrics centrally,
- sealing the template to the gate device,
- separating signing from decryption,
- keeping gate verification offline and authoritative,
- enforcing single-use locally,
- adding active liveness before final match.

Its main residual risks remain endpoint compromise and probabilistic biometric error, both of which should be surfaced honestly in the evaluation and discussion sections of the EPQ artefact.

---

## 6. Final Threat Model Statement

The threat model shows that the system’s key protections are not isolated features but layered controls. A stolen QR alone is insufficient because it lacks decryptability and live biometric presence. A backend data leak is less damaging because biometrics are not stored centrally. A replay attempt fails because acceptance state is enforced locally offline. This layered structure is what allows One-Time Face Pass to support its central academic claim: that convenience, offline usability, and improved privacy can coexist when biometric data is transformed, compartmentalised, and cryptographically bound to the event and gate context.
