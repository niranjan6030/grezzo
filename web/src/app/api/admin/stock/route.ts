import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readAdminData, updateAdminData } from "@/lib/admin/store";
import { byId } from "@/lib/products";
import { skuFor } from "@/lib/pricing";
import { DEFAULT_DEPTH } from "@/lib/inventory";
import { guarded } from "@/lib/admin/guard";

/** Stock grid for one product: every colourway × size. */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  const product = byId(productId);
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  const data = await readAdminData();
  const override = data.products[productId];
  const colours = override?.colours ?? product.colours;

  return NextResponse.json({
    productId,
    sizes: product.sizes,
    rows: colours.map((c) => ({
      colour: c.code,
      wash: c.wash,
      sizes: Object.fromEntries(product.sizes.map((size) => {
        const sku = skuFor(productId, c.code, size);
        return [size, data.stock[sku] ?? DEFAULT_DEPTH];
      })),
    })),
  });
}

/** Set an absolute count, or book in a delivery. Both write a movement note
 *  so the change is attributable later. */
const _post = async (req: Request) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const updates: { sku: string; qty: number }[] = Array.isArray(body.updates) ? body.updates : [];
  const mode: "set" | "receive" = body.mode === "receive" ? "receive" : "set";

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

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
    stock: Object.fromEntries(updates.map((u) => [u.sku, data.stock[u.sku]])),
  });
}

export const POST = guarded(_post);
