import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const repo = path.resolve(import.meta.dirname, "../..");
const requireWeb = createRequire(path.join(repo, "apps/web/package.json"));
const { createServerClient } = requireWeb("@supabase/ssr");

function parseEnv(file) {
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
    const i = line.indexOf("=");
    if (i < 1 || line.trim().startsWith("#")) return [];
    return [[line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")]];
  }));
}

export const webEnv = parseEnv(path.join(repo, "apps/web/.env.local"));
export const fnEnv = parseEnv(path.join(repo, "supabase/functions/.env.local"));
export const webUrl = new URL(webEnv.NEXT_PUBLIC_FOCACCIA_WEB_URL).origin;
export const supabaseUrl = webEnv.NEXT_PUBLIC_FOCACCIA_SUPABASE_URL;
export const anonKey = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const serviceKey = fnEnv.SUPABASE_SERVICE_ROLE_KEY;

async function post(endpoint, body, headers) {
  const response = await fetch(`${supabaseUrl}/auth/v1/${endpoint}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${endpoint} failed ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Returns browser cookies for an @supabase/ssr session, plus the access token. */
export async function organizerSession(email = "organizer@example.com") {
  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...jar.values()].map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((cookie) => jar.set(cookie.name, cookie)),
    },
  });
  const link = await post("admin/generate_link", { email, type: "magiclink" }, { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` });
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.hashed_token, type: "magiclink" });
  if (error) throw error;
  const host = new URL(webUrl).hostname;
  return {
    accessToken: data.session.access_token,
    cookies: [...jar.values()].map(({ name, value }) => ({ domain: host, httpOnly: false, name, path: "/", sameSite: "Lax", value })),
    userId: data.user.id,
  };
}

export async function invoke(name, accessToken, body, extraHeaders = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    body: JSON.stringify(body),
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...extraHeaders },
    method: "POST",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${name} failed ${response.status}: ${JSON.stringify(json)}`);
  return json;
}
