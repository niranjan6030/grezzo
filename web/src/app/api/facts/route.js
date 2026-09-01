import { NextResponse } from "next/server";
import { DENIM_FACTS, ROTATION_MS, factsForNow, nextRotationAt } from "@/lib/facts";

/**
 * The Denim Index feed.
 *
 * A curated library on a twelve-hour rotation rather than a third-party
 * feed: no denim-facts API exists that is worth putting a shop's name
 * behind, and the alternative — scraping or generating claims — means
 * publishing things nobody verified.
 *
 * Swap the body of this route for a CMS or an external source later and
 * nothing else has to change; the storefront only knows this shape.
 */
export async function GET(req) {
  const count = Math.min(
    Math.max(Number(new URL(req.url).searchParams.get("count")) || 12, 1),
    DENIM_FACTS.length,
  );

  const facts = factsForNow(count);
  const rotatesAt = nextRotationAt();

  return NextResponse.json(
    {
      facts,
      total: DENIM_FACTS.length,
      rotatesAt: rotatesAt.toISOString(),
      rotationHours: ROTATION_MS / 3_600_000,
    },
    {
      // Cacheable right up to the moment the selection changes.
      headers: {
        "cache-control": `public, max-age=60, s-maxage=${Math.max(
          Math.floor((rotatesAt.getTime() - Date.now()) / 1000),
          60,
        )}`,
      },
    },
  );
}
