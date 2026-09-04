/**
 * Grezzo Lens — matching a photograph to the range, on the device.
 *
 * A jean varies in only a few things a camera can see: how dark the cloth
 * is, how even that darkness is, how blue it is, and the shape of the leg.
 * So rather than reaching for a general vision model, this measures those
 * four directly and scores the catalogue on them.
 *
 * The pixel work and the scoring are deliberately separate. `describePixels`
 * and `matchCatalogue` are pure functions over plain arrays, so they can be
 * exercised without a browser; only `describeImage` needs a canvas.
 */

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** sRGB → HSL, with H in turns (0..1) so hue differences wrap cleanly. */
export function rgbToHsl(r, g, b) {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h, s, l };
}

export const hexToRgb = (hex) => {
  const v = parseInt(String(hex).replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Shortest distance between two hues on the colour wheel. */
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
};

/* ------------------------------------------------------------------ */
/* Reading the photograph                                              */
/* ------------------------------------------------------------------ */

export const GRID = 64;

/**
 * Separate garment from backdrop.
 *
 * The old approach dropped anything brighter than 0.94, which only works
 * against white. Product shots come on grey seamless, bedroom floors and
 * shop mirrors, so instead the border of the frame is sampled — whatever
 * colour surrounds the subject is the background, whatever it happens to
 * be — and pixels close to it in both tone and hue are discarded.
 */
function backgroundMask(px, w, h) {
  const edge = [];
  for (let x = 0; x < w; x += 1) {
    edge.push((0 * w + x) * 4, ((h - 1) * w + x) * 4);
  }
  for (let y = 0; y < h; y += 1) {
    edge.push((y * w + 0) * 4, (y * w + (w - 1)) * 4);
  }

  let r = 0,
    g = 0,
    b = 0;
  for (const i of edge) {
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
  }
  const bg = [r / edge.length, g / edge.length, b / edge.length];
  const bgHsl = rgbToHsl(...bg);

  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    const { h: ph, s: ps, l: pl } = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    // Close in lightness AND (unsaturated or close in hue) counts as backdrop.
    const near =
      Math.abs(pl - bgHsl.l) < 0.13 &&
      (ps < 0.12 || bgHsl.s < 0.12 || hueGap(ph, bgHsl.h) < 0.08);
    mask[p] = near ? 0 : 1;
  }
  return mask;
}

/**
 * Width of the garment at a given fraction down its bounding box.
 *
 * The outer span, not a pixel count: below the crotch there is daylight
 * between the legs, so counting cloth would report a wide leg as narrow
 * and every cut would look more tapered than it is. The span is also what
 * a person actually sees when they call a leg wide.
 */
function widthAt(mask, w, box, frac) {
  const y = Math.min(box.y1, Math.max(box.y0, Math.round(box.y0 + (box.y1 - box.y0) * frac)));
  let lo = -1;
  let hi = -1;
  for (let x = box.x0; x <= box.x1; x += 1) {
    if (!mask[y * w + x]) continue;
    if (lo < 0) lo = x;
    hi = x;
  }
  return lo < 0 ? 0 : hi - lo + 1;
}

/**
 * Turn raw RGBA into the handful of numbers the catalogue is scored on.
 * Pure: takes arrays, returns a plain object.
 */
export function describePixels(px, w, h) {
  const mask = backgroundMask(px, w, h);

  const ls = [];
  let sSum = 0;
  let hx = 0,
    hy = 0,
    hw = 0;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;

  for (let p = 0; p < w * h; p += 1) {
    if (!mask[p]) continue;
    const i = p * 4;
    const { h: ph, s: ps, l: pl } = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    ls.push(pl);
    sSum += ps;
    // Hue averaged on the circle, weighted by saturation — a near-grey
    // pixel has no meaningful hue and should not drag the mean.
    hx += Math.cos(ph * 2 * Math.PI) * ps;
    hy += Math.sin(ph * 2 * Math.PI) * ps;
    hw += ps;

    const x = p % w;
    const y = (p / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }

  if (ls.length < w * h * 0.02) return null; // nothing that looks like a subject

  ls.sort((a, b) => a - b);
  const at = (q) => ls[Math.min(ls.length - 1, Math.max(0, Math.floor(ls.length * q)))];
  const lightness = at(0.5);
  // Interquartile spread, not min-to-max: one blown highlight should not
  // make a flat raw denim look like a heavy stonewash.
  const spread = at(0.75) - at(0.25);
  const saturation = sSum / ls.length;
  const hue = hw > 0 ? (Math.atan2(hy, hx) / (2 * Math.PI) + 1) % 1 : 0;

  const box = { x0, y0, x1, y1 };
  const hip = widthAt(mask, w, box, 0.3);
  const knee = widthAt(mask, w, box, 0.62);
  const hem = widthAt(mask, w, box, 0.93);

  // Ratios rather than pixels, so distance from the camera does not matter.
  const silhouette =
    hip > 2 ? { knee: knee / hip, hem: hem / hip, ok: knee > 0 && hem > 0 } : { ok: false };

  return { lightness, spread, saturation, hue, silhouette, coverage: ls.length / (w * h) };
}

/** Browser side: draw the photo small and hand the pixels to describePixels. */
export async function describeImage(dataUrl) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const c = document.createElement("canvas");
  c.width = GRID;
  c.height = GRID;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, GRID, GRID);
  const { data } = ctx.getImageData(0, 0, GRID, GRID);
  return describePixels(data, GRID, GRID);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Leg shape per cut, as width at the knee and hem relative to the hip.
 * Eyeballed from the range's own technical drawings — they only have to
 * rank cuts against each other, not be a pattern spec.
 */
export const FIT_SHAPE = {
  Skinny: { knee: 0.55, hem: 0.42 },
  Slim: { knee: 0.63, hem: 0.51 },
  Tapered: { knee: 0.7, hem: 0.53 },
  Straight: { knee: 0.74, hem: 0.71 },
  Regular: { knee: 0.77, hem: 0.74 },
  Bootcut: { knee: 0.67, hem: 0.82 },
  Relaxed: { knee: 0.84, hem: 0.79 },
  "Wide Leg": { knee: 0.93, hem: 0.96 },
  Baggy: { knee: 0.96, hem: 0.92 },
};

/** How well one colourway explains the photograph. 0..1. */
function colourScore(desc, ramp) {
  const [r, g, b] = hexToRgb(ramp[1]);
  const t = rgbToHsl(r, g, b);

  // Lightness carries most of the signal: it is what separates raw indigo
  // from a bleach, and it survives white balance better than hue does.
  const lGap = Math.abs(desc.lightness - t.l);
  const sGap = Math.abs(desc.saturation - t.s);
  // Hue only counts when both sides are actually coloured; comparing the
  // hue of two near-blacks is noise.
  const chroma = Math.min(desc.saturation, t.s) / 0.25;
  const hGap = hueGap(desc.hue, t.h) * Math.min(1, chroma);

  return Math.max(0, 1 - (lGap * 1.7 + sGap * 0.8 + hGap * 0.9));
}

/** How well a cut explains the silhouette. 0..1, or null when unreadable. */
function shapeScore(desc, fit) {
  const s = desc.silhouette;
  const want = FIT_SHAPE[fit];
  if (!s?.ok || !want) return null;
  const gap = Math.abs(s.knee - want.knee) * 0.5 + Math.abs(s.hem - want.hem) * 0.5;
  return Math.max(0, 1 - gap * 1.6);
}

/**
 * Rank the catalogue against a photograph.
 *
 * Every colourway is considered, not just the first — a jean sold in three
 * washes should be findable by all three, which is the main thing the old
 * matcher got wrong.
 */
export function matchCatalogue(desc, products, limit = 6) {
  if (!desc) return [];

  const scored = [];
  for (const p of products) {
    let best = null;
    for (const c of p.colours ?? []) {
      if (!Array.isArray(c.ramp) || c.ramp.length < 2) continue;
      const colour = colourScore(desc, c.ramp);
      if (!best || colour > best.colour) best = { colour, c };
    }
    if (!best) continue;

    const shape = shapeScore(desc, p.fit);
    // Shape is the weaker, noisier signal — a photo taken at an angle or a
    // model standing badly ruins it — so colour leads and shape adjusts.
    const score = shape === null ? best.colour : best.colour * 0.72 + shape * 0.28;

    // Say which signal actually earned the place, rather than always
    // crediting the wash.
    let why;
    if (shape !== null && shape > 0.78 && best.colour > 0.78) why = "cut and wash";
    else if (shape !== null && shape > 0.82) why = "same cut";
    else if (best.colour > 0.85) why = "wash match";
    else if (best.colour > 0.65) why = "tone match";
    else why = "closest tone";

    scored.push({ product: p, colour: best.c.code, score, why });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
