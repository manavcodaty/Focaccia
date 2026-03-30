Product Requirements Document (PRD)

One-Time Face Pass

1. Executive Summary

1.1 Product Overview

One-Time Face Pass is a privacy-preserving event entry system designed to prove that biometric verification can be used for physical access control without storing face images or reusable biometric embeddings. The system consists of three tightly coupled components:
	1.	Organizer Web Dashboard for event creation, gate provisioning state, revocations, and log review.
	2.	Enrollment iOS App for attendee pre-event enrollment on their own device.
	3.	Gate Verifier iOS App for fully offline verification at the point of entry.

The core technical claim of the artefact is that an attendee can generate a facial template locally on their device, transform it into a cancelable event-scoped biometric representation, encrypt it specifically for a single gate device, and obtain a server-signed pass token. At the venue, the gate phone can verify the pass entirely offline, perform active liveness, compute a fresh event-scoped template, and accept or reject the attendee using Hamming-distance matching.

This product is not intended to be a generic face-recognition platform. It is a constrained, security-first prototype whose academic value lies in demonstrating a privacy-by-design architecture under realistic operational conditions.

1.2 Core Problem

Conventional event access systems create a trade-off between convenience and privacy. QR-only systems are easily transferable if stolen or screenshotted, while many biometric systems introduce serious privacy risks because they store reusable biometric identifiers centrally.

One-Time Face Pass addresses this by combining:
	•	server-signed passes for authenticity,
	•	gate-specific encryption so a stolen QR code does not reveal usable biometric data,
	•	cancelable biometric templates so templates are event-scoped and unlinkable across events,
	•	offline gate verification so entry decisions do not depend on venue connectivity,
	•	single-use replay protection so the same pass cannot be reused after successful entry.

1.3 Core Objectives

The product must prove the following:
	•	A pass can be issued without any raw face image or embedding leaving the attendee’s device.
	•	The QR token remains useless to an attacker who steals it, because the protected template is encrypted to the specific gate device.
	•	The gate can verify authenticity, decrypt the template, perform liveness, and match a live face offline.
	•	The system can enforce one gate phone per event and single-entry only.
	•	Manual fallback remains possible without pretending that a short code can reconstruct the pass offline.
	•	Evaluation can be performed using non-biometric logs only.

1.4 Academic Positioning

This artefact should be judged as a high-level computer science system rather than a superficial app prototype. The technical emphasis is on:
	•	applied cryptography,
	•	privacy-preserving machine learning,
	•	cancelable biometrics,
	•	offline verification architecture,
	•	secure mobile storage and event-scoped trust design,
	•	measurable evaluation using explicit reason codes and latency metrics.

⸻

2. Product Scope

2.1 In Scope
	•	Organizer login and event creation.
	•	Generation of event metadata required for secure issuance and verification.
	•	Single gate provisioning per event.
	•	Attendee enrollment using an on-device face embedding model.
	•	Conversion of live embeddings into a 256-bit cancelable template.
	•	Encryption of the template to the gate public key.
	•	Server signing of the pass payload.
	•	QR-based pass presentation.
	•	Offline scan verification at the gate.
	•	Active liveness challenge before final match.
	•	Replay rejection after first successful entry.
	•	Revocation sync and local enforcement.
	•	Manual token paste fallback.
	•	Non-biometric gate logs and CSV export.

2.2 Out of Scope
	•	Android support.
	•	Multi-gate events.
	•	Multi-entry passes.
	•	Cloud-based live verification.
	•	Storage of raw biometrics or reusable embeddings.
	•	Training a custom facial recognition model.
	•	Identity verification against government ID.
	•	Background or passive liveness without explicit user challenge.

⸻

3. Locked Constraints and Tech Stack

This section is non-negotiable and must remain consistent with the truth base.

3.1 Locked Constraints
	•	Platform: iOS only.
	•	Mobile runtime: React Native with Expo Dev Build only. Expo Go is not permitted.
	•	Web framework: Next.js 16 using App Router.
	•	Signing model: server signing only; the private signing key never leaves the server-side secret environment.
	•	Gate model: exactly one gate phone per event.
	•	Entry policy: single-entry only; replay attempts must be rejected.
	•	Enrollment model: attendee enrolls before the event on their own phone.
	•	Fallback requirement: a typed/paste fallback must exist.
	•	Face model policy: use an existing pre-trained on-device embedding model; no training.
	•	Privacy policy: face data must be obfuscated into a cancelable template and never stored; the template inside the pass must be encrypted.

3.2 Required Tech Stack

Web
	•	Node.js: 20 LTS
	•	Package manager: pnpm 9
	•	Framework: Next.js 16.1.4
	•	UI system: shadcn/ui on top of Next.js
	•	Styling: Tailwind CSS 4.1.18
	•	Backend client: @supabase/supabase-js 2.90.1

Mobile
	•	Framework: React Native
	•	Build system: Expo 54.0.32 (SDK 54), Dev Build only
	•	Routing: expo-router ~6.0.22
	•	Styling approach: standard React Native StyleSheet for mobile UI
	•	Camera: react-native-vision-camera 4.7.3
	•	On-device inference: react-native-fast-tflite 2.0.0
	•	Cryptography: @more-tech/react-native-libsodium 1.5.6
	•	Face detection: @ashleysmart/react-native-vision-camera-face-detector 1.0.8
	•	QR scanning: VisionCamera built-in code scanning API

3.3 Repository Structure

The implementation must logically map to the following monorepo structure:
	•	apps/web
	•	apps/enrollment
	•	apps/gate
	•	packages/shared
	•	supabase/functions/*
	•	supabase/migrations
	•	docs/*

3.4 Security-Critical Architecture Constraints
	•	Ed25519 must be used for signatures.
	•	X25519 sealed boxes must be used for encryption of templates to the gate device.
	•	BLAKE2b / HKDF must be used for event-scoped derivation and hashing tasks.
	•	JSON payloads must be canonicalised before signing.
	•	The gate must make the entry decision without a network call.
	•	The gate’s private decryption key must remain on-device in secure mobile storage.

⸻

4. Product Principles

4.1 Privacy by Design

The system must never store raw face images, intermediate crops, or reusable embeddings. Only a cancelable template may exist transiently, and the transport representation must be encrypted to the gate device.

4.2 Event-Scoped Unlinkability

The biometric representation must be specific to the event through the event salt. A template generated for one event must not be meaningfully reusable or linkable across another event.

4.3 Offline Verifiability

Once the gate device has been provisioned and synced, it must be capable of verifying pass authenticity, replay status, liveness, and template match while offline.

4.4 Operational Simplicity

The system must be realistic for a school or small venue pilot: one organizer flow, one attendee app flow, one gate phone, and one clear fallback path.

4.5 Measurable Security

Every rejection must map to a clear reason code. Every attempt must produce measurable non-biometric telemetry for evaluation.

⸻

5. System Overview

5.1 High-Level Functional Model
	1.	Organizer creates an event in the web dashboard.
	2.	The system generates an event salt, signing keypair, and join code.
	3.	The gate phone provisions itself for the event by generating its own gate encryption keypair and registering its public key.
	4.	The attendee enters the join code in the enrollment app.
	5.	The app fetches the enrollment bundle, captures the user’s face, generates an embedding on-device, converts it into a cancelable template, encrypts it to the gate public key, builds the pass payload, and requests a server signature.
	6.	The signed token is displayed as a QR code.
	7.	At the venue, the gate app scans the QR offline, verifies the signature, checks replay and revocation status, decrypts the protected template, performs liveness, computes a live template, compares by Hamming distance, and accepts or rejects.
	8.	If accepted, the pass is marked locally as used and cannot be reused.

5.2 Trust Boundaries
	•	Trusted server environment: event creation, signing key custody, pass signing, organizer-authenticated revocations.
	•	Trusted gate device: gate private key custody, offline decryption, local replay protection, local logs.
	•	Semi-trusted attendee device: local biometric capture and template creation, but not trusted to self-sign or override policy.
	•	Untrusted transport/display: QR display itself can be seen or copied, so its contents must be cryptographically protected.

⸻

6. User Personas

6.1 Organizer

Profile: Event administrator responsible for setting up the system before the event.

Goals:
	•	Create an event quickly.
	•	Ensure the gate phone is provisioned correctly.
	•	Share join instructions with attendees.
	•	Manage revocations if a pass needs to be disabled.
	•	Review logs after the event.

Security concerns:
	•	Must trust that signing keys never leave secure server-side storage.
	•	Must be confident that there is only one valid gate phone per event.
	•	Must be able to revoke compromised or invalid passes.

Pain points:
	•	Needs a clear provisioning flow.
	•	Needs confidence that the gate will still work offline.
	•	Needs evidence that the system did not store biometric data.

6.2 Attendee

Profile: Legitimate event participant enrolling on their own iPhone before the event.

Goals:
	•	Join the event with minimal friction.
	•	Understand consent and privacy clearly.
	•	Generate a pass that works reliably at entry.
	•	Have a fallback if QR scanning fails.

Security and privacy expectations:
	•	Their face image should not be uploaded or stored.
	•	Their pass should not be transferable if copied.
	•	Their biometric representation should not be reusable elsewhere.

Pain points:
	•	Needs understandable instructions for capture quality.
	•	May be nervous about facial recognition.
	•	May need manual fallback support if screen brightness, cracked display, or scanner conditions are poor.

6.3 Gate Staff

Profile: Operator using the single gate phone at entry.

Goals:
	•	Scan entrants quickly.
	•	Get a clear accept/reject result.
	•	Know exactly why a rejection occurred.
	•	Use a fallback route when scanning fails.
	•	Export logs after the event if required.

Operational concerns:
	•	Needs the system to work offline.
	•	Needs a highly readable UI with strong status states.
	•	Needs liveness prompts that are simple to administer.
	•	Must not be forced into ambiguous override decisions without logging.

⸻

7. Functional Requirements

7.1 Organizer Web Dashboard

The web dashboard must provide:
	•	Organizer authentication using Supabase Auth.
	•	Event creation with name, event_id, starts_at, and ends_at.
	•	Generated join code display.
	•	Gate provisioning state display.
	•	Visibility of PK_SIGN_EVENT and EVENT_SALT for verification and administration.
	•	Revocations management: create and remove revocations.
	•	Optional uploaded gate logs listing and download.

7.2 Enrollment App

The enrollment app must provide routes for:
	•	/ join code entry,
	•	/consent,
	•	/capture,
	•	/pass,
	•	/help.

It must support:
	•	fetching the enrollment bundle using join code,
	•	privacy and consent explanation,
	•	face capture and landmark-based alignment,
	•	on-device embedding inference,
	•	cancelable template generation,
	•	encryption to gate public key,
	•	pass payload assembly,
	•	server signing request,
	•	QR rendering,
	•	token copy access and snippet assistance.

7.3 Gate App

The gate app must provide routes for:
	•	/ organizer login status + event selection,
	•	/provision,
	•	/scan,
	•	/liveness,
	•	/result,
	•	/fallback,
	•	/settings,
	•	/export.

It must support:
	•	one-time provisioning of the gate public key,
	•	local secure storage of the gate private key,
	•	revocation and policy sync before the event,
	•	offline scanning and validation,
	•	active liveness challenge,
	•	template comparison,
	•	single-use replay rejection,
	•	manual token paste fallback,
	•	CSV export of logs.

7.4 Shared Package

The shared package must centralise:
	•	canonical JSON encoding,
	•	base64url helpers,
	•	libsodium initialisation wrappers,
	•	cancelable template logic,
	•	Hamming distance calculation,
	•	timing helpers,
	•	shared types and reason codes.

⸻

8. Security and Privacy Requirements

8.1 Cryptographic Requirements
	•	The pass payload must be signed with Ed25519 by the server.
	•	The cancelable template must be encrypted with X25519 sealed boxes to the gate public key.
	•	Payload encoding must be canonical before signing.
	•	Private signing keys must never be stored in the database.
	•	Gate private decryption keys must be generated on the gate device and retained only in secure device storage.

8.2 Biometric Protection Requirements
	•	Raw face images must not be stored.
	•	Face crops must remain in volatile memory only.
	•	Raw embeddings must not be persisted.
	•	Template generation must be deterministic per event but unlinkable across different events.
	•	Matching must use Hamming distance on the 256-bit cancelable representation.

8.3 Offline Integrity Requirements

The gate must verify:
	•	signature validity,
	•	event match,
	•	validity window,
	•	single-use flag,
	•	local replay status,
	•	local revocation cache,
	•	template decryptability,
	•	liveness success,
	•	match threshold.

8.4 Logging Restrictions

Logs may contain:
	•	timestamps,
	•	event identifiers,
	•	reason codes,
	•	latency metrics,
	•	Hamming distance,
	•	truncated hash of pass ID.

Logs must not contain:
	•	face images,
	•	embeddings,
	•	templates,
	•	decrypted biometric content,
	•	full pass tokens,
	•	personally identifying biometric traces.

⸻

9. User Journeys

9.1 User Journey A: Event Creation

Primary actor: Organizer
	1.	Organizer signs into the web dashboard.
	2.	Organizer opens the event creation form.
	3.	Organizer enters event name, event ID, start time, and end time.
	4.	Organizer submits the form.
	5.	The backend creates the event record.
	6.	The backend generates:
	•	a unique join code,
	•	an event salt,
	•	an event signing keypair.
	7.	The server stores the private signing key only in secure server-side secret infrastructure.
	8.	The public signing key is stored with the event record.
	9.	The organizer is shown the created event page.
	10.	The organizer sees:
	•	event details,
	•	join code for attendees,
	•	current gate provisioning status,
	•	public signing key,
	•	event salt.
	11.	If the gate has not yet been provisioned, the organizer is prompted to complete gate setup using the gate app.

Postconditions:
	•	Event exists.
	•	Join code is available.
	•	No attendee enrollment can complete until a gate public key has been provisioned.

Failure conditions:
	•	Unauthorized user attempts creation.
	•	Duplicate event ID.
	•	Invalid time range.

⸻

9.2 User Journey B: Attendee Enrollment

Primary actor: Attendee
	1.	Attendee opens the enrollment iOS app.
	2.	On the / route, the attendee enters the join code.
	3.	The app requests the public enrollment bundle.
	4.	If the gate has not been provisioned yet, the app blocks progress and informs the attendee that enrollment is not available.
	5.	If successful, the app transitions to /consent.
	6.	The app explains:
	•	face processing occurs on-device,
	•	no face image or embedding is stored,
	•	the generated pass is event-specific,
	•	the pass is intended for one-time use.
	7.	The attendee gives consent and proceeds to /capture.
	8.	The camera opens and detects the face.
	9.	The app aligns the face crop using eye landmarks.
	10.	The app runs the on-device embedding model.
	11.	The embedding is L2-normalized.
	12.	The app computes cancelableTemplateV1(embedding, EVENT_SALT) to produce a 256-bit template.
	13.	The app encrypts the 32-byte template using the event gate public key.
	14.	The app assembles the unsigned pass payload with version, event ID, issue time, expiry time, pass ID, nonce, encrypted template, and single-use flag.
	15.	The app sends the payload to the issue-pass endpoint.
	16.	The server canonicalises the payload and signs it with the event signing private key.
	17.	The signed token is returned to the app.
	18.	The app transitions to /pass and renders the QR token.
	19.	The attendee can:

	•	display the QR code,
	•	copy the full token,
	•	view a token snippet for manual support,
	•	open /help for entry instructions.

	20.	The app clears in-memory buffers where possible after pass generation.

Postconditions:
	•	A valid signed token exists on the attendee’s device.
	•	No raw face image or embedding has been stored.

Failure conditions:
	•	Invalid join code.
	•	Event inactive or missing gate key.
	•	Camera permission denied.
	•	No face detected or poor alignment.
	•	Inference failure.
	•	Signing request rejected.

⸻

9.3 User Journey C: Gate Scanning (Happy Path)

Primary actor: Gate Staff
	1.	Before the event, the gate device has already been provisioned for the correct event.
	2.	The gate app is on /scan.
	3.	Gate staff points the camera at the attendee’s QR code.
	4.	The gate app scans the token using VisionCamera’s built-in code scanning API.
	5.	The app splits the token into payload bytes and signature bytes.
	6.	The app verifies the Ed25519 signature against the stored event public signing key.
	7.	The app parses and validates the payload:
	•	event ID matches the provisioned event,
	•	current time is within iat and exp,
	•	single_use is true.
	8.	The app checks local SQLite for the pass ID.
	9.	If the pass has already been accepted previously, it rejects as REPLAY_USED.
	10.	The app checks the locally cached revocation list.
	11.	If the pass is revoked, it rejects as REVOKED.
	12.	The app decrypts the encrypted template using the gate private key.
	13.	The app transitions to /liveness.
	14.	A random active liveness challenge is selected.
	15.	The attendee completes the challenge within four seconds while the face remains continuously tracked.
	16.	The app captures the live face frame sequence needed for verification.
	17.	The app generates a live embedding on-device.
	18.	The app computes the live cancelable template using the same event salt.
	19.	The app computes Hamming distance between stored and live templates.
	20.	If the distance is at or below threshold, the app accepts.
	21.	The app writes the pass ID into local used_passes storage.
	22.	The app shows a green result screen, emits haptic feedback, and logs non-biometric metrics.

Postconditions:
	•	Entry is granted.
	•	The pass becomes unusable for future attempts on that gate.
	•	A non-biometric log record exists.

⸻

9.4 User Journey D: Gate Scanning (Fallback or Liveness Failure)

Primary actor: Gate Staff

Scenario 1: Camera scan failure
	1.	The QR cannot be scanned due to glare, screen damage, or camera conditions.
	2.	Gate staff opens /fallback.
	3.	The attendee provides the full token using copy/paste or typed transfer.
	4.	The gate app validates the pasted token using the exact same offline verification pipeline as a scanned token.
	5.	If the token is valid, the flow proceeds to liveness and matching.
	6.	If the token is invalid, expired, revoked, or already used, the system rejects with the corresponding reason code.

Scenario 2: Liveness failure
	1.	The QR or pasted token is structurally valid and decryptable.
	2.	The app begins liveness.
	3.	The attendee fails to complete the challenge in time, loses tracking, or does not cross the required motion threshold.
	4.	The system rejects with LIVENESS_FAIL or a more specific sub-reason in logs.
	5.	Gate staff sees a clear rejection reason and can restart a new attempt if appropriate.

Scenario 3: Optional queue code manual override
	1.	A short 8-digit queue code may exist only for human support.
	2.	It cannot reconstruct a full pass offline on its own.
	3.	If the system allows a manual override path, it must be explicitly logged as MANUAL_OVERRIDE.
	4.	This path is administrative and not part of the standard biometric verification guarantee.

Postconditions:
	•	Fallback preserves security properties because full-token validation is still required.
	•	Liveness failure does not mark the pass as used.
	•	Any override remains auditable.

⸻

10. Detailed Verification Logic

10.1 Pass Payload Structure

The signed pass payload must contain:
	•	version,
	•	event ID,
	•	issued-at time,
	•	expiry time,
	•	pass ID,
	•	nonce,
	•	encrypted template,
	•	single-use flag.

10.2 Verification Order

The gate should reject as early as possible for efficiency and clarity. Recommended order:
	1.	Parse token.
	2.	Verify signature.
	3.	Validate payload fields.
	4.	Check replay.
	5.	Check revocation.
	6.	Decrypt template.
	7.	Run liveness.
	8.	Generate live template.
	9.	Compare Hamming distance.
	10.	Record outcome and timings.

10.3 Reason Codes

The system must use explicit machine-readable reason codes, including at minimum:
	•	ACCEPT
	•	INVALID_TOKEN
	•	BAD_SIGNATURE
	•	WRONG_EVENT
	•	EXPIRED
	•	NOT_YET_VALID
	•	REPLAY_USED
	•	REVOKED
	•	DECRYPT_FAIL
	•	LIVENESS_FAIL
	•	MATCH_FAIL
	•	MANUAL_OVERRIDE
	•	SYSTEM_ERROR

Each reason code must map to a human-readable hint in the UI.

⸻

11. Active Liveness Requirements

11.1 Challenge Types

Each attempt must randomly select one of:
	•	blink twice,
	•	turn head left then centre,
	•	look up then centre.

11.2 Success Conditions
	•	The challenge must complete within 4 seconds.
	•	The face must remain continuously tracked.
	•	If tracking is lost, the prompt resets.
	•	Landmark movement must cross the challenge threshold and return to neutral.

11.3 Failure Handling

If liveness fails:
	•	no biometric artefact may be stored,
	•	the pass must not be marked used,
	•	the attempt must still be logged with liveness time and failure reason.

⸻

12. Data Model Requirements

12.1 Events

Must support:
	•	event identifier,
	•	human-readable name,
	•	start and end times,
	•	join code,
	•	event salt,
	•	public signing key,
	•	gate public key once provisioned,
	•	creator identity,
	•	created timestamp.

12.2 Gate Devices

Must enforce:
	•	exactly one gate device per event,
	•	gate public key registration,
	•	provision timestamp,
	•	optional device name.

12.3 Revocations

Must support:
	•	event-scoped pass revocation,
	•	uniqueness of (event_id, pass_id).

12.4 Gate Logs

If uploaded, must support:
	•	event ID,
	•	upload timestamp,
	•	CSV link.

12.5 Access Control

Row-level security must ensure that only the organizer who created the event can modify associated records and view their logs.

⸻

13. Non-Functional Requirements

13.1 Security
	•	No fake cryptography.
	•	No client-side signing.
	•	No reusable biometric storage.
	•	No dependence on network availability during gate decisioning.

13.2 Reliability
	•	Offline verification must remain functional after provisioning and sync.
	•	Scanning latency should be low enough for practical gate throughput.
	•	Manual fallback must use the same trust model as QR scanning wherever possible.

13.3 Usability
	•	Organizer screens must be simple and auditable.
	•	Attendee instructions must reduce fear around privacy.
	•	Gate UI must use high-contrast status outcomes and minimal ambiguity.

13.4 Auditability
	•	Each verification attempt must produce a structured outcome record.
	•	Logs must be exportable in CSV form.
	•	Override paths must be clearly separable from standard acceptance.

13.5 Maintainability
	•	Strict TypeScript must be used across the system.
	•	Shared logic must be centralised in the shared package.
	•	Tests must cover cryptographic and template utilities.

⸻

14. Success Metrics

The artefact will be considered successful if it demonstrates both technical correctness and evaluable system behaviour.

14.1 Security/Privacy Success Metrics
	•	Zero biometric persistence: no raw face images, embeddings, or templates stored in backend or logs.
	•	Offline verification integrity: gate decisions remain functional with network disabled.
	•	Replay resistance: second use of an accepted pass is rejected consistently.
	•	Event unlinkability evidence: templates generated under different event salts are not directly reusable across events.
	•	Protected QR content: copying a QR token alone does not expose usable biometric information.

14.2 Functional Success Metrics
	•	Event creation succeeds end-to-end.
	•	Gate provisioning succeeds exactly once per event.
	•	Attendee enrollment succeeds from join code to QR pass generation.
	•	Gate happy-path verification succeeds offline.
	•	Fallback token paste path works.
	•	Revocation sync correctly blocks revoked passes.
	•	CSV export produces readable non-biometric logs.

14.3 Performance/Evaluation Metrics

The following timings should be captured and analysed per attempt:
	•	scan_ms
	•	sig_verify_ms
	•	decrypt_ms
	•	liveness_ms
	•	inference_ms
	•	template_ms
	•	match_ms
	•	total_ms

Additional evaluation fields:
	•	outcome,
	•	reason code,
	•	Hamming distance,
	•	truncated pass ID hash.

14.4 Indicative Quantitative Targets

For prototype evaluation, the following targets are suitable:
	•	100% rejection of replayed accepted passes.
	•	100% rejection of tampered signatures in controlled tests.
	•	100% refusal to verify when the token is for the wrong event.
	•	0 stored biometric records in logs, backend tables, or app persistence.
	•	Operationally acceptable median total verification time for a supervised school or small-event gate trial.

⸻

15. Definition of Done

The product is done only when all of the following are true:
	1.	Organizer can authenticate and create an event.
	2.	The event page displays the join code.
	3.	Gate provisioning can occur exactly once for the event.
	4.	The gate private key is created on-device and retained securely.
	5.	The enrollment app can fetch the event bundle using join code.
	6.	The attendee can complete consent and capture.
	7.	The app can generate an on-device embedding and convert it into a cancelable template.
	8.	The template is encrypted to the gate public key.
	9.	The unsigned payload is server-signed only.
	10.	The attendee can display a QR token and access the full token for fallback.
	11.	The gate can scan the token while offline.
	12.	The gate can verify signature and payload validity.
	13.	The gate can check replay and revocation status from local state.
	14.	The gate can decrypt the protected template.
	15.	The gate can run an active liveness challenge.
	16.	The gate can compute a live template and compare by Hamming distance.
	17.	The gate accepts legitimate users and rejects failure states with explicit reason codes.
	18.	A successful pass cannot be used again.
	19.	Logs export as CSV and contain timings and reason codes only.
	20.	No face images or embeddings are stored anywhere in the system.

⸻

16. Dual Testing Strategy

The testing strategy must combine repeatable automated checks with practical manual end-to-end validation.

16.1 Automated Unit Tests

These tests are designed to verify deterministic and security-sensitive logic.

Shared Package Tests
	1.	Cancelable template determinism
	•	Same embedding + same event salt must always produce the same 256-bit template.
	•	Same embedding + different event salts must produce different templates.
	2.	Hamming distance correctness
	•	Known template pairs must return the correct popcount distance.
	•	Identity comparison must return zero.
	3.	Base64url roundtrip
	•	Encoding then decoding must recover the original bytes exactly.
	4.	Canonical JSON stability
	•	Equivalent payload objects with different key orderings must canonicalise identically.

Backend / Crypto Tests
	5.	Signature verification vector
	•	Known payload and signing keypair must verify correctly.
	•	Any payload modification must fail verification.
	6.	Provisioning invariants
	•	A second gate provisioning request for the same event must be rejected.
	7.	Enrollment bundle exposure rules
	•	The bundle must not be returned before the gate public key exists.
	8.	Issue-pass contract test
	•	Returned signature must validate against the stored event public key.

16.2 Manual End-to-End Checklists

These checklists are essential because camera, liveness, secure storage, and offline UX cannot be fully validated by unit tests alone.

A. Organizer Checklist
	•	Log in successfully.
	•	Create an event with valid times.
	•	Confirm join code is shown.
	•	Confirm gate state initially appears unprovisioned.
	•	Confirm revocations can be added and removed.

B. Gate Provisioning Checklist
	•	Open gate app and select event.
	•	Generate gate keypair.
	•	Provision event successfully.
	•	Confirm second provisioning attempt is rejected.
	•	Confirm keys persist across app relaunch.

C. Enrollment Checklist
	•	Enter valid join code.
	•	Read and accept consent.
	•	Capture face successfully.
	•	Confirm pass token is generated.
	•	Confirm QR appears.
	•	Confirm full token copy is available.
	•	Confirm no image is saved to Photos or app storage.

D. Happy-Path Gate Verification Checklist
	•	Disable network on gate device.
	•	Scan valid attendee QR.
	•	Confirm signature validation passes.
	•	Complete liveness challenge.
	•	Confirm accepted result shown.
	•	Confirm used pass recorded locally.
	•	Immediately rescan same pass and confirm replay rejection.

E. Negative Case Checklist
	•	Try expired token.
	•	Try wrong-event token.
	•	Try token with tampered payload.
	•	Try revoked token after sync.
	•	Fail liveness deliberately.
	•	Present another person’s face with a copied token.
	•	Confirm each case yields a distinct reason code.

F. Fallback Checklist
	•	Use pasted full token instead of QR scan.
	•	Confirm identical validation logic is applied.
	•	Confirm pasted valid token can still proceed to liveness and matching.
	•	Confirm malformed pasted token is rejected cleanly.

G. Log Export Checklist
	•	Export logs to CSV.
	•	Confirm presence of timings, reason code, outcome, and truncated pass hash.
	•	Confirm absence of biometric data and full token values.

⸻

17. Risks and Mitigations

17.1 Risk: False Match / False Reject

Because this is a prototype using a pre-trained model and a cancelable transformation, threshold tuning may affect usability.

Mitigation:
	•	Start with a threshold of 80 as specified.
	•	Expose threshold only behind organizer-authenticated settings.
	•	Record Hamming distance distributions during evaluation.

17.2 Risk: Liveness Friction

Active liveness may slow throughput or confuse attendees.

Mitigation:
	•	Keep the prompt set small and interpretable.
	•	Use only one challenge per attempt.
	•	Keep success window fixed at four seconds.

17.3 Risk: Operational Failure if Gate Not Provisioned

Attendees cannot generate valid passes before the gate public key exists.

Mitigation:
	•	Block enrollment until provisioning exists.
	•	Make gate status highly visible on the organizer dashboard.

17.4 Risk: Misunderstanding of Privacy Claims

Users may assume “face recognition” means face images are stored.

Mitigation:
	•	Use explicit consent text.
	•	Provide plain-language help explaining on-device processing and non-storage.

⸻

18. Open Implementation Notes That Must Remain Consistent with the PRD
	•	The implementation must use a real pre-trained on-device face embedding model.
	•	The implementation must document assumptions where compatibility issues arise.
	•	The gate’s offline decision path must remain authoritative.
	•	Manual fallback must never weaken the trust model by pretending a short human-readable code contains the full pass.

⸻

19. Final Product Statement

One-Time Face Pass is a deliberately constrained, privacy-first event entry system intended to demonstrate that biometric verification can be made substantially less invasive by combining on-device inference, cancelable templates, gate-specific encryption, server-side signing, and offline verification. The artefact’s success depends not only on whether it works, but on whether it works without storing biometrics, without relying on constant connectivity, and without collapsing under common operational failure cases such as replay, scanner failure, or liveness failure.

In product terms, the system should be judged successful if it provides a credible answer to the central research question of the artefact: whether biometric access control can be designed so that convenience does not automatically require centralised biometric storage or transferable credentials.
