import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchWithTimeout,
  resolveSupabaseUrl,
} from "../src/lib/function-network.ts";

test("does not rewrite an explicitly selected LAN host from Expo metadata", () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: "http://192.168.0.144:54321",
    expoHostUri: "192.168.0.141:8081",
  });

  assert.equal(resolved, "http://192.168.0.144:54321");
});

test("preserves configured non-local hosts", () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: "https://project-ref.supabase.co",
    expoHostUri: "192.168.0.141:8081",
  });

  assert.equal(resolved, "https://project-ref.supabase.co");
});

test("does not silently repair a loopback URL from Expo metadata", () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: "http://127.0.0.1:54321",
    expoHostUri: "192.168.0.141:8081",
  });

  assert.equal(resolved, "http://127.0.0.1:54321");
});

test("rejects a missing selected URL instead of inferring one", () => {
  assert.throws(
    () => resolveSupabaseUrl({ expoHostUri: "192.168.0.141:8081" }),
    /never inferred/i,
  );
});

test("times out hung requests with an actionable error", async () => {
  await assert.rejects(
    () =>
      fetchWithTimeout({
        errorPrefix: "Unable to reach the enrollment service.",
        fetchImpl: (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
        timeoutMs: 10,
        url: "http://192.168.0.144:54321/functions/v1/get-enrollment-bundle",
      }),
    /Unable to reach the enrollment service\..*EXPO_PUBLIC_FOCACCIA_SUPABASE_URL/i,
  );
});
