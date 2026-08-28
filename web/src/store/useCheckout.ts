"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PaymentMethod } from "@/lib/types";

/**
 * What the checkout carries between its three steps.
 *
 * Session storage rather than local: a half-finished checkout should not
 * still be sitting there next week with a coupon that has since expired.
 */
interface CheckoutState {
  addressId: string | null;
  code: string;
  method: PaymentMethod;
  setAddressId: (id: string | null) => void;
  setCode: (code: string) => void;
  setMethod: (m: PaymentMethod) => void;
  reset: () => void;
}

export const useCheckout = create<CheckoutState>()(
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
        typeof window === "undefined" ? (undefined as never) : sessionStorage),
    },
  ),
);
