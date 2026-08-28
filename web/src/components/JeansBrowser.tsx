"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { ALL_FITS, ALL_WASHES, COLLECTIONS } from "@/lib/products";
import { useCatalogue } from "./CatalogueProvider";
import type { MergedProduct } from "@/lib/admin/types";
import ProductCard from "./ProductCard";
import Recommendations from "./Recommendations";

type Sort = "featured" | "price-asc" | "price-desc" | "weight-desc";

export default function JeansBrowser() {
  const params = useSearchParams();
  const q = params.get("q")?.toLowerCase() ?? "";
  const collectionParam = params.get("collection");

  const [fits, setFits] = useState<string[]>([]);
  const [washes, setWashes] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>(collectionParam ? [collectionParam] : []);
  const [maxPrice, setMaxPrice] = useState(8000);
  const [sort, setSort] = useState<Sort>("featured");
  const [panelOpen, setPanelOpen] = useState(false);
  const [density, setDensity] = useState<2 | 4>(4);
  const { products } = useCatalogue();

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const results = useMemo(() => {
    let out: MergedProduct[] = products.filter((p) => {
      if (collections.length && !collections.includes(p.collection)) return false;
      if (fits.length && !fits.includes(p.fit)) return false;
      if (washes.length && !washes.includes(p.wash)) return false;
      if (p.pricePaise / 100 > maxPrice) return false;
      if (q) {
        const hay = [p.name, p.fit, p.wash, p.rise, p.collection, ...p.tags]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === "price-asc") out = out.sort((a, b) => a.pricePaise - b.pricePaise);
    if (sort === "price-desc") out = out.sort((a, b) => b.pricePaise - a.pricePaise);
    if (sort === "weight-desc") out = out.sort((a, b) => b.weightOz - a.weightOz);
    return out;
  }, [q, fits, washes, collections, maxPrice, sort, products]);

  const activeCount = fits.length + washes.length + collections.length + (maxPrice < 8000 ? 1 : 0);

  return (
    <>
      <div className="px-5 pt-16 md:px-10">
        <h1 className="tracked-lg text-3xl md:text-5xl">
          {q ? `“${q}”` : collectionParam ? collectionParam : "All jeans"}
        </h1>
        <p className="mt-3 text-sm text-ink-soft">{results.length} items</p>
      </div>

      {/* control bar */}
      <div className="sticky top-[68px] z-30 mt-10 border-y border-line bg-white/94 px-5 py-3 backdrop-blur-md md:px-10">
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => setPanelOpen(true)} className="tracked flex items-center gap-2">
            <SlidersHorizontal size={15} strokeWidth={1.25} />
            Filter{activeCount ? ` (${activeCount})` : ""}
          </button>

          <div className="flex items-center gap-5">
            <div className="hidden gap-1 md:flex">
              {([2, 4] as const).map((d) => (
                <button key={d} onClick={() => setDensity(d)}
                        className={`tracked px-2 ${density === d ? "text-ink" : "text-ink-soft"}`}>
                  {d === 2 ? "▦" : "▤▤"}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                    className="tracked cursor-pointer bg-transparent outline-none">
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="weight-desc">Heaviest fabric</option>
            </select>
          </div>
        </div>
      </div>

      {/* grid */}
      <section className="px-5 py-14 md:px-10">
        {results.length === 0 ? (
          <div className="py-24 text-center">
            <p className="tracked-lg text-2xl">Nothing matches</p>
            <p className="mt-4 text-sm text-ink-soft">Try widening the wash or the fit.</p>
          </div>
        ) : (
          <motion.div layout
            className={`grid gap-x-4 gap-y-12 md:gap-x-6 ${
              density === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
            <AnimatePresence mode="popLayout">
              {results.map((p, i) => (
                <motion.div key={p.id} layout
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.6, delay: Math.min(i * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}>
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      <Recommendations title="You may also like" exclude={results.slice(0, 4).map((p) => p.id)} />

      {/* filter drawer */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div className="fixed inset-0 z-[65] bg-denim-raw/35"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-[66] flex w-full max-w-sm flex-col bg-white"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <p className="tracked">Filter</p>
                <button onClick={() => setPanelOpen(false)}><X size={20} strokeWidth={1.25} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <Group title="Fit" values={ALL_FITS} selected={fits}
                       onToggle={(v) => toggle(fits, setFits, v)} />
                <Group title="Wash" values={ALL_WASHES} selected={washes}
                       onToggle={(v) => toggle(washes, setWashes, v)} />
                <Group title="Collection" values={COLLECTIONS} selected={collections}
                       onToggle={(v) => toggle(collections, setCollections, v)} />

                <div className="mt-8">
                  <p className="tracked mb-4">Max price — ₹{maxPrice.toLocaleString("en-IN")}</p>
                  <input type="range" min={3000} max={8000} step={100} value={maxPrice}
                         onChange={(e) => setMaxPrice(Number(e.target.value))}
                         className="w-full accent-[var(--denim-deep)]" />
                </div>
              </div>

              <div className="flex gap-3 border-t border-line px-6 py-5">
                <button onClick={() => { setFits([]); setWashes([]); setCollections([]); setMaxPrice(8000); }}
                        className="tracked flex-1 border border-denim-deep py-3">Clear</button>
                <button onClick={() => setPanelOpen(false)}
                        className="tracked flex-1 bg-denim-deep py-3 text-white">
                  Show {results.length}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Group({ title, values, selected, onToggle }: {
  title: string; values: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="mb-8">
      <p className="tracked mb-4">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button key={v} onClick={() => onToggle(v)}
                  className={`tracked border px-3 py-2 transition-colors ${
                    selected.includes(v)
                      ? "border-denim-deep bg-denim-deep text-white"
                      : "border-line hover:border-denim-deep"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
