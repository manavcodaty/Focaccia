import { z } from "zod";

import { resolveBrowserSupabaseUrl } from "@/lib/browser-local-network";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
});

type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedEnv: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  return cachedEnv;
}

export function getBrowserPublicEnv(): PublicEnv {
  const env = getPublicEnv();

  if (typeof window === "undefined") {
    return env;
  }

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: resolveBrowserSupabaseUrl({
      browserHostname: window.location.hostname,
      configuredUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    }),
  };
}
