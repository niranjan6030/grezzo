import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import {
  createAddress, deleteAddress, loadAddresses, setDefaultAddress, updateAddress,
} from "@/lib/addresses";
import type { Address } from "@/lib/types";
import { guarded } from "@/lib/admin/guard";

/* Saved addresses, kept against the Firebase uid so they follow a shopper
   from phone to laptop rather than living in one browser. */

const STATES = 2;   // minimum sane length for the state field

function parse(body: Record<string, unknown>): { error: string } | { address: Omit<Address, "id" | "createdAt" | "isDefault"> } {
  const str = (k: string, max = 120) => String(body[k] ?? "").trim().slice(0, max);

  const name = str("name");
  if (name.length < 2) return { error: "Who is this going to?" };

  const phone = str("phone", 20).replace(/[^\d+]/g, "");
  if (phone.replace(/\D/g, "").length < 10) {
    return { error: "A ten-digit contact number is needed for delivery." };
  }

  const line1 = str("line1", 200);
  if (line1.length < 5) return { error: "Enter the house or flat and street." };

  const city = str("city", 80);
  if (city.length < 2) return { error: "Enter the city." };

  const state = str("state", 80);
  if (state.length < STATES) return { error: "Enter the state." };

  const pincode = str("pincode", 6).replace(/\D/g, "");
  if (pincode.length !== 6) return { error: "A pincode is six digits." };

  return {
    address: {
      label: str("label", 24) || "Home",
      name, phone, line1,
      line2: str("line2", 200) || undefined,
      city, state, pincode,
    },
  };
}

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  return NextResponse.json(
    { addresses: await loadAddresses(auth.user.uid) },
    { headers: { "cache-control": "no-store" } },
  );
}

const _post = async (req: Request) => {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const parsed = parse(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { addresses, error } = await createAddress(auth.user.uid, parsed.address);
  if (error) return NextResponse.json({ error, addresses }, { status: 409 });
  return NextResponse.json({ addresses });
}

const _patch = async (req: Request) => {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");

  // Setting a default is the common case and needs no field validation.
  if (body.makeDefault === true) {
    return NextResponse.json({ addresses: await setDefaultAddress(auth.user.uid, id) });
  }

  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { addresses, error } = await updateAddress(auth.user.uid, id, parsed.address);
  if (error) return NextResponse.json({ error, addresses }, { status: 404 });
  return NextResponse.json({ addresses });
}

const _delete = async (req: Request) => {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { id } = await req.json().catch(() => ({}));
  return NextResponse.json({ addresses: await deleteAddress(auth.user.uid, id) });
}

export const POST = guarded(_post);
export const PATCH = guarded(_patch);
export const DELETE = guarded(_delete);
