import type { MetadataRoute } from "next";
import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

/**
 * Only pages a search engine should actually index.
 *
 * The bag, favourites, checkout, account and admin are all either private
 * or per-visitor, so they are deliberately absent here and disallowed in
 * robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = mergeCatalogue(await readAdminData());
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/jeans`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/facts`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  for (const product of catalogue) {
    pages.push({
      url: `${SITE_URL}/product/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return pages;
}
