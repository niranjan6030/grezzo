import { NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";

const AI_URL = process.env.AI_SERVICE_URL;
const TIMEOUT_MS = 12000;   // CLIP on a cold free-tier container is slow

export async function POST(req: Request) {
  const { image } = await req.json().catch(() => ({ image: null }));
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected a data URL image." }, { status: 400 });
  }
  // ~8MB of base64 is already generous for a phone photo.
  if (image.length > 8_000_000) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  if (!AI_URL) {
    // No service configured — the client falls back to on-device matching.
    return NextResponse.json({ engine: "none", matches: [] });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${AI_URL.replace(/\/$/, "")}/visual-search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        image,
        catalogue: PRODUCTS.map((p) => ({
          id: p.id, name: p.name, fit: p.fit, wash: p.wash,
          rise: p.rise, tags: p.tags, ramp: p.ramp,
        })),
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return NextResponse.json({ engine: "clip", matches: json.matches ?? [] });
  } catch {
    return NextResponse.json({ engine: "none", matches: [] });
  }
}
