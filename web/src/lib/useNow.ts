"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, as a value React is allowed to read during render.
 *
 * Calling Date.now() straight from a component body is impure and makes
 * renders non-deterministic. This subscribes to a ticker instead, so badges
 * like "Live" and "Expired" update on their own when a coupon's window
 * opens or closes, without anyone reloading the page.
 *
 * The snapshot is floored to the tick interval so it stays stable between
 * ticks — otherwise every render would see a new value and loop.
 */
export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,          // server: nothing has expired yet
  );
}
