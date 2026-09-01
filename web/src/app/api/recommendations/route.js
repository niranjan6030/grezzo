import { NextResponse } from "next/server";
import { localRecommend } from "@/lib/recommend";
import { PRODUCTS } from "@/lib/products";

/** The trained LSTM lives in ../ai, deployed separately. When it is not
 *  reachable we serve the on-site hybrid model instead — same shape of
 *  response, so the client never has to care. */
const AI_URL = process.env.AI_SERVICE_URL;
const TIMEOUT_MS = 2500;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events.slice(-60) : [];
  const favourites = Array.isArray(body.favourites) ? body.favourites : [];
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const limit = Math.min(Number(body.limit) || 8, 16);

  if (AI_URL && events.length >= 3) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(`${AI_URL.replace(/\/$/, "")}/recommend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          sequence: events.map((e) => ({ item: e.productId, kind: e.kind, at: e.at })),
          favourites,
          cart,
          limit,
          catalogue: PRODUCTS.map((p) => ({ id: p.id, vector: p.vector, tags: p.tags })),
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.recommendations) && json.recommendations.length) {
          return NextResponse.json({ engine: "lstm", recommendations: json.recommendations });
        }
      }
    } catch {
      // Cold start on a free tier, or the service is down. Fall through.
    }
  }

  return NextResponse.json({
    engine: "hybrid",
    recommendations: localRecommend(events, favourites, cart, limit),
  });
}
