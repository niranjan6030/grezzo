/* ------------------------------------------------------------------
   Coupon and bank-offer rules.

   Kept as pure functions so the bag and the checkout evaluate a code the
   same way — the bag needs to show the discount before payment, and the
   server needs to prove it before charging. Anything that diverges here
   becomes a shopper who is quoted one price and charged another.
   ------------------------------------------------------------------ */

const inWindow = (o, now) =>
  (!o.startsAt || Date.parse(o.startsAt) <= now) && (!o.endsAt || Date.parse(o.endsAt) >= now);

function scopeMatches(scope, p) {
  switch (scope.type) {
    case "all":
      return true;
    case "collection":
      return p.collection === scope.value;
    case "product":
      return p.id === scope.value;
    case "fit":
      return p.fit === scope.value;
  }
}

/** The part of the basket a scoped coupon is allowed to discount. */
function eligibleSubtotal(coupon, ctx) {
  if (coupon.scope.type === "all") return ctx.subtotalPaise;
  return ctx.lines.reduce((sum, line) => {
    const product = ctx.catalogue.find((p) => p.id === line.productId);
    if (!product || !scopeMatches(coupon.scope, product)) return sum;
    return sum + line.linePaise;
  }, 0);
}

export function findCoupon(data, code) {
  const wanted = code.trim().toUpperCase();
  return data.coupons.find((c) => c.code.toUpperCase() === wanted);
}

/**
 * Can this code be used on this basket, by this person, right now?
 * Every failure returns a reason a shopper can act on.
 */
export function evaluateCoupon(data, code, ctx, now = Date.now()) {
  const coupon = findCoupon(data, code);
  if (!coupon) return { ok: false, reason: "That code does not exist." };
  if (!coupon.active) return { ok: false, reason: "That code is no longer active." };

  if (coupon.startsAt && Date.parse(coupon.startsAt) > now) {
    return { ok: false, reason: "That code is not live yet." };
  }
  if (coupon.endsAt && Date.parse(coupon.endsAt) < now) {
    return { ok: false, reason: "That code has expired." };
  }

  /* Scope before spend. Telling someone to add ₹10 to a basket the code
     will never apply to sends them off to spend money for nothing. */
  const eligible = eligibleSubtotal(coupon, ctx);
  if (eligible <= 0) {
    return { ok: false, reason: "That code does not apply to anything in your bag." };
  }

  if (ctx.subtotalPaise < coupon.minOrderPaise) {
    const short = coupon.minOrderPaise - ctx.subtotalPaise;
    return {
      ok: false,
      reason: `Spend ₹${Math.ceil(short / 100).toLocaleString("en-IN")} more to use this code.`,
    };
  }

  const use = data.couponUse[coupon.id];
  if (coupon.usageLimit !== null && (use?.total ?? 0) >= coupon.usageLimit) {
    return { ok: false, reason: "That code has been fully claimed." };
  }
  if (ctx.userId && coupon.perUserLimit > 0) {
    const mine = use?.byUser?.[ctx.userId] ?? 0;
    if (mine >= coupon.perUserLimit) {
      return { ok: false, reason: "You have already used this code." };
    }
  }
  if (coupon.firstOrderOnly) {
    if (!ctx.userId) return { ok: false, reason: "Sign in to use a first-order code." };
    if (ctx.firstOrder === false) {
      return { ok: false, reason: "This code is for first orders only." };
    }
  }

  if (coupon.kind === "free_shipping") {
    return { ok: true, coupon, discountPaise: 0, freeShipping: true };
  }

  let discount =
    coupon.kind === "percent"
      ? Math.round((eligible * Math.min(Math.max(coupon.value, 1), 90)) / 100)
      : coupon.value;

  if (coupon.maxDiscountPaise !== null) discount = Math.min(discount, coupon.maxDiscountPaise);
  // Never let a coupon take the basket below ₹1 — Razorpay rejects it and it
  // would be a free order anyway.
  discount = Math.max(0, Math.min(discount, eligible - 100));

  if (discount <= 0) return { ok: false, reason: "That code gives no discount on this bag." };

  return { ok: true, coupon, discountPaise: discount, freeShipping: false };
}

/* ------------------------------------------------------------------
   Bank offers
   ------------------------------------------------------------------ */

export function liveBankOffers(data, subtotalPaise, method, now = Date.now()) {
  return data.bankOffers.filter(
    (o) =>
      o.active &&
      inWindow(o, now) &&
      subtotalPaise >= o.minOrderPaise &&
      (!method || o.methods.includes(method)),
  );
}

/** What the offer is worth on this basket — an estimate we label as such,
 *  because only Razorpay can see the card and decide for real. */
export function bankOfferValue(offer, subtotalPaise) {
  const raw =
    offer.kind === "percent" ? Math.round((subtotalPaise * offer.value) / 100) : offer.value;
  return offer.maxDiscountPaise !== null ? Math.min(raw, offer.maxDiscountPaise) : raw;
}

export function describeBankOffer(o) {
  const amount =
    o.kind === "percent"
      ? `${o.value}% off`
      : `₹${Math.round(o.value / 100).toLocaleString("en-IN")} off`;
  const cap =
    o.maxDiscountPaise !== null && o.kind === "percent"
      ? ` up to ₹${Math.round(o.maxDiscountPaise / 100).toLocaleString("en-IN")}`
      : "";
  const card = o.cardType === "both" ? "cards" : `${o.cardType} cards`;
  const network = o.network === "any" ? "" : ` ${o.network.toUpperCase()}`;
  return `${amount}${cap} on ${o.bank}${network} ${card}`;
}

/* ------------------------------------------------------------------
   Redemption accounting.

   Counted when an order is actually confirmed — payment captured, or a
   COD order accepted — never when the code is merely typed in. Both call
   sites can fire more than once (Razorpay retries webhooks), so this is
   keyed on the order and safe to repeat.
   ------------------------------------------------------------------ */
export function applyRedemption(draft, couponCode, userId, orderId) {
  const coupon = findCoupon(draft, couponCode);
  if (!coupon) return;

  draft.couponUse[coupon.id] ??= { total: 0, byUser: {} };
  const use = draft.couponUse[coupon.id];

  // The order id is recorded against the user so a retried webhook cannot
  // count the same redemption twice.
  const seen = use.orders ?? [];
  if (seen.includes(orderId)) return;
  use.orders = [...seen, orderId];

  use.total += 1;
  if (userId) use.byUser[userId] = (use.byUser[userId] ?? 0) + 1;
  coupon.redemptions = use.total;
}
