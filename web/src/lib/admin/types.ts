import type { Address, Colourway, Fit, PaymentMethod, Product, Rise } from "@/lib/types";

/** What the admin has changed about a catalogue product. Anything absent
 *  falls through to the built-in catalogue, so an edit is always reversible
 *  by deleting the override rather than restoring a value. */
export interface ProductOverride {
  name?: string;
  story?: string;
  /** Cut and rise drive the technical flat, so they are editable. */
  fit?: Fit;
  rise?: Rise;
  pricePaise?: number;
  comparePaise?: number | null;
  fabric?: string;
  tags?: string[];
  active?: boolean;
  /** Full replacement list when colourways are added, removed or reordered. */
  colours?: Colourway[];
  /** colourway code → image data URL. Absent means draw the SVG plate. */
  photos?: Record<string, string>;
}

export type OfferScope =
  | { type: "all" }
  | { type: "collection"; value: string }
  | { type: "product"; value: string }
  | { type: "fit"; value: string };

export interface Offer {
  id: string;
  name: string;
  kind: "percent" | "flat";
  /** percent: 1–90. flat: paise off. */
  value: number;
  scope: OfferScope;
  startsAt: string | null;   // ISO, null = immediately
  endsAt: string | null;     // ISO, null = no end
  active: boolean;
  createdAt: string;
}

/** A transaction as the admin sees it. Mirrors the `orders` table so the
 *  console renders the same shape whichever backend is behind it. */
export interface AdminOrder {
  id: string;
  receipt: string;
  /** Firebase uid, when the shopper was signed in. */
  userId?: string;
  paymentMethod?: PaymentMethod;
  address?: Address;
  /** Fulfilment history, newest last — what the tracking page renders. */
  timeline?: { status: string; at: string; note?: string }[];
  couponCode?: string;
  couponDiscountPaise?: number;
  codFeePaise?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  email?: string;
  pincode?: string;
  status: "created" | "paid" | "failed" | "signature_failed" | "refunded"
        | "cancelled" | "shipped" | "delivered" | "cod_pending";
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  lines: { productId: string; name: string; colour: string; size: number; qty: number; unitPaise: number }[];
  createdAt: string;
  paidAt?: string;
}

/* ------------------------------------------------------------------
   Coupons — a code the shopper types in.
   ------------------------------------------------------------------ */
export interface Coupon {
  id: string;
  code: string;                    // stored uppercase; matched case-insensitively
  description: string;             // shown in the bag once applied
  kind: "percent" | "flat" | "free_shipping";
  value: number;                   // percent 1–90, or paise off
  minOrderPaise: number;
  maxDiscountPaise: number | null; // caps a percentage coupon
  scope: OfferScope;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;       // total redemptions across everyone
  perUserLimit: number;            // per signed-in shopper
  firstOrderOnly: boolean;
  active: boolean;
  redemptions: number;
  createdAt: string;
}

/* ------------------------------------------------------------------
   Bank / card offers — "10% off with HDFC credit cards".

   We never see the card, so we cannot verify eligibility ourselves. The
   discount is enforced by Razorpay against the real card at payment time,
   using an Offer created in the Razorpay dashboard. `razorpayOfferId` is
   what ties the two together; without it the entry is display-only.
   ------------------------------------------------------------------ */
export interface BankOffer {
  id: string;
  bank: string;                    // "HDFC Bank"
  cardType: "credit" | "debit" | "both";
  network: "visa" | "mastercard" | "rupay" | "amex" | "any";
  kind: "percent" | "flat";
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  methods: PaymentMethod[];        // which rails it can apply to
  razorpayOfferId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface AdminData {
  products: Record<string, ProductOverride>;
  offers: Offer[];
  coupons: Coupon[];
  bankOffers: BankOffer[];
  /** couponId → { total, byUser } redemption counts. */
  couponUse: Record<string, { total: number; byUser: Record<string, number> }>;
  /** Firebase uid → their saved delivery addresses. */
  addresses: Record<string, Address[]>;
  /** sku → units on hand, used by the local inventory backend. */
  stock: Record<string, number>;
  orders: AdminOrder[];
  updatedAt: string;
}

export const EMPTY_ADMIN_DATA: AdminData = {
  products: {}, offers: [], coupons: [], bankOffers: [], couponUse: {},
  addresses: {}, stock: {}, orders: [],
  updatedAt: new Date(0).toISOString(),
};

/** A product with the admin's edits and any live offer already applied. */
export interface MergedProduct extends Product {
  /** Set when an offer is currently reducing this product. */
  offer?: { id: string; name: string; wasPaise: number };
  /** False hides it from the storefront without deleting anything. */
  active: boolean;
}
