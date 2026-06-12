'use client';

import { createClient } from '@supabase/supabase-js';

import { getPublicEnv } from './env';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  const env = getPublicEnv();
  client = createClient(env.supabaseUrl, env.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}
