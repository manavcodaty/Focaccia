import test from "node:test";
import assert from "node:assert/strict";

import { parseEdgeFunctionResponse } from "../lib/edge-function-response.ts";

test("surfaces top-level message fields from failed edge function payloads", async () => {
  const response = new Response(
    JSON.stringify({
      code: "FUNCTION_INVOCATION_FAILED",
      message: "Secret wrapping key is missing.",
    }),
    {
      status: 500,
      statusText: "Internal Server Error",
    },
  );

  await assert.rejects(
    () => parseEdgeFunctionResponse(response),
    {
      message: "Secret wrapping key is missing.",
      name: "Error",
    },
  );
});
