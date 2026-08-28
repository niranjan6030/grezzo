import "server-only";
import crypto from "node:crypto";
import { getAdminSupabase } from "./supabase/server";
import { readAdminData, updateAdminData } from "./admin/store";
import { skuFor, type PricedLine } from "./pricing";

/* ------------------------------------------------------------------
   Inventory core.

   The model is deliberately the one large retailers run on SAP:
     · stock lives per (product, colour, size, warehouse), never as one
       number
     · every change is an append-only movement, so stock is auditable
     · checkout takes a time-limited reservation rather than an immediate
       decrement, so an abandoned payment never loses you a sale
     · allocation prefers the warehouse closest to the delivery pincode
       that can ship the whole order in one parcel

   With Supabase connected this runs as a single Postgres transaction
   (see supabase/schema.sql). Without it, stock comes from the admin
   store so the console's edits are real, and reservations are held in
   memory for the life of the process.
   ------------------------------------------------------------------ */

/** Opening depth for a SKU nobody has counted yet. */
export const DEFAULT_DEPTH = 12;

const RESERVATION_TTL_MINUTES = 15;

export interface ReservationResult {
  ok: boolean;
  id: string;
  unavailable: {
    productId: string; colour: string; size: number;
    requested: number; available: number;
  }[];
}

/* ---------- local backend: holds live in memory, counts in the store ---------- */
interface MemReservation { lines: PricedLine[]; expires: number }
const holds = new Map<string, MemReservation>();

function heldFor(sku: string): number {
  const now = Date.now();
  let held = 0;
  for (const [id, r] of holds) {
    if (r.expires < now) { holds.delete(id); continue; }
    for (const l of r.lines) if (l.sku === sku) held += l.qty;
  }
  return held;
}

async function localAvailable(sku: string): Promise<number> {
  const { stock } = await readAdminData();
  return (stock[sku] ?? DEFAULT_DEPTH) - heldFor(sku);
}

/* ---------- public API ---------- */

export async function reserveStock(
  lines: PricedLine[],
  pincode?: string,
): Promise<ReservationResult> {
  const id = `rsv_${crypto.randomBytes(9).toString("hex")}`;
  const db = getAdminSupabase();

  if (db) {
    const { data, error } = await db.rpc("reserve_stock", {
      p_reservation_id: id,
      p_pincode: pincode ?? null,
      p_ttl_minutes: RESERVATION_TTL_MINUTES,
      p_lines: lines.map((l) => ({
        product_id: l.productId, colour: l.colour, size: l.size, qty: l.qty,
      })),
    });
    if (error) {
      console.error("reserve_stock failed", error);
      return { ok: false, id, unavailable: [] };
    }
    return {
      ok: Boolean(data?.ok),
      id,
      unavailable: (data?.unavailable ?? []).map(
        (u: { product_id: string; colour: string; size: number; requested: number; available: number }) => ({
          productId: u.product_id, colour: u.colour, size: u.size,
          requested: u.requested, available: u.available,
        })),
    };
  }

  const { stock } = await readAdminData();
  const unavailable: ReservationResult["unavailable"] = [];

  for (const l of lines) {
    const available = (stock[l.sku] ?? DEFAULT_DEPTH) - heldFor(l.sku);
    if (available < l.qty) {
      unavailable.push({
        productId: l.productId, colour: l.colour, size: l.size,
        requested: l.qty, available: Math.max(0, available),
      });
    }
  }
  if (unavailable.length) return { ok: false, id, unavailable };

  holds.set(id, { lines, expires: Date.now() + RESERVATION_TTL_MINUTES * 60_000 });
  return { ok: true, id, unavailable: [] };
}

/** Payment succeeded: turn the hold into an actual issue from the warehouse. */
export async function commitReservation(reservationId: string): Promise<boolean> {
  if (!reservationId) return false;
  const db = getAdminSupabase();

  if (db) {
    const { error } = await db.rpc("commit_reservation", { p_reservation_id: reservationId });
    if (error) { console.error("commit_reservation failed", error); return false; }
    return true;
  }

  const hold = holds.get(reservationId);
  if (!hold) return false;
  await updateAdminData((draft) => {
    for (const l of hold.lines) {
      const current = draft.stock[l.sku] ?? DEFAULT_DEPTH;
      draft.stock[l.sku] = Math.max(0, current - l.qty);
    }
  });
  holds.delete(reservationId);
  return true;
}

/** Payment failed or abandoned: put the stock back on the shelf. */
export async function releaseReservation(reservationId: string): Promise<boolean> {
  if (!reservationId) return false;
  const db = getAdminSupabase();

  if (db) {
    const { error } = await db.rpc("release_reservation", { p_reservation_id: reservationId });
    if (error) { console.error("release_reservation failed", error); return false; }
    return true;
  }
  return holds.delete(reservationId);
}

/** Availability for the product page: per size, for one colourway. */
export async function availabilityFor(
  productId: string,
  colour: string,
  sizes: number[],
): Promise<Record<number, number>> {
  const db = getAdminSupabase();

  if (db) {
    const { data, error } = await db.rpc("available_by_size", {
      p_product_id: productId, p_colour: colour,
    });
    if (!error && data) {
      const out: Record<number, number> = {};
      for (const row of data as { size: number; available: number }[]) out[row.size] = row.available;
      return out;
    }
  }

  const entries = await Promise.all(
    sizes.map(async (s) => [s, Math.max(0, await localAvailable(skuFor(productId, colour, s)))] as const),
  );
  return Object.fromEntries(entries);
}
