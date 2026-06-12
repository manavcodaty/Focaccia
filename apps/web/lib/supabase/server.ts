import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.supabaseUrl,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, options, value }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot always write cookies. Middleware handles refreshes.
          }
        },
      },
    },
  );
}
