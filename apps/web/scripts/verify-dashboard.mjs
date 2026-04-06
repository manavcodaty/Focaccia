import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createServerClient } from "@supabase/ssr";

import { getCurrentServerHostname, resolveServerSupabaseUrl } from "./local-network.mjs";

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

function applySetCookieHeaders(response, cookieJar) {
  for (const header of response.headers.getSetCookie?.() ?? []) {
    const [nameValue] = header.split(";", 1);

    if (!nameValue) {
      continue;
    }

    const separatorIndex = nameValue.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = nameValue.slice(0, separatorIndex);
    const value = nameValue.slice(separatorIndex + 1);
    cookieJar.set(name, { name, value });
  }
}

async function fetchWithCookies(url, cookieJar, init = {}) {
  let currentUrl = url;
  let method = init.method ?? "GET";
  let body = init.body;
  let redirects = 0;
  const baseHeaders = new Headers(init.headers ?? {});

  while (redirects < 10) {
    const headers = new Headers(baseHeaders);
    const cookieHeader = buildCookieHeader(cookieJar);

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await fetch(currentUrl, {
      ...init,
      body,
      headers,
      method,
      redirect: "manual",
    });

    applySetCookieHeaders(response, cookieJar);

    const location = response.headers.get("location");

    if (
      location
      && [301, 302, 303, 307, 308].includes(response.status)
    ) {
      currentUrl = new URL(location, currentUrl).toString();
      redirects += 1;

      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== "GET")) {
        method = "GET";
        body = undefined;
      }

      continue;
    }

    return response;
  }

  throw new Error("redirect count exceeded");
}

const webDir = import.meta.dirname;
const env = parseEnvFile(path.join(webDir, "../.env.local"));
const cookieJar = new Map();
const supabaseUrl = resolveServerSupabaseUrl({
  configuredUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  serverHostname: getCurrentServerHostname(),
});

const supabase = createServerClient(
  supabaseUrl,
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

const dashboardResponse = await fetchWithCookies("http://127.0.0.1:3000/dashboard", cookieJar);
const dashboardHtml = await dashboardResponse.text();
assert.equal(dashboardResponse.status, 200);
assert.match(dashboardHtml, /Welcome back/i);
assert.match(dashboardHtml, /Event roster|No events yet/i);
assert.match(dashboardHtml, /Create event/i);

const eventId = `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

const createEventResponse = await fetch(
  `${supabaseUrl}/functions/v1/create-event`,
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

const eventOverviewResponse = await fetchWithCookies(
  `http://127.0.0.1:3000/events/${eventId}`,
  cookieJar,
);
const eventOverviewHtml = await eventOverviewResponse.text();
assert.equal(eventOverviewResponse.status, 200);
assert.match(eventOverviewHtml, /Event overview/i);
assert.match(eventOverviewHtml, /Public cryptographic values/i);
assert.match(eventOverviewHtml, /Gate logs/i);

const eventCreatePage = await fetchWithCookies("http://127.0.0.1:3000/events/new", cookieJar);
const eventCreateHtml = await eventCreatePage.text();
assert.equal(eventCreatePage.status, 200);
assert.match(eventCreateHtml, /Create Event/i);
assert.match(eventCreateHtml, /join code, event salt, and signing key/i);

const provisioningResponse = await fetchWithCookies(
  `http://127.0.0.1:3000/events/${eventId}/provisioning`,
  cookieJar,
);
const provisioningHtml = await provisioningResponse.text();
assert.equal(provisioningResponse.status, 200);
assert.match(provisioningHtml, /Gate Provisioning/i);
assert.match(provisioningHtml, /Public values/i);
assert.match(provisioningHtml, /PK_SIGN_EVENT/i);
assert.match(provisioningHtml, /EVENT_SALT/i);
assert.match(provisioningHtml, new RegExp(eventId));

const revocationsResponse = await fetchWithCookies(
  `http://127.0.0.1:3000/events/${eventId}/revocations`,
  cookieJar,
);
const revocationsHtml = await revocationsResponse.text();
assert.equal(revocationsResponse.status, 200);
assert.match(revocationsHtml, /Revocations/i);
assert.match(revocationsHtml, /No revocations yet/i);

const logsResponse = await fetchWithCookies(
  `http://127.0.0.1:3000/events/${eventId}/logs`,
  cookieJar,
);
const logsHtml = await logsResponse.text();
assert.equal(logsResponse.status, 200);
assert.match(logsHtml, /Gate logs/i);
assert.match(logsHtml, /No logs uploaded yet/i);

console.log(
  JSON.stringify(
    {
      dashboard_checked: true,
      event_id: eventId,
      join_code: createEventJson.data.join_code,
      logs_checked: true,
      provisioning_checked: true,
      revocations_checked: true,
    },
    null,
    2,
  ),
);
