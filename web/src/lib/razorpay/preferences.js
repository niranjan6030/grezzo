import "server-only";

/* ------------------------------------------------------------------
   Which payment methods this Razorpay account can actually accept.

   The storefront used to offer all seven regardless. That is not a
   cosmetic problem: Razorpay checkout is opened restricted to the one
   method the shopper picked, so choosing one the account does not
   support ends at "No appropriate payment method found" with no way
   back. On a live account it is normal for several to be off — UPI and
   EMI both were here — and the default selection was one of them.

   Razorpay publishes this at /v1/preferences against the public key id,
   so no secret is involved.
   ------------------------------------------------------------------ */

const TTL_MS = 10 * 60 * 1000;
let cache = null;

/** Razorpay reports a method as `true`, `false`, or an object of providers.
 *  An empty provider object means the method is nominally on with nothing
 *  behind it — PayLater with zero lenders — which fails exactly like off. */
function usable(value) {
  if (value === true) return true;
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).length > 0;
}

/**
 * Returns { upi, card, netbanking, wallet, paylater, emi } as booleans, or
 * null when it cannot be determined — the caller should then fall back to
 * offering everything rather than blocking checkout on a lookup failure.
 */
export async function enabledMethods() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) return null;

  if (cache && cache.keyId === keyId && Date.now() - cache.at < TTL_MS) {
    return cache.methods;
  }

  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/preferences?key_id=${encodeURIComponent(keyId)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const m = json?.methods;
    if (!m || typeof m !== "object") return null;

    const methods = {
      upi: usable(m.upi),
      card: usable(m.card),
      netbanking: usable(m.netbanking),
      wallet: usable(m.wallet),
      // Razorpay reports cardless_emi separately; either counts as "EMI"
      // as far as the shopper is concerned.
      paylater: usable(m.paylater),
      emi: usable(m.emi) || usable(m.cardless_emi),
    };

    cache = { keyId, methods, at: Date.now() };
    return methods;
  } catch {
    // Network trouble or a slow response. Unknown, not "none".
    return null;
  }
}
