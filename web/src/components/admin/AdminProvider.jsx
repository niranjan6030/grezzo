"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

class NotSignedIn extends Error {}

async function send(url, method, body) {
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

export function AdminProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState("file");
  const [data, setData] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

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
      setError(
        e instanceof NotSignedIn ? null : e instanceof Error ? e.message : "Could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // No fetch on mount: AdminShell calls reload() once the session check has
  // passed, so the console never fires a request it knows will 401.

  // Returns whatever the request resolved to, so a caller that needs the
  // created record — the product creator attaching photography, say — can
  // reach it without a second round trip.
  const after = useCallback(
    async (p) => {
      const result = await p;
      await reload();
      return result;
    },
    [reload],
  );

  const value = useMemo(
    () => ({
      loading,
      backend,
      data,
      catalogue,
      orders,
      stats,
      error,
      reload,
      createProduct: (p) => after(send("/api/admin/products", "POST", p)),
      saveProduct: (productId, patch) =>
        after(send("/api/admin/products", "PATCH", { productId, ...patch })),
      resetProduct: (productId) => after(send("/api/admin/products", "DELETE", { productId })),
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
    }),
    [loading, backend, data, catalogue, orders, stats, error, reload, after],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
