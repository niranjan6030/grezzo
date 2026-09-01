"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { ALL_FITS, COLLECTIONS } from "@/lib/products";
import { describeBankOffer } from "@/lib/coupons";

import { useNow } from "@/lib/useNow";
import { useAdmin } from "./AdminProvider";
import { Button, Card, Empty, Field, Input, PanelHead, Pill, Select, rupees } from "./ui";

export default function CouponsPanel() {
  const { data, loading } = useAdmin();
  const [tab, setTab] = useState("coupons");

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
        title="Coupons & bank offers"
        sub="Codes shoppers type in, and card-linked discounts Razorpay applies at payment."
      />

      <div className="mb-8 flex gap-6 border-b border-line">
        {[
          ["coupons", "Coupon codes", Ticket],
          ["bank", "Bank & card offers", CreditCard],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tracked flex items-center gap-2 pb-3 ${
              tab === key ? "-mb-px border-b border-denim-deep" : "text-ink-soft"
            }`}
          >
            <Icon size={14} strokeWidth={1.5} /> {label}
            <span className="text-ink-soft">
              ({key === "coupons" ? (data?.coupons.length ?? 0) : (data?.bankOffers.length ?? 0)})
            </span>
          </button>
        ))}
      </div>

      {tab === "coupons" ? <Coupons /> : <BankOffers />}
    </>
  );
}

/* ====================================================================== */

const BLANK_COUPON = {
  code: "",
  description: "",
  kind: "percent",
  value: 10,
  minOrder: "",
  maxDiscount: "",
  scopeType: "all",
  scopeValue: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perUserLimit: "1",
  firstOrderOnly: false,
  active: true,
};

function Coupons() {
  const { data, catalogue, createCoupon, updateCoupon, deleteCoupon } = useAdmin();
  const [form, setForm] = useState(BLANK_COUPON);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const coupons = data?.coupons ?? [];
  const now = useNow();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const rupeesToPaise = (v) => (v.trim() === "" ? null : Math.round(Number(v) * 100));
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        code: form.code,
        description: form.description,
        kind: form.kind,
        value: form.kind === "flat" ? Math.round(Number(form.value) * 100) : Number(form.value),
        minOrderPaise: rupeesToPaise(form.minOrder) ?? 0,
        maxDiscountPaise: rupeesToPaise(form.maxDiscount),
        scope:
          form.scopeType === "all"
            ? { type: "all" }
            : { type: form.scopeType, value: form.scopeValue },
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        usageLimit: form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit) || 1,
        firstOrderOnly: form.firstOrderOnly,
        active: form.active,
      };
      await (form.id ? updateCoupon(payload) : createCoupon(payload));
      setForm(BLANK_COUPON);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the coupon.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (c) => {
    setForm({
      id: c.id,
      code: c.code,
      description: c.description,
      kind: c.kind,
      value: c.kind === "flat" ? c.value / 100 : c.value,
      minOrder: c.minOrderPaise ? String(c.minOrderPaise / 100) : "",
      maxDiscount: c.maxDiscountPaise ? String(c.maxDiscountPaise / 100) : "",
      scopeType: c.scope.type,
      scopeValue: "value" in c.scope ? c.scope.value : "",
      startsAt: c.startsAt ? c.startsAt.slice(0, 16) : "",
      endsAt: c.endsAt ? c.endsAt.slice(0, 16) : "",
      usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
      perUserLimit: String(c.perUserLimit),
      firstOrderOnly: c.firstOrderOnly,
      active: c.active,
    });
    setOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button
          onClick={() => {
            setForm(BLANK_COUPON);
            setOpen(true);
            setError(null);
          }}
        >
          <Plus size={14} strokeWidth={1.8} className="mr-2 inline" /> New coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <Empty>No coupon codes yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {coupons.map((c) => {
            const used = data?.couponUse[c.id]?.total ?? 0;
            const expired = now > 0 && c.endsAt !== null && Date.parse(c.endsAt) < now;
            const spent = c.usageLimit !== null && used >= c.usageLimit;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="tracked-lg text-base">{c.code}</p>
                    <p className="mt-2 text-sm">
                      {c.kind === "free_shipping"
                        ? "Free delivery"
                        : c.kind === "percent"
                          ? `${c.value}% off`
                          : `${rupees(c.value)} off`}
                      {c.maxDiscountPaise !== null && c.kind === "percent" && (
                        <span className="text-ink-soft"> up to {rupees(c.maxDiscountPaise)}</span>
                      )}
                      {c.minOrderPaise > 0 && (
                        <span className="text-ink-soft"> · min {rupees(c.minOrderPaise)}</span>
                      )}
                    </p>
                    {c.description && (
                      <p className="mt-1.5 text-xs text-ink-soft">{c.description}</p>
                    )}
                  </div>
                  <Pill tone={spent ? "bad" : expired ? "neutral" : c.active ? "good" : "warn"}>
                    {spent ? "Claimed" : expired ? "Expired" : c.active ? "Live" : "Paused"}
                  </Pill>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
                  <span>
                    Used {used}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                  </span>
                  <span>{c.perUserLimit} per shopper</span>
                  {c.firstOrderOnly && <span>First order only</span>}
                  {c.endsAt && <span>Ends {new Date(c.endsAt).toLocaleDateString("en-IN")}</span>}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={() => edit(c)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => updateCoupon({ id: c.id, active: !c.active })}
                  >
                    {c.active ? "Pause" : "Resume"}
                  </Button>
                  <button
                    onClick={() => deleteCoupon(c.id)}
                    aria-label="Delete coupon"
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

      <AnimatePresence>
        {open && (
          <Drawer
            title={form.id ? "Edit coupon" : "New coupon"}
            onClose={() => setOpen(false)}
            onSubmit={submit}
            busy={busy}
            error={error}
            submitLabel={form.id ? "Save coupon" : "Create coupon"}
          >
            <Field label="Code" hint="What the shopper types. Letters, numbers and hyphens.">
              <Input
                required
                value={form.code}
                placeholder="FIRST10"
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Description" hint="Shown in the bag once the code is applied.">
              <Input
                value={form.description}
                placeholder="10% off your first order"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                  <option value="free_shipping">Free delivery</option>
                </Select>
              </Field>
              {form.kind !== "free_shipping" && (
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
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum order (₹)" hint="Blank = no minimum">
                <Input
                  inputMode="numeric"
                  value={form.minOrder}
                  onChange={(e) =>
                    setForm({ ...form, minOrder: e.target.value.replace(/[^\d.]/g, "") })
                  }
                />
              </Field>
              <Field
                label="Max discount (₹)"
                hint={form.kind === "percent" ? "Required above 30%" : "Blank = no cap"}
              >
                <Input
                  inputMode="numeric"
                  value={form.maxDiscount}
                  onChange={(e) =>
                    setForm({ ...form, maxDiscount: e.target.value.replace(/[^\d.]/g, "") })
                  }
                />
              </Field>
            </div>

            <Field label="Applies to">
              <Select
                value={form.scopeType}
                onChange={(e) => setForm({ ...form, scopeType: e.target.value, scopeValue: "" })}
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
              <Field label="Total uses" hint="Blank = unlimited">
                <Input
                  inputMode="numeric"
                  value={form.usageLimit}
                  onChange={(e) =>
                    setForm({ ...form, usageLimit: e.target.value.replace(/\D/g, "") })
                  }
                />
              </Field>
              <Field label="Per shopper">
                <Input
                  inputMode="numeric"
                  value={form.perUserLimit}
                  onChange={(e) =>
                    setForm({ ...form, perUserLimit: e.target.value.replace(/\D/g, "") })
                  }
                />
              </Field>
            </div>

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

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.firstOrderOnly}
                onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
                className="mt-1 h-4 w-4 accent-[var(--denim-deep)]"
              />
              <span className="text-sm">
                First order only
                <span className="mt-0.5 block text-xs text-ink-soft">
                  Requires sign-in, since there is no other way to know whose first order it is.
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-[var(--denim-deep)]"
              />
              <span className="text-sm">Active</span>
            </label>
          </Drawer>
        )}
      </AnimatePresence>
    </>
  );
}

/* ====================================================================== */

const RAILS = [
  { id: "card", label: "Card" },
  { id: "upi", label: "UPI" },
  { id: "netbanking", label: "Net banking" },
  { id: "wallet", label: "Wallet" },
  { id: "emi", label: "EMI" },
  { id: "paylater", label: "Pay later" },
];

const BLANK_BANK = {
  bank: "",
  cardType: "both",
  network: "any",
  kind: "percent",
  value: 10,
  minOrder: "",
  maxDiscount: "",
  methods: ["card"],
  razorpayOfferId: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

function BankOffers() {
  const { data, createBankOffer, updateBankOffer, deleteBankOffer } = useAdmin();
  const [form, setForm] = useState(BLANK_BANK);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const offers = data?.bankOffers ?? [];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const rupeesToPaise = (v) => (v.trim() === "" ? null : Math.round(Number(v) * 100));
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        bank: form.bank,
        cardType: form.cardType,
        network: form.network,
        kind: form.kind,
        value: form.kind === "flat" ? Math.round(Number(form.value) * 100) : Number(form.value),
        minOrderPaise: rupeesToPaise(form.minOrder) ?? 0,
        maxDiscountPaise: rupeesToPaise(form.maxDiscount),
        methods: form.methods,
        razorpayOfferId: form.razorpayOfferId.trim() || null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        active: form.active,
      };
      await (form.id ? updateBankOffer(payload) : createBankOffer(payload));
      setForm(BLANK_BANK);
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
      bank: o.bank,
      cardType: o.cardType,
      network: o.network,
      kind: o.kind,
      value: o.kind === "flat" ? o.value / 100 : o.value,
      minOrder: o.minOrderPaise ? String(o.minOrderPaise / 100) : "",
      maxDiscount: o.maxDiscountPaise ? String(o.maxDiscountPaise / 100) : "",
      methods: o.methods,
      razorpayOfferId: o.razorpayOfferId ?? "",
      startsAt: o.startsAt ? o.startsAt.slice(0, 16) : "",
      endsAt: o.endsAt ? o.endsAt.slice(0, 16) : "",
      active: o.active,
    });
    setOpen(true);
    setError(null);
  };

  const toggleRail = (m) =>
    setForm((f) => ({
      ...f,
      methods: f.methods.includes(m) ? f.methods.filter((x) => x !== m) : [...f.methods, m],
    }));

  return (
    <>
      <Card className="mb-6 border-thread/40 bg-thread/8 p-5">
        <p className="tracked">How these are enforced</p>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
          Card details never reach our servers, so we cannot check whether a shopper is really
          paying with an HDFC credit card. Razorpay can. Create the matching Offer in the Razorpay
          dashboard, paste its id below, and the discount is applied against the real card at
          payment. Without an Offer id the entry still shows in the bag — clearly labelled as
          display-only — but nothing is deducted.
        </p>
      </Card>

      <div className="mb-6 flex justify-end">
        <Button
          onClick={() => {
            setForm(BLANK_BANK);
            setOpen(true);
            setError(null);
          }}
        >
          <Plus size={14} strokeWidth={1.8} className="mr-2 inline" /> New bank offer
        </Button>
      </div>

      {offers.length === 0 ? (
        <Card>
          <Empty>No bank or card offers yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {offers.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="tracked">{o.bank}</p>
                  <p className="mt-2 text-sm">{describeBankOffer(o)}</p>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {o.methods.join(", ")}
                    {o.minOrderPaise > 0 && ` · min ${rupees(o.minOrderPaise)}`}
                  </p>
                </div>
                <Pill tone={o.razorpayOfferId ? (o.active ? "good" : "warn") : "neutral"}>
                  {!o.razorpayOfferId ? "Display only" : o.active ? "Live" : "Paused"}
                </Pill>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => edit(o)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => updateBankOffer({ id: o.id, active: !o.active })}
                >
                  {o.active ? "Pause" : "Resume"}
                </Button>
                <button
                  onClick={() => deleteBankOffer(o.id)}
                  aria-label="Delete offer"
                  className="ml-auto p-2 text-ink-soft transition-colors hover:text-red-700"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <Drawer
            title={form.id ? "Edit bank offer" : "New bank offer"}
            onClose={() => setOpen(false)}
            onSubmit={submit}
            busy={busy}
            error={error}
            submitLabel={form.id ? "Save offer" : "Create offer"}
          >
            <Field label="Bank">
              <Input
                required
                value={form.bank}
                placeholder="HDFC Bank"
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Card type">
                <Select
                  value={form.cardType}
                  onChange={(e) => setForm({ ...form, cardType: e.target.value })}
                >
                  <option value="both">Credit and debit</option>
                  <option value="credit">Credit only</option>
                  <option value="debit">Debit only</option>
                </Select>
              </Field>
              <Field label="Network">
                <Select
                  value={form.network}
                  onChange={(e) => setForm({ ...form, network: e.target.value })}
                >
                  <option value="any">Any</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="rupay">RuPay</option>
                  <option value="amex">Amex</option>
                </Select>
              </Field>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum order (₹)">
                <Input
                  inputMode="numeric"
                  value={form.minOrder}
                  onChange={(e) =>
                    setForm({ ...form, minOrder: e.target.value.replace(/[^\d.]/g, "") })
                  }
                />
              </Field>
              <Field label="Max discount (₹)" hint="Required for percentage offers">
                <Input
                  inputMode="numeric"
                  value={form.maxDiscount}
                  onChange={(e) =>
                    setForm({ ...form, maxDiscount: e.target.value.replace(/[^\d.]/g, "") })
                  }
                />
              </Field>
            </div>

            <Field label="Payment methods" hint="Which rails this offer can apply to.">
              <div className="flex flex-wrap gap-2">
                {RAILS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRail(r.id)}
                    className={`tracked border px-3 py-2 transition-colors ${
                      form.methods.includes(r.id)
                        ? "border-denim-deep bg-denim-deep text-white"
                        : "border-line hover:border-denim-deep"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Razorpay Offer id"
              hint="From Razorpay dashboard → Offers. Blank makes this display-only."
            >
              <Input
                value={form.razorpayOfferId}
                placeholder="offer_XXXXXXXXXXXX"
                onChange={(e) => setForm({ ...form, razorpayOfferId: e.target.value })}
              />
            </Field>

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
          </Drawer>
        )}
      </AnimatePresence>
    </>
  );
}

/* ====================================================================== */

function Drawer({ title, children, onClose, onSubmit, busy, error, submitLabel }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-denim-raw/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.form
        onSubmit={onSubmit}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-denim-paper"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="border-b border-line bg-white px-6 py-5">
          <p className="tracked-lg text-lg">{title}</p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-7">
          {children}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-line bg-white px-6 py-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </motion.form>
    </>
  );
}
