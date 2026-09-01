/**
 * Where this deployment lives.
 *
 * Used for canonical URLs, Open Graph images, the sitemap and robots.txt —
 * all of which need an absolute address. Vercel sets VERCEL_PROJECT_PRODUCTION_URL
 * automatically, so preview deployments get sensible values without anyone
 * configuring anything; NEXT_PUBLIC_SITE_URL overrides it once a real domain
 * is attached.
 */
function resolve() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolve();

/** The shop's own address, for the contact page and receipts. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "help@grezzojeans.com";
