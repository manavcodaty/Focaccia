# EPQ Artifact Report: Focaccia

## Project title

Can events use face scans for entry without keeping a database of people's faces?

## Candidate artifact

Focaccia is a working software prototype for privacy-preserving event entry. It lets an organiser create an event, lets an attendee enrol on their own iPhone, and lets a gate phone verify the attendee offline at entry. The project tests whether biometric access can be made more privacy-respecting by avoiding a central database of face images or reusable face embeddings, which is important because biometric recognition is treated as a sensitive processing context under UK and EU data protection guidance (European Parliament and Council, 2016; Information Commissioner's Office, 2025).

The artifact is implemented as a monorepo with three main applications:

- a Next.js organiser dashboard in `apps/web`,
- an Expo iOS enrolment app in `apps/enrollment`,
- an Expo iOS gate verification app in `apps/gate`,
- shared cryptography and biometric-template code in `packages/shared`,
- Supabase database migrations and Edge Functions in `supabase`.

This report explains the problem, the design decisions, the implementation, the testing evidence, the limitations, and the final evaluation of the artifact.

## Abstract

Biometric entry systems are attractive because they are fast and hard to share compared with ordinary QR tickets. The privacy problem is that many biometric systems store face images or reusable face templates centrally. If that database is leaked, the damage is serious because a face cannot be reset like a password. This is why biometric-template protection literature places emphasis on confidentiality, renewability, and revocability rather than only on matching accuracy (Ratha, Connell and Bolle, 2001; International Organization for Standardization, 2022).

Focaccia explores a narrower question: can an event entry system use a face scan without keeping a central database of people's faces?

The implemented answer is a privacy-by-design prototype. The attendee's face is processed on the attendee phone. The app turns the face embedding into an event-scoped cancelable template, encrypts that template for one gate phone, and asks the server to sign the pass. At the venue, the gate phone verifies the token signature, decrypts the protected template locally, checks replay state locally, runs liveness, creates a fresh live template, and compares the two templates. The gate decision is designed to work offline after setup.

The prototype does not claim to be a finished commercial biometric system. Its academic value is that it combines applied cryptography, on-device machine learning, offline verification, local replay protection, and non-biometric evaluation logs into one working artifact.

## 1. Introduction

Event entry usually balances convenience against security and privacy. A paper ticket or QR ticket is easy to use, but it can be copied or screenshotted. A biometric system can reduce transferability, but it often creates a much more serious privacy risk because the system may store face images or biometric templates in a central database.

That trade-off motivated my project. I did not want to build a normal face-recognition database. The interesting computer science question was whether the system could prove entry using a face scan while reducing the amount of sensitive biometric data stored by the organiser.

The final artifact is called Focaccia. It is a prototype event entry system built around one claim:

> biometric entry does not need a central database of face images or reusable face embeddings.

The project is deliberately constrained. It supports iOS only, one gate phone per event, single-entry passes, attendee enrolment before the event, and a manual paste-token fallback. Those limits are not accidental. They make the security model testable for an EPQ artifact. A multi-gate commercial venue would add more complexity, especially around shared replay state, but that was outside the scope of this project. This is also consistent with a security-engineering approach where a prototype's trust boundaries are made explicit before the system is enlarged (OWASP Foundation, 2025a).

## 2. Aims and success criteria

The main aim was to build and evaluate a working prototype that demonstrates privacy-preserving biometric event access.

The artifact had to satisfy these success criteria:

1. An organiser can create and manage an event through a web dashboard.
2. A gate phone can be provisioned for exactly one event.
3. An attendee can enrol on their own phone and receive a signed pass.
4. Raw face images and reusable face embeddings are not stored in Supabase.
5. The pass token contains an encrypted cancelable template, not a plaintext biometric template.
6. The gate can verify the pass offline after it has been provisioned.
7. A copied token is not enough by itself, because the gate still requires liveness and face matching.
8. A pass accepted once is rejected if presented again to the same gate.
9. The system records non-biometric reason codes and timings for evaluation.
10. The report is honest about limits, especially liveness quality, endpoint compromise, and the one-gate assumption.

## 3. Background research

The background research shaped the project in three ways.

First, biometric data used for identification or access control is sensitive personal data. The GDPR defines biometric data as data resulting from technical processing relating to a person's physical, physiological or behavioural characteristics, and Article 9 gives additional protection to biometric data used for unique identification (European Parliament and Council, 2016). The UK Information Commissioner's Office also describes biometric recognition as special category biometric data when it is used to uniquely identify someone (Information Commissioner's Office, 2024; Information Commissioner's Office, 2025). That made it clear that the project should minimise biometric storage rather than treat face data like ordinary event metadata.

Second, guidance on authentication systems treats biometric samples and derived biometric data as sensitive during processing. NIST SP 800-63B discusses the need to clear biometric samples and derived data after the authentication transaction (National Institute of Standards and Technology, 2017). This supported my design choice to process face data transiently and avoid long-term storage of raw images or embeddings.

Third, biometric information protection standards such as ISO/IEC 24745 focus on confidentiality, integrity, renewability, and revocability (International Organization for Standardization, 2022). This influenced the use of event-scoped cancelable templates. If the same person's biometric representation changes between events, the system is less useful for tracking people across different contexts.

Further complications arise because facial recognition systems can behave differently across datasets, image quality, and demographic groups. NIST's demographic-effects work and the Gender Shades study both show why biometric systems should be evaluated cautiously rather than treated as universally accurate (Grother, Ngan and Hanaoka, 2019; Buolamwini and Gebru, 2018). These sources led to the central design decision: the backend should administer events and sign passes, but it should not become a biometric database.

## 4. Requirements

### 4.1 Functional requirements

The organiser dashboard must let an organiser:

- sign in,
- create an event,
- view the event join code,
- view provisioning status,
- manage revoked passes,
- review gate logs where available.

The enrolment app must let an attendee:

- enter a join code,
- give consent,
- capture their face locally,
- generate a pass,
- view a QR token,
- copy the full token for fallback entry.

The gate app must let gate staff:

- provision one gate phone for one event,
- scan a QR token,
- paste a token manually if scanning fails,
- verify the token offline,
- run an active liveness prompt,
- accept or reject the attendee with a clear reason,
- export non-biometric logs.

### 4.2 Security and privacy requirements

The system must:

- avoid storing raw face images in Supabase,
- avoid storing reusable face embeddings in Supabase,
- avoid exporting biometric images or embeddings in logs,
- use server-side signing for pass authenticity,
- encrypt the protected template to the gate phone,
- reject replay after one successful use,
- reject tokens for the wrong event,
- reject expired or malformed tokens,
- keep the gate's private decryption key on the gate device,
- keep evaluation logs non-biometric.

### 4.3 Scope limits

The artifact does not attempt to solve every real-world deployment issue. The following are deliberately out of scope:

- Android support,
- multiple gate devices for one event,
- multi-entry passes,
- government ID verification,
- training a custom face model,
- enterprise-grade anti-spoofing,
- cloud-based live gate verification.

These limits make the prototype more focused. The EPQ question is not whether I can build a complete commercial ticketing company. It is whether I can build a working proof that biometric entry can avoid a central face database.

## 5. System design

### 5.1 High-level flow

The system flow is:

1. The organiser creates an event in the web dashboard.
2. The backend creates an event salt, an event join code, and an event signing keypair.
3. The gate phone provisions itself for that event and generates its own gate encryption keypair.
4. The attendee enters the join code in the enrolment app.
5. The enrolment app receives public event information and the gate public key.
6. The attendee's face is processed on-device.
7. The app derives a 256-bit event-scoped cancelable template.
8. The template is encrypted to the gate public key.
9. The server signs the pass payload.
10. The attendee presents the signed token as a QR code.
11. The gate verifies the token offline, performs liveness, compares the live face template, and records the result.

The most important separation is that the server signs passes but does not need the raw biometric material. The gate can decrypt and compare the protected template, but it cannot create new valid passes because it does not have the event signing key.

### 5.2 Trust boundaries

The system has four trust zones.

The server is trusted for event administration and signing. It creates event records, signs pass payloads, stores public event metadata, and stores revocation records. It is not trusted with raw biometric data.

The enrolment phone is trusted to capture the attendee's face and generate a template locally. It is not trusted to sign its own pass or bypass event policy.

The gate phone is trusted to hold the private gate key and make the entry decision offline. It stores local replay state and local logs.

The QR token and copied token text are treated as untrusted. They can be screenshotted or copied, so the token must be signed, event-bound, time-bound, encrypted, and checked against liveness and replay rules. This follows the broader principle that sensitive data should be protected even when transport or presentation channels are visible to an attacker (OWASP Foundation, 2025b).

### 5.3 Cryptographic design

The artifact uses three separate security mechanisms.

Ed25519 signatures provide authenticity. The server signs the pass payload. The gate verifies the signature using the event public signing key. If a token has been altered, the gate rejects it. Ed25519 is specified as part of the Edwards-Curve Digital Signature Algorithm family in RFC 8032 (Josefsson and Liusvaara, 2017).

X25519 sealed-box encryption protects the template in the token. The enrolment app encrypts the cancelable template to the gate public key. Only the provisioned gate phone should have the private key needed to decrypt it. X25519 is specified in RFC 7748, and libsodium sealed boxes use X25519 with XSalsa20-Poly1305 so that only the recipient can decrypt the message (Langley, Hamburg and Turner, 2016; Libsodium, 2026).

Canonical JSON prevents ambiguity in what is signed. The payload is encoded in a deterministic format before signing and verification. The gate checks that the payload matches canonical encoding before accepting it. This is the same general problem addressed by the JSON Canonicalization Scheme, where cryptographic operations need an invariant byte representation (Rundgren, Jordan and Erdtman, 2020). Base64url encoding is used because the token must travel through QR and text-based channels without relying on binary-safe transport (Josefsson, 2006).

This design means that a stolen QR token does not reveal the plaintext template, and an attacker cannot create a valid token without the server signing key.

### 5.4 Cancelable biometric template

The key privacy feature is `cancelableTemplateV1` in `packages/shared/src/template.ts`.

The enrolment app starts with a face embedding produced by a local TFLite model. Face embeddings are a common representation in modern face verification systems; FaceNet, as an example, maps face images into an embedding space where distances correspond to face similarity (Schroff, Kalenichenko and Philbin, 2015). More recent work such as ArcFace also shows the broader movement towards more discriminative face embeddings (Deng et al., 2019). Instead of storing or sending that embedding, the shared code normalises it and turns it into a 256-bit template. Each bit is generated using event-salted random projections. The event salt means that the same face should produce a different template in a different event context.

The template is still biometric material, so the system does not store it centrally. It is encrypted inside the token and only opened by the gate phone during verification. This follows the basic argument behind cancelable biometrics: the stored or transported representation should be transformed so that compromise does not permanently compromise the original biometric trait (Ratha, Connell and Bolle, 2001).

Matching uses Hamming distance. The gate derives a live template from the attendee at entry and compares it with the decrypted pass template. If the distance is below the configured threshold, the match passes.

### 5.5 Offline verification

The offline verifier is implemented in `apps/gate/src/lib/offline-verifier.ts`.

Before liveness begins, the gate:

- decodes the token,
- verifies canonical JSON,
- verifies the Ed25519 signature,
- checks the event ID,
- checks the issue and expiry time,
- checks local replay state,
- checks local revocation cache,
- decrypts the protected template with the gate key.

Only after those checks does the gate run the live biometric part. This matters because malformed, forged, expired, replayed, or revoked tokens can be rejected quickly without asking the person to complete liveness.

After liveness, the gate:

- extracts a live embedding,
- derives a live cancelable template using the same event salt,
- computes Hamming distance,
- accepts or rejects,
- logs the result,
- marks an accepted pass as used locally.

The important point is that the gate does not need a live server call for the entry decision once it has been provisioned and synced. However, presentation attack detection remains a separate problem from cryptographic verification. ISO/IEC 30107-3 is concerned with biometric presentation attack testing and reporting, which is why this report treats active liveness as a limitation to be evaluated physically rather than as a solved property (International Organization for Standardization, 2023).

### 5.6 Logging and evaluation

The gate logs are intentionally non-biometric. In `apps/gate/src/lib/gate-db.ts`, the exported CSV includes:

- timestamp,
- event ID,
- hashed pass reference,
- outcome,
- reason code,
- scan, decode, verify, replay, revocation, decrypt, liveness, match, and total timings,
- Hamming distance where matching occurred.

It does not export face images, embeddings, or templates. This lets the project evaluate performance and failure reasons without creating a biometric evidence file. The design is also aligned with pseudonymisation guidance, because the logs preserve limited analytical value while avoiding direct biometric material (ENISA, 2019; ENISA, 2021).

## 6. Implementation

### 6.1 Web dashboard

The web dashboard is built in `apps/web` using Next.js, React, Tailwind, shadcn-style components, and Supabase. It is the organiser control plane. The App Router structure was suitable for this project because it keeps the dashboard routes, event pages, and authenticated layouts in a single file-system routing model.

The dashboard supports the event lifecycle: creating events, viewing event detail pages, provisioning the gate, managing revocations, and viewing logs. The dashboard does not perform biometric matching. That separation keeps the web app away from the most sensitive part of the system.

### 6.2 Supabase backend

The backend uses Supabase migrations and Edge Functions.

The database stores operational records such as events, gate devices, revocations, and uploaded logs. Row-level security scopes organiser operations so one organiser cannot freely manage another organiser's events. This is important because the dashboard is backed by browser-accessible Supabase clients, so authorisation has to be enforced at the database boundary rather than only in the interface.

The Edge Functions handle privileged actions:

- event creation,
- gate provisioning,
- enrolment-bundle retrieval,
- pass signing,
- pass revocation,
- event deletion.

Pass signing happens server-side. The enrolment app can request a signature for a payload, but it cannot sign that payload itself.

### 6.3 Enrolment app

The enrolment app is built as an Expo iOS dev-build app.

The main pass-generation logic is in `apps/enrollment/src/lib/pass-flow.ts`. It:

- reads the event salt and gate public key from the enrolment bundle,
- generates a random pass ID and nonce,
- derives the cancelable template from the local embedding,
- encrypts the template to the gate public key,
- builds the pass payload,
- requests a server signature,
- assembles the final token.

The face embedding model is loaded in `apps/enrollment/src/lib/embedding-model.ts`. The implementation uses the bundled `facenet_512.tflite` model. Because Expo and VisionCamera expose still captures through temporary file URIs, the code deletes both the source photo and aligned crop after inference. It also zeroes temporary byte arrays where possible. The gate's private values are stored using secure mobile storage mechanisms; Expo SecureStore is relevant here because it is designed for storing small sensitive values through platform-backed storage (Expo, 2026).

This is not as perfect as a pure in-memory camera pipeline, but it is a realistic limitation of the chosen mobile stack and is documented in the privacy notes.

### 6.4 Gate app

The gate app is also an Expo iOS dev-build app.

Its responsibilities are wider than the enrolment app because it is the final enforcement point. It provisions the event, stores gate configuration, keeps local replay state, checks revocations, runs active liveness, verifies tokens, and exports logs.

The local database schema is in `apps/gate/src/lib/gate-db.ts`. It stores:

- gate configuration,
- used passes,
- revocation cache,
- scan logs.

The biometric verification path is split into preparation and finalisation. `prepareOfflineVerification` performs cryptographic and policy checks before liveness. `finalizeOfflineVerification` performs the live template comparison after liveness succeeds. This structure makes it easier to test the non-camera verification path separately from the physical camera path.

### 6.5 Shared package

The shared package avoids duplicated security logic. It includes:

- canonical JSON,
- base64url helpers,
- crypto wrappers,
- random byte generation,
- cancelable template derivation,
- Hamming-distance matching,
- shared types.

The shared template implementation is especially important because enrolment and gate matching must agree exactly. If one app generated templates differently, valid attendees would fail at the gate.

## 7. Testing and verification

I used two kinds of verification for this artifact:

- automated code-level tests that can run on the development machine,
- documented physical evaluation protocols for claims that require real iPhones, cameras, lighting conditions, and human participants.

This distinction matters. Automated tests can prove the cryptographic and data-flow logic. They cannot fully prove real-world liveness robustness because that depends on camera conditions and user behaviour.

### 7.1 Automated verification scope

The repository includes tests for:

- shared cryptographic template behaviour,
- enrolment pass flow,
- gate offline verification,
- gate provisioning,
- dashboard adapters and function handling,
- local network helpers,
- face-crop calculations,
- responsive metrics,
- source-level checks around branding, auth feedback, and sign-out behaviour.

The most important automated tests for the EPQ claim are:

- `pnpm --filter @face-pass/shared test`,
- `pnpm --filter @face-pass/enrollment typecheck`,
- `pnpm --filter @face-pass/enrollment test:flow`,
- `pnpm --filter @face-pass/gate typecheck`,
- `pnpm --filter @face-pass/gate test:offline`,
- `pnpm --filter @face-pass/gate test:provisioning`,
- `pnpm --dir apps/web build`,
- `pnpm run db:verify`.

These tests check the implementation at the level that can be verified without a physical phone. This multi-faceted approach is necessary because code-level verification, security review, and physical biometric trials measure different parts of the system (OWASP Foundation, 2025a; International Organization for Standardization, 2023).

### 7.2 Manual and physical evaluation scope

Some parts of the project must be evaluated physically:

- camera capture quality,
- liveness prompts,
- face tracking under different lighting,
- false rejection and false acceptance behaviour,
- user friction at the gate,
- offline operation on a real provisioned phone.

The detailed evaluation protocol is in `docs/EVALUATION_PLAN.md` and `docs/EPQ_OPERATIONS_MANUAL.md`. It defines tests for baseline indoor lighting, bright sunlight, backlighting, low light, replay, wrong-event tokens, revoked tokens, expired tokens, and fallback token entry. This is necessary because facial recognition accuracy is not a single fixed property of an algorithm; image quality, demographics, masks, and deployment conditions can all affect results (Grother, Ngan and Hanaoka, 2019; National Institute of Standards and Technology, 2026).

For the final EPQ write-up, I would present automated tests separately from physical trial results. That avoids pretending that a unit test is the same thing as a field evaluation.

## 8. Evaluation against success criteria

### 8.1 Event creation and operation

The organiser dashboard and backend meet the event-creation requirement. The event flow has a web dashboard, event pages, join codes, gate provisioning state, revocation management, and supporting Supabase functions.

### 8.2 Enrolment without central face storage

The enrolment design meets the main privacy aim. The attendee's face is processed locally. The raw face image and aligned crop are deleted after inference. The reusable embedding is not sent to Supabase. The backend receives the pass payload for signing, but the biometric template inside that payload is encrypted to the gate.

The remaining caveat is that the mobile stack uses temporary files during photo capture and manipulation. The implementation deletes them immediately, but a lower-level native camera pipeline could reduce that exposure further. This is a plausible future improvement because endpoint handling is one of the places where privacy guarantees are easiest to weaken in practice.

### 8.3 Signed, encrypted pass

The pass design meets the authenticity and confidentiality requirement. The token is signed by the server and contains an encrypted template. A copied token should not expose the template plaintext. A modified token should fail signature verification. The cryptographic design also avoids inventing custom primitives, which is consistent with OWASP guidance to use mature algorithms and libraries rather than custom cryptography (OWASP Foundation, 2025b).

### 8.4 Offline gate verification

The gate verifier is designed to work offline after provisioning. The gate has the public signing key, event salt, private gate key, replay database, and revocation cache locally. The verification path checks signature, event, time window, replay, revocation, decryption, liveness, and match without relying on a network call during the scan decision.

The scope caveat is that revocation changes made after the gate goes offline cannot be known until the gate syncs again. That is a normal trade-off in offline systems and should be stated clearly in the EPQ evaluation.

### 8.5 Replay protection

Replay protection is implemented locally in SQLite. When a pass is accepted, the gate records the pass ID in `used_passes`. A second attempt with the same pass is rejected as `REPLAY_USED`.

This is strong within the one-gate model. It would not be enough for a multi-gate event unless the gates shared used-pass state, which is outside this artifact's scope.

### 8.6 Manual fallback

The manual fallback is the paste-token route. This is the correct fallback because it still uses the same signed token and offline verifier. The project deliberately does not pretend that an eight-digit code can reconstruct a cryptographic pass offline.

This is a good design decision because it preserves the security model while still giving gate staff a way to handle broken cameras, cracked screens, brightness problems, or QR scan failure.

### 8.7 Evaluation logging

The gate logs meet the evaluation requirement. They capture timings, outcomes, reason codes, and a hashed pass reference without exporting biometric data. This allows the project to measure where time is spent and why attempts fail.

## 9. Limitations

The artifact has real limitations.

The first limitation is liveness. The liveness system is basic active liveness, not a commercial anti-spoofing product. It can challenge blinking, head movement, or looking up, but a sophisticated presentation attack may still be possible. This is acceptable for an EPQ prototype, but it must not be oversold. ISO/IEC 30107-3 exists because presentation attack detection needs its own test method and reporting structure, not just an informal claim that a camera prompt is enough (International Organization for Standardization, 2023).

The second limitation is endpoint compromise. If the attendee phone is compromised during enrolment, an attacker may be able to inspect transient biometric data. If the gate phone is compromised, an attacker may be able to tamper with local state or extract secrets depending on device security. The design reduces server-side biometric risk, but it cannot make compromised endpoints harmless. This is why the project uses secure storage and key separation, while still acknowledging that local device compromise remains a systemic issue rather than a small implementation detail (OWASP Foundation, 2025b; Expo, 2026).

The third limitation is the one-gate model. Single-entry replay protection is reliable because only one gate phone is allowed per event. A multi-gate venue would need distributed replay synchronisation, conflict handling, and stronger operational design.

The fourth limitation is temporary file handling. The implementation deletes temporary image files after inference, but the chosen Expo/VisionCamera path is not a pure in-memory capture pipeline.

The fifth limitation is model quality. The project uses an existing pre-trained FaceNet-style TFLite model. It does not train a custom model or provide a large biometric benchmark. The evaluation should therefore focus on prototype feasibility rather than claiming production-grade biometric accuracy.

## 10. Ethical and privacy reflection

This project deals with biometric recognition, so the ethical standard has to be higher than for an ordinary ticketing app. A working demo is not enough if the demo normalises unnecessary collection of sensitive data. The EDPB's guidance on video devices is relevant here because it treats biometric recognition as a context that requires careful justification, transparency, and control rather than casual deployment (European Data Protection Board, 2020).

The main ethical decision was to avoid building a face database. The system does not need to store every attendee's face image or reusable embedding in the organiser backend. Instead, it uses event-scoped templates, gate-specific encryption, local matching, and non-biometric logs.

The second ethical decision was to make the limitations visible. The project should not claim that privacy risk disappears completely. It reduces a specific risk: centralised biometric storage. It does not eliminate all risk from cameras, device compromise, false rejection, false acceptance, or bad deployment practices.

The third ethical decision was consent. The enrolment flow includes an explicit consent step before camera capture. In a real deployment, there would also need to be a non-biometric alternative for people who cannot or do not want to use face-based entry. Without that alternative, the system could create pressure to accept biometric processing even where the user's choice is only formal rather than meaningful (European Data Protection Board, 2020; Article 29 Data Protection Working Party, 2012).

## 11. What I learned

At the start, I thought the hard part would be building the apps. The deeper challenge was designing the trust boundary correctly.

A simple version of the project would have uploaded a face embedding to a backend and compared against it later. That would have been much easier, but it would have failed the purpose of the project. The better design was harder because the system had to coordinate signing, encryption, local storage, event salts, token formats, replay checks, revocation state, and mobile camera behaviour.

The biggest technical lesson was that privacy is not a label that can be added at the end. It changes the architecture. If the server must not store biometric data, then the enrolment app, gate app, and backend all need different responsibilities.

The second lesson was that offline systems are honest about trade-offs. Offline gate verification is useful because it avoids venue connectivity problems, but it also means revocations must be synced before going offline.

The third lesson was that evaluation has to be designed into the system. The gate logs were not just a debugging feature. They are what make the artifact measurable without creating a new biometric dataset.

## 12. Conclusion

Focaccia answers the EPQ question with a working prototype: yes, an event can use a face scan for entry without keeping a central database of people's faces, if the system is carefully constrained.

The artifact proves this through a three-part system. The enrolment app processes the face locally and creates an event-scoped template. The backend signs the pass but does not store raw biometrics. The gate phone verifies the token offline, decrypts the protected template locally, performs liveness, checks replay, and records only non-biometric evaluation logs.

The result is not a finished commercial biometric product. It is a serious prototype that demonstrates the architecture needed to make biometric entry more privacy-preserving. Its strongest contribution is showing that the privacy boundary has to be built into the technical design from the beginning.

## Appendix A: Verification run recorded for this report

This report was checked against the current repository rather than written from memory alone. I verified the main implementation claims against:

- `README.md`,
- `docs/ARCHITECTURE.md`,
- `docs/PRIVACY_BY_DESIGN.md`,
- `docs/THREAT_MODEL.md`,
- `docs/EVALUATION_PLAN.md`,
- `docs/EPQ_OPERATIONS_MANUAL.md`,
- `packages/shared/src/template.ts`,
- `apps/enrollment/src/lib/pass-flow.ts`,
- `apps/enrollment/src/lib/embedding-model.ts`,
- `apps/gate/src/lib/offline-verifier.ts`,
- `apps/gate/src/lib/gate-db.ts`,
- `apps/gate/src/lib/embedding-model.ts`.

The following automated checks passed on 20 May 2026:

| Check | Result |
| --- | --- |
| Report structure, keyword/source coverage, and reference count | Passed; 5,565 words total and exactly 30 reference entries |
| Shared package direct test run | Passed; 1 test suite, 9 tests |
| Enrolment app TypeScript check | Passed |
| Gate app TypeScript check | Passed |
| Web production build | Passed |
| Enrolment pass-flow test | Passed; encrypted signed token generation test |
| Gate offline verifier | Passed; offline verification script produced an accepted pass and CSV output |
| Web source tests | Passed; 35 tests |

Two live-infrastructure checks could not be completed in this shell:

| Check | Result | Reason |
| --- | --- | --- |
| Gate provisioning verifier against local Supabase | Blocked | The configured Supabase URL was unreachable at `http://10.1.64.184:54321/auth/v1/signup` |
| Database schema verification | Blocked | The shell reported `docker` and `supabase` as unavailable commands |

This means the local code-level and offline-verifier evidence passed, while the live Supabase provisioning path still requires the local Supabase stack and Docker/Supabase CLI to be available before it can be honestly reported as passed.

## References

Article 29 Data Protection Working Party (2012) *Opinion 3/2012 on developments in biometric technologies*. Available at: https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2012/wp193_en.pdf (Accessed: 20 May 2026).

Buolamwini, J. and Gebru, T. (2018) *Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification*. Available at: https://proceedings.mlr.press/v81/buolamwini18a.html (Accessed: 20 May 2026).

Deng, J., Guo, J., Xue, N. and Zafeiriou, S. (2019) *ArcFace: Additive Angular Margin Loss for Deep Face Recognition*. Available at: https://openaccess.thecvf.com/content_CVPR_2019/papers/Deng_ArcFace_Additive_Angular_Margin_Loss_for_Deep_Face_Recognition_CVPR_2019_paper.pdf (Accessed: 20 May 2026).

ENISA (2019) *Pseudonymisation techniques and best practices*. Available at: https://www.enisa.europa.eu/publications/pseudonymisation-techniques-and-best-practices (Accessed: 20 May 2026).

ENISA (2021) *Data pseudonymisation: advanced techniques and use cases*. Available at: https://www.enisa.europa.eu/publications/data-pseudonymisation-advanced-techniques-and-use-cases (Accessed: 20 May 2026).

European Data Protection Board (2020) *Guidelines 3/2019 on processing of personal data through video devices*. Available at: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-32019-processing-personal-data-through-video_en (Accessed: 20 May 2026).

European Parliament and Council (2016) *Regulation (EU) 2016/679: General Data Protection Regulation*. Available at: https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX%3A32016R0679 (Accessed: 20 May 2026).

Expo (2026) *SecureStore*. Available at: https://docs.expo.dev/versions/latest/sdk/securestore (Accessed: 20 May 2026).

Grother, P., Ngan, M. and Hanaoka, K. (2019) *Face Recognition Vendor Test (FRVT) Part 3: Demographic Effects*. Available at: https://nvlpubs.nist.gov/nistpubs/ir/2019/nist.ir.8280.pdf (Accessed: 20 May 2026).

Information Commissioner's Office (2024) *What is special category data?* Available at: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/ (Accessed: 20 May 2026).

Information Commissioner's Office (2025) *Biometric recognition*. Available at: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/biometric-recognition/ (Accessed: 20 May 2026).

International Organization for Standardization (2022) *ISO/IEC 24745:2022: Information security, cybersecurity and privacy protection - Biometric information protection*. Available at: https://www.iso.org/standard/75302.html (Accessed: 20 May 2026).

International Organization for Standardization (2023) *ISO/IEC 30107-3:2023: Information technology - Biometric presentation attack detection - Part 3: Testing and reporting*. Available at: https://www.iso.org/standard/79520.html (Accessed: 20 May 2026).

Josefsson, S. (2006) *RFC 4648: The Base16, Base32, and Base64 Data Encodings*. Available at: https://www.rfc-editor.org/rfc/rfc4648 (Accessed: 20 May 2026).

Josefsson, S. and Liusvaara, I. (2017) *RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)*. Available at: https://www.rfc-editor.org/rfc/rfc8032.html (Accessed: 20 May 2026).

Langley, A., Hamburg, M. and Turner, S. (2016) *RFC 7748: Elliptic Curves for Security*. Available at: https://www.rfc-editor.org/rfc/rfc7748 (Accessed: 20 May 2026).

Libsodium (2026) *Sealed boxes*. Available at: https://libsodium.gitbook.io/doc/public-key_cryptography/sealed_boxes (Accessed: 20 May 2026).

National Institute of Standards and Technology (2017) *Digital Identity Guidelines: Authentication and Lifecycle Management, SP 800-63B*. Available at: https://pages.nist.gov/800-63-3/sp800-63b.html (Accessed: 20 May 2026).

National Institute of Standards and Technology (2026) *Face Recognition Vendor Test*. Available at: https://www.nist.gov/image-group/face-recognition-vendor-test (Accessed: 20 May 2026).

OWASP Foundation (2025a) *Application Security Verification Standard*. Available at: https://owasp.org/www-project-application-security-verification-standard/ (Accessed: 20 May 2026).

OWASP Foundation (2025b) *Cryptographic Storage Cheat Sheet*. Available at: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html (Accessed: 20 May 2026).

Ratha, N.K., Connell, J.H. and Bolle, R.M. (2001) *Enhancing security and privacy in biometrics-based authentication systems*. Available at: https://doi.org/10.1147/sj.403.0614 (Accessed: 20 May 2026).

Rundgren, A., Jordan, B. and Erdtman, S. (2020) *RFC 8785: JSON Canonicalization Scheme (JCS)*. Available at: https://www.rfc-editor.org/rfc/rfc8785 (Accessed: 20 May 2026).

Schroff, F., Kalenichenko, D. and Philbin, J. (2015) *FaceNet: A Unified Embedding for Face Recognition and Clustering*. Available at: https://openaccess.thecvf.com/content_cvpr_2015/html/Schroff_FaceNet_A_Unified_2015_CVPR_paper.html (Accessed: 20 May 2026).

Focaccia project repository (2026) *README.md*. Local file: `README.md`.

Focaccia project repository (2026) *Architecture*. Local file: `docs/ARCHITECTURE.md`.

Focaccia project repository (2026) *Privacy By Design*. Local file: `docs/PRIVACY_BY_DESIGN.md`.

Focaccia project repository (2026) *Threat Model*. Local file: `docs/THREAT_MODEL.md`.

Focaccia project repository (2026) *Evaluation Plan*. Local file: `docs/EVALUATION_PLAN.md`.

Focaccia project repository (2026) *EPQ Operations Manual*. Local file: `docs/EPQ_OPERATIONS_MANUAL.md`.
