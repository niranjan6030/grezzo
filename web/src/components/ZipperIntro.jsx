"use client";

import { useCallback, useEffect, useState } from "react";
import { markIntroPlayed, useIntroWillPlay } from "@/lib/intro";
import ZipCurtain, { useZipProgress } from "./ZipCurtain";

/** The entrance: the store is behind a zipped panel of denim, and it opens. */
const DURATION = 2600;

export default function ZipperIntro() {
  const willPlay = useIntroWillPlay();
  const [done, setDone] = useState(false);
  const finish = useCallback(() => {
    markIntroPlayed();
    document.body.style.overflow = "";
    setDone(true);
  }, []);

  const progress = useZipProgress(DURATION, willPlay && !done, finish);

  useEffect(() => {
    if (!willPlay || done) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [willPlay, done]);

  if (!willPlay || done) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <ZipCurtain progress={progress} />
      <button
        onClick={finish}
        className="tracked absolute bottom-8 right-8 z-10 text-white/70 transition-colors hover:text-white"
      >
        Skip
      </button>
    </div>
  );
}
