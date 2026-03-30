export interface EventPolicyConfig {
    match_threshold: number;
    liveness_timeout_ms: number;
    single_entry: true;
    typed_token_fallback: true;
    queue_code_enabled: boolean;
    queue_code_digits?: number;
}
export interface GateBundle {
    event_id: string;
    event_salt: string;
    pk_gate_event: string;
    pk_sign_event: string;
    starts_at: string;
    ends_at: string;
    policy: EventPolicyConfig;
    k_code_event?: string;
}
export interface EnrollmentBundle {
    event_id: string;
    event_salt: string;
    pk_gate_event: string;
    pk_sign_event: string;
    starts_at: string;
    ends_at: string;
}
export interface PassPayload {
    v: 1;
    event_id: string;
    iat: number;
    exp: number;
    pass_id: string;
    nonce: string;
    enc_template: string;
    single_use: true;
}
export interface IssuePassResult {
    signature: string;
    queue_code?: string;
}
//# sourceMappingURL=types.d.ts.map