"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { lineKey } from "@/lib/types";

const EVENT_CAP = 120;

export const useStore = create()(
  persist(
    (set, get) => ({
      consent: {
        decided: false,
        necessary: true,
        analytics: false,
        personalisation: false,
        marketing: false,
      },
      setConsent: (c) => set((s) => ({ consent: { ...s.consent, ...c, decided: true } })),

      cart: [],
      deselected: [],
      toggleSelected: (key) =>
        set((s) => ({
          deselected: s.deselected.includes(key)
            ? s.deselected.filter((k) => k !== key)
            : [...s.deselected, key],
        })),
      setAllSelected: (on) => set((s) => ({ deselected: on ? [] : s.cart.map(lineKey) })),

      addToCart: (productId, colour, size, qty = 1) =>
        set((s) => {
          const key = lineKey({ productId, colour, size });
          const deselected = s.deselected.filter((k) => k !== key);
          const i = s.cart.findIndex(
            (l) => l.productId === productId && l.colour === colour && l.size === size,
          );
          if (i === -1) {
            return { cart: [...s.cart, { productId, colour, size, qty }], deselected };
          }
          const next = [...s.cart];
          next[i] = { ...next[i], qty: Math.min(next[i].qty + qty, 10) };
          return { cart: next, deselected };
        }),
      setQty: (productId, colour, size, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter(
                  (l) => !(l.productId === productId && l.colour === colour && l.size === size),
                )
              : s.cart.map((l) =>
                  l.productId === productId && l.colour === colour && l.size === size
                    ? { ...l, qty }
                    : l,
                ),
        })),
      removeLine: (productId, colour, size) =>
        set((s) => ({
          cart: s.cart.filter(
            (l) => !(l.productId === productId && l.colour === colour && l.size === size),
          ),
          deselected: s.deselected.filter((k) => k !== lineKey({ productId, colour, size })),
        })),
      clearCart: () => set({ cart: [], deselected: [] }),
      /** Drops only what was just bought, leaving parked lines behind. */
      clearPurchased: (keys) =>
        set((s) => ({
          cart: s.cart.filter((l) => !keys.includes(lineKey(l))),
          deselected: s.deselected.filter((k) => !keys.includes(k)),
        })),

      favourites: [],
      toggleFavourite: (productId) =>
        set((s) => ({
          favourites: s.favourites.includes(productId)
            ? s.favourites.filter((f) => f !== productId)
            : [...s.favourites, productId],
        })),

      events: [],
      track: (kind, productId) => {
        // Personalisation is opt-in: with consent withheld we keep nothing.
        if (!get().consent.personalisation) return;
        set((s) => ({
          events: [...s.events, { kind, productId, at: Date.now() }].slice(-EVENT_CAP),
        }));
      },
    }),
    {
      name: "grezzo-v2",
      partialize: (s) => ({
        consent: s.consent,
        cart: s.cart,
        deselected: s.deselected,
        favourites: s.favourites,
        events: s.consent.personalisation ? s.events : [],
      }),
    },
  ),
);

/** Cart line count, used by the header badge. */
export const useCartCount = () => useStore((s) => s.cart.reduce((n, l) => n + l.qty, 0));
