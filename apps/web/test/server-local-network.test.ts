import assert from "node:assert/strict";
import test from "node:test";

import { resolveServerSupabaseUrl } from "../lib/server-local-network.ts";

test("replaces a stale private Supabase host with the current server LAN host", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "http://192.168.0.144:54321",
      serverHostname: "192.168.0.141",
    }),
    "http://192.168.0.141:54321",
  );
});

test("uses the request host for local Supabase so SSR reads the browser auth cookie", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "http://127.0.0.1:54321",
      requestHostname: "localhost",
      serverHostname: "192.168.0.141",
    }),
    "http://localhost:54321",
  );
});

test("uses the request LAN host for local Supabase when the app is opened from another device", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "http://127.0.0.1:54321",
      requestHostname: "192.168.0.141",
      serverHostname: "192.168.0.141",
    }),
    "http://192.168.0.141:54321",
  );
});

test("preserves loopback Supabase URLs on the server when there is no request host", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "http://127.0.0.1:54321",
      serverHostname: "192.168.0.141",
    }),
    "http://127.0.0.1:54321",
  );
});

test("preserves hosted Supabase URLs on the server", () => {
  assert.equal(
    resolveServerSupabaseUrl({
      configuredUrl: "https://project-ref.supabase.co",
      serverHostname: "192.168.0.141",
    }),
    "https://project-ref.supabase.co",
  );
});
