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

const unauthenticatedDashboard = await fetch("http://127.0.0.1:3000/dashboard", {
  redirect: "manual",
});
assert.equal(unauthenticatedDashboard.status, 307);
assert.equal(unauthenticatedDashboard.headers.get("location"), "/login");

const email = `organizer-${randomUUID()}@example.com`;
const password = `P@ssword-${randomUUID()}`;

let authResult = await supabase.auth.signUp({ email, password });

if (authResult.error) {
  throw authResult.error;
}

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

const dashboardResponse = await fetch("http://127.0.0.1:3000/dashboard", {
  headers: {
    Cookie: cookieHeader,
  },
});
const dashboardHtml = await dashboardResponse.text();
assert.equal(dashboardResponse.status, 200);
assert.match(dashboardHtml, /Event inventory for/i);
assert.match(dashboardHtml, /Create Event/i);

const eventId = `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

const createEventResponse = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-event`,
  {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ends_at: endsAt,
      event_id: eventId,
      name: "Web Dashboard Verification Event",
      starts_at: startsAt,
    }),
  },
);
const createEventJson = await createEventResponse.json();
assert.equal(createEventResponse.status, 201, JSON.stringify(createEventJson));
assert.equal(createEventJson.ok, true);
assert.match(createEventJson.data.join_code, /^[A-Z0-9]{8}$/);

const eventCreatePage = await fetch("http://127.0.0.1:3000/events/new", {
  headers: {
    Cookie: cookieHeader,
  },
});
const eventCreateHtml = await eventCreatePage.text();
assert.equal(eventCreatePage.status, 200);
assert.match(eventCreateHtml, /Event creation/i);
assert.match(eventCreateHtml, /Create event/i);

const provisioningResponse = await fetch(
  `http://127.0.0.1:3000/events/${eventId}/provisioning`,
  {
    headers: {
      Cookie: cookieHeader,
    },
  },
);
const provisioningHtml = await provisioningResponse.text();
assert.equal(provisioningResponse.status, 200);
assert.match(provisioningHtml, /Gate provisioning transfer/i);
assert.match(provisioningHtml, /PK_SIGN_EVENT/i);
assert.match(provisioningHtml, /EVENT_SALT/i);
assert.match(provisioningHtml, new RegExp(eventId));

console.log(
  JSON.stringify(
    {
      dashboard_checked: true,
      event_id: eventId,
      join_code: createEventJson.data.join_code,
      provisioning_checked: true,
    },
    null,
    2,
  ),
);
