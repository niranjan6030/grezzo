"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * What the checkout carries between its three steps.
 *
 * Session storage rather than local: a half-finished checkout should not
 * still be sitting there next week with a coupon that has since expired.
 */

export const useCheckout = create()(
  persist(
    (set) => ({
      addressId: null,
      code: "",
      method: "upi",
      setAddressId: (addressId) => set({ addressId }),
      setCode: (code) => set({ code }),
      setMethod: (method) => set({ method }),
      reset: () => set({ addressId: null, code: "", method: "upi" }),
    }),
    {
      name: "grezzo-checkout",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? undefined : sessionStorage,
      ),
    },
  ),
);
