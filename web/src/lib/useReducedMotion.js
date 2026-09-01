"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this person has asked their system for less motion.
 *
 * Subscribed rather than read once, so toggling the OS setting takes effect
 * immediately instead of at the next reload — and read through
 * `useSyncExternalStore` so it is safe to use during render on the server.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // server: assume motion is welcome
  );
}
