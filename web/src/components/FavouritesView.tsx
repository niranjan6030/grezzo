"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCatalogue } from "./CatalogueProvider";
import { useStore } from "@/store/useStore";
import ProductCard from "./ProductCard";

export default function FavouritesView() {
  const favourites = useStore((s) => s.favourites);
  const { byId } = useCatalogue();
  const products = favourites.map(byId).filter(Boolean);

  if (products.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <h1 className="tracked-lg text-3xl">Nothing saved yet</h1>
        <p className="mt-4 max-w-sm text-sm text-ink-soft">
          Tap the heart on any pair. What you save also teaches the recommender what you like.
        </p>
        <Link href="/jeans"
              className="tracked mt-10 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white">
          Browse jeans
        </Link>
      </section>
    );
  }

  return (
    <section className="px-5 py-16 md:px-10">
      <h1 className="tracked-lg text-3xl md:text-4xl">Favourites</h1>
      <p className="mt-3 text-sm text-ink-soft">{products.length} saved</p>

      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
        {products.map((p, i) => (
          <motion.div key={p!.id}
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
            <ProductCard product={p!} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
