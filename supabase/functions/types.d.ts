declare module "libsodium-wrappers" {
  export interface SodiumModule {
    readonly ready: Promise<void>;
    readonly crypto_secretbox_KEYBYTES: number;
    readonly crypto_secretbox_NONCEBYTES: number;
    crypto_generichash(hashLength: number, message: Uint8Array, key: Uint8Array | null): Uint8Array;
    crypto_secretbox_easy(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    randombytes_buf(length: number): Uint8Array;
  }

  const sodium: SodiumModule;
  export default sodium;
}

declare module "npm:@supabase/supabase-js@2.100.0" {
  export interface User {
    readonly id: string;
    readonly email?: string;
    readonly [key: string]: unknown;
  }

  export interface SupabaseError {
    readonly message: string;
    readonly [key: string]: unknown;
  }

  export interface SupabaseQueryResult<T = unknown> {
    readonly data: T;
    readonly error: SupabaseError | null;
    readonly count?: number | null;
  }

  export interface SupabaseQuery<T = unknown> extends PromiseLike<SupabaseQueryResult<T>> {
    delete(): SupabaseQuery<T>;
    eq(column: string, value: unknown): SupabaseQuery<T>;
    gt(column: string, value: unknown): SupabaseQuery<T>;
    in(column: string, values: readonly unknown[]): SupabaseQuery<T>;
    insert(values: unknown): SupabaseQuery<T>;
    is(column: string, value: unknown): SupabaseQuery<T>;
    limit(count: number): SupabaseQuery<T>;
    maybeSingle(): SupabaseQuery<T | null>;
    order(column: string, options?: { ascending?: boolean }): SupabaseQuery<T>;
    select(columns?: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): SupabaseQuery<T>;
    single(): SupabaseQuery<T>;
    update(values: unknown): SupabaseQuery<T>;
    upsert(values: unknown, options?: { onConflict?: string }): SupabaseQuery<T>;
  }

  export interface SupabaseClient {
    readonly auth: {
      getUser(accessToken?: string): Promise<{
        data: { user: User | null };
        error: SupabaseError | null;
      }>;
    };
    from<T = unknown>(table: string): SupabaseQuery<T>;
    rpc<T = unknown>(fn: string, args?: Record<string, unknown>): SupabaseQuery<T>;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>,
  ): SupabaseClient;
}
