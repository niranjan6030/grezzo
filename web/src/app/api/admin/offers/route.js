import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { updateAdminData } from "@/lib/admin/store";

import { guarded } from "@/lib/admin/guard";

function parseScope(raw) {
  const s = raw;
  if (!s?.type) return null;
  if (s.type === "all") return { type: "all" };
  if (["collection", "product", "fit"].includes(s.type) && s.value) {
    return { type: s.type, value: String(s.value) };
  }
  return null;
}

function validate(body) {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Give the offer a name — it shows on the product card." };

  const kind = body.kind === "flat" ? "flat" : "percent";
  const value = Math.round(Number(body.value));
  if (!Number.isFinite(value) || value < 1) return { error: "Enter a discount amount." };
  if (kind === "percent" && value > 90) return { error: "Percentage offers are capped at 90%." };

  const scope = parseScope(body.scope);
  if (!scope) return { error: "Choose what the offer applies to." };

  for (const key of ["startsAt", "endsAt"]) {
    const v = body[key];
    if (v && Number.isNaN(Date.parse(String(v)))) return { error: `${key} is not a valid date.` };
  }
  if (
    body.startsAt &&
    body.endsAt &&
    Date.parse(String(body.endsAt)) <= Date.parse(String(body.startsAt))
  ) {
    return { error: "The offer ends before it starts." };
  }

  return {
    offer: {
      name,
      kind,
      value,
      scope,
      startsAt: body.startsAt ? new Date(String(body.startsAt)).toISOString() : null,
      endsAt: body.endsAt ? new Date(String(body.endsAt)).toISOString() : null,
      active: body.active !== false,
    },
  };
}

const _post = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const offer = {
    ...checked.offer,
    id: `off_${crypto.randomBytes(6).toString("hex")}`,
    createdAt: new Date().toISOString(),
  };
  await updateAdminData((draft) => {
    draft.offers.unshift(offer);
  });
  return NextResponse.json({ ok: true, offer });
};

const _patch = async (req) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");

  // Toggling active is the common case and skips full revalidation.
  if (Object.keys(body).length === 2 && typeof body.active === "boolean") {
    const { result } = await updateAdminData((draft) => {
      const o = draft.offers.find((x) => x.id === id);
      if (o) o.active = body.active;
      return Boolean(o);
    });
    if (!result) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const checked = validate(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { result } = await updateAdminData((draft) => {
    const i = draft.offers.findIndex((x) => x.id === id);
    if (i === -1) return false;
    draft.offers[i] = { ...draft.offers[i], ...checked.offer };
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
    draft.offers = draft.offers.filter((o) => o.id !== id);
  });
  return NextResponse.json({ ok: true });
};

export const POST = guarded(_post);
export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
