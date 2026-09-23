import "server-only";
import { headers } from "next/headers";

const trimSlash = (url) => url.replace(/\/+$/, "");

/**
 * The site's public origin, used for links in emails (invitation, password reset).
 *
 * - `npm run dev`: the address the request arrived on (http://localhost:3000, or
 *   the LAN address when testing from a phone). Nothing to configure.
 * - Deployed: `SITE_URL` (read at runtime, so the same build works on any host),
 *   then the old `NEXT_PUBLIC_SITE_URL`, then the address the host provides
 *   (Netlify `URL` / `DEPLOY_PRIME_URL`, Vercel `VERCEL_URL`).
 *
 * The request's Host header is only trusted in development: in production a
 * forged Host header would otherwise put an attacker's domain into a victim's
 * password-reset link.
 */
export async function getSiteUrl() {
  if (process.env.NODE_ENV === "development") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  }

  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return trimSlash(configured);

  // Netlify: URL is the main site address; deploy previews / branch deploys use DEPLOY_PRIME_URL.
  if (process.env.NETLIFY) {
    const netlify = process.env.CONTEXT === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL || process.env.URL;
    if (netlify) return trimSlash(netlify);
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  throw new Error("SITE_URL_MISSING");
}
