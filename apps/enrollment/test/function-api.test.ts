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

test("public function requests include a bearer anon key for the local gateway", () => {
  const headers = buildFunctionHeaders("anon-key-value");

  assert.deepEqual(headers, {
    Authorization: "Bearer anon-key-value",
    apikey: "anon-key-value",
    "Content-Type": "application/json",
  });
});
