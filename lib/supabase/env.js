// Public Supabase settings. These are safe in the browser: the anon key only
// grants what Row Level Security allows (see supabase/migrations).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The site address for email links lives in lib/site-url.js (server only).
