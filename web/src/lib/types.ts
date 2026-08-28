export type Fit =
  | "Skinny" | "Slim" | "Straight" | "Regular"
  | "Relaxed" | "Wide Leg" | "Bootcut" | "Baggy" | "Tapered";

export type Rise = "Low" | "Mid" | "High";

export type Wash =
  | "Raw Indigo" | "Rinse" | "Light Stone" | "Mid Stone"
  | "Dark Stone" | "Bleach" | "Ecru" | "Black Overdye";

/** One colourway of a jean. Colour is a real variant axis: it changes the
 *  SKU, the stock it draws from, and what the customer receives. */
export interface Colourway {
  code: string;                        // url-safe, part of the SKU
  wash: Wash;
  /** Hex ramp: [shadow, body, highlight] — drives the SVG product plate. */
  ramp: [string, string, string];
  /** Photograph uploaded in the admin. When absent the plate is drawn. */
  photo?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Price in paise (Razorpay's unit) to avoid float money bugs. */
  pricePaise: number;
  comparePaise?: number;
  fit: Fit;
  rise: Rise;
  /** First entry is the default colourway shown in listings. */
  colours: Colourway[];
  /** Convenience aliases for the default colourway. */
  wash: Wash;
  ramp: [string, string, string];
  sizes: number[];
  fabric: string;
  weightOz: number;
  stretchPct: number;
  collection: string;
  story: string;
  tags: string[];
  /** Feature vector for content-based similarity + as LSTM item metadata. */
  vector: number[];
}

/** A saved delivery address. Shoppers keep several and pick one per order. */
export interface Address {
  id: string;
  label: string;                 // "Home", "Office"
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

/** Stable identity for a bag line — product, colour and size together. */
export const lineKey = (l: { productId: string; colour: string; size: number }) =>
  `${l.productId}|${l.colour}|${l.size}`;

export interface CartLine {
  productId: string;
  colour: string;                      // Colourway.code
  size: number;
  qty: number;
}

export type EventKind = "view" | "favourite" | "add_to_cart" | "purchase" | "search";

export interface BrowseEvent {
  kind: EventKind;
  productId: string;
  at: number;
}

/** Every rail we accept. COD is settled offline; the rest go via Razorpay. */
export type PaymentMethod =
  | "upi" | "card" | "netbanking" | "wallet" | "paylater" | "emi" | "cod";

export const PAYMENT_METHODS: {
  id: PaymentMethod; label: string; note: string; online: boolean;
}[] = [
  { id: "upi",        label: "UPI",             note: "GPay, PhonePe, Paytm, any UPI app", online: true },
  { id: "card",       label: "Card",            note: "Credit, debit and RuPay",           online: true },
  { id: "netbanking", label: "Net banking",     note: "All major Indian banks",            online: true },
  { id: "wallet",     label: "Wallet",          note: "Paytm, Mobikwik, Freecharge",       online: true },
  { id: "paylater",   label: "Pay later",       note: "Simpl, LazyPay, ICICI PayLater",    online: true },
  { id: "emi",        label: "EMI",             note: "Card and cardless instalments",     online: true },
  { id: "cod",        label: "Cash on delivery", note: "Pay the courier when it arrives",  online: false },
];
