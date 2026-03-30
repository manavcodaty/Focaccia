export interface SupabasePublicEnv {
  anonKey: string;
  url: string;
}

let cachedEnv: SupabasePublicEnv | null = null;

export function getSupabasePublicEnv(): SupabasePublicEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY for the gate app.',
    );
  }

  cachedEnv = { anonKey, url };
  return cachedEnv;
}
