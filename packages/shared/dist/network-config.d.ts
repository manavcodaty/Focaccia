export type NetworkMode = 'local' | 'tunnel';
export interface NetworkConfig {
    readonly browserOrigins: readonly string[];
    readonly diagnosticLabel: 'Local network' | 'Tunnel';
    readonly localHost?: string;
    readonly mode: NetworkMode;
    readonly supabaseUrl: string;
    readonly ticketsUrl: string;
    readonly webUrl: string;
}
export interface PublicNetworkConfig extends NetworkConfig {
    readonly anonKey: string;
}
type Environment = Readonly<Record<string, string | undefined>>;
type PublicPrefix = 'EXPO_PUBLIC_' | 'NEXT_PUBLIC_';
export declare class NetworkConfigError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function parseRootNetworkConfig(env: Environment): NetworkConfig;
export declare function parsePublicNetworkConfig(env: Environment, prefix: PublicPrefix): PublicNetworkConfig;
export {};
//# sourceMappingURL=network-config.d.ts.map