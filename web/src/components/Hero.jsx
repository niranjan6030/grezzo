"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useIntroWillPlay } from "@/lib/intro";

/** Full-bleed opening. The fabric drifts slower than the type, which is the
 *  whole trick behind Zara's landing pages. */
export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fabricY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const typeY = useTransform(scrollYProgress, [0, 1], ["0%", "-38%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  // The intro runs once per session. When it is skipped the copy should not
  // sit and wait for an animation that never happened.
  const base = useIntroWillPlay() ? 2.6 : 0.15;

  return (
    <section ref={ref} className="relative h-[92vh] overflow-hidden">
      <motion.div className="denim-weave absolute inset-0 scale-110" style={{ y: fabricY }} />

      {/* Double-stitched seams running the full height, where an outseam
          actually falls. Two rows, because that is what a seam built to last
          uses — one row is trim, two is construction. */}
      <div className="topstitch-y pointer-events-none absolute inset-y-0 left-[18%] opacity-70" />
      <div className="topstitch-y pointer-events-none absolute inset-y-0 right-[18%] opacity-40" />

      <motion.div
        style={{ y: typeY, opacity: fade }}
        className="relative flex h-full flex-col items-center justify-center px-6 text-white"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: base, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="tracked text-thread"
        >
          Autumn / Winter — The Raw Edit
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: base + 0.15, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="tracked-lg mt-6 text-center text-[13vw] leading-[0.85] md:text-[8vw]"
        >
          Jeans.
          <br />
          Only jeans.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: base + 0.4, duration: 1 }}
          className="mt-8 max-w-md text-center text-sm leading-relaxed"
        >
          Menswear denim only. Sixteen cuts, eight washes, one fabric understood properly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: base + 0.55, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex gap-4"
        >
          <Link
            href="/jeans"
            className="tracked border border-white px-10 py-3.5 transition-colors duration-500 hover:bg-white hover:text-denim-raw"
          >
            Shop all
          </Link>
          <Link href="/facts" className="tracked px-4 py-3.5 seam-link">
            The Denim Index
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: base + 0.8, duration: 1 }}
        style={{ opacity: fade }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70"
      >
        <motion.div
          animate={{ y: [0, 9, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="tracked">Scroll</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
