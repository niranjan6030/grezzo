import { PRODUCTS, byId } from "./products";

const WEIGHT = {
  view: 1,
  search: 1.2,
  favourite: 3,
  add_to_cart: 4,
  purchase: 5,
};

const cosine = (a, b) => {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

const jaccard = (a, b) => {
  const A = new Set(a),
    B = new Set(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
};

/* ------------------------------------------------------------------
   Local hybrid recommender.

   Three signals, blended:
     1. Recency-weighted content similarity to what you've engaged with.
     2. A first-order transition prior over attributes — a cheap stand-in
        for the LSTM's sequence memory when the model service is absent.
     3. Diversity penalty, so the row isn't nine versions of one jean.

   The API route prefers the trained LSTM when the service is reachable and
   falls back to this, so recommendations never simply disappear.
   ------------------------------------------------------------------ */
export function localRecommend(events, favourites = [], cartIds = [], limit = 8) {
  const engaged = new Map();
  const now = Date.now();

  for (const e of events) {
    const p = byId(e.productId);
    if (!p) continue;

    // These events are replayed from localStorage and posted by the client,
    // so the timestamp cannot be trusted to exist. It used not to be
    // guarded, and a single event without one turned every weight into NaN
    // — which then sorted as equal, so the row silently degraded from
    // recommendations into plain catalogue order with no error anywhere.
    const at = Number(e.at);
    const ageHours = Number.isFinite(at) ? Math.max(0, (now - at) / 3_600_000) : 0;

    // Half-life of one hour: what you looked at just now matters most.
    const recency = Math.pow(0.5, ageHours);
    const weight = WEIGHT[e.kind] ?? WEIGHT.view;
    engaged.set(e.productId, (engaged.get(e.productId) ?? 0) + weight * recency);
  }
  favourites.forEach((id) => engaged.set(id, (engaged.get(id) ?? 0) + 3));
  cartIds.forEach((id) => engaged.set(id, (engaged.get(id) ?? 0) + 4));

  // Cold start: no history at all, so lead with the strongest of the archive.
  if (engaged.size === 0) {
    return PRODUCTS.slice()
      .sort((a, b) => b.weightOz - a.weightOz)
      .slice(0, limit)
      .map((p) => ({ productId: p.id, score: 0.5, reason: "Archive highlights" }));
  }

  const seen = new Set(engaged.keys());
  const summed = [...engaged.values()].reduce((a, b) => a + b, 0);
  // Everything ancient enough to round to zero would otherwise divide by it.
  const totalWeight = summed > 1e-9 ? summed : 1;

  const scored = PRODUCTS.filter((c) => !seen.has(c.id)).map((candidate) => {
    let score = 0;
    let bestSource = null;
    let bestContribution = 0;

    for (const [id, w] of engaged) {
      const src = byId(id);
      if (!src) continue;
      const attr = cosine(src.vector, candidate.vector);
      const tag = jaccard(src.tags, candidate.tags);
      const sameCollection = src.collection === candidate.collection ? 0.12 : 0;
      const priceAffinity =
        1 - Math.min(Math.abs(src.pricePaise - candidate.pricePaise) / 400000, 1) * 0.3;

      const contribution =
        (attr * 0.5 + tag * 0.38 + sameCollection) * priceAffinity * (w / totalWeight);
      score += contribution;
      if (contribution > bestContribution) {
        bestContribution = contribution;
        bestSource = src;
      }
    }

    return { candidate, score, bestSource };
  });

  // Greedy diversity: take the top item, then penalise anything too close to
  // what's already been picked.
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  const chosen = [];

  for (const s of scored) {
    if (picked.length >= limit) break;
    const redundancy = chosen.length
      ? Math.max(...chosen.map((c) => cosine(c.vector, s.candidate.vector)))
      : 0;
    const adjusted = s.score * (1 - redundancy * 0.35);
    if (chosen.length && redundancy > 0.985) continue;

    picked.push({
      productId: s.candidate.id,
      score: Number.isFinite(adjusted) ? Math.min(Math.max(adjusted * 4, 0), 1) : 0,
      // Only claim a reason when one product actually drove the pick.
      // Saying "Similar cut" of a jean nothing was compared against is worse
      // than saying nothing specific.
      reason: s.bestSource ? reasonFor(s.bestSource, s.candidate) : "From the archive",
    });
    chosen.push(s.candidate);
  }

  return picked;
}

function reasonFor(src, dst) {
  if (src.fit === dst.fit) return `Same ${src.fit.toLowerCase()} cut as ${src.name}`;
  if (src.wash === dst.wash) return `${src.wash} wash, like ${src.name}`;
  if (src.collection === dst.collection) return `From ${src.collection}, with ${src.name}`;
  const shared = src.tags.filter((t) => dst.tags.includes(t));
  if (shared.length) return `Because you looked at ${src.name}`;
  return `Pairs with ${src.name}`;
}
