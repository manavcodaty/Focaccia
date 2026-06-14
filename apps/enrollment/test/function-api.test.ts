import assert from "node:assert/strict";
import test from "node:test";

import { buildFunctionHeaders } from "../src/lib/function-request.ts";
import {
  extractFunctionError,
  FunctionApiError,
} from "../src/lib/function-errors.ts";

test("extracts gateway msg payloads without crashing", () => {
  assert.deepEqual(
    extractFunctionError({
      payload: { msg: "Error: Missing authorization header" },
      status: 401,
    }),
    {
      code: "unknown_error",
      message: "Error: Missing authorization header",
    },
  );
});

test("FunctionApiError falls back when the payload has no structured error", () => {
  const error = new FunctionApiError(503, undefined, "Gateway unavailable");

  assert.equal(error.status, 503);
  assert.equal(error.code, "unknown_error");
  assert.equal(error.message, "Gateway unavailable");
});

test("authenticated function requests keep the anon gateway key separate from the user bearer token", () => {
  const headers = buildFunctionHeaders({
    accessToken: "attendee-access-token",
    anonKey: "anon-key-value",
    idempotencyKey: "40000000-0000-4000-8000-000000000001",
  });

  assert.deepEqual(headers, {
    Authorization: "Bearer attendee-access-token",
    "Idempotency-Key": "40000000-0000-4000-8000-000000000001",
    apikey: "anon-key-value",
    "Content-Type": "application/json",
  });
});

test("authenticated function requests reject an absent session token", () => {
  assert.throws(
    () => buildFunctionHeaders({ accessToken: "", anonKey: "anon-key-value" }),
    /sign in/i,
  );
});
