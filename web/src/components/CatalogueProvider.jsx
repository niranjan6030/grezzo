"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* The catalogue every client component reads from: built-in products with
   the admin's edits and live offers already applied. Seeded from the server
   render so there is no flash of stale prices, then refreshed when the tab
   regains focus so a price change in the console lands without a reload. */

const Ctx = createContext(null);

export function CatalogueProvider({ initial, children }) {
  const [products, setProducts] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogue", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.products) && json.products.length) setProducts(json.products);
    } catch {
      // Offline or mid-deploy — keep showing what we already have.
    }
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo(
    () => ({
      products,
      byId: (id) => products.find((p) => p.id === id),
      bySlug: (slug) => products.find((p) => p.slug === slug),
      refresh,
    }),
    [products, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCatalogue must be used inside <CatalogueProvider>");
  return ctx;
}
