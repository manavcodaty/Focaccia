import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareFunctionsEnvFiles,
} from "./prepare-supabase-functions-env.mjs";

test("builds supabase/functions/.env from .env.local and example defaults", () => {
  const result = prepareFunctionsEnvFiles({
    envExampleText: [
      "FACE_PASS_SECRET_WRAPPING_KEY_B64URL=replace-with-a-base64url-encoded-32-byte-secret",
      "FACE_PASS_MATCH_THRESHOLD=80",
      "FACE_PASS_LIVENESS_TIMEOUT_MS=4000",
      "FACE_PASS_QUEUE_CODE_DIGITS=8",
      "",
    ].join("\n"),
    envLocalText: [
      "SUPABASE_URL=http://127.0.0.1:54321",
      "SUPABASE_ANON_KEY=test-anon",
      "SUPABASE_SERVICE_ROLE_KEY=test-service-role",
      "FACE_PASS_SECRET_WRAPPING_KEY_B64URL=existing-secret-value-1234567890123456789012",
      "",
    ].join("\n"),
  });

  assert.equal(result.generatedSecret, false);
  assert.match(
    result.envText,
    /^FACE_PASS_SECRET_WRAPPING_KEY_B64URL=existing-secret-value-1234567890123456789012/m,
  );
  assert.match(result.envText, /^FACE_PASS_MATCH_THRESHOLD=80$/m);
  assert.match(result.envText, /^FACE_PASS_LIVENESS_TIMEOUT_MS=4000$/m);
  assert.match(result.envText, /^FACE_PASS_QUEUE_CODE_DIGITS=8$/m);
  assert.doesNotMatch(result.envText, /^SUPABASE_URL=/m);
});

test("generates and persists a wrapping key when .env.local is missing it", () => {
  const result = prepareFunctionsEnvFiles({
    envExampleText: [
      "FACE_PASS_SECRET_WRAPPING_KEY_B64URL=replace-with-a-base64url-encoded-32-byte-secret",
      "FACE_PASS_MATCH_THRESHOLD=80",
      "FACE_PASS_LIVENESS_TIMEOUT_MS=4000",
      "FACE_PASS_QUEUE_CODE_DIGITS=8",
      "",
    ].join("\n"),
    envLocalText: [
      "SUPABASE_URL=http://127.0.0.1:54321",
      "SUPABASE_ANON_KEY=test-anon",
      "SUPABASE_SERVICE_ROLE_KEY=test-service-role",
      "",
    ].join("\n"),
  });

  assert.equal(result.generatedSecret, true);
  assert.match(result.envText, /^FACE_PASS_SECRET_WRAPPING_KEY_B64URL=[A-Za-z0-9_-]{43}$/m);
  assert.match(result.updatedEnvLocalText, /^FACE_PASS_SECRET_WRAPPING_KEY_B64URL=[A-Za-z0-9_-]{43}$/m);
});
