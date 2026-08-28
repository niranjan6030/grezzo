"use client";

import { useId } from "react";
import type { Colourway, Fit, Product, Wash } from "@/lib/types";

/* ------------------------------------------------------------------
   A pair of jeans drawn from the product's own attributes: the fit
   decides the silhouette, the rise decides where the waistband sits,
   and the wash decides how much fading and whiskering shows.
   No photography, no external assets.
   ------------------------------------------------------------------ */

/** Per-leg widths in viewBox units at knee and hem. */
const SILHOUETTE: Record<Fit, { knee: number; hem: number }> = {
  Skinny:     { knee: 27, hem: 20 },
  Slim:       { knee: 31, hem: 25 },
  Tapered:    { knee: 36, hem: 24 },
  Straight:   { knee: 35, hem: 34 },
  Regular:    { knee: 38, hem: 36 },
  Bootcut:    { knee: 31, hem: 45 },
  Relaxed:    { knee: 43, hem: 41 },
  "Wide Leg": { knee: 54, hem: 58 },
  Baggy:      { knee: 51, hem: 48 },
};

/** How worn the finish looks: 0 = raw, 1 = heavily bleached. */
const WEAR: Record<Wash, number> = {
  "Raw Indigo": 0, Rinse: 0.15, "Dark Stone": 0.35, "Mid Stone": 0.55,
  "Light Stone": 0.72, Bleach: 0.9, Ecru: 0.1, "Black Overdye": 0.2,
};

const RISE_TOP: Record<Product["rise"], number> = {
  Low: 60, Mid: 50, High: 40,
};

const CX = 150;
const Y_HIP = 158;
const Y_CROTCH = 192;
const Y_KNEE = 312;
const Y_HEM = 452;

export default function JeanPlate({
  product, className = "", hovered = false, flat = false, colour,
}: {
  product: Product; className?: string; hovered?: boolean; flat?: boolean;
  /** Defaults to the product's first colourway. */
  colour?: Colourway;
}) {
  const uid = useId().replace(/:/g, "");
  const way = colour ?? product.colours[0];
  const [shadow, body, highlight] = way.ramp;
  const { knee, hem } = SILHOUETTE[product.fit];
  const wear = WEAR[way.wash];
  const yWaist = RISE_TOP[product.rise];
  const yBand = yWaist + 24;

  const waistHalf = 52;
  const hipHalf = 64;

  const leg = (dir: -1 | 1) => {
    const oKnee = knee + 4, iKnee = 4, oHem = hem + 5, iHem = 5;
    const x = (v: number) => CX + dir * v;
    return [
      `M ${x(hipHalf)} ${Y_HIP}`,
      `C ${x(hipHalf)} ${Y_HIP + 60}, ${x(oKnee)} ${Y_KNEE - 70}, ${x(oKnee)} ${Y_KNEE}`,
      `C ${x(oKnee)} ${Y_KNEE + 60}, ${x(oHem)} ${Y_HEM - 60}, ${x(oHem)} ${Y_HEM}`,
      `L ${x(iHem)} ${Y_HEM}`,
      `C ${x(iHem)} ${Y_HEM - 60}, ${x(iKnee)} ${Y_KNEE + 60}, ${x(iKnee)} ${Y_KNEE}`,
      // Inner seam runs up to the crotch point, then straight across the top
      // to the centre line — the two legs share that edge, so the rise fills
      // solid instead of leaving a wedge of background showing through.
      `C ${x(iKnee)} ${Y_KNEE - 70}, ${x(2)} ${Y_CROTCH + 46}, ${x(2)} ${Y_CROTCH}`,
      `L ${CX} ${Y_CROTCH}`,
      `L ${CX} ${Y_HIP}`,
      "Z",
    ].join(" ");
  };

  const bodyPath = [
    `M ${CX - waistHalf} ${yWaist}`,
    `L ${CX + waistHalf} ${yWaist}`,
    `C ${CX + waistHalf + 6} ${yWaist + 50}, ${CX + hipHalf} ${Y_HIP - 40}, ${CX + hipHalf} ${Y_HIP + 4}`,
    `L ${CX - hipHalf} ${Y_HIP + 4}`,
    `C ${CX - hipHalf} ${Y_HIP - 40}, ${CX - waistHalf - 6} ${yWaist + 50}, ${CX - waistHalf} ${yWaist}`,
    "Z",
  ].join(" ");

  // Topstitch thread. Real jeans use a tonal gold that reads almost brown
  // against indigo — the bright dashed gold looked like scaffolding.
  const stitch = {
    stroke: flat ? "#14315f" : "#b8912f",
    strokeWidth: 1,
    strokeDasharray: "3.5 3",
    fill: "none",
    opacity: flat ? 0.55 : 0.5,
  };

  return (
    <svg viewBox="0 0 300 500" className={className} role="img"
         aria-label={`${product.name}, ${product.fit.toLowerCase()} fit in ${way.wash.toLowerCase()}`}>
      <defs>
        <linearGradient id={`w-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={shadow} />
          <stop offset="22%" stopColor={body} />
          <stop offset="50%" stopColor={highlight} stopOpacity={0.22 + wear * 0.4} />
          <stop offset="78%" stopColor={body} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>
        {/* Twill: the diagonal that makes denim denim. */}
        <pattern id={`t-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="none" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="0.9" opacity="0.075" />
          <line x1="3" y1="0" x2="3" y2="6" stroke="#000000" strokeWidth="0.9" opacity="0.065" />
        </pattern>
        {/* Whiskers at the hip and honeycombs behind the knee. */}
        <radialGradient id={`sh-${uid}`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#0d1420" stopOpacity="0.20" />
          <stop offset="65%" stopColor="#0d1420" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#0d1420" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`wh-${uid}`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={wear * 0.28} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g style={{
        transition: "transform 900ms cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-8px) scale(1.015)" : "none",
        transformOrigin: "center",
      }}>
        {/* contact shadow, so the garment sits on the ground rather than
            floating in front of it */}
        {!flat && (
          <ellipse cx={CX} cy={Y_HEM + 14} rx={Math.max(hem + 34, 78)} ry="11"
                   fill={`url(#sh-${uid})`} />
        )}

        {/* fabric — or, in flat mode, the technical drawing the pattern
            cutter actually works from */}
        <g>
          <path d={bodyPath} fill={flat ? "#ffffff" : `url(#w-${uid})`}
                stroke={flat ? "#14315f" : "none"} strokeWidth={flat ? 1.6 : 0} />
          <path d={leg(-1)} fill={flat ? "#ffffff" : `url(#w-${uid})`}
                stroke={flat ? "#14315f" : "none"} strokeWidth={flat ? 1.6 : 0} />
          <path d={leg(1)} fill={flat ? "#ffffff" : `url(#w-${uid})`}
                stroke={flat ? "#14315f" : "none"} strokeWidth={flat ? 1.6 : 0} />
        </g>
        {!flat && (
          <g>
            <path d={bodyPath} fill={`url(#t-${uid})`} />
            <path d={leg(-1)} fill={`url(#t-${uid})`} />
            <path d={leg(1)} fill={`url(#t-${uid})`} />
          </g>
        )}

        {/* wear marks */}
        {!flat && wear > 0.25 && (
          <g>
            <ellipse cx={CX - 44} cy={Y_HIP + 30} rx="46" ry="26" fill={`url(#wh-${uid})`} />
            <ellipse cx={CX + 44} cy={Y_HIP + 30} rx="46" ry="26" fill={`url(#wh-${uid})`} />
            <ellipse cx={CX - 26} cy={Y_KNEE} rx="26" ry="34" fill={`url(#wh-${uid})`} />
            <ellipse cx={CX + 26} cy={Y_KNEE} rx="26" ry="34" fill={`url(#wh-${uid})`} />
          </g>
        )}

        {/* waistband */}
        <path d={`M ${CX - waistHalf} ${yWaist} L ${CX + waistHalf} ${yWaist} L ${CX + waistHalf + 3} ${yBand} L ${CX - waistHalf - 3} ${yBand} Z`}
              fill={flat ? "#ffffff" : shadow} stroke={flat ? "#14315f" : "none"}
              strokeWidth={flat ? 1.2 : 0} opacity={flat ? 1 : 0.55} />
        <path d={`M ${CX - waistHalf} ${yWaist + 4} L ${CX + waistHalf} ${yWaist + 4}`} {...stitch} />
        <path d={`M ${CX - waistHalf - 2} ${yBand - 4} L ${CX + waistHalf + 2} ${yBand - 4}`} {...stitch} />

        {/* belt loops */}
        {[-40, -20, 0, 20, 40].map((dx) => (
          <rect key={dx} x={CX + dx - 2.5} y={yWaist - 1} width="5" height={25} rx="1"
                fill={flat ? "#ffffff" : body}
                stroke={flat ? "#14315f" : shadow} strokeWidth="0.7" opacity={flat ? 1 : 0.9} />
        ))}

        {/* fly + shank button */}
        <path d={`M ${CX + 8} ${yBand} C ${CX + 10} ${yBand + 30}, ${CX + 4} ${Y_HIP - 6}, ${CX} ${Y_CROTCH - 6}`} {...stitch} />
        <circle cx={CX - 2} cy={yWaist + 12} r="5.5" fill="#c9ccd2" stroke="#7d8899" strokeWidth="1" />

        {/* front pocket openings — one clean scoop each side */}
        <path d={`M ${CX - waistHalf + 6} ${yBand + 1} C ${CX - 34} ${yBand + 26}, ${CX - 28} ${yBand + 38}, ${CX - 23} ${yBand + 50}`} {...stitch} />
        <path d={`M ${CX + waistHalf - 6} ${yBand + 1} C ${CX + 34} ${yBand + 26}, ${CX + 28} ${yBand + 38}, ${CX + 23} ${yBand + 50}`} {...stitch} />

        {/* rivets, only at the two pocket corners that actually carry load */}
        {!flat && [[CX - 23, yBand + 50], [CX + 23, yBand + 50]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.9" fill="#a8863a" opacity="0.75" />
        ))}

        {/* inseam + outseam + hems */}
        <path d={`M ${CX - 8} ${Y_CROTCH} C ${CX - 10} ${Y_KNEE - 60}, ${CX - 9} ${Y_KNEE + 60}, ${CX - 9} ${Y_HEM - 6}`} {...stitch} />
        <path d={`M ${CX + 8} ${Y_CROTCH} C ${CX + 10} ${Y_KNEE - 60}, ${CX + 9} ${Y_KNEE + 60}, ${CX + 9} ${Y_HEM - 6}`} {...stitch} />
        <path d={`M ${CX - hem - 5} ${Y_HEM - 12} L ${CX - 5} ${Y_HEM - 12}`} {...stitch} />
        <path d={`M ${CX + 5} ${Y_HEM - 12} L ${CX + hem + 5} ${Y_HEM - 12}`} {...stitch} />
      </g>
    </svg>
  );
}
