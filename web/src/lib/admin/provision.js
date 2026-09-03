import "server-only";
import crypto from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase/server";
import { skuFor } from "@/lib/skus";
import { DEFAULT_DEPTH } from "@/lib/inventory";

/* ------------------------------------------------------------------
   Making an admin-created product real.

   A product is not sellable the moment it appears in the catalogue. It
   needs a variant per colour × size, and stock booked against a
   warehouse, or checkout refuses every size with "out of stock" — the
   reservation function resolves lines through `variants` and finds
   nothing.

   So creating a product is three writes that belong together:
     products → variants → opening stock (as receipts, so the ledger is
     complete from the first unit).
   ------------------------------------------------------------------ */

/** Warehouse that ships first, used as the default home for opening stock. */
async function primaryWarehouse(db) {
  const { data } = await db
    .from("warehouses")
    .select("code")
    .eq("active", true)
    .order("priority", { ascending: true })
    .limit(1);
  return data?.[0]?.code ?? null;
}

/**
 * Create the Postgres side of a product.
 *
 * Returns { ok, warehouse, skus } or { ok: false, error }. When Supabase is
 * not connected this is a no-op that reports ok — the local file backend
 * keeps stock in the config blob instead, and the console says so.
 */
export async function provisionProduct(product, openingStock = DEFAULT_DEPTH) {
  const db = getAdminSupabase();
  if (!db) return { ok: true, warehouse: null, skus: [], backend: "file" };

  const warehouse = await primaryWarehouse(db);
  if (!warehouse) {
    return { ok: false, error: "No active warehouse to hold stock against." };
  }

  // The catalogue row anchors the variants foreign key. The console keeps
  // the display copy in site_config; this is the relational anchor.
  const { error: pErr } = await db.from("products").upsert(
    {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_paise: product.pricePaise,
      compare_paise: product.comparePaise ?? null,
      fit: product.fit,
      rise: product.rise,
      wash: product.colours[0].wash,
      fabric: product.fabric ?? null,
      weight_oz: product.weightOz ?? null,
      stretch_pct: product.stretchPct ?? 0,
      collection: product.collection ?? null,
      story: product.story ?? null,
      tags: product.tags ?? [],
      active: true,
    },
    { onConflict: "id" },
  );
  if (pErr) return { ok: false, error: `Could not save the product: ${pErr.message}` };

  const rows = [];
  for (const c of product.colours) {
    for (const size of product.sizes) {
      rows.push({
        sku: skuFor(product.id, c.code, size),
        product_id: product.id,
        colour: c.code,
        size,
      });
    }
  }

  const { error: vErr } = await db.from("variants").upsert(rows, { onConflict: "sku" });
  if (vErr) return { ok: false, error: `Could not create sizes: ${vErr.message}` };

  // Booked as receipts rather than a bare UPDATE, so the movement ledger
  // explains where every unit came from.
  const qty = Math.max(0, Math.min(Math.round(openingStock), 9999));
  if (qty > 0) {
    const results = await Promise.all(
      rows.map((r) =>
        db.rpc("receive_stock", {
          p_sku: r.sku,
          p_warehouse: warehouse,
          p_qty: qty,
          p_reference: `opening-${product.id}`,
        }),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed) return { ok: false, error: `Could not book stock: ${failed.error.message}` };
  }

  return { ok: true, warehouse, skus: rows.map((r) => r.sku), backend: "supabase" };
}

/** Take a product out of the catalogue without destroying its order history. */
export async function deactivateProduct(productId) {
  const db = getAdminSupabase();
  if (!db) return { ok: true };
  const { error } = await db.from("products").update({ active: false }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ------------------------------------------------------------------
   Stock, read and written where checkout actually looks.

   The console used to read and write `data.stock` in the config blob.
   Once Supabase is connected that value is never consulted again —
   reservations resolve through the `inventory` table — so a seller could
   set a count in the console and have it change nothing a shopper sees.
   ------------------------------------------------------------------ */

/** Per-sku counts for one product, or null when Postgres is not the record. */
export async function readStock(productId) {
  const db = getAdminSupabase();
  if (!db) return null;

  const { data, error } = await db.rpc("stock_grid", { p_product_id: productId });
  if (error) {
    console.error("[admin] stock_grid failed", error);
    return null;
  }
  const onHand = {};
  const available = {};
  for (const r of data ?? []) {
    onHand[r.sku] = r.on_hand;
    available[r.sku] = r.available;
  }
  return { onHand, available };
}

/**
 * Apply console stock edits.
 *
 * `set` corrects to an absolute figure after a stocktake; `receive` books a
 * delivery in. Both leave a movement behind. Returns null when Supabase is
 * not connected, so the caller can fall back to the config blob.
 */
export async function writeStock(updates, mode) {
  const db = getAdminSupabase();
  if (!db) return null;

  const warehouse = await primaryWarehouse(db);
  if (!warehouse) return { error: "No active warehouse to hold stock against." };

  const ref = `console-${crypto.randomBytes(4).toString("hex")}`;
  const touched = [];

  for (const u of updates) {
    const qty = Math.max(0, Math.round(Number(u.qty)));
    if (!u.sku || !Number.isFinite(qty)) continue;

    const fn = mode === "receive" ? "receive_stock" : "set_stock";
    const { error } = await db.rpc(fn, {
      p_sku: u.sku,
      p_warehouse: warehouse,
      p_qty: qty,
      p_reference: ref,
    });
    if (error) return { error: `${u.sku}: ${error.message}` };
    touched.push(u.sku);
  }

  // Report the settled figures rather than what was asked for, so the grid
  // shows what the warehouse actually holds.
  return { stock: await readStockForSkus(db, touched) };
}

async function readStockForSkus(db, skus) {
  const { data } = await db.from("inventory").select("sku, on_hand").in("sku", skus);
  const out = {};
  for (const r of data ?? []) out[r.sku] = (out[r.sku] ?? 0) + r.on_hand;
  return out;
}

/* ------------------------------------------------------------------
   Identity for a new product.
   ------------------------------------------------------------------ */

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/** A product id that cannot collide with the seeded gz-001..gz-016 range. */
export function newProductId(taken) {
  for (let i = 0; i < 50; i += 1) {
    const id = `gz-c${crypto.randomBytes(3).toString("hex")}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("Could not allocate a product id.");
}

/** Slugs are the product page URL, so they have to be unique across both
 *  the built-in range and anything already created. */
export function uniqueSlug(base, taken) {
  const root = base || "product";
  if (!taken.has(root)) return root;
  for (let n = 2; n < 200; n += 1) {
    const s = `${root}-${n}`;
    if (!taken.has(s)) return s;
  }
  return `${root}-${crypto.randomBytes(2).toString("hex")}`;
}
