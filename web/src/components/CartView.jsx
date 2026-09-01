"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { colourOf, inr } from "@/lib/products";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { lineKey } from "@/lib/types";
import { useStore } from "@/store/useStore";
import { useCatalogue } from "./CatalogueProvider";
import ProductImage from "./ProductImage";

export default function CartView() {
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const deselected = useStore((s) => s.deselected);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const setAllSelected = useStore((s) => s.setAllSelected);
  const setQty = useStore((s) => s.setQty);
  const removeLine = useStore((s) => s.removeLine);
  const { byId } = useCatalogue();

  const priced = useMemo(
    () =>
      cart
        .map((l) => {
          const product = byId(l.productId);
          if (!product) return null;
          return {
            line: l,
            key: lineKey(l),
            product,
            colour: colourOf(product, l.colour),
          };
        })
        .filter((x) => x !== null),
    [cart, byId],
  );

  const chosen = priced.filter((x) => !deselected.includes(x.key));
  const subtotal = chosen.reduce((n, x) => n + x.product.pricePaise * x.line.qty, 0);
  const units = chosen.reduce((n, x) => n + x.line.qty, 0);
  const allOn = chosen.length === priced.length && priced.length > 0;

  if (priced.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <h1 className="tracked-lg text-3xl">Your bag is empty</h1>
        <Link
          href="/jeans"
          className="tracked mt-10 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white"
        >
          Shop jeans
        </Link>
      </section>
    );
  }

  const toFree = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <section className="px-5 py-16 md:px-10">
      <h1 className="tracked-lg text-3xl md:text-4xl">Shopping bag</h1>
      <p className="mt-3 text-sm text-ink-soft">
        Tick what you want to buy now. Anything you leave unticked stays in the bag.
      </p>

      <div className="mt-10 grid gap-14 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
            <label className="tracked flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={allOn}
                onChange={(e) => setAllSelected(e.target.checked)}
                className="h-4 w-4 accent-[var(--denim-deep)]"
              />
              Select all
            </label>
            <span className="text-xs text-ink-soft">
              {chosen.length} of {priced.length} selected
            </span>
          </div>

          <AnimatePresence initial={false}>
            {priced.map(({ line, key, product, colour }) => {
              const on = !deselected.includes(key);
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-6 flex gap-4 border-b border-line pb-6"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleSelected(key)}
                    aria-label={`Buy ${product.name} now`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--denim-deep)]"
                  />

                  <Link
                    href={`/product/${product.slug}?c=${colour.code}`}
                    className={`denim-weave-light w-24 shrink-0 transition-opacity md:w-32 ${
                      on ? "" : "opacity-45"
                    }`}
                  >
                    <ProductImage product={product} colour={colour} className="h-full w-full" />
                  </Link>

                  <div
                    className={`flex flex-1 flex-col justify-between transition-opacity ${
                      on ? "" : "opacity-45"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/product/${product.slug}?c=${colour.code}`}
                          className="tracked seam-link"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-1.5 text-xs text-ink-soft">
                          {product.fit} · {colour.wash} · Size {line.size}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(line.productId, line.colour, line.size)}
                        aria-label="Remove"
                      >
                        <X size={17} strokeWidth={1.25} className="text-ink-soft hover:text-ink" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center border border-line">
                        <button
                          onClick={() =>
                            setQty(line.productId, line.colour, line.size, line.qty - 1)
                          }
                          className="px-3 py-2"
                          aria-label="Decrease"
                        >
                          <Minus size={13} strokeWidth={1.5} />
                        </button>
                        <span className="min-w-8 text-center text-sm">{line.qty}</span>
                        <button
                          onClick={() =>
                            setQty(line.productId, line.colour, line.size, line.qty + 1)
                          }
                          className="px-3 py-2"
                          aria-label="Increase"
                        >
                          <Plus size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                      <p className="text-sm">{inr(product.pricePaise * line.qty)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ---- summary ---- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="denim-weave-light p-7">
            <p className="tracked border-b border-line pb-4">Selected</p>

            <div className="mt-4 flex justify-between text-sm">
              <span className="text-ink-soft">
                {units} item{units === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">{inr(subtotal)}</span>
            </div>

            {toFree > 0 && subtotal > 0 && (
              <div className="mt-4">
                <p className="text-xs text-ink-soft">{inr(toFree)} more for free delivery</p>
                <div className="mt-2 h-[3px] w-full bg-white">
                  <motion.div
                    className="h-full bg-denim-deep"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                    }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            )}

            <p className="mt-5 text-[0.62rem] leading-relaxed text-ink-soft">
              Delivery, coupons and payment come next. Nothing is charged until you confirm on the
              last step.
            </p>

            <button
              onClick={() => router.push("/checkout/address")}
              disabled={chosen.length === 0}
              className="tracked mt-6 flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-40"
            >
              Proceed to checkout
              <ArrowRight size={15} strokeWidth={1.5} />
            </button>

            {chosen.length === 0 && (
              <p className="mt-3 text-xs text-ink-soft">Tick at least one item to continue.</p>
            )}

            <Link href="/jeans" className="tracked mt-4 block text-center text-ink-soft seam-link">
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
