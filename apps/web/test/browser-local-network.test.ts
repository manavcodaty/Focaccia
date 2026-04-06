import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrowserSupabaseUrl } from "../lib/browser-local-network.ts";

test("replaces localhost with the current browser LAN host", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "192.168.0.141",
      configuredUrl: "http://127.0.0.1:54321",
    }),
    "http://192.168.0.141:54321",
  );
});

test("replaces a stale private Supabase host with localhost when the page is opened locally", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "127.0.0.1",
      configuredUrl: "http://192.168.0.144:54321",
    }),
    "http://127.0.0.1:54321",
  );
});

test("replaces a stale private Supabase host with the current browser LAN host", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "192.168.0.141",
      configuredUrl: "http://192.168.0.144:54321",
    }),
    "http://192.168.0.141:54321",
  );
});

test("preserves hosted Supabase URLs for the browser client", () => {
  assert.equal(
    resolveBrowserSupabaseUrl({
      browserHostname: "192.168.0.141",
      configuredUrl: "https://project-ref.supabase.co",
    }),
    "https://project-ref.supabase.co",
  );
});
