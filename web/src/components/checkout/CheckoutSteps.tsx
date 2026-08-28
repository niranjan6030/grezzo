"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { path: "/cart", label: "Bag" },
  { path: "/checkout/address", label: "Delivery" },
  { path: "/checkout/review", label: "Review & pay" },
];

export default function CheckoutSteps() {
  const pathname = usePathname();
  // The confirmation page is past the sequence, so everything reads as done.
  const current = pathname.startsWith("/checkout/done")
    ? STEPS.length
    : Math.max(0, STEPS.findIndex((s) => pathname.startsWith(s.path)));

  return (
    <ol className="mb-12 flex items-center gap-3 md:gap-5">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.path} className="flex flex-1 items-center gap-3 md:gap-5">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.62rem] transition-colors ${
                done ? "bg-denim-deep text-white"
                  : active ? "border border-denim-deep text-denim-deep"
                  : "border border-line text-ink-soft"}`}>
                {done ? <Check size={11} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={`tracked whitespace-nowrap ${
                active ? "text-ink" : "text-ink-soft"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`hidden h-px flex-1 transition-colors sm:block ${
                done ? "bg-denim-deep" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
