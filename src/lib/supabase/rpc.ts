import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Functions = Database["public"]["Functions"];

/**
 * Typed RPC helper. The installed @supabase/supabase-js version can't infer
 * `.rpc()` argument types against a hand-written (non-generated) Database —
 * its generic constraint chain resolves Args to `never` for any function
 * that takes a real argument object. This isolates the single `any` cast in
 * one place so every call site stays fully typed (fn name + args + return).
 * Safe to drop once `types.ts` is replaced by `generate_typescript_types`
 * output — re-test direct `.rpc()` calls first, this may no longer be needed.
 */
export async function callRpc<K extends keyof Functions & string>(
  client: SupabaseClient<Database>,
  fn: K,
  ...args: Functions[K]["Args"] extends Record<string, never> ? [] : [Functions[K]["Args"]]
): Promise<{ data: Functions[K]["Returns"] | null; error: PostgrestError | null }> {
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: unknown,
  ) => Promise<{ data: unknown; error: PostgrestError | null }>;
  const result = await rpc(fn, args[0]);
  return result as { data: Functions[K]["Returns"] | null; error: PostgrestError | null };
}
