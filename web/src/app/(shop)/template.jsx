"use client";

import { motion } from "framer-motion";

/** Route change: a denim panel wipes down over the old page and lifts off
 *  the new one. Hard-edged, no cross-fade — the Zara house style. */
export default function Template({ children }) {
  return (
    <>
      <motion.div
        className="denim-weave pointer-events-none fixed inset-0 z-[90]"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.75, ease: [0.77, 0, 0.175, 1] }}
        style={{ transformOrigin: "top" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </>
  );
}
