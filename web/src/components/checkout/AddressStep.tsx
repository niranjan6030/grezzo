"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { INDIAN_STATES } from "@/lib/india";
import type { Address } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useCheckout } from "@/store/useCheckout";
import { useStore } from "@/store/useStore";

const BLANK = {
  label: "Home", name: "", phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "",
};

export default function AddressStep() {
  const router = useRouter();
  const { ready, user, configured } = useAuth();
  const cart = useStore((s) => s.cart);
  const deselected = useStore((s) => s.deselected);
  const { addressId, setAddressId } = useCheckout();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [form, setForm] = useState<typeof BLANK & { id?: string }>(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Keyed by the pincode it describes, so the status below can be derived
     rather than pushed in from the effect — a stale result for a pincode
     that has since been retyped simply stops matching. */
  const [pinResult, setPinResult] = useState<
    { pincode: string; found: boolean; localities: string[] } | null
  >(null);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;

    fetch("/api/addresses")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load your addresses.");
        if (!cancelled) setAddresses(json.addresses);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load your addresses.");
        setAddresses([]);
      });

    return () => { cancelled = true; };
  }, [ready, user]);

  /* The chosen address is derived rather than stored, so an id left over from
     a deleted address quietly falls back to the default instead of leaving
     the step stuck on nothing. */
  const chosenId =
    addressId && addresses?.some((a) => a.id === addressId)
      ? addressId
      : addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;

  // With an empty book there is nothing to choose from, so open the form.
  const formOpen = showForm || addresses?.length === 0;

  /* A pincode already encodes the city and the state, so asking someone to
     type them again is asking them to make a mistake. India Post's free API
     fills them in; if it is unreachable the fields simply stay editable. */
  useEffect(() => {
    const pincode = form.pincode;
    if (pincode.length !== 6) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pincode/${pincode}`);
        const json = await res.json();
        if (cancelled) return;

        setPinResult({
          pincode,
          found: Boolean(json.found),
          localities: json.localities ?? [],
        });

        if (json.found) {
          // Never overwrite something already typed — a correction beats a guess.
          setForm((f) => ({
            ...f,
            city: f.city.trim() ? f.city : json.city ?? "",
            state: f.state.trim() ? f.state : json.state ?? "",
          }));
        }
      } catch {
        if (!cancelled) setPinResult({ pincode, found: false, localities: [] });
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.pincode]);

  const matched = pinResult?.pincode === form.pincode ? pinResult : null;
  const lookup = {
    state: form.pincode.length !== 6
      ? ("idle" as const)
      : !matched
        ? ("checking" as const)
        : matched.found ? ("found" as const) : ("missing" as const),
    localities: matched?.found ? matched.localities : [],
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save that address.");
      setAddresses(json.addresses);
      if (!form.id) {
        const added = json.addresses[json.addresses.length - 1];
        if (added) setAddressId(added.id);
      }
      setForm(BLANK);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that address.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch("/api/addresses", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    setAddresses(json.addresses);
    if (addressId === id) setAddressId(null);   // falls back to the default
  };

  const edit = (a: Address) => {
    setForm({
      id: a.id, label: a.label, name: a.name, phone: a.phone, line1: a.line1,
      line2: a.line2 ?? "", city: a.city, state: a.state, pincode: a.pincode,
    });
    setShowForm(true);
    setError(null);
  };

  /* ---- gates ---- */

  const selectedCount = cart.filter(
    (l) => !deselected.includes(`${l.productId}|${l.colour}|${l.size}`)).length;

  if (!ready) {
    return <Centered><Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} /></Centered>;
  }

  if (selectedCount === 0) {
    return (
      <Centered>
        <p className="tracked-lg text-2xl">Nothing selected</p>
        <Link href="/cart" className="tracked mt-8 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white">
          Back to the bag
        </Link>
      </Centered>
    );
  }

  if (!configured) {
    return (
      <Centered>
        <p className="tracked-lg text-2xl">Sign-in not connected</p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
          Checkout keeps your addresses and lets you track orders, so it needs an
          account. Add the Firebase configuration — README section 1 — to switch
          it on.
        </p>
      </Centered>
    );
  }

  if (!user) {
    return (
      <Centered>
        <p className="tracked-lg text-2xl">Sign in to continue</p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
          We keep your delivery addresses and order history against your account,
          so you only type them once.
        </p>
        <Link href="/account?next=/checkout/address"
              className="tracked mt-8 bg-denim-deep px-10 py-3.5 text-white transition-colors hover:bg-denim-mid">
          Sign in
        </Link>
      </Centered>
    );
  }

  if (addresses === null) {
    return <Centered><Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} /></Centered>;
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h1 className="tracked-lg text-2xl md:text-3xl">Where is it going?</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Save as many addresses as you like and pick one per order.
        </p>

        {/* ---- saved addresses ---- */}
        <div className="mt-8 space-y-3">
          {addresses.map((a) => (
            <label key={a.id}
                   className={`flex cursor-pointer items-start gap-4 border p-5 transition-colors ${
                     chosenId === a.id ? "border-denim-deep" : "border-line hover:border-denim-light"}`}>
              <input type="radio" name="address" checked={chosenId === a.id}
                     onChange={() => setAddressId(a.id)}
                     className="mt-1 h-4 w-4 shrink-0 accent-[var(--denim-deep)]" />
              <div className="min-w-0 flex-1">
                <p className="tracked flex flex-wrap items-center gap-2">
                  {a.label}
                  {a.isDefault && (
                    <span className="bg-denim-wash px-2 py-0.5 text-[0.55rem] text-ink-soft">Default</span>
                  )}
                </p>
                <p className="mt-2 text-sm">{a.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                </p>
                <p className="mt-1 text-xs text-ink-soft">{a.phone}</p>

                <div className="mt-3 flex flex-wrap gap-4">
                  <button type="button" onClick={() => edit(a)}
                          className="tracked flex items-center gap-1.5 text-ink-soft seam-link">
                    <Pencil size={12} strokeWidth={1.6} /> Edit
                  </button>
                  {!a.isDefault && (
                    <>
                      <button type="button"
                              onClick={() => fetch("/api/addresses", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id: a.id, makeDefault: true }),
                              }).then((r) => r.json()).then((j) => setAddresses(j.addresses))}
                              className="tracked text-ink-soft seam-link">
                        Make default
                      </button>
                      <button type="button" onClick={() => remove(a.id)}
                              className="tracked flex items-center gap-1.5 text-ink-soft transition-colors hover:text-red-700">
                        <Trash2 size={12} strokeWidth={1.6} /> Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* ---- add / edit ---- */}
        {!formOpen ? (
          <button onClick={() => { setForm(BLANK); setShowForm(true); }}
                  className="tracked mt-4 flex w-full items-center justify-center gap-2 border border-dashed border-denim-light py-4 text-denim-mid transition-colors hover:border-denim-deep">
            <Plus size={15} strokeWidth={1.6} /> Add a new address
          </button>
        ) : (
          <AnimatePresence>
            <motion.form onSubmit={save}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 overflow-hidden border border-line p-6"
            >
              <p className="tracked mb-5">{form.id ? "Edit address" : "New address"}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input v={form.label} set={(v) => setForm({ ...form, label: v })} ph="LABEL — HOME, OFFICE" />
                <Input v={form.name} set={(v) => setForm({ ...form, name: v })} ph="FULL NAME" required />
                <Input v={form.phone} set={(v) => setForm({ ...form, phone: v })} ph="CONTACT NUMBER" required type="tel" />

                {/* Pincode leads, because it fills in the two fields below it. */}
                <div className="relative">
                  <Input v={form.pincode}
                         set={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })}
                         ph="PINCODE" required inputMode="numeric" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lookup.state === "checking" && (
                      <Loader2 size={14} className="animate-spin text-ink-soft" strokeWidth={1.5} />
                    )}
                    {lookup.state === "found" && (
                      <Check size={14} className="text-denim-mid" strokeWidth={2} />
                    )}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <Input v={form.line1} set={(v) => setForm({ ...form, line1: v })} ph="FLAT / HOUSE, STREET" required />
                </div>

                {/* Localities for this pincode, once we know them. */}
                {/* A datalist, not a select: the localities are suggestions, and
                    plenty of real addresses use a landmark that is on no list. */}
                <div className="sm:col-span-2">
                  <input
                    value={form.line2}
                    onChange={(e) => setForm({ ...form, line2: e.target.value })}
                    list={lookup.localities.length ? "grezzo-localities" : undefined}
                    placeholder="AREA, LANDMARK (OPTIONAL)"
                    className="field w-full border border-line px-4 py-3 outline-none focus:border-denim-deep"
                  />
                  {lookup.localities.length > 0 && (
                    <datalist id="grezzo-localities">
                      {lookup.localities.map((l) => <option key={l} value={l} />)}
                    </datalist>
                  )}
                  {lookup.localities.length > 1 && (
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {lookup.localities.length} localities found for this pincode — start
                      typing to pick one.
                    </p>
                  )}
                </div>

                <Input v={form.city} set={(v) => setForm({ ...form, city: v })} ph="CITY" required />

                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  required
                  className={`field w-full cursor-pointer border px-4 py-3 outline-none focus:border-denim-deep ${
                    form.state ? "border-line" : "border-line text-ink-soft"}`}
                >
                  <option value="">State or union territory</option>
                  {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              {lookup.state === "missing" && form.pincode.length === 6 && (
                <p className="mt-3 text-xs text-ink-soft">
                  We could not look that pincode up — fill in the city and state yourself
                  and the order will be fine.
                </p>
              )}

              {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

              <div className="mt-5 flex gap-3">
                <button type="submit" disabled={busy}
                        className="tracked flex items-center gap-2 bg-denim-deep px-8 py-3 text-white transition-colors hover:bg-denim-mid disabled:opacity-50">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {form.id ? "Save address" : "Add address"}
                </button>
                {addresses.length > 0 && (
                  <button type="button" onClick={() => { setShowForm(false); setError(null); }}
                          className="tracked border border-denim-deep px-8 py-3 transition-colors hover:bg-denim-wash">
                    Cancel
                  </button>
                )}
              </div>
            </motion.form>
          </AnimatePresence>
        )}
      </div>

      {/* ---- continue ---- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="denim-weave-light p-7">
          <p className="tracked flex items-center gap-2 border-b border-line pb-4">
            <MapPin size={14} strokeWidth={1.5} /> Delivering to
          </p>
          {chosenId && addresses.find((a) => a.id === chosenId) ? (
            <div className="mt-4 text-sm leading-relaxed">
              {(() => {
                const a = addresses.find((x) => x.id === chosenId)!;
                return (
                  <>
                    <p>{a.name}</p>
                    <p className="mt-1 text-ink-soft">
                      {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                    </p>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">Choose or add an address to continue.</p>
          )}

          <button
            onClick={() => { setAddressId(chosenId); router.push("/checkout/review"); }}
            disabled={!chosenId}
                  className="tracked mt-6 flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-40">
            Continue to review <ArrowRight size={15} strokeWidth={1.5} />
          </button>

          <Link href="/cart" className="tracked mt-4 block text-center text-ink-soft seam-link">
            Back to the bag
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Input({ v, set, ph, required, type = "text", inputMode }: {
  v: string; set: (v: string) => void; ph: string; required?: boolean;
  type?: string; inputMode?: "numeric" | "tel" | "text" | "email";
}) {
  return (
    <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph}
           required={required} type={type} inputMode={inputMode}
           className="field w-full border border-line px-4 py-3 outline-none focus:border-denim-deep" />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      {children}
    </div>
  );
}
