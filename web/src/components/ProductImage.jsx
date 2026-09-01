"use client";

import JeanPlate from "./JeanPlate";

/**
 * Shows the photograph uploaded in the admin for this colourway, and falls
 * back to the drawn plate when there isn't one. Every product therefore has
 * an image from day one, and gains a real photo the moment it is uploaded.
 */
export default function ProductImage({
  product,
  colour,
  hovered = false,
  flat = false,
  className = "",
}) {
  const way = colour ?? product.colours[0];

  if (way.photo && !flat) {
    return (
      // Photos come from the admin as data URLs, so next/image cannot
      // optimise them and a plain img is correct here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={way.photo}
        alt={`${product.name} in ${way.wash}`}
        className={`object-cover transition-transform duration-[900ms] ${className}`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
          transform: hovered ? "scale(1.04)" : "none",
        }}
      />
    );
  }

  return (
    <JeanPlate product={product} colour={way} hovered={hovered} flat={flat} className={className} />
  );
}
