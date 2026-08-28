import { NextResponse } from "next/server";
import { normaliseState } from "@/lib/india";

/*
 * Pincode → city, state and the localities inside it.
 *
 * Backed by India Post's free public API. It has no SLA and no support, so
 * everything here degrades to "type it yourself" rather than blocking a sale:
 * a failed lookup returns 200 with `found: false`, never an error the form
 * has to handle specially.
 *
 * Results are cached in memory because a pincode's district effectively never
 * changes, and it keeps a busy checkout from hammering someone else's server.
 */

interface PincodeResult {
  found: boolean;
  city?: string;
  state?: string;
  localities?: string[];
}

const CACHE = new Map<string, { value: PincodeResult; at: number }>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;   // a month
const TIMEOUT_MS = 5000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const pincode = code.replace(/\D/g, "");

  if (pincode.length !== 6) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const hit = CACHE.get(pincode);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json(hit.value, { headers: { "x-cache": "hit" } });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);

    const body = await res.json();
    const entry = Array.isArray(body) ? body[0] : null;
    const offices: { Name: string; District: string; State: string }[] =
      entry?.PostOffice ?? [];

    if (entry?.Status !== "Success" || offices.length === 0) {
      const miss: PincodeResult = { found: false };
      CACHE.set(pincode, { value: miss, at: Date.now() });
      return NextResponse.json(miss);
    }

    const value: PincodeResult = {
      found: true,
      city: offices[0].District,
      state: normaliseState(offices[0].State) ?? offices[0].State,
      // Sorted and de-duplicated: some pincodes list twenty post offices.
      localities: [...new Set(offices.map((o) => o.Name))].sort(),
    };

    CACHE.set(pincode, { value, at: Date.now() });
    return NextResponse.json(value, {
      headers: { "cache-control": "public, max-age=86400", "x-cache": "miss" },
    });
  } catch {
    // Down, slow or rate-limited. Not a reason to stop someone checking out.
    return NextResponse.json({ found: false });
  }
}
