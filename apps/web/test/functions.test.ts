import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEdgeFunctionErrorMessage } from "../lib/edge-function-invocation.ts";

test("maps local Supabase edge runtime resolution failures to an actionable message", () => {
  const message = normalizeEdgeFunctionErrorMessage("name resolution failed");

  assert.match(message, /Supabase Edge Functions are unavailable/i);
  assert.match(message, /restart the local Supabase stack/i);
});

test("preserves ordinary edge-function errors", () => {
  assert.equal(
    normalizeEdgeFunctionErrorMessage("starts_at must be earlier than ends_at."),
    "starts_at must be earlier than ends_at.",
  );
});
