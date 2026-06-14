import { createClient } from '@supabase/supabase-js';

import { getSupabasePublicEnv } from './env';
import { supabaseSecureStorage } from './secure-storage';

const env = getSupabasePublicEnv();

export const supabase = createClient(env.url, env.anonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage: supabaseSecureStorage,
  },
});
