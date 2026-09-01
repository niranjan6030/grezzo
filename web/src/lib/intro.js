"use client";

import { useSyncExternalStore } from "react";

/*
 * Whether the unzip intro should run on this page load.
 *
 * The answer depends on sessionStorage and a media query, neither of which
 * exists on the server — and it must not change halfway through a render, so
 * it is decided once per page load and cached. `useSyncExternalStore` is how
 * React wants browser-only values read: it hands back the server value during
 * hydration, then swaps in the real one without a mismatch.
 */

let decided = null;

function read() {
  if (decided === null) {
    decided =
      sessionStorage.getItem("grezzo-intro") !== "1" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return decided;
}

/** Call once the intro has finished, so the rest of the page stops waiting. */
export function markIntroPlayed() {
  decided = false;
  try {
    sessionStorage.setItem("grezzo-intro", "1");
  } catch {
    // Private mode with storage disabled — the intro simply plays again.
  }
}

const noSubscribe = () => () => {};

export function useIntroWillPlay() {
  return useSyncExternalStore(noSubscribe, read, () => false);
}
