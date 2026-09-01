"use client";

import { useEffect } from "react";

/** Registers the service worker in production only — in development it just
 *  gets in the way of hot reloading. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration fails on http origins and in some private modes.
        // The site works fine without it, so there is nothing to report.
      });
    };

    // Wait for load so the worker never competes with the first render.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
