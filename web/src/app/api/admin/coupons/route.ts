import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { updateAdminData } from "@/lib/admin/store";
import type { Coupon, OfferScope } from "@/lib/admin/types";
import { guarded } from "@/lib/admin/guard";

function parseScope(raw: unknown): OfferScope | null {
  const s = raw as { type?: string; value?: string };
  if (!s?.type) return null;
  if (s.type === "all") return { type: "all" };
  if (["collection", "product", "fit"].includes(s.type) && s.value) {
    return { type: s.type as "collection" | "product" | "fit", value: String(s.value) };
  }
  return null;
}

type Draft = Omit<Coupon, "id" | "createdAt" | "redemptions">;

function validate(body: Record<string, unknown>): { error: string } | { coupon: Draft } {
  const code = String(body.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) {
    return { error: "Codes are 3–24 characters, letters, numbers and hyphens only." };
  }

  const kind = ["percent", "flat", "free_shipping"].includes(String(body.kind))
    ? (body.kind as Coupon["kind"]) : "percent";

  const value = kind === "free_shipping" ? 0 : Math.round(Number(body.value));
  if (kind !== "free_shipping") {
    if (!Number.isFinite(value) || value < 1) return { error: "Enter a discount amount." };
    if (kind === "percent" && value > 90) return { error: "Percentage coupons are capped at 90%." };
  }

  const scope = parseScope(body.scope);
  if (!scope) return { error: "Choose what the coupon applies to." };

  for (const key of ["startsAt", "endsAt"] as const) {
    const v = body[key];
    if (v && Number.isNaN(Date.parse(String(v)))) return { error: `${key} is not a valid date.` };
  }
  if (body.startsAt && body.endsAt &&
      Date.parse(String(body.endsAt)) <= Date.parse(String(body.startsAt))) {
    return { error: "The coupon ends before it starts." };
  }

  const usageLimit = body.usageLimit === null || body.usageLimit === undefined || body.usageLimit === ""
    ? null : Math.max(1, Math.round(Number(body.usageLimit)));
  const maxDiscountPaise = body.maxDiscountPaise === null || body.maxDiscountPaise === undefined || body.maxDiscountPaise === ""
    ? null : Math.max(100, Math.round(Number(body.maxDiscountPaise)));

  if (kind === "percent" && maxDiscountPaise === null && value > 30) {
    return { error: "A percentage over 30% needs a maximum discount, or one large order could cost you the month." };
  }

  return {
    coupon: {
      code,
      description: String(body.description ?? "").slice(0, 140),
      kind,
      value,
      minOrderPaise: Math.max(0, Math.round(Number(body.minOrderPaise) || 0)),
      maxDiscountPaise,
      scope,
      startsAt: body.startsAt ? new Date(String(body.startsAt)).toISOString() : null,
      endsAt: body.endsAt ? new Date(String(body.endsAt)).toISOString() : null,
      usageLimit,
      perUserLimit: Math.max(1, Math.round(Number(body.perUserLimit) || 1)),
      firstOrderOnly: body.firstOrderOnly === true,
      active: body.active !== false,
    },
  };
}

const _post = async (req: Request) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { result } = await updateAdminData((draft) => {
    if (draft.coupons.some((c) => c.code === checked.coupon.code)) return "duplicate";
    draft.coupons.unshift({
      ...checked.coupon,
      id: `cpn_${crypto.randomBytes(6).toString("hex")}`,
      redemptions: 0,
      createdAt: new Date().toISOString(),
    });
    return "ok";
  });

  if (result === "duplicate") {
    return NextResponse.json({ error: "That code already exists." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

const _patch = async (req: Request) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");

  if (Object.keys(body).length === 2 && typeof body.active === "boolean") {
    const { result } = await updateAdminData((draft) => {
      const c = draft.coupons.find((x) => x.id === id);
      if (c) c.active = body.active as boolean;
      return Boolean(c);
    });
    if (!result) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { result } = await updateAdminData((draft) => {
    const i = draft.coupons.findIndex((x) => x.id === id);
    if (i === -1) return false;
    // Redemption history stays with the code — editing the terms must not
    // hand everyone who already used it a second go.
    draft.coupons[i] = { ...draft.coupons[i], ...checked.coupon };
    return true;
  });
  if (!result) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

const _delete = async (req: Request) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await req.json().catch(() => ({}));
  await updateAdminData((draft) => {
    draft.coupons = draft.coupons.filter((c) => c.id !== id);
    delete draft.couponUse[id];
  });
  return NextResponse.json({ ok: true });
}

export const POST = guarded(_post);
export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
