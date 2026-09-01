import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

const AI_URL = process.env.AI_SERVICE_URL;
const TIMEOUT_MS = 20_000; // CLIP on a cold free-tier container is slow

/**
 * Read a product photograph and report the cut, rise and wash.
 *
 * The technical flat is then drawn from those attributes rather than being
 * generated as an image — a spec drawing has to be exact, and a generative
 * model would invent seams that are not there.
 *
 * Weight, stretch and composition are deliberately not returned: they cannot
 * be seen in a photo, and guessing them confidently would be worse than
 * leaving them to the seller.
 */
export async function POST(req) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { image } = await req.json().catch(() => ({ image: null }));
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Upload a photo first." }, { status: 400 });
  }
  if (image.length > 9_000_000) {
    return NextResponse.json({ error: "That image is too large." }, { status: 413 });
  }

  if (!AI_URL) {
    return NextResponse.json(
      {
        error:
          "The AI service is not connected. Set AI_SERVICE_URL to read attributes from a photo — see ai/README.md.",
      },
      { status: 503 },
    );
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${AI_URL.replace(/\/$/, "")}/analyse-garment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ image }),
    });
    clearTimeout(timer);

    const json = await res.json();
    if (!res.ok || json.error) {
      return NextResponse.json(
        { error: json.error ?? "The AI service could not read that image." },
        { status: 502 },
      );
    }
    return NextResponse.json(json);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the AI service. Is it running?" },
      { status: 504 },
    );
  }
}
