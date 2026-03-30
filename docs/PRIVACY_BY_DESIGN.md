# Privacy By Design

The implementation still preserves the core privacy boundary from the truth base: no raw face image, crop, embedding, or cancelable template is written to Supabase, analytics, or exported logs.

For the enrollment app, the biometric flow is now:

- request camera access only after explicit consent,
- capture a face locally on the attendee device,
- derive the embedding with the bundled `facenet_512.tflite` model,
- transform it into the event-scoped cancelable template in `packages/shared`,
- seal that template to the provisioned gate public key,
- send only the encrypted template inside the payload to be signed.

Model provenance:

- `apps/enrollment/assets/models/facenet_512.tflite`
- source repository: `shubham0204/OnDevice-Face-Recognition-Android`
- source license: Apache License 2.0
- assumed shape: `160x160x3` float32 input, `512`-float embedding output

Platform caveat:

- Expo + VisionCamera photo capture is currently exposed through temporary file URIs rather than a pure in-memory still buffer API.
- The enrollment implementation deletes the captured photo and aligned crop immediately after the embedding is extracted, so no biometric image files are intentionally retained past the current issuance attempt.
