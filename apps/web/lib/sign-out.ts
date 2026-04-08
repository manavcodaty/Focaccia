"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_COOKIE_PREFIXES = ["sb-", "supabase.auth."] as const;

type StorageLike = Pick<Storage, "key" | "length" | "removeItem">;

export function clearMatchingStorage(storage: StorageLike, prefixes = AUTH_COOKIE_PREFIXES): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function clearMatchingDocumentCookies(prefixes = AUTH_COOKIE_PREFIXES): void {
  for (const rawCookie of document.cookie.split(";")) {
    const trimmed = rawCookie.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const name = separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);

    if (!prefixes.some((prefix) => name.startsWith(prefix))) {
      continue;
    }

    document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
}

async function clearServerAuthCookies(): Promise<void> {
  const response = await fetch("/auth/sign-out", {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to clear the server auth session.");
  }
}

export async function performSecureSignOut(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });

  clearMatchingStorage(window.localStorage);
  clearMatchingStorage(window.sessionStorage);
  clearMatchingDocumentCookies();
  await clearServerAuthCookies();

  if (error) {
    throw error;
  }
}
