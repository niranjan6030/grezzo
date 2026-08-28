/*
 * Proves the payment signature check does what Razorpay expects:
 * HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the API secret.
 *
 *   npm run dev            # in another terminal
 *   npm run test:razorpay
 *
 * Reads RAZORPAY_KEY_SECRET from the environment, and must match whatever
 * the running server has. Only the valid case should verify.
 */
import crypto from "node:crypto";

const SECRET = process.env.RAZORPAY_KEY_SECRET ?? "local_signature_test_secret";
const orderId = "order_TESTabcdefghij";
const paymentId = "pay_TESTklmnopqrst";

const sign = (o, p, secret = SECRET) =>
  crypto.createHmac("sha256", secret).update(`${o}|${p}`).digest("hex");

const post = (body) =>
  fetch("http://localhost:3000/api/razorpay/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

const cases = {
  valid: await post({
    razorpay_order_id: orderId, razorpay_payment_id: paymentId,
    razorpay_signature: sign(orderId, paymentId),
  }),
  tampered_amount_signature: await post({
    razorpay_order_id: orderId, razorpay_payment_id: paymentId,
    razorpay_signature: sign(orderId, paymentId, "attacker-guess"),
  }),
  swapped_ids: await post({
    razorpay_order_id: paymentId, razorpay_payment_id: orderId,
    razorpay_signature: sign(orderId, paymentId),
  }),
  missing_fields: await post({ razorpay_order_id: orderId }),
  wrong_length_signature: await post({
    razorpay_order_id: orderId, razorpay_payment_id: paymentId,
    razorpay_signature: "abc",
  }),
};

console.log(JSON.stringify(cases, null, 1));
