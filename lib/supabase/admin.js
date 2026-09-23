import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses Row Level Security, so only use it on the
 * server, and only after checking who is asking. Used for:
 *   - checking the student roster during sign-up (anon has no table access)
 *   - sending mentor / admin invitations (Auth admin API)
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Code is mapped to a readable message in lib/errors.js; see README > Environment variables.
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set.");
    throw new Error("SERVICE_KEY_MISSING");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
