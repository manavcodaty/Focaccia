export declare const CLAIM_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export type TicketStatus = 'claimed' | 'enrolled' | 'checked_in' | 'cancelled' | 'revoked';
export declare function canonicalizeClaimCode(value: string): string;
export declare function formatClaimCode(canonical: string): string;
export declare function claimCodeFromEntropy(entropy: Uint8Array): string;
export declare function isValidClaimCode(value: string): boolean;
export declare function isLowercaseUuidV4(value: string): boolean;
export declare function isAllowedTicketTransition(from: TicketStatus, to: TicketStatus): boolean;
//# sourceMappingURL=ticketing.d.ts.map