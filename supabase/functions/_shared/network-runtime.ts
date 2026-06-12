import {
  parseRootNetworkConfig,
  type NetworkConfig,
} from '../../../packages/shared/src/network-config.ts';

let cachedConfig: NetworkConfig | undefined;

export function getEdgeNetworkConfig(): NetworkConfig {
  if (!cachedConfig) {
    cachedConfig = parseRootNetworkConfig(Deno.env.toObject());
  }

  return cachedConfig;
}
