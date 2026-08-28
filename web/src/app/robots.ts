import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret — these routes are all guarded server-side —
      // but they are private or per-visitor, so indexing them is pointless
      // and would leak order URLs into search results.
      disallow: ["/admin", "/api/", "/account", "/checkout", "/cart", "/favourites"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
