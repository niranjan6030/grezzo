/** What the admin has changed about a catalogue product. Anything absent
 *  falls through to the built-in catalogue, so an edit is always reversible
 *  by deleting the override rather than restoring a value. */

/** A transaction as the admin sees it. Mirrors the `orders` table so the
 *  console renders the same shape whichever backend is behind it. */

/* ------------------------------------------------------------------
   Coupons — a code the shopper types in.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   Bank / card offers — "10% off with HDFC credit cards".

   We never see the card, so we cannot verify eligibility ourselves. The
   discount is enforced by Razorpay against the real card at payment time,
   using an Offer created in the Razorpay dashboard. `razorpayOfferId` is
   what ties the two together; without it the entry is display-only.
   ------------------------------------------------------------------ */

export const EMPTY_ADMIN_DATA = {
  // Edits to the built-in catalogue, keyed by product id.
  products: {},
  // Whole products created in the console. Kept here rather than read from
  // the Postgres `products` table so mergeCatalogue can stay synchronous —
  // it is called from pricing paths that must not become async. The row in
  // Postgres still exists; it anchors the variants foreign key.
  customProducts: [],
  offers: [],
  coupons: [],
  bankOffers: [],
  couponUse: {},
  addresses: {},
  stock: {},
  orders: [],
  updatedAt: new Date(0).toISOString(),
};

/** A product with the admin's edits and any live offer already applied. */
