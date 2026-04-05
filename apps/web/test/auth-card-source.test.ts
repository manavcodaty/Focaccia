import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const authCardPath = path.join(import.meta.dirname, "../components/auth/auth-card.tsx");
const loginPagePath = path.join(import.meta.dirname, "../app/login/page.tsx");

test("uses a dedicated auth card component on the login page", () => {
  const source = readFileSync(loginPagePath, "utf8");

  assert.match(source, /@\/components\/auth\/auth-card/);
});

test("strips social-login UI and wires the auth card to email/password Supabase auth", () => {
  const source = readFileSync(authCardPath, "utf8");

  assert.doesNotMatch(source, /Apple/i);
  assert.doesNotMatch(source, /Google/i);
  assert.doesNotMatch(source, /Continue with/i);
  assert.doesNotMatch(source, /Or continue with/i);
  assert.match(source, /signInWithPassword/);
  assert.match(source, /signUp\(/);
  assert.match(source, /Email/);
  assert.match(source, /Password/);
});
