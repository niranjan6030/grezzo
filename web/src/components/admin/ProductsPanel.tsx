"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronUp, ImagePlus, Loader2, Plus,
  RotateCcw, Ruler, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { WASH_NAMES, WASH_RAMP } from "@/lib/products";
import { downscaleImage } from "@/lib/downscale";
import type { MergedProduct } from "@/lib/admin/types";
import type { Colourway, Fit, Rise, Wash } from "@/lib/types";
import ProductImage from "@/components/ProductImage";
import { useAdmin } from "./AdminProvider";
import { Button, Card, Empty, Field, Input, PanelHead, Pill, Select, Textarea, rupees } from "./ui";

interface GarmentRead {
  fit: { value: string; confidence: number; alternatives: { value: string; confidence: number }[] };
  rise: { value: string; confidence: number; alternatives: { value: string; confidence: number }[] };
  wash: { value: string; confidence: number; alternatives: { value: string; confidence: number }[] };
}

const FIT_OPTIONS: Fit[] = ["Skinny", "Slim", "Tapered", "Straight", "Regular",
                            "Bootcut", "Relaxed", "Wide Leg", "Baggy"];
const RISE_OPTIONS: Rise[] = ["Low", "Mid", "High"];

export default function ProductsPanel() {
  const { catalogue, loading, data } = useAdmin();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalogue;
    return catalogue.filter((p) =>
      [p.name, p.fit, p.wash, p.collection, ...p.tags].join(" ").toLowerCase().includes(needle));
  }, [catalogue, q]);

  const product = catalogue.find((p) => p.id === editing) ?? null;

  return (
    <>
      <PanelHead title="Products"
                 sub="Prices, descriptions, colourways and photography. Changes go live immediately." />

      <div className="relative mb-6 max-w-md">
        <Search size={15} strokeWidth={1.4}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
               placeholder="Search products" />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
        </div>
      ) : rows.length === 0 ? (
        <Card><Empty>Nothing matches that search.</Empty></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Card key={p.id} className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-[0_2px_14px_rgba(16,22,31,0.07)]"
                  >
              <div onClick={() => setEditing(p.id)}>
                <div className="denim-weave-light aspect-[4/3] overflow-hidden">
                  <ProductImage product={p} className="h-full w-full" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="tracked">{p.name}</p>
                    {data?.products[p.id] && <Pill>Edited</Pill>}
                  </div>
                  <p className="mt-2 text-sm tabular-nums">
                    {rupees(p.pricePaise)}
                    {p.comparePaise && (
                      <span className="ml-2 text-ink-soft line-through">{rupees(p.comparePaise)}</span>
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5">
                    {p.colours.map((c) => (
                      <span key={c.code} className="h-4 w-4 rounded-full border border-line"
                            title={c.wash}
                            style={{ background: `linear-gradient(135deg, ${c.ramp[2]}, ${c.ramp[1]} 55%, ${c.ramp[0]})` }} />
                    ))}
                    <span className="ml-1 text-xs text-ink-soft">
                      {p.colours.length} colour{p.colours.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {p.offer && <p className="mt-3 text-xs text-denim-mid">Offer: {p.offer.name}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {product && <Editor key={product.id} product={product} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </>
  );
}

/* ====================================================================== */

function Editor({ product, onClose }: { product: MergedProduct; onClose: () => void }) {
  const { saveProduct, resetProduct, data } = useAdmin();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product.name);
  const [story, setStory] = useState(product.story);
  const [fabric, setFabric] = useState(product.fabric);
  const [tags, setTags] = useState(product.tags.join(", "));
  // An offer may already have reduced the shown price, so the field edits the
  // pre-offer figure. The drawer is keyed on product id, so this re-initialises
  // whenever a different product is opened.
  const basePaise = product.offer?.wasPaise ?? product.pricePaise;
  const [price, setPrice] = useState(String(Math.round(basePaise / 100)));
  const [compare, setCompare] = useState(
    product.comparePaise ? String(Math.round(product.comparePaise / 100)) : "");
  const [colours, setColours] = useState<Colourway[]>(product.colours);
  const [fit, setFit] = useState<Fit>(product.fit);
  const [rise, setRise] = useState<Rise>(product.rise);
  const [reading, setReading] = useState(false);
  const [readOut, setReadOut] = useState<GarmentRead | null>(null);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const unused = WASH_NAMES.filter((w) => !colours.some((c) => c.wash === w));

  const addColour = (wash: Wash) => {
    setColours((cs) => [...cs, {
      code: wash.toLowerCase().replace(/\s+/g, "-"),
      wash,
      ramp: WASH_RAMP[wash],
    }]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setColours((cs) => {
      const next = [...cs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const pickPhoto = (code: string) => {
    setUploadFor(code);
    fileInput.current?.click();
  };

  const onFile = async (file: File) => {
    if (!uploadFor) return;
    setError(null);
    try {
      const dataUrl = await downscaleImage(file);
      setPhotos((p) => ({ ...p, [uploadFor]: dataUrl }));
    } catch {
      setError("Could not read that image file.");
    } finally {
      setUploadFor(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const rupeesToPaise = (v: string) => Math.round(Number(v) * 100);
      if (!Number.isFinite(rupeesToPaise(price))) throw new Error("Price is not a number.");

      await saveProduct(product.id, {
        name,
        story,
        fabric,
        fit,
        rise,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        pricePaise: rupeesToPaise(price),
        comparePaise: compare.trim() === "" ? null : rupeesToPaise(compare),
        colours,
        ...(Object.keys(photos).length ? { photos } : {}),
      });
      setPhotos({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await resetProduct(product.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  /* Reads the cut, rise and wash off the uploaded photograph. The flat is
     then drawn from those attributes rather than generated as an image —
     a spec drawing has to be exact, and a generative model invents seams. */
  const readPhoto = async (dataUrl: string) => {
    setReading(true);
    setReadOut(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/analyse-garment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not read that photo.");
      setReadOut(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that photo.");
    } finally {
      setReading(false);
    }
  };

  const applyRead = () => {
    if (!readOut) return;
    setFit(readOut.fit.value as Fit);
    setRise(readOut.rise.value as Rise);
    // The wash becomes the leading colourway, so the plate matches the photo.
    const wash = readOut.wash.value as Wash;
    const code = wash.toLowerCase().replace(/\s+/g, "-");
    setColours((cs) => {
      const existing = cs.find((c) => c.code === code);
      const rest = cs.filter((c) => c.code !== code);
      return [existing ?? { code, wash, ramp: WASH_RAMP[wash] }, ...rest];
    });
    setReadOut(null);
  };

  const photoFor = (code: string) =>
    photos[code] !== undefined
      ? photos[code]
      : product.colours.find((c) => c.code === code)?.photo ?? null;

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-denim-raw/30"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={onClose} />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-denim-paper"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <p className="tracked-lg text-lg">{product.name}</p>
            <p className="mt-1.5 text-xs text-ink-soft">
              {product.id} · {product.fit} · {product.collection}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={20} strokeWidth={1.3} /></button>
        </div>

        <div className="flex-1 space-y-9 overflow-y-auto px-6 py-7">
          {/* ---- basics ---- */}
          <section className="space-y-5">
            <p className="tracked text-ink-soft">Details</p>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description" hint="Shown on the product page under the price.">
              <Textarea rows={4} value={story} onChange={(e) => setStory(e.target.value)} />
            </Field>
            <Field label="Composition">
              <Input value={fabric} onChange={(e) => setFabric(e.target.value)} />
            </Field>
            <Field label="Tags" hint="Comma separated. These feed search and the recommender.">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
          </section>

          {/* ---- pricing ---- */}
          <section>
            <p className="tracked mb-4 text-ink-soft">Pricing</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (₹)">
                <Input value={price} inputMode="numeric"
                       onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Field label="Compare at (₹)" hint="Leave blank for no strike-through.">
                <Input value={compare} inputMode="numeric"
                       onChange={(e) => setCompare(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
            </div>
            {product.offer && (
              <p className="mt-3 text-xs text-denim-mid">
                “{product.offer.name}” is currently reducing this to {rupees(product.pricePaise)}.
                The figure above is the price before the offer.
              </p>
            )}
          </section>

          {/* ---- technical drawing ---- */}
          <section>
            <p className="tracked mb-4 flex items-center gap-2 text-ink-soft">
              <Ruler size={13} strokeWidth={1.6} /> Technical drawing
            </p>

            <Card className="p-4">
              <div className="flex gap-5">
                <div className="w-28 shrink-0 border border-line bg-white">
                  {/* Drawn live from the values below, so it is always in step. */}
                  <ProductImage
                    product={{ ...product, fit, rise, colours }}
                    flat
                    className="h-full w-full"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-ink-soft">
                    The flat is drawn from the cut and the rise, so it is exact by
                    construction. Set them by hand, or let the AI read them off a
                    photograph you have uploaded below.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Fit">
                      <Select value={fit} onChange={(e) => setFit(e.target.value as Fit)}>
                        {FIT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </Field>
                    <Field label="Rise">
                      <Select value={rise} onChange={(e) => setRise(e.target.value as Rise)}>
                        {RISE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </Field>
                  </div>

                  {(() => {
                    const source = colours.map((c) => photoFor(c.code)).find(Boolean);
                    return (
                      <div className="mt-4">
                        <Button variant="outline" disabled={!source || reading}
                                onClick={() => source && readPhoto(source)}>
                          {reading
                            ? <><Loader2 size={13} className="mr-2 inline animate-spin" /> Reading the photo…</>
                            : <><Sparkles size={13} strokeWidth={1.7} className="mr-2 inline" /> Read from photo</>}
                        </Button>
                        {!source && (
                          <p className="mt-2 text-xs text-ink-soft">
                            Upload a product photo below first.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {readOut && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="tracked mb-3">What the model saw</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([["Fit", readOut.fit], ["Rise", readOut.rise], ["Wash", readOut.wash]] as const)
                      .map(([label, r]) => (
                        <div key={label}>
                          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
                          <p className="mt-1.5 text-sm">{r.value}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {Math.round(r.confidence * 100)}% confident
                          </p>
                          {r.confidence < 0.5 && r.alternatives[0] && (
                            <p className="mt-1 text-xs text-ink-soft">
                              or {r.alternatives[0].value}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-ink-soft">
                    Weight, stretch and composition are not listed because they cannot
                    be seen in a photograph — those stay yours to enter.
                  </p>

                  <div className="mt-4 flex gap-3">
                    <Button onClick={applyRead}>Apply to this product</Button>
                    <Button variant="ghost" onClick={() => setReadOut(null)}>Discard</Button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* ---- colourways ---- */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="tracked text-ink-soft">Colours &amp; photography</p>
              <span className="text-xs text-ink-soft">First colour is the one shown in listings</span>
            </div>

            <div className="space-y-3">
              {colours.map((c, i) => {
                const photo = photoFor(c.code);
                return (
                  <Card key={c.code} className="flex items-center gap-4 p-3">
                    <div className="denim-weave-light h-20 w-20 shrink-0 overflow-hidden">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt={c.wash} className="h-full w-full object-cover" />
                      ) : (
                        <ProductImage product={{ ...product, colours: [c] }} colour={c}
                                      className="h-full w-full" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="tracked">{c.wash}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {photo ? "Photograph uploaded" : "Drawn from the wash — upload a photo to replace it"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button onClick={() => pickPhoto(c.code)}
                                className="tracked flex items-center gap-1.5 text-denim-mid seam-link">
                          <ImagePlus size={13} strokeWidth={1.5} /> {photo ? "Replace" : "Upload"}
                        </button>
                        {photo && (
                          <button onClick={() => setPhotos((p) => ({ ...p, [c.code]: null }))}
                                  className="tracked text-ink-soft seam-link">Remove photo</button>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                              className="p-1 disabled:opacity-25"><ChevronUp size={15} strokeWidth={1.5} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === colours.length - 1}
                              aria-label="Move down"
                              className="p-1 disabled:opacity-25"><ChevronDown size={15} strokeWidth={1.5} /></button>
                    </div>

                    <button
                      onClick={() => setColours((cs) => cs.filter((x) => x.code !== c.code))}
                      disabled={colours.length === 1}
                      aria-label="Remove colour"
                      className="shrink-0 p-1 text-ink-soft transition-colors hover:text-red-700 disabled:opacity-25"
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </Card>
                );
              })}
            </div>

            {unused.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <Select defaultValue="" className="w-auto"
                        onChange={(e) => { if (e.target.value) { addColour(e.target.value as Wash); e.target.value = ""; } }}>
                  <option value="">Add a colourway…</option>
                  {unused.map((w) => <option key={w} value={w}>{w}</option>)}
                </Select>
                <Plus size={15} strokeWidth={1.5} className="text-ink-soft" />
              </div>
            )}

            <input ref={fileInput} type="file" accept="image/*" className="hidden"
                   onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </section>

          {data?.products[product.id] && (
            <section>
              <p className="tracked mb-3 text-ink-soft">Revert</p>
              <Button variant="danger" onClick={reset} disabled={busy}>
                <RotateCcw size={13} strokeWidth={1.6} className="mr-2 inline" />
                Discard all edits to this product
              </Button>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line bg-white px-6 py-5">
          <p className="text-sm">
            {error ? <span className="text-red-700">{error}</span>
              : saved ? <span className="text-denim-mid">Saved and live.</span>
              : <span className="text-ink-soft">Changes apply to the storefront immediately.</span>}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <><Loader2 size={13} className="mr-2 inline animate-spin" /> Saving</> : "Save"}
            </Button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
