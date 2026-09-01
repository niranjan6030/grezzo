import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/* Admin sign-in. One shared password from the environment, exchanged for a
   signed, expiring cookie. No password is ever stored or logged. */

const COOKIE = "grezzo_admin";
const MAX_AGE_S = 60 * 60 * 8;

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(candidate.padEnd(64).slice(0, 64));
  const b = Buffer.from(expected.padEnd(64).slice(0, 64));
  return crypto.timingSafeEqual(a, b);
}

function sign(expiry) {
  return crypto.createHmac("sha256", secret()).update(String(expiry)).digest("hex");
}

export async function issueSession() {
  const expiry = Date.now() + MAX_AGE_S * 1000;
  const store = await cookies();
  store.set(COOKIE, `${expiry}.${sign(expiry)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function isSignedIn() {
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [expiryRaw, mac] = raw.split(".");
  const expiry = Number(expiryRaw);
  if (!expiry || !mac || expiry < Date.now()) return false;
  const expected = sign(expiry);
  return (
    expected.length === mac.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  );
}

/** Guard for every admin route handler. */
export async function requireAdmin() {
  if (!adminConfigured()) {
    return Response.json(
      { error: "Set ADMIN_PASSWORD in your environment to enable the console." },
      { status: 503 },
    );
  }
  if (!(await isSignedIn())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  return null;
}
