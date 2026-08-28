import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readAdminData, storageBackend } from "@/lib/admin/store";
import { loadOrders } from "@/lib/admin/orders";
import { mergeCatalogue } from "@/lib/catalogue";
import { skuFor } from "@/lib/pricing";

/** Everything the console needs in one round trip: catalogue, offers,
 *  stock, transactions, and the headline numbers. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const data = await readAdminData();
  const catalogue = mergeCatalogue(data);
  const orders = await loadOrders();

  // A cash order is confirmed revenue the moment it is placed and shipped.
  const paid = orders.filter((o) =>
    ["paid", "cod_pending", "shipped", "delivered"].includes(o.status));
  const dayAgo = Date.now() - 86_400_000;
  const weekAgo = Date.now() - 7 * 86_400_000;

  const revenue = (list: typeof paid) => list.reduce((n, o) => n + o.totalPaise, 0);
  const units = (list: typeof paid) =>
    list.reduce((n, o) => n + o.lines.reduce((m, l) => m + l.qty, 0), 0);

  // Units sold per product, for the best-sellers table.
  const sold = new Map<string, number>();
  for (const o of paid) {
    for (const l of o.lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.qty);
  }

  // Anything under this depth needs a purchase order raising.
  const LOW = 4;
  const lowStock: { sku: string; productId: string; name: string; colour: string; size: number; qty: number }[] = [];
  for (const p of catalogue) {
    for (const c of p.colours) {
      for (const size of p.sizes) {
        const sku = skuFor(p.id, c.code, size);
        const qty = data.stock[sku] ?? 12;      // 12 is the seeded default
        if (qty <= LOW) {
          lowStock.push({ sku, productId: p.id, name: p.name, colour: c.wash, size, qty });
        }
      }
    }
  }
  lowStock.sort((a, b) => a.qty - b.qty);

  return NextResponse.json({
    backend: storageBackend(),
    data,
    orders,
    catalogue,
    stats: {
      revenueAllPaise: revenue(paid),
      revenueDayPaise: revenue(paid.filter((o) => Date.parse(o.createdAt) > dayAgo)),
      revenueWeekPaise: revenue(paid.filter((o) => Date.parse(o.createdAt) > weekAgo)),
      ordersAll: paid.length,
      ordersDay: paid.filter((o) => Date.parse(o.createdAt) > dayAgo).length,
      unitsAll: units(paid),
      abandoned: orders.filter((o) => o.status === "created").length,
      averageOrderPaise: paid.length ? Math.round(revenue(paid) / paid.length) : 0,
      bestSellers: [...sold.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([productId, qty]) => ({
          productId, qty, name: catalogue.find((p) => p.id === productId)?.name ?? productId,
        })),
      lowStock: lowStock.slice(0, 25),
      lowStockCount: lowStock.length,
    },
  });
}
