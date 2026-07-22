import { createClient } from '@supabase/supabase-js';

import { createDeferredAuthStorage } from './auth-session';
import { getSupabasePublicEnv } from './env';
import { supabaseSecureStorage } from './secure-storage';

const env = getSupabasePublicEnv();
const supabaseAuthStorageKey = `sb-${new URL(env.url).hostname.split('.')[0]}-auth-token`;

export const supabaseAuthStorage = createDeferredAuthStorage(
  supabaseSecureStorage,
  supabaseAuthStorageKey,
);

export const supabase = createClient(env.url, env.anonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    storage: supabaseAuthStorage.storage,
    storageKey: supabaseAuthStorageKey,
  },
});
