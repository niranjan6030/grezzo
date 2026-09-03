import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readAdminData, updateAdminData } from "@/lib/admin/store";
import { buildProduct, byId } from "@/lib/products";
import { skuFor } from "@/lib/pricing";
import { DEFAULT_DEPTH } from "@/lib/inventory";
import { readStock, writeStock } from "@/lib/admin/provision";
import { guarded } from "@/lib/admin/guard";

/** Built-in or console-created — the grid works the same for both. */
function baseProduct(data, id) {
  const built = byId(id);
  if (built) return built;
  const custom = (data.customProducts ?? []).find((c) => c.id === id);
  return custom ? buildProduct(custom) : null;
}

/** Stock grid for one product: every colourway × size. */
export async function GET(req) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  const data = await readAdminData();
  const product = baseProduct(data, productId);
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  const override = data.products[productId];
  const colours = override?.colours ?? product.colours;

  // Once Postgres holds the stock it is the only figure that matters — it is
  // what reserve_stock consults at checkout. The config blob is consulted
  // only when Supabase is not connected.
  const live = await readStock(productId);

  return NextResponse.json({
    productId,
    sizes: product.sizes,
    backend: live ? "supabase" : "file",
    rows: colours.map((c) => ({
      colour: c.code,
      wash: c.wash,
      sizes: Object.fromEntries(
        product.sizes.map((size) => {
          const sku = skuFor(productId, c.code, size);
          return [size, live ? (live.onHand[sku] ?? 0) : (data.stock[sku] ?? DEFAULT_DEPTH)];
        }),
      ),
      // What a shopper can actually buy right now: on hand, less anything
      // held by a checkout in progress.
      available: live
        ? Object.fromEntries(
            product.sizes.map((size) => [size, live.available[skuFor(productId, c.code, size)] ?? 0]),
          )
        : undefined,
    })),
  });
}

/** Set an absolute count, or book in a delivery. Both write a movement note
 *  so the change is attributable later. */
const _post = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const updates = Array.isArray(body.updates) ? body.updates : [];
  const mode = body.mode === "receive" ? "receive" : "set";

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Postgres first when it is connected. Writing only to the config blob
  // there would show the seller a number that checkout never reads.
  const live = await writeStock(updates, mode);
  if (live?.error) return NextResponse.json({ error: live.error }, { status: 502 });
  if (live) return NextResponse.json({ ok: true, stock: live.stock, backend: "supabase" });

  const { data } = await updateAdminData((draft) => {
    for (const u of updates) {
      const qty = Math.round(Number(u.qty));
      if (!u.sku || !Number.isFinite(qty)) continue;
      const current = draft.stock[u.sku] ?? DEFAULT_DEPTH;
      draft.stock[u.sku] = Math.max(0, Math.min(mode === "set" ? qty : current + qty, 9999));
    }
  });

  return NextResponse.json({
    ok: true,
    backend: "file",
    stock: Object.fromEntries(updates.map((u) => [u.sku, data.stock[u.sku]])),
  });
};

export const POST = guarded(_post);
