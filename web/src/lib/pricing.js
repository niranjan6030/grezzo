import { skuFor } from "./skus";

export const FREE_SHIPPING_THRESHOLD = 300000; // ₹3,000 in paise
export const SHIPPING_PAISE = 14900;

/** Cash on delivery costs us a courier collection fee, and carries more risk
 *  the larger the order — hence a handling charge and an upper limit. */
export const COD_FEE_PAISE = 4900;
export const COD_MAX_ORDER_PAISE = 1500000; // ₹15,000

export { skuFor } from "./skus";

/**
 * Prices are always recomputed from the catalogue on the server. The client
 * sends product ids and quantities; it never sends money.
 *
 * The catalogue passed in must be the *merged* one — built-in products with
 * the admin's edits and live offers applied — so the price a shopper is shown
 * is the price they are charged.
 *
 * Bank/card discounts are deliberately absent here: we never see the card, so
 * Razorpay applies those against the real instrument at payment time.
 */
export function priceCart(cart, catalogue, options = {}) {
  const lines = [];
  const byId = (id) => catalogue.find((p) => p.id === id);

  for (const line of cart) {
    const p = byId(line.productId);
    if (!p) continue;
    if (!p.sizes.includes(line.size)) continue;
    const colour = p.colours.find((c) => c.code === line.colour);
    if (!colour) continue;
    const qty = Math.max(1, Math.min(Math.floor(line.qty), 10));
    lines.push({
      productId: p.id,
      name: p.name,
      colour: colour.code,
      size: line.size,
      qty,
      sku: skuFor(p.id, colour.code, line.size),
      unitPaise: p.pricePaise,
      linePaise: p.pricePaise * qty,
    });
  }

  const subtotalPaise = lines.reduce((n, l) => n + l.linePaise, 0);
  const couponDiscountPaise = Math.min(
    options.coupon?.discountPaise ?? 0,
    Math.max(subtotalPaise - 100, 0),
  );
  const afterCoupon = subtotalPaise - couponDiscountPaise;

  // Free-shipping thresholds are judged on what the shopper actually pays,
  // otherwise a coupon could push an order under the threshold and still ship free.
  const shippingPaise =
    subtotalPaise === 0 || options.coupon?.freeShipping || afterCoupon >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_PAISE;

  const codFeePaise = options.method === "cod" ? COD_FEE_PAISE : 0;

  return {
    lines,
    subtotalPaise,
    couponCode: options.coupon?.code ?? null,
    couponDiscountPaise,
    shippingPaise,
    codFeePaise,
    totalPaise: afterCoupon + shippingPaise + codFeePaise,
  };
}

/** Why cash on delivery might not be offered on this basket. */
export function codUnavailableReason(subtotalPaise) {
  if (subtotalPaise > COD_MAX_ORDER_PAISE) {
    return `Cash on delivery is available up to ₹${(COD_MAX_ORDER_PAISE / 100).toLocaleString("en-IN")}.`;
  }
  return null;
}
