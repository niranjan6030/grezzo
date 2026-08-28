"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AdminData, AdminOrder, MergedProduct, Offer } from "@/lib/admin/types";

export interface AdminStats {
  revenueAllPaise: number;
  revenueDayPaise: number;
  revenueWeekPaise: number;
  ordersAll: number;
  ordersDay: number;
  unitsAll: number;
  abandoned: number;
  averageOrderPaise: number;
  bestSellers: { productId: string; name: string; qty: number }[];
  lowStock: { sku: string; productId: string; name: string; colour: string; size: number; qty: number }[];
  lowStockCount: number;
}

interface AdminValue {
  loading: boolean;
  backend: "supabase" | "file";
  data: AdminData | null;
  catalogue: MergedProduct[];
  orders: AdminOrder[];
  stats: AdminStats | null;
  error: string | null;
  reload: () => Promise<void>;
  /** Patch fields to change. `photos: { [colour]: null }` deletes a photo. */
  saveProduct: (productId: string, patch: Record<string, unknown>) => Promise<void>;
  resetProduct: (productId: string) => Promise<void>;
  saveStock: (updates: { sku: string; qty: number }[], mode?: "set" | "receive") => Promise<void>;
  createOffer: (o: Record<string, unknown>) => Promise<void>;
  updateOffer: (o: Record<string, unknown>) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  createCoupon: (c: Record<string, unknown>) => Promise<void>;
  updateCoupon: (c: Record<string, unknown>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  createBankOffer: (b: Record<string, unknown>) => Promise<void>;
  updateBankOffer: (b: Record<string, unknown>) => Promise<void>;
  deleteBankOffer: (id: string) => Promise<void>;
  setOrderStatus: (id: string, status: AdminOrder["status"]) => Promise<void>;
}

const Ctx = createContext<AdminValue | null>(null);

class NotSignedIn extends Error {}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new NotSignedIn("Not signed in.");
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "file">("file");
  const [data, setData] = useState<AdminData | null>(null);
  const [catalogue, setCatalogue] = useState<MergedProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const json = await send("/api/admin/data", "GET");
      setBackend(json.backend);
      setData(json.data);
      setCatalogue(json.catalogue);
      setOrders(json.orders ?? []);
      setStats(json.stats);
      setError(null);
    } catch (e) {
      // A 401 just means the gate has not been passed yet — the shell calls
      // reload() again once sign-in succeeds. Not something to shout about.
      setError(e instanceof NotSignedIn ? null : e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  // No fetch on mount: AdminShell calls reload() once the session check has
  // passed, so the console never fires a request it knows will 401.

  const after = useCallback(async <T,>(p: Promise<T>) => { await p; await reload(); }, [reload]);

  const value = useMemo<AdminValue>(() => ({
    loading, backend, data, catalogue, orders, stats, error, reload,
    saveProduct: (productId, patch) =>
      after(send("/api/admin/products", "PATCH", { productId, ...patch })),
    resetProduct: (productId) =>
      after(send("/api/admin/products", "DELETE", { productId })),
    saveStock: (updates, mode = "set") =>
      after(send("/api/admin/stock", "POST", { updates, mode })),
    createOffer: (o) => after(send("/api/admin/offers", "POST", o)),
    updateOffer: (o) => after(send("/api/admin/offers", "PATCH", o)),
    deleteOffer: (id) => after(send("/api/admin/offers", "DELETE", { id })),
    createCoupon: (c) => after(send("/api/admin/coupons", "POST", c)),
    updateCoupon: (c) => after(send("/api/admin/coupons", "PATCH", c)),
    deleteCoupon: (id) => after(send("/api/admin/coupons", "DELETE", { id })),
    createBankOffer: (b) => after(send("/api/admin/bank-offers", "POST", b)),
    updateBankOffer: (b) => after(send("/api/admin/bank-offers", "PATCH", b)),
    deleteBankOffer: (id) => after(send("/api/admin/bank-offers", "DELETE", { id })),
    setOrderStatus: (id, status) => after(send("/api/admin/orders", "PATCH", { id, status })),
  }), [loading, backend, data, catalogue, orders, stats, error, reload, after]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

export type { AdminData, AdminOrder, MergedProduct, Offer };
