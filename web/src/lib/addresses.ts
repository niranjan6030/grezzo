import "server-only";
import crypto from "node:crypto";
import type { Address } from "./types";
import { readAdminData, updateAdminData } from "./admin/store";
import { getAdminSupabase } from "./supabase/server";

/* ------------------------------------------------------------------
   Saved delivery addresses.

   Postgres holds these once Supabase is connected, in their own table.
   They deliberately do NOT live in the site_config blob in production:
   that blob is read whole on every page render, and stuffing every
   customer's address book into it would make the storefront slower with
   each new shopper.

   Without Supabase they fall back to the local store, which is fine for
   development where there is one of you.
   ------------------------------------------------------------------ */

const MAX_PER_USER = 10;

type Row = {
  id: string; user_id: string; label: string; name: string; phone: string;
  line1: string; line2: string | null; city: string; state: string;
  pincode: string; is_default: boolean; created_at: string;
};

const fromRow = (r: Row): Address => ({
  id: r.id, label: r.label, name: r.name, phone: r.phone,
  line1: r.line1, line2: r.line2 ?? undefined, city: r.city, state: r.state,
  pincode: r.pincode, isDefault: r.is_default, createdAt: r.created_at,
});

export async function loadAddresses(uid: string): Promise<Address[]> {
  const db = getAdminSupabase();
  if (!db) return (await readAdminData()).addresses[uid] ?? [];

  const { data, error } = await db
    .from("addresses").select("*").eq("user_id", uid)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[addresses] load failed", error);
    return [];
  }
  return (data as Row[]).map(fromRow);
}

export async function createAddress(
  uid: string,
  fields: Omit<Address, "id" | "createdAt" | "isDefault">,
): Promise<{ addresses: Address[]; error?: string }> {
  const existing = await loadAddresses(uid);
  if (existing.length >= MAX_PER_USER) {
    return { addresses: existing, error: `You can save up to ${MAX_PER_USER} addresses.` };
  }

  const id = `adr_${crypto.randomBytes(6).toString("hex")}`;
  // The first address someone saves is their default, obviously.
  const isDefault = existing.length === 0;
  const db = getAdminSupabase();

  if (db) {
    const { error } = await db.from("addresses").insert({
      id, user_id: uid, label: fields.label, name: fields.name, phone: fields.phone,
      line1: fields.line1, line2: fields.line2 ?? null, city: fields.city,
      state: fields.state, pincode: fields.pincode, is_default: isDefault,
    });
    if (error) return { addresses: existing, error: error.message };
  } else {
    await updateAdminData((draft) => {
      (draft.addresses[uid] ??= []).push({
        ...fields, id, isDefault, createdAt: new Date().toISOString(),
      });
    });
  }
  return { addresses: await loadAddresses(uid) };
}

export async function updateAddress(
  uid: string,
  id: string,
  fields: Omit<Address, "id" | "createdAt" | "isDefault">,
): Promise<{ addresses: Address[]; error?: string }> {
  const db = getAdminSupabase();

  if (db) {
    // The uid filter is what stops one shopper editing another's address.
    const { error, count } = await db.from("addresses").update({
      label: fields.label, name: fields.name, phone: fields.phone,
      line1: fields.line1, line2: fields.line2 ?? null, city: fields.city,
      state: fields.state, pincode: fields.pincode,
    }, { count: "exact" }).eq("id", id).eq("user_id", uid);
    if (error) return { addresses: await loadAddresses(uid), error: error.message };
    if (!count) return { addresses: await loadAddresses(uid), error: "Address not found." };
  } else {
    const { result } = await updateAdminData((draft) => {
      const list = draft.addresses[uid] ?? [];
      const i = list.findIndex((a) => a.id === id);
      if (i === -1) return false;
      list[i] = { ...list[i], ...fields };
      return true;
    });
    if (!result) return { addresses: await loadAddresses(uid), error: "Address not found." };
  }
  return { addresses: await loadAddresses(uid) };
}

export async function setDefaultAddress(uid: string, id: string): Promise<Address[]> {
  const db = getAdminSupabase();

  if (db) {
    await db.from("addresses").update({ is_default: false }).eq("user_id", uid);
    await db.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", uid);
  } else {
    await updateAdminData((draft) => {
      (draft.addresses[uid] ?? []).forEach((a) => { a.isDefault = a.id === id; });
    });
  }
  return loadAddresses(uid);
}

export async function deleteAddress(uid: string, id: string): Promise<Address[]> {
  const db = getAdminSupabase();
  const before = await loadAddresses(uid);
  const removed = before.find((a) => a.id === id);

  if (db) {
    await db.from("addresses").delete().eq("id", id).eq("user_id", uid);
  } else {
    await updateAdminData((draft) => {
      draft.addresses[uid] = (draft.addresses[uid] ?? []).filter((a) => a.id !== id);
    });
  }

  // Never leave the book without a default.
  const after = await loadAddresses(uid);
  if (removed?.isDefault && after.length) return setDefaultAddress(uid, after[0].id);
  return after;
}

/** One address belonging to this shopper, or undefined. Used at checkout so
 *  an order can only ship to an address its owner actually saved. */
export async function findAddress(uid: string, id: string): Promise<Address | undefined> {
  return (await loadAddresses(uid)).find((a) => a.id === id);
}
