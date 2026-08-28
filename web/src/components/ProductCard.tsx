"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { inr } from "@/lib/products";
import type { MergedProduct } from "@/lib/admin/types";
import { useStore } from "@/store/useStore";
import { tapFeedback } from "@/lib/native";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: MergedProduct }) {
  const [hover, setHover] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [colourIdx, setColourIdx] = useState(0);
  const colour = product.colours[colourIdx];
  const favourites = useStore((s) => s.favourites);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const addToCart = useStore((s) => s.addToCart);
  const track = useStore((s) => s.track);
  const isFav = favourites.includes(product.id);

  const quickAdd = (size: number) => {
    addToCart(product.id, colour.code, size);
    track("add_to_cart", product.id);
    tapFeedback();
    setAdded(size);
    setTimeout(() => setAdded(null), 1400);
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={`/product/${product.slug}?c=${colour.code}`} onClick={() => track("view", product.id)}>
        <div className="denim-weave-light relative aspect-[3/4] overflow-hidden">
          <ProductImage product={product} hovered={hover} colour={colour} className="h-full w-full" />

          {/* wash label wipes up from the bottom edge on hover */}
          <AnimatePresence>
            {hover && (
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 bottom-0 bg-denim-deep/92 px-4 py-3 text-white"
              >
                <p className="tracked">{product.fit} · {product.rise} rise</p>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-denim-light">
                  {product.weightOz}oz · {product.wash}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {(product.offer || product.comparePaise) && (
            <span className="tracked absolute left-3 top-3 bg-denim-raw px-2.5 py-1 text-[0.58rem] text-white">
              {product.offer?.name ?? "Reduced"}
            </span>
          )}
        </div>
      </Link>

      <button
        onClick={() => { toggleFavourite(product.id); track("favourite", product.id); }}
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
        className="absolute right-3 top-3 transition-transform duration-300 hover:scale-110"
      >
        <Heart size={19} strokeWidth={1.25}
               className={isFav ? "fill-denim-deep text-denim-deep" : "text-denim-deep/70"} />
      </button>

      {/* quick size add — slides out from under the card */}
      <div className="relative">
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 py-3">
                {product.sizes.map((s) => (
                  <button key={s} onClick={() => quickAdd(s)}
                          className={`h-7 min-w-8 border px-1.5 text-[0.65rem] transition-colors ${
                            added === s
                              ? "border-denim-deep bg-denim-deep text-white"
                              : "border-line hover:border-denim-deep"
                          }`}>
                    {added === s ? "✓" : s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* colourways — hovering a swatch repaints the plate above */}
      <div className="flex gap-1.5 pt-1">
        {product.colours.map((c, i) => (
          <button key={c.code}
                  onMouseEnter={() => setColourIdx(i)}
                  onFocus={() => setColourIdx(i)}
                  onClick={() => setColourIdx(i)}
                  aria-label={c.wash}
                  title={c.wash}
                  className={`h-4 w-4 rounded-full border transition-transform duration-300 hover:scale-115 ${
                    i === colourIdx ? "border-denim-deep" : "border-line"}`}
                  style={{ background: `linear-gradient(135deg, ${c.ramp[2]}, ${c.ramp[1]} 55%, ${c.ramp[0]})` }} />
        ))}
      </div>

      <Link href={`/product/${product.slug}?c=${colour.code}`} className="block pt-2">
        <p className="tracked">{product.name}</p>
        <p className="mt-1.5 text-sm">
          {inr(product.pricePaise)}
          {product.comparePaise && (
            <span className="ml-2 text-ink-soft line-through">{inr(product.comparePaise)}</span>
          )}
        </p>
      </Link>
    </div>
  );
}
