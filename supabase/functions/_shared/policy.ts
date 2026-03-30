import type { EventPolicyConfig } from './face-pass-shared.ts';

import { getRuntimeConfig } from './env.ts';

export function getDefaultPolicy(queueCodeEnabled: boolean): EventPolicyConfig {
  const config = getRuntimeConfig();

  return {
    match_threshold: config.matchThreshold,
    liveness_timeout_ms: config.livenessTimeoutMs,
    single_entry: true,
    typed_token_fallback: true,
    queue_code_enabled: queueCodeEnabled,
    queue_code_digits: queueCodeEnabled ? config.queueCodeDigits : undefined,
  };
}
