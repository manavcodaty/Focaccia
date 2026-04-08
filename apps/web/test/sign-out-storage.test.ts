import test from "node:test";
import assert from "node:assert/strict";

import { clearMatchingStorage } from "../lib/sign-out.ts";

class FakeStorage {
  readonly entries = new Map<string, string>();

  get length() {
    return this.entries.size;
  }

  key(index: number) {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.entries.delete(key);
  }

  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

test("clearMatchingStorage only removes Supabase auth artifacts", () => {
  const storage = new FakeStorage();
  storage.setItem("sb-project-auth-token", "token");
  storage.setItem("supabase.auth.refreshToken", "refresh");
  storage.setItem("theme", "dark");

  clearMatchingStorage(storage);

  assert.equal(storage.entries.has("sb-project-auth-token"), false);
  assert.equal(storage.entries.has("supabase.auth.refreshToken"), false);
  assert.equal(storage.entries.get("theme"), "dark");
});
