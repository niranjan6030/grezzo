import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { updateAdminData } from "@/lib/admin/store";

import { byId } from "@/lib/products";

import { guarded } from "@/lib/admin/guard";

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
  const base = byId(productId);
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

/** Drop every override for a product and fall back to the built-in values. */
const _delete = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { productId } = await req.json().catch(() => ({}));
  await updateAdminData((draft) => {
    delete draft.products[productId];
  });
  return NextResponse.json({ ok: true });
};

export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
