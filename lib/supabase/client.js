import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let browserClient;

/**
 * Supabase client for Client Components. One instance per tab so realtime
 * channels and the auth listener are shared. The session is stored in cookies,
 * which is how the server and proxy see the same signed-in user.
 */
export function getSupabaseBrowserClient() {
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
