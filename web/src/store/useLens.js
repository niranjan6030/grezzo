"use client";

import { create } from "zustand";

/**
 * Grezzo Lens is reachable from the header and from the home page, so its
 * open/closed state lives here rather than inside the header.
 */

export const useLens = create((set) => ({
  open: false,
  openLens: () => set({ open: true }),
  closeLens: () => set({ open: false }),
}));
