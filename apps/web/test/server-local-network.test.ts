import assert from "node:assert/strict";
import test from "node:test";

import { resolveServerSupabaseUrl } from "../lib/server-local-network.ts";

test("does not rewrite the selected local URL from request or server hosts", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "http://192.168.0.195:54331/",
      requestHostname: "localhost",
      serverHostname: "192.168.0.141",
    }),
    "http://192.168.0.195:54331",
  );
});

test("preserves the selected tunnel URL", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "https://focaccia-api.share.zrok.io/",
      requestHostname: "localhost",
      serverHostname: "192.168.0.141",
    }),
    "https://focaccia-api.share.zrok.io",
  );
});
