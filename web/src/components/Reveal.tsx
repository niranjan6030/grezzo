"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Zara's reveal: content rises out from behind a hard edge as it enters
 *  the viewport. No fade-only, no bounce. */
export default function Reveal({
  children, delay = 0, y = 42, once = true, className = "",
}: { children: ReactNode; delay?: number; y?: number; once?: boolean; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once, margin: "-12% 0px -12% 0px" }}
        transition={{ duration: 0.95, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
