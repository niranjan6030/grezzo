/** One colourway of a jean. Colour is a real variant axis: it changes the
 *  SKU, the stock it draws from, and what the customer receives. */

/** A saved delivery address. Shoppers keep several and pick one per order. */

/** Stable identity for a bag line — product, colour and size together. */
export const lineKey = (l) => `${l.productId}|${l.colour}|${l.size}`;

/** Every rail we accept. COD is settled offline; the rest go via Razorpay. */

export const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", note: "GPay, PhonePe, Paytm, any UPI app", online: true },
  { id: "card", label: "Card", note: "Credit, debit and RuPay", online: true },
  { id: "netbanking", label: "Net banking", note: "All major Indian banks", online: true },
  { id: "wallet", label: "Wallet", note: "Paytm, Mobikwik, Freecharge", online: true },
  { id: "paylater", label: "Pay later", note: "Simpl, LazyPay, ICICI PayLater", online: true },
  { id: "emi", label: "EMI", note: "Card and cardless instalments", online: true },
  { id: "cod", label: "Cash on delivery", note: "Pay the courier when it arrives", online: false },
];
