import { parsePublicNetworkConfig, type PublicNetworkConfig } from "@face-pass/shared";

let cachedEnv: PublicNetworkConfig | null = null;

export function getPublicEnv(): PublicNetworkConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = parsePublicNetworkConfig({
    NEXT_PUBLIC_FOCACCIA_LOCAL_HOST: process.env.NEXT_PUBLIC_FOCACCIA_LOCAL_HOST,
    NEXT_PUBLIC_FOCACCIA_NETWORK_MODE: process.env.NEXT_PUBLIC_FOCACCIA_NETWORK_MODE,
    NEXT_PUBLIC_FOCACCIA_SUPABASE_URL: process.env.NEXT_PUBLIC_FOCACCIA_SUPABASE_URL,
    NEXT_PUBLIC_FOCACCIA_TICKETS_URL: process.env.NEXT_PUBLIC_FOCACCIA_TICKETS_URL,
    NEXT_PUBLIC_FOCACCIA_WEB_URL: process.env.NEXT_PUBLIC_FOCACCIA_WEB_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }, "NEXT_PUBLIC_");

  return cachedEnv;
}

export const getBrowserPublicEnv = getPublicEnv;
