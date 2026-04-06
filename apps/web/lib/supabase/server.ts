import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";
import { getCurrentServerHostname, resolveServerSupabaseUrl } from "@/lib/server-local-network";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  const supabaseUrl = resolveServerSupabaseUrl({
    configuredUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serverHostname: getCurrentServerHostname(),
  });

  return createServerClient(
    supabaseUrl,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
