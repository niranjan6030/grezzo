"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   The unzip, as a reusable piece.

   A denim panel fills its container, a metal slider runs down the centre,
   and the fabric peels open in a V to reveal whatever is behind it.
   Everything derives from one 0→1 progress value, so the teeth, the fabric
   edges and the slider can never drift apart.

   Used twice: once as the entrance to the site, and again when an order is
   confirmed. Same cloth, same zip.
   ------------------------------------------------------------------ */

const TEETH = 48;
const MAX_GAP = 78;      // % of the width the V spans at the very top

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
// Slow start, slow finish — a zip pulled by a hand, not a motor.
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Drives a 0→1 value with the animation frame clock.
 *
 * `setProgress` runs inside a requestAnimationFrame callback — a later frame,
 * not this render — so it cannot cascade.
 *
 * An earlier version moved this to useSyncExternalStore with the clock built
 * in useMemo. That was wrong: React may discard and rebuild a memo, which left
 * the subscriber attached to one clock and the live animation frame on
 * another, and the zip froze at zero. Side-effecting objects do not belong in
 * useMemo.
 */
export function useZipProgress(
  durationMs: number,
  enabled: boolean,
  onDone?: () => void,
): number {
  const [progress, setProgress] = useState(enabled ? 0 : 1);
  const done = useRef(onDone);

  useEffect(() => { done.current = onDone; }, [onDone]);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let startedAt: number | null = null;
    let finished = false;

    const tick = (now: number) => {
      startedAt ??= now;
      const p = clamp01((now - startedAt) / durationMs);
      setProgress(p);
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        done.current?.();
      }
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [durationMs, enabled]);

  return progress;
}

export interface ZipCurtainProps {
  /** 0 = fully closed, 1 = panels gone. */
  progress: number;
  /** Fraction of the run spent unzipping, before the halves are pulled off. */
  openFrom?: number;
  openTo?: number;
  className?: string;
}

export default function ZipCurtain({
  progress, openFrom = 0.14, openTo = 0.76, className = "",
}: ZipCurtainProps) {
  const unzip = easeInOut(seg(progress, openFrom, openTo));
  const exit = easeOut(seg(progress, openTo, 1));

  const sliderY = unzip * 100;
  const halfGap = (unzip * MAX_GAP) / 2;
  const leftEdgeTop = 50 - halfGap;
  const rightEdgeTop = 50 + halfGap;

  // How far a tooth has swung off the centre seam, given how far down it sits.
  const toothOffset = (ty: number) => {
    if (ty >= sliderY) return 0;
    const frac = sliderY === 0 ? 0 : (sliderY - ty) / sliderY;
    return halfGap * frac;
  };

  const panel = (side: "left" | "right") => {
    const isLeft = side === "left";
    const clip = isLeft
      ? `polygon(0% 0%, ${leftEdgeTop}% 0%, 50% ${sliderY}%, 50% 100%, 0% 100%)`
      : `polygon(100% 0%, ${rightEdgeTop}% 0%, 50% ${sliderY}%, 50% 100%, 100% 100%)`;

    return (
      <div
        className="denim-weave absolute inset-0"
        style={{
          clipPath: clip,
          transform: `translate3d(${(isLeft ? -1 : 1) * exit * 105}%, 0, 0) rotateY(${(isLeft ? 1 : -1) * exit * 12}deg)`,
          transformOrigin: isLeft ? "left center" : "right center",
        }}
      >
        {/* Shadow along the opening edge, so the V reads as depth. */}
        <div
          className="absolute inset-y-0"
          style={{
            width: "16px",
            [isLeft ? "right" : "left"]: 0,
            background: isLeft
              ? "linear-gradient(90deg, transparent, rgba(0,0,0,0.55))"
              : "linear-gradient(270deg, transparent, rgba(0,0,0,0.55))",
          }}
        />
      </div>
    );
  };

  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#0d1420] ${className}`}
         style={{ perspective: "1400px", opacity: 1 - easeOut(seg(progress, 0.94, 1)) }}
         aria-hidden>
      {panel("left")}
      {panel("right")}

      <div className="pointer-events-none absolute inset-0" style={{ opacity: 1 - exit }}>
        {Array.from({ length: TEETH }, (_, i) => {
          const ty = (i / (TEETH - 1)) * 100;
          const dx = toothOffset(ty);
          const open = ty < sliderY;
          return (
            <div key={i}>
              <Tooth top={ty} left={50 - dx} flip open={open} />
              {open && <Tooth top={ty} left={50 + dx} open />}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute left-1/2"
           style={{ top: `${sliderY}%`, transform: "translate(-50%, -50%)", opacity: 1 - exit }}>
        <Slider glint={seg(progress, 0.02, openFrom)} />
      </div>
    </div>
  );
}

function Tooth({ top, left, flip, open }: { top: number; left: number; flip?: boolean; open?: boolean }) {
  return (
    <span
      className="absolute block"
      style={{
        top: `${top}%`, left: `${left}%`,
        width: 13, height: 7, marginLeft: -6.5, marginTop: -3.5, borderRadius: 2,
        background: "linear-gradient(180deg, #f2f5fa 0%, #b9c4d3 45%, #7d8899 100%)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        transform: `rotate(${open ? (flip ? -14 : 14) : 0}deg)`,
      }}
    />
  );
}

function Slider({ glint }: { glint: number }) {
  return (
    <svg width="40" height="66" viewBox="0 0 40 66" fill="none">
      <defs>
        <linearGradient id={`gz-metal-${Math.round(glint * 100)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset={`${18 + glint * 55}%`} stopColor="#dfe6ef" />
          <stop offset="60%" stopColor="#9aa6b8" />
          <stop offset="100%" stopColor="#5f6b7d" />
        </linearGradient>
      </defs>
      <path d="M8 6h24a4 4 0 0 1 4 4v18a10 10 0 0 1-4 8l-6 4v6H14v-6l-6-4a10 10 0 0 1-4-8V10a4 4 0 0 1 4-4Z"
            fill={`url(#gz-metal-${Math.round(glint * 100)})`} stroke="#4a5566" strokeWidth="1" />
      <rect x="13" y="44" width="14" height="19" rx="4"
            fill={`url(#gz-metal-${Math.round(glint * 100)})`} stroke="#4a5566" strokeWidth="1" />
      <rect x="17" y="49" width="6" height="9" rx="3" fill="#0d1420" opacity="0.75" />
    </svg>
  );
}
