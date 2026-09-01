"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ALL_FITS, COLLECTIONS } from "@/lib/products";
import { offerActive } from "@/lib/catalogue";

import { useNow } from "@/lib/useNow";
import { useAdmin } from "./AdminProvider";
import { Button, Card, Empty, Field, Input, PanelHead, Pill, Select, rupees } from "./ui";

const BLANK = {
  name: "",
  kind: "percent",
  value: 20,
  scopeType: "all",
  scopeValue: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

export default function OffersPanel() {
  const { data, catalogue, loading, createOffer, updateOffer, deleteOffer } = useAdmin();
  const [form, setForm] = useState(BLANK);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const offers = data?.offers ?? [];
  const now = useNow();

  /** How many products each offer is actually touching right now. */
  const reach = useMemo(() => {
    const map = new Map();
    for (const p of catalogue) if (p.offer) map.set(p.offer.id, (map.get(p.offer.id) ?? 0) + 1);
    return map;
  }, [catalogue]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      kind: form.kind,
      value: form.kind === "flat" ? Math.round(Number(form.value) * 100) : Number(form.value),
      scope:
        form.scopeType === "all"
          ? { type: "all" }
          : { type: form.scopeType, value: form.scopeValue },
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      active: form.active,
    };
    try {
      await (form.id ? updateOffer(payload) : createOffer(payload));
      setForm(BLANK);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the offer.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (o) => {
    setForm({
      id: o.id,
      name: o.name,
      kind: o.kind,
      value: o.kind === "flat" ? o.value / 100 : o.value,
      scopeType: o.scope.type,
      scopeValue: "value" in o.scope ? o.scope.value : "",
      startsAt: o.startsAt ? o.startsAt.slice(0, 16) : "",
      endsAt: o.endsAt ? o.endsAt.slice(0, 16) : "",
      active: o.active,
    });
    setOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <>
      <PanelHead
        title="Offers"
        sub="Discounts applied automatically at checkout. Only the deepest offer applies to any one product — they never stack."
        action={
          <Button
            onClick={() => {
              setForm(BLANK);
              setOpen(true);
              setError(null);
            }}
          >
            <Plus size={14} strokeWidth={1.8} className="mr-2 inline" /> New offer
          </Button>
        }
      />

      {offers.length === 0 ? (
        <Card>
          <Empty>No offers yet. Create one and it applies the moment it saves.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {offers.map((o) => {
            const live = now > 0 && offerActive(o, now);
            return (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="tracked">{o.name}</p>
                    <p className="mt-2 text-sm">
                      {o.kind === "percent" ? `${o.value}% off` : `${rupees(o.value)} off`}
                      <span className="text-ink-soft"> · {describeScope(o.scope)}</span>
                    </p>
                  </div>
                  <Pill tone={live ? "good" : "neutral"}>
                    {live ? "Live" : o.active ? "Scheduled" : "Paused"}
                  </Pill>
                </div>

                <p className="mt-3 text-xs text-ink-soft">
                  {o.startsAt
                    ? `From ${new Date(o.startsAt).toLocaleString("en-IN")}`
                    : "Started immediately"}
                  {o.endsAt
                    ? ` · until ${new Date(o.endsAt).toLocaleString("en-IN")}`
                    : " · no end date"}
                </p>
                <p className="mt-1.5 text-xs text-ink-soft">
                  Currently reducing {reach.get(o.id) ?? 0} product
                  {(reach.get(o.id) ?? 0) === 1 ? "" : "s"}.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={() => edit(o)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => updateOffer({ id: o.id, active: !o.active })}
                  >
                    {o.active ? "Pause" : "Resume"}
                  </Button>
                  <button
                    onClick={() => deleteOffer(o.id)}
                    aria-label="Delete offer"
                    className="ml-auto p-2 text-ink-soft transition-colors hover:text-red-700"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---- create / edit ---- */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-denim-raw/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.form
              onSubmit={submit}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-denim-paper"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="border-b border-line bg-white px-6 py-5">
                <p className="tracked-lg text-lg">{form.id ? "Edit offer" : "New offer"}</p>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-7">
                <Field label="Name" hint="Shown on the product card, so write it for shoppers.">
                  <Input
                    required
                    value={form.name}
                    placeholder="Mid-season 20%"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Type">
                    <Select
                      value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    >
                      <option value="percent">Percentage off</option>
                      <option value="flat">Fixed amount off</option>
                    </Select>
                  </Field>
                  <Field label={form.kind === "percent" ? "Percent" : "Amount (₹)"}>
                    <Input
                      required
                      inputMode="numeric"
                      value={String(form.value)}
                      onChange={(e) =>
                        setForm({ ...form, value: Number(e.target.value.replace(/[^\d.]/g, "")) })
                      }
                    />
                  </Field>
                </div>

                <Field label="Applies to">
                  <Select
                    value={form.scopeType}
                    onChange={(e) =>
                      setForm({ ...form, scopeType: e.target.value, scopeValue: "" })
                    }
                  >
                    <option value="all">Everything</option>
                    <option value="collection">One collection</option>
                    <option value="fit">One fit</option>
                    <option value="product">One product</option>
                  </Select>
                </Field>

                {form.scopeType !== "all" && (
                  <Field label="Which one">
                    <Select
                      required
                      value={form.scopeValue}
                      onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      {form.scopeType === "collection" &&
                        COLLECTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      {form.scopeType === "fit" &&
                        ALL_FITS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      {form.scopeType === "product" &&
                        catalogue.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Starts" hint="Blank = now">
                    <Input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    />
                  </Field>
                  <Field label="Ends" hint="Blank = no end">
                    <Input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    />
                  </Field>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--denim-deep)]"
                  />
                  <span className="text-sm">Active</span>
                </label>

                {error && <p className="text-sm text-red-700">{error}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-line bg-white px-6 py-5">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : form.id ? "Save offer" : "Create offer"}
                </Button>
              </div>
            </motion.form>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function describeScope(s) {
  switch (s.type) {
    case "all":
      return "everything";
    case "collection":
      return `the ${s.value} collection`;
    case "fit":
      return `${s.value} fits`;
    case "product":
      return "one product";
  }
}
