"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Continuous ribbon of denim facts. Pauses on hover so a fact can be read. */
export function FactRibbon({ facts }) {
  const line = facts.map((f) => f.short);
  const doubled = [...line, ...line]; // seamless loop needs two copies
  return (
    <div className="marquee-host denim-weave overflow-hidden py-2.5 text-white">
      <div className="marquee-track">
        {doubled.map((t, i) => (
          <span key={i} className="tracked flex shrink-0 items-center px-7 opacity-90">
            <span className="mr-7 text-thread">✳</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Rotating long-form fact. Morphs between entries rather than cutting. */
export function FactPanel({ facts, interval = 7000 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % facts.length), interval);
    return () => clearInterval(t);
  }, [interval, facts.length]);
  const fact = facts[i % facts.length];
  if (!fact) return null;

  return (
    <div className="relative min-h-[190px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="tracked text-thread">{fact.tag}</p>
          <p className="mt-4 text-2xl font-light leading-snug md:text-3xl">{fact.short}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-75">{fact.long}</p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-7 flex gap-1.5">
        {facts.map((_, n) => (
          <button
            key={n}
            onClick={() => setI(n)}
            aria-label={`Fact ${n + 1}`}
            className={`h-[2px] flex-1 transition-colors duration-500 ${
              n === i ? "bg-thread" : "bg-current opacity-25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
