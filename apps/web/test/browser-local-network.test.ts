import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrowserSupabaseUrl } from "../lib/browser-local-network.ts";

test("does not rewrite an explicitly selected local URL from the browser host", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "192.168.0.141",
      configuredUrl: "http://192.168.0.195:54331/",
    }),
    "http://192.168.0.195:54331",
  );
});

test("preserves an explicitly selected tunnel URL", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "192.168.0.141",
      configuredUrl: "https://focaccia-api.share.zrok.io/",
    }),
    "https://focaccia-api.share.zrok.io",
  );
});
