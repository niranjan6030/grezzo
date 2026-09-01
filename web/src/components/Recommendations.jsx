"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCatalogue } from "./CatalogueProvider";

import { useStore } from "@/store/useStore";
import ProductCard from "./ProductCard";

export default function Recommendations({ title = "Chosen for you", exclude = [], limit = 4 }) {
  const events = useStore((s) => s.events);
  const favourites = useStore((s) => s.favourites);
  const cart = useStore((s) => s.cart);
  const personalised = useStore((s) => s.consent.personalisation);
  const { byId } = useCatalogue();
  const excludeKey = exclude.join(",");
  const [recs, setRecs] = useState(null);
  const [engine, setEngine] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            events,
            favourites,
            cart: cart.map((l) => l.productId),
            limit: limit + exclude.length,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        setEngine(json.engine ?? "");
        setRecs(json.recommendations.filter((r) => !exclude.includes(r.productId)).slice(0, limit));
      } catch {
        if (!cancelled) setRecs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Refetch when engagement changes — this is what makes it feel live.
  }, [events, favourites, cart, limit, exclude, excludeKey]);

  if (!recs || recs.length === 0) return null;

  return (
    <section className="px-5 py-20 md:px-10">
      <div className="mb-8 flex items-end justify-between border-b border-line pb-4">
        <h2 className="tracked-lg text-lg">{title}</h2>
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">
          {!personalised
            ? "Generic — personalisation is off"
            : engine === "lstm"
              ? "LSTM sequence model"
              : "On-site hybrid model"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {recs.map((r, i) => {
          const p = byId(r.productId);
          if (!p) return null;
          return (
            <motion.div
              key={r.productId}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductCard product={p} />
              <p className="mt-2 text-[0.62rem] uppercase tracking-[0.18em] text-denim-mid">
                {r.reason}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
