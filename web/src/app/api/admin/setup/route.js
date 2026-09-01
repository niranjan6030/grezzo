import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireAdmin } from "@/lib/admin/auth";
import { firebaseAdminConfigured, usingAuthEmulator } from "@/lib/firebase/admin";
import { getAdminSupabase } from "@/lib/supabase/server";

/**
 * What is actually wired up.
 *
 * Deliberately goes beyond "is the variable set" — a key that is present but
 * rejected is worse than one that is missing, because everything looks fine
 * until a customer tries to pay.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const out = [];

  /* ---- Firebase ---- */
  if (usingAuthEmulator()) {
    out.push({
      id: "firebase",
      name: "Sign-in (Firebase Auth)",
      state: "local",
      detail: "Running against the local Auth emulator. Real accounts need a Firebase project.",
    });
  } else if (firebaseAdminConfigured()) {
    out.push({
      id: "firebase",
      name: "Sign-in (Firebase Auth)",
      state: "live",
      detail: "Verifying session cookies with a service account.",
    });
  } else {
    out.push({
      id: "firebase",
      name: "Sign-in (Firebase Auth)",
      state: "off",
      detail: "No credentials. Checkout, addresses and order tracking are unavailable.",
    });
  }

  /* ---- Supabase ---- */
  const db = getAdminSupabase();
  if (!db) {
    out.push({
      id: "supabase",
      name: "Database (Supabase)",
      state: "off",
      detail:
        "Using the local file store. Fine for development; edits vanish on a serverless deploy.",
    });
  } else {
    const { error } = await db.from("site_config").select("key").limit(1);
    out.push(
      error
        ? {
            id: "supabase",
            name: "Database (Supabase)",
            state: "broken",
            detail: `Connected but the query failed: ${error.message}. Has schema.sql been run?`,
          }
        : {
            id: "supabase",
            name: "Database (Supabase)",
            state: "live",
            detail: "Postgres reachable, schema present.",
          },
    );
  }

  /* ---- Razorpay ---- */
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    out.push({
      id: "razorpay",
      name: "Payments (Razorpay)",
      state: "off",
      detail: keySecret
        ? "RAZORPAY_KEY_SECRET is set but RAZORPAY_KEY_ID is missing — both are needed."
        : "No keys. Online payment stops before charging; cash on delivery still works.",
    });
  } else {
    // Presence proves nothing. A cheap authenticated call proves the pair works.
    try {
      const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
      await rzp.orders.all({ count: 1 });
      out.push({
        id: "razorpay",
        name: "Payments (Razorpay)",
        state: "live",
        detail: keyId.startsWith("rzp_test")
          ? "Test mode. Use card 4111 1111 1111 1111 with any future expiry."
          : "LIVE MODE — real money will move.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      out.push({
        id: "razorpay",
        name: "Payments (Razorpay)",
        state: "broken",
        detail: /auth/i.test(message)
          ? "Razorpay rejected these keys. Check the id and secret are from the same mode."
          : `Razorpay could not be reached: ${message.slice(0, 120)}`,
      });
    }
  }

  /* ---- webhook ---- */
  out.push(
    process.env.RAZORPAY_WEBHOOK_SECRET
      ? {
          id: "webhook",
          name: "Payment webhook",
          state: "live",
          detail: "Signed webhooks accepted — this is what confirms payment authoritatively.",
        }
      : {
          id: "webhook",
          name: "Payment webhook",
          state: "off",
          detail:
            "No signing secret. Orders confirm on the browser callback alone, which is weaker.",
        },
  );

  /* ---- AI service ---- */
  const ai = process.env.AI_SERVICE_URL;
  if (!ai) {
    out.push({
      id: "ai",
      name: "AI service",
      state: "off",
      detail: "Recommendations fall back to the on-site model; reading a photo is unavailable.",
    });
  } else {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${ai.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      const json = await res.json();
      out.push({
        id: "ai",
        name: "AI service",
        state: "live",
        detail: `Recommender: ${json.recommender}. Vision: ${json.vision}.`,
      });
    } catch {
      out.push({
        id: "ai",
        name: "AI service",
        state: "broken",
        detail: "AI_SERVICE_URL is set but the service did not answer. Free tiers sleep when idle.",
      });
    }
  }

  return NextResponse.json({ integrations: out }, { headers: { "cache-control": "no-store" } });
}
