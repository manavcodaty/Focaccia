import { z } from "zod";

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
