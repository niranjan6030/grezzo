"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Heart, Truck } from "lucide-react";
import { DENIM_FACTS } from "@/lib/facts";
import { colourOf, inr } from "@/lib/products";
import type { Colourway, Product } from "@/lib/types";
import { useStore } from "@/store/useStore";
import { tapFeedback } from "@/lib/native";
import ProductImage from "./ProductImage";

const VIEWS = ["Garment", "Technical", "Fabric"] as const;
type View = (typeof VIEWS)[number];

export default function ProductDetail({
  product, initialColour,
}: { product: Product; initialColour?: string }) {
  const [colourCode, setColourCode] = useState(() => colourOf(product, initialColour).code);
  const colour = useMemo(() => colourOf(product, colourCode), [product, colourCode]);
  const [size, setSize] = useState<number | null>(null);
  const [view, setView] = useState<View>("Garment");
  const [added, setAdded] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("Composition");

  const addToCart = useStore((s) => s.addToCart);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const track = useStore((s) => s.track);
  const isFav = useStore((s) => s.favourites.includes(product.id));

  useEffect(() => { track("view", product.id); }, [product.id, track]);

  const add = () => {
    if (size === null) return;
    addToCart(product.id, colour.code, size);
    track("add_to_cart", product.id);
    tapFeedback("medium");
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Two facts tied to this specific garment.
  const facts = DENIM_FACTS.filter((f) =>
    (colour.wash === "Raw Indigo" && f.tag === "Craft") ||
    (product.stretchPct > 5 && f.short.includes("Stretch")) ||
    f.tag === "Fabric",
  ).slice(0, 2);

  const sections = [
    { title: "Composition", body: `${product.fabric}. ${product.weightOz}oz per square yard${product.stretchPct ? `, ${product.stretchPct}% stretch recovery` : ", no stretch"}.` },
    { title: "Fit", body: `${product.fit} through the leg with a ${product.rise.toLowerCase()} rise. Model is 185cm with a 32in waist and wears a 32.` },
    { title: "Care", body: "Machine wash cold, inside out, with like colours. Do not tumble dry — heat is what kills elastane and shrinks cotton. Wash less than you think you need to." },
    { title: "Shipping & returns", body: "Free delivery on orders over ₹3,000. Dispatched within 24 hours from the nearest warehouse holding your size. Returns free within 30 days, unworn with tags." },
  ];

  return (
    <article className="grid md:grid-cols-2">
      {/* ---- gallery ---- */}
      <div className="denim-weave-light relative md:sticky md:top-[68px] md:h-[calc(100vh-68px)]">
        <div className="flex h-full items-center justify-center p-6 md:p-14">
          <AnimatePresence mode="wait">
            <motion.div key={`${view}-${colour.code}`} className="h-full w-full"
              initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === "Fabric" ? <FabricMacro colour={colour} />
                : <ProductImage product={product} colour={colour}
                             flat={view === "Technical"} className="h-full w-full" />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setView(v)}
                    className={`tracked border px-3 py-1.5 transition-colors ${
                      view === v ? "border-denim-deep bg-denim-deep text-white" : "border-denim-deep/40 bg-white/70"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ---- detail ---- */}
      <div className="px-5 py-14 md:px-14 md:py-20">
        <p className="tracked text-ink-soft">{product.collection} · Menswear</p>
        <h1 className="tracked-lg mt-4 text-3xl md:text-4xl">{product.name}</h1>
        <p className="mt-4 text-lg">
          {inr(product.pricePaise)}
          {product.comparePaise && (
            <span className="ml-3 text-ink-soft line-through">{inr(product.comparePaise)}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-soft">Inclusive of all taxes</p>

        <p className="mt-8 max-w-md text-sm leading-relaxed">{product.story}</p>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
          {[["Fit", product.fit], ["Rise", product.rise], ["Wash", colour.wash],
            ["Weight", `${product.weightOz}oz`]].map(([k, v]) => (
            <div key={k}>
              <p className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">{k}</p>
              <p className="tracked mt-1">{v}</p>
            </div>
          ))}
        </div>

        {/* colour */}
        <div className="mt-10">
          <p className="tracked mb-3">
            Colour — <span className="text-ink-soft">{colour.wash}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {product.colours.map((c) => (
              <button key={c.code} onClick={() => setColourCode(c.code)}
                      aria-label={c.wash} aria-pressed={c.code === colour.code}
                      title={c.wash}
                      className={`relative h-11 w-11 rounded-full border transition-transform duration-300 hover:scale-105 ${
                        c.code === colour.code
                          ? "border-denim-deep ring-1 ring-denim-deep ring-offset-2"
                          : "border-line"}`}
                      style={{ background: `linear-gradient(135deg, ${c.ramp[2]}, ${c.ramp[1]} 55%, ${c.ramp[0]})` }} />
            ))}
          </div>
        </div>

        {/* sizes */}
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <p className="tracked">Size</p>
            <button className="tracked seam-link text-ink-soft">Size guide</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)}
                      className={`h-11 min-w-12 border transition-colors ${
                        size === s ? "border-denim-deep bg-denim-deep text-white" : "border-line hover:border-denim-deep"}`}>
                {s}
              </button>
            ))}
          </div>
          {size === null && <p className="mt-3 text-xs text-ink-soft">Select a size to continue.</p>}
        </div>

        {/* actions */}
        <div className="mt-8 flex gap-3">
          <button onClick={add} disabled={size === null}
                  className="tracked relative flex-1 overflow-hidden bg-denim-deep py-4 text-white
                             transition-opacity disabled:cursor-not-allowed disabled:opacity-35">
            <AnimatePresence mode="wait">
              <motion.span key={added ? "added" : "add"} className="flex items-center justify-center gap-2"
                initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                {added ? <><Check size={15} strokeWidth={2} /> Added to bag</> : "Add to bag"}
              </motion.span>
            </AnimatePresence>
          </button>
          <button onClick={() => { toggleFavourite(product.id); track("favourite", product.id); }}
                  aria-label="Favourite"
                  className="w-14 border border-denim-deep transition-colors hover:bg-denim-wash">
            <Heart size={19} strokeWidth={1.25}
                   className={`mx-auto ${isFav ? "fill-denim-deep text-denim-deep" : ""}`} />
          </button>
        </div>

        <p className="mt-5 flex items-center gap-2 text-xs text-ink-soft">
          <Truck size={15} strokeWidth={1.25} /> Dispatched in 24 hours from the nearest warehouse in stock
        </p>

        {/* accordions */}
        <div className="mt-12 border-t border-line">
          {sections.map((s) => (
            <div key={s.title} className="border-b border-line">
              <button onClick={() => setOpenSection(openSection === s.title ? null : s.title)}
                      className="flex w-full items-center justify-between py-5 text-left">
                <span className="tracked">{s.title}</span>
                <ChevronDown size={17} strokeWidth={1.25}
                             className={`transition-transform duration-500 ${openSection === s.title ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {openSection === s.title && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden">
                    <p className="pb-5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* facts */}
        <div className="denim-weave mt-12 p-7 text-white">
          <p className="tracked text-thread">While you are here</p>
          {facts.map((f) => (
            <div key={f.short} className="mt-5">
              <p className="text-base leading-snug">{f.short}</p>
              <p className="mt-2 text-xs leading-relaxed opacity-70">{f.long}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Macro view: the twill, blown up until the diagonal is unmissable. */
function FabricMacro({ colour }: { colour: Colourway }) {
  const [shadow, body, highlight] = colour.ramp;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundColor: body,
        backgroundImage: `
          repeating-linear-gradient(45deg, ${highlight}55 0 4px, transparent 4px 14px),
          repeating-linear-gradient(45deg, ${shadow}88 7px, transparent 7px 16px),
          repeating-linear-gradient(135deg, #ffffff18 0 2px, transparent 2px 9px)`,
      }} />
      <div className="absolute inset-x-0 bottom-0 bg-denim-raw/75 p-5 text-white">
        <p className="tracked text-thread">Right-hand twill · {colour.wash}</p>
        <p className="mt-2 text-xs leading-relaxed opacity-80">
          Indigo warp over undyed weft. The pale threads you can see running the other way
          are why this fades instead of going grey.
        </p>
      </div>
    </div>
  );
}
