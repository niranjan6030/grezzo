import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { updateAdminData } from "@/lib/admin/store";

import { guarded } from "@/lib/admin/guard";

const RAILS = ["card", "upi", "netbanking", "wallet", "paylater", "emi"];

function validate(body) {
  const bank = String(body.bank ?? "").trim();
  if (!bank) return { error: "Name the bank — it is what the shopper looks for." };

  const kind = body.kind === "flat" ? "flat" : "percent";
  const value = Math.round(Number(body.value));
  if (!Number.isFinite(value) || value < 1) return { error: "Enter a discount amount." };
  if (kind === "percent" && value > 50)
    return { error: "Bank offers over 50% are almost certainly a mistake." };

  const methods = Array.isArray(body.methods) ? body.methods.filter((m) => RAILS.includes(m)) : [];
  if (methods.length === 0) return { error: "Choose at least one payment method." };

  const maxDiscountPaise =
    body.maxDiscountPaise === null ||
    body.maxDiscountPaise === undefined ||
    body.maxDiscountPaise === ""
      ? null
      : Math.max(100, Math.round(Number(body.maxDiscountPaise)));
  if (kind === "percent" && maxDiscountPaise === null) {
    return { error: "A percentage bank offer needs a maximum discount." };
  }

  return {
    offer: {
      bank,
      cardType: ["credit", "debit", "both"].includes(String(body.cardType))
        ? body.cardType
        : "both",
      network: ["visa", "mastercard", "rupay", "amex", "any"].includes(String(body.network))
        ? body.network
        : "any",
      kind,
      value,
      minOrderPaise: Math.max(0, Math.round(Number(body.minOrderPaise) || 0)),
      maxDiscountPaise,
      methods,
      // Without this the entry is display-only: Razorpay is the only party
      // that can see the card and decide whether the offer really applies.
      razorpayOfferId: body.razorpayOfferId ? String(body.razorpayOfferId).trim() : null,
      startsAt: body.startsAt ? new Date(String(body.startsAt)).toISOString() : null,
      endsAt: body.endsAt ? new Date(String(body.endsAt)).toISOString() : null,
      active: body.active !== false,
    },
  };
}

const _post = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const checked = validate(await req.json().catch(() => ({})));
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  await updateAdminData((draft) => {
    draft.bankOffers.unshift({
      ...checked.offer,
      id: `bnk_${crypto.randomBytes(6).toString("hex")}`,
      createdAt: new Date().toISOString(),
    });
  });
  return NextResponse.json({ ok: true });
};

const _patch = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");

  if (Object.keys(body).length === 2 && typeof body.active === "boolean") {
    const { result } = await updateAdminData((draft) => {
      const o = draft.bankOffers.find((x) => x.id === id);
      if (o) o.active = body.active;
      return Boolean(o);
    });
    if (!result) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { result } = await updateAdminData((draft) => {
    const i = draft.bankOffers.findIndex((x) => x.id === id);
    if (i === -1) return false;
    draft.bankOffers[i] = { ...draft.bankOffers[i], ...checked.offer };
    return true;
  });
  if (!result) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
};

const _delete = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await req.json().catch(() => ({}));
  await updateAdminData((draft) => {
    draft.bankOffers = draft.bankOffers.filter((o) => o.id !== id);
  });
  return NextResponse.json({ ok: true });
};

export const POST = guarded(_post);
export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
