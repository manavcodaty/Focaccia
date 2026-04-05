import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createServerClient } from "@supabase/ssr";

function parseEnvFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const values = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    values[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return values;
}

function buildCookieHeader(cookieJar) {
  return Array.from(cookieJar.values())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

const webDir = import.meta.dirname;
const env = parseEnvFile(path.join(webDir, "../.env.local"));
const cookieJar = new Map();

const supabase = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll() {
        return Array.from(cookieJar.values()).map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          cookieJar.set(cookie.name, cookie);
        });
      },
    },
  },
);

const loginResponse = await fetch("http://127.0.0.1:3000/login");
const loginHtml = await loginResponse.text();
const loginMain = loginHtml.match(/<main[\s\S]*<\/main>/i)?.[0] ?? loginHtml;
assert.equal(loginResponse.status, 200);
assert.match(loginMain, /Welcome back/i);
assert.match(loginMain, /Email/i);
assert.match(loginMain, /Password/i);
assert.match(loginMain, /Sign in/i);
assert.match(loginMain, /Sign up/i);
assert.doesNotMatch(loginMain, /Apple/i);
assert.doesNotMatch(loginMain, /Google/i);
assert.doesNotMatch(loginMain, /Continue with/i);
assert.doesNotMatch(loginMain, /Or continue with/i);

const unauthenticatedDashboard = await fetch("http://127.0.0.1:3000/dashboard", {
  redirect: "manual",
});
assert.equal(unauthenticatedDashboard.status, 307);
assert.equal(unauthenticatedDashboard.headers.get("location"), "/login");

const email = `organizer-${randomUUID()}@example.com`;
const password = `P@ssword-${randomUUID()}`;

const invalidSignIn = await supabase.auth.signInWithPassword({
  email,
  password: `${password}-wrong`,
});
assert.match(invalidSignIn.error?.message ?? "", /invalid/i);

let authResult = await supabase.auth.signUp({ email, password });

if (authResult.error) {
  throw authResult.error;
}

const duplicateSignUp = await supabase.auth.signUp({ email, password });
assert.match(duplicateSignUp.error?.message ?? "", /already|registered|exists/i);

let session = authResult.data.session;

if (!session) {
  authResult = await supabase.auth.signInWithPassword({ email, password });

  if (authResult.error) {
    throw authResult.error;
  }

  session = authResult.data.session;
}

assert.ok(session?.access_token, "missing access token after auth");

const cookieHeader = buildCookieHeader(cookieJar);
assert.ok(cookieHeader.length > 0, "missing session cookies");

const authenticatedDashboard = await fetch("http://127.0.0.1:3000/dashboard", {
  headers: {
    Cookie: cookieHeader,
  },
});
const dashboardHtml = await authenticatedDashboard.text();
assert.equal(authenticatedDashboard.status, 200);
assert.match(dashboardHtml, /Dashboard/i);

const authenticatedLogin = await fetch("http://127.0.0.1:3000/login", {
  headers: {
    Cookie: cookieHeader,
  },
  redirect: "manual",
});
assert.equal(authenticatedLogin.status, 307);
assert.equal(authenticatedLogin.headers.get("location"), "/dashboard");

console.log(
  JSON.stringify(
    {
      auth_ui_checked: true,
      dashboard_checked: true,
      email,
      login_redirect_checked: true,
    },
    null,
    2,
  ),
);
