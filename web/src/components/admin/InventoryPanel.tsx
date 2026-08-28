"use client";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Save } from "lucide-react";
import { DEFAULT_DEPTH_CLIENT, skuFor } from "@/lib/skus";
import { useAdmin } from "./AdminProvider";
import { Button, Card, Empty, Input, PanelHead, Pill, Select } from "./ui";

const LOW = 4;

export default function InventoryPanel() {
  const { catalogue, data, loading, saveStock } = useAdmin();
  const [productId, setProductId] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("10");

  const product = catalogue.find((p) => p.id === productId) ?? catalogue[0];


  const grid = useMemo(() => {
    const stock = data?.stock ?? {};
    if (!product) return [];
    return product.colours.map((c) => ({
      colour: c,
      cells: product.sizes.map((size) => {
        const sku = skuFor(product.id, c.code, size);
        return { sku, size, qty: stock[sku] ?? DEFAULT_DEPTH_CLIENT };
      }),
    }));
  }, [product, data]);

  const dirty = Object.keys(draft).length > 0;

  const commit = async (mode: "set" | "receive") => {
    if (!dirty && mode === "set") return;
    setBusy(true);
    setNote(null);
    try {
      const updates = Object.entries(draft)
        .map(([sku, v]) => ({ sku, qty: Math.round(Number(v)) }))
        .filter((u) => Number.isFinite(u.qty));
      await saveStock(updates, mode);
      setDraft({});
      setNote(`${updates.length} SKU${updates.length === 1 ? "" : "s"} updated.`);
      setTimeout(() => setNote(null), 2500);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  /** Book the same quantity into every size of this product at once. */
  const receiveAll = async () => {
    if (!product) return;
    const qty = Math.round(Number(receiveQty));
    if (!Number.isFinite(qty) || qty === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const updates = product.colours.flatMap((c) =>
        product.sizes.map((size) => ({ sku: skuFor(product.id, c.code, size), qty })));
      await saveStock(updates, "receive");
      setNote(`Booked in ${qty} per size across ${product.colours.length} colourways.`);
      setTimeout(() => setNote(null), 3000);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
    </div>;
  }
  if (!product) return <Card><Empty>No products to stock.</Empty></Card>;

  return (
    <>
      <PanelHead
        title="Inventory"
        sub="Units on hand per colour and size. Checkout holds stock for 15 minutes before payment, so these numbers already exclude anything reserved."
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-64">
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">Product</span>
          <Select className="mt-2" value={product.id} onChange={(e) => { setProductId(e.target.value); setDraft({}); }}>
            {catalogue.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <div className="w-28">
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">Book in</span>
            <Input className="mt-2" value={receiveQty} inputMode="numeric"
                   onChange={(e) => setReceiveQty(e.target.value.replace(/[^\d-]/g, ""))} />
          </div>
          <Button variant="outline" onClick={receiveAll} disabled={busy}>
            <PackagePlus size={14} strokeWidth={1.6} className="mr-2 inline" />
            Add to every size
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">
              <th className="px-5 py-3.5 font-normal">Colourway</th>
              {product.sizes.map((s) => (
                <th key={s} className="px-3 py-3.5 text-center font-normal">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {grid.map(({ colour, cells }) => (
              <tr key={colour.code}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-4 w-4 shrink-0 rounded-full border border-line"
                          style={{ background: `linear-gradient(135deg, ${colour.ramp[2]}, ${colour.ramp[1]} 55%, ${colour.ramp[0]})` }} />
                    <span className="whitespace-nowrap">{colour.wash}</span>
                  </div>
                </td>
                {cells.map((cell) => {
                  const value = draft[cell.sku] ?? String(cell.qty);
                  const n = Number(value);
                  const tone = n === 0 ? "border-red-300 bg-red-50"
                    : n <= LOW ? "border-thread/50 bg-thread/10"
                    : "border-line";
                  return (
                    <td key={cell.sku} className="px-2 py-2">
                      <input
                        value={value}
                        inputMode="numeric"
                        aria-label={`${colour.wash} size ${cell.size}`}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [cell.sku]: e.target.value.replace(/[^\d]/g, "") }))}
                        className={`w-14 border px-2 py-2 text-center tabular-nums outline-none transition-colors focus:border-denim-deep ${tone}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={() => commit("set")} disabled={!dirty || busy}>
          {busy ? <><Loader2 size={13} className="mr-2 inline animate-spin" /> Saving</>
                : <><Save size={13} strokeWidth={1.7} className="mr-2 inline" /> Save counts</>}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft({})}>Discard changes</Button>
        )}
        {note && <span className="text-sm text-ink-soft">{note}</span>}
        <span className="ml-auto flex items-center gap-3 text-xs text-ink-soft">
          <Pill tone="warn">≤ {LOW} low</Pill>
          <Pill tone="bad">0 out of stock</Pill>
        </span>
      </div>
    </>
  );
}
