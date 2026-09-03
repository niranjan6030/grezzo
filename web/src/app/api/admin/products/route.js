import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readAdminData, updateAdminData } from "@/lib/admin/store";

import { PRODUCTS, WASH_NAMES, buildProduct, byId } from "@/lib/products";
import {
  deactivateProduct,
  newProductId,
  provisionProduct,
  slugify,
  uniqueSlug,
} from "@/lib/admin/provision";

import { skuFor } from "@/lib/skus";
import { guarded } from "@/lib/admin/guard";

/** A product the console can act on: built-in, or one it created earlier. */
function baseProduct(data, id) {
  return byId(id) ?? (data.customProducts ?? []).find((c) => c.id === id) ?? null;
}

const FITS = [
  "Skinny",
  "Slim",
  "Tapered",
  "Straight",
  "Regular",
  "Bootcut",
  "Relaxed",
  "Wide Leg",
  "Baggy",
];
const RISES = ["Low", "Mid", "High"];

const MAX_PHOTO_CHARS = 700_000; // ~500KB of base64; the client downscales first

/** Save an override for one product. Fields left out are left alone, so the
 *  console can send just what changed. */
const _patch = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const productId = body.productId;
  // Looked up across both sources: a product created in the console must be
  // as editable as a built-in one.
  const base = baseProduct(await readAdminData(), productId);
  if (!base) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  const patch = {};

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.story === "string") patch.story = body.story.slice(0, 1200);
  if (typeof body.fabric === "string") patch.fabric = body.fabric.slice(0, 200);
  if (typeof body.active === "boolean") patch.active = body.active;

  // Cut and rise change the technical drawing, so only known values are taken.
  if (body.fit !== undefined) {
    if (!FITS.includes(body.fit)) {
      return NextResponse.json({ error: `Unknown fit: ${body.fit}` }, { status: 400 });
    }
    patch.fit = body.fit;
  }
  if (body.rise !== undefined) {
    if (!RISES.includes(body.rise)) {
      return NextResponse.json({ error: `Unknown rise: ${body.rise}` }, { status: 400 });
    }
    patch.rise = body.rise;
  }

  if (body.pricePaise !== undefined) {
    const v = Math.round(Number(body.pricePaise));
    if (!Number.isFinite(v) || v < 100 || v > 100_000_00) {
      return NextResponse.json(
        { error: "Price must be between ₹1 and ₹1,00,000." },
        { status: 400 },
      );
    }
    patch.pricePaise = v;
  }

  if (body.comparePaise !== undefined) {
    patch.comparePaise = body.comparePaise === null ? null : Math.round(Number(body.comparePaise));
    if (patch.comparePaise !== null && !Number.isFinite(patch.comparePaise)) {
      return NextResponse.json({ error: "Compare-at price is not a number." }, { status: 400 });
    }
  }

  if (Array.isArray(body.tags)) {
    patch.tags = body.tags
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
  }

  if (Array.isArray(body.colours)) {
    const colours = [];
    for (const c of body.colours) {
      if (!c?.code || !c?.wash || !Array.isArray(c?.ramp) || c.ramp.length !== 3) continue;
      colours.push({
        code: String(c.code)
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 32),
        wash: c.wash,
        ramp: [String(c.ramp[0]), String(c.ramp[1]), String(c.ramp[2])],
      });
    }
    if (colours.length === 0) {
      return NextResponse.json(
        { error: "A product needs at least one colourway." },
        { status: 400 },
      );
    }
    patch.colours = colours;
  }

  if (body.photos && typeof body.photos === "object") {
    const photos = {};
    for (const [code, url] of Object.entries(body.photos)) {
      if (url === null) continue; // null removes a photo
      if (typeof url !== "string" || !url.startsWith("data:image/")) continue;
      if (url.length > MAX_PHOTO_CHARS) {
        return NextResponse.json(
          { error: "That image is too large even after downscaling. Try a smaller one." },
          { status: 413 },
        );
      }
      photos[code] = url;
    }
    patch.photos = photos;
  }

  const { data } = await updateAdminData((draft) => {
    const existing = draft.products[productId] ?? {};
    // Photos merge rather than replace, so saving text edits cannot wipe images.
    const photos = body.photos
      ? { ...(existing.photos ?? {}), ...(patch.photos ?? {}) }
      : existing.photos;
    // An explicit null in the payload deletes that colourway's photo.
    if (body.photos && photos) {
      for (const [code, url] of Object.entries(body.photos)) {
        if (url === null) delete photos[code];
      }
    }
    draft.products[productId] = { ...existing, ...patch, ...(photos ? { photos } : {}) };
  });

  return NextResponse.json({ ok: true, override: data.products[productId] });
};

/**
 * For a built-in product this drops the console's edits and falls back to the
 * shipped values. For a product the console created there is nothing to fall
 * back to, so it is removed from the catalogue and deactivated in Postgres —
 * deactivated rather than deleted, because orders reference it and their
 * history must survive.
 */
const _delete = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { productId } = await req.json().catch(() => ({}));
  const custom = !byId(productId);

  if (custom) {
    const data = await readAdminData();
    if (!(data.customProducts ?? []).some((c) => c.id === productId)) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    const gone = await deactivateProduct(productId);
    if (!gone.ok) return NextResponse.json({ error: gone.error }, { status: 502 });
  }

  await updateAdminData((draft) => {
    delete draft.products[productId];
    if (custom) {
      draft.customProducts = (draft.customProducts ?? []).filter((c) => c.id !== productId);
    }
  });

  return NextResponse.json({ ok: true, removed: custom });
};

/* ------------------------------------------------------------------
   Create a product.

   The Postgres side goes first. A product that exists in the catalogue but
   has no variants looks fine on the shelf and then refuses every size at
   checkout, so if provisioning fails nothing is added at all.
   ------------------------------------------------------------------ */
const _post = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const bad = (error, status = 400) => NextResponse.json({ error }, { status });

  const name = String(body.name ?? "").trim().slice(0, 80);
  if (name.length < 2) return bad("Give the product a name.");

  const pricePaise = Math.round(Number(body.pricePaise));
  if (!Number.isFinite(pricePaise) || pricePaise < 100 || pricePaise > 100_000_00) {
    return bad("Price must be between ₹1 and ₹1,00,000.");
  }

  let comparePaise = null;
  if (body.comparePaise !== undefined && body.comparePaise !== null && body.comparePaise !== "") {
    comparePaise = Math.round(Number(body.comparePaise));
    if (!Number.isFinite(comparePaise)) return bad("Compare-at price is not a number.");
    if (comparePaise <= pricePaise) {
      return bad("Compare-at price should be higher than the price, or left empty.");
    }
  }

  if (!FITS.includes(body.fit)) return bad(`Unknown fit: ${body.fit}`);
  if (!RISES.includes(body.rise)) return bad(`Unknown rise: ${body.rise}`);

  // Washes drive the colour ramps, so only ones the design system knows.
  const washes = [...new Set((Array.isArray(body.washes) ? body.washes : []).filter((w) => WASH_NAMES.includes(w)))];
  if (washes.length === 0) return bad("Choose at least one colourway.");

  const sizes = [
    ...new Set(
      (Array.isArray(body.sizes) ? body.sizes : [])
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 24 && n <= 48),
    ),
  ].sort((a, b) => a - b);
  if (sizes.length === 0) return bad("Choose at least one size.");

  const openingStock = Math.max(0, Math.min(Math.round(Number(body.openingStock ?? 12)) || 0, 9999));

  const data = await readAdminData();
  const custom = data.customProducts ?? [];
  const id = newProductId(new Set([...PRODUCTS.map((p) => p.id), ...custom.map((c) => c.id)]));
  const slug = uniqueSlug(
    slugify(name),
    new Set([...PRODUCTS.map((p) => p.slug), ...custom.map((c) => c.slug)]),
  );

  const seed = {
    id,
    slug,
    name,
    pricePaise,
    comparePaise: comparePaise ?? undefined,
    fit: body.fit,
    rise: body.rise,
    washes,
    sizes,
    fabric: String(body.fabric ?? "").slice(0, 200) || undefined,
    weightOz: Number.isFinite(Number(body.weightOz)) ? Number(body.weightOz) : 12,
    stretchPct: Math.max(0, Math.min(Math.round(Number(body.stretchPct)) || 0, 40)),
    collection: String(body.collection ?? "Core").slice(0, 40) || "Core",
    story: String(body.story ?? "").slice(0, 1200) || undefined,
    tags: (Array.isArray(body.tags) ? body.tags : [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12),
  };

  const product = buildProduct(seed);

  const provisioned = await provisionProduct(product, openingStock);
  if (!provisioned.ok) return bad(provisioned.error, 502);

  await updateAdminData((draft) => {
    draft.customProducts = [...(draft.customProducts ?? []), seed];

    // With Postgres connected the opening stock was already booked in as
    // receipts. Without it, stock lives in this blob — and an unset sku
    // silently reads as DEFAULT_DEPTH, so the figure the seller typed has
    // to be written down or it is quietly ignored.
    if (provisioned.backend === "file") {
      for (const c of product.colours) {
        for (const size of product.sizes) {
          draft.stock[skuFor(product.id, c.code, size)] = openingStock;
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    product: { id, slug, name },
    skus: provisioned.skus.length || sizes.length * washes.length,
    warehouse: provisioned.warehouse,
    backend: provisioned.backend,
  });
};

export const POST = guarded(_post);
export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
