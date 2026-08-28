import { parsePublicNetworkConfig, type PublicNetworkConfig } from '@face-pass/shared';

export interface SupabasePublicEnv extends PublicNetworkConfig {
  readonly url: string;
}

let cachedEnv: SupabasePublicEnv | null = null;

export function getSupabasePublicEnv(): SupabasePublicEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const isCloudSimulatorE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';
  const network = parsePublicNetworkConfig({
    EXPO_PUBLIC_FOCACCIA_LOCAL_HOST: process.env.EXPO_PUBLIC_FOCACCIA_LOCAL_HOST,
    EXPO_PUBLIC_FOCACCIA_NETWORK_MODE: process.env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE,
    EXPO_PUBLIC_FOCACCIA_SUPABASE_URL: process.env.EXPO_PUBLIC_FOCACCIA_SUPABASE_URL,
    EXPO_PUBLIC_FOCACCIA_TICKETS_URL: process.env.EXPO_PUBLIC_FOCACCIA_TICKETS_URL,
    EXPO_PUBLIC_FOCACCIA_WEB_URL: process.env.EXPO_PUBLIC_FOCACCIA_WEB_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  }, 'EXPO_PUBLIC_', { allowCloudSimulatorLoopback: isCloudSimulatorE2E });

  cachedEnv = { ...network, url: network.supabaseUrl };
  return cachedEnv;
}
