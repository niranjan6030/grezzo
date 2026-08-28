"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { inr } from "@/lib/products";
import { useCatalogue } from "./CatalogueProvider";
import { isNative, nativePhoto } from "@/lib/native";
import { useLens } from "@/store/useLens";
import type { Product } from "@/lib/types";
import ProductImage from "./ProductImage";

interface Match { product: Product; score: number; why: string }

export default function VisualSearch() {
  const open = useLens((s) => s.open);
  const onClose = useLens((s) => s.closeLens);

  // The panel holds all the capture state. Mounting it only while open means
  // closing the lens resets everything and stops the camera through ordinary
  // unmount cleanup — no reset effect to keep in sync.
  return (
    <AnimatePresence>
      {open && <LensPanel onClose={onClose} />}
    </AnimatePresence>
  );
}

function LensPanel({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [mode, setMode] = useState<"clip" | "local" | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { products, byId } = useCatalogue();

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  const startCam = async () => {
    setErr(null);

    // Inside the iOS shell, hand off to the system camera — better capture,
    // and it is the permission dialog people expect on a phone.
    if (isNative()) {
      const shot = await nativePhoto();
      if (shot) analyse(shot);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch {
      setErr("Camera unavailable. Upload a photo instead.");
    }
  };

  const shoot = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stopCam();
    analyse(c.toDataURL("image/jpeg", 0.85));
  };

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => analyse(String(reader.result));
    reader.readAsDataURL(f);
  };

  const analyse = async (dataUrl: string) => {
    setPreview(dataUrl);
    setBusy(true);
    setMatches(null);
    setErr(null);
    try {
      const res = await fetch("/api/visual-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (json.matches?.length) {
        setMode(json.engine);
        setMatches(
          json.matches
            .map((m: { productId: string; score: number; why: string }) => ({
              product: byId(m.productId)!, score: m.score, why: m.why,
            }))
            .filter((m: Match) => m.product),
        );
      } else {
        throw new Error("no matches");
      }
    } catch {
      // Service down or not deployed yet — fall back to on-device colour matching.
      setMode("local");
      setMatches(await localMatch(dataUrl, products));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      initial={{ clipPath: "circle(0% at 88% 5%)" }}
      animate={{ clipPath: "circle(150% at 88% 5%)" }}
      exit={{ clipPath: "circle(0% at 88% 5%)" }}
      transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4 md:px-10">
        <div>
          <p className="tracked-lg text-[1rem]">GREZZO LENS</p>
          <p className="mt-1 text-xs text-ink-soft">
            Photograph any pair of jeans. We find the closest cut in the archive.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close"><X size={22} strokeWidth={1.25} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[320px_1fr]">
          {/* ---- capture ---- */}
          <div>
            <div className="denim-weave-light relative aspect-[3/4] overflow-hidden border border-line">
              {camOn ? (
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-soft">
                  <Camera size={34} strokeWidth={1} />
                  <p className="tracked">No image yet</p>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                  <Loader2 className="animate-spin text-denim-mid" size={30} strokeWidth={1.25} />
                </div>
              )}
              {/* scan sweep */}
              {busy && (
                <motion.div
                  className="absolute inset-x-0 h-[2px] bg-thread"
                  initial={{ top: "0%" }} animate={{ top: "100%" }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>

            <div className="mt-4 flex gap-3">
              {camOn ? (
                <button onClick={shoot} className="tracked flex-1 bg-denim-deep py-3 text-white">
                  Capture
                </button>
              ) : (
                <button onClick={startCam} className="tracked flex-1 border border-denim-deep py-3">
                  <Camera size={15} className="mr-2 inline" strokeWidth={1.25} /> Camera
                </button>
              )}
              <label className="tracked flex-1 cursor-pointer border border-denim-deep py-3 text-center">
                <ImageIcon size={15} className="mr-2 inline" strokeWidth={1.25} /> Upload
                <input type="file" accept="image/*" className="hidden"
                       onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
            </div>
            {err && <p className="mt-3 text-xs text-ink-soft">{err}</p>}
            {mode && matches && (
              <p className="mt-4 text-xs text-ink-soft">
                {mode === "clip"
                  ? "Matched with CLIP image embeddings."
                  : "Matched on-device by colour and tone — the embedding service is not connected."}
              </p>
            )}
          </div>

          {/* ---- results ---- */}
          <div>
            <p className="tracked border-b border-line pb-3">
              {matches ? `${matches.length} closest cuts` : "Results"}
            </p>
            <div className="grid grid-cols-2 gap-6 pt-6 sm:grid-cols-3">
              {matches?.map((m, i) => (
                <motion.div key={m.product.id}
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
                  <Link href={`/product/${m.product.slug}`} onClick={onClose}>
                    <div className="denim-weave-light aspect-[3/4] overflow-hidden">
                      <ProductImage product={m.product} className="h-full w-full" />
                    </div>
                    <p className="tracked mt-3">{m.product.name}</p>
                    <p className="mt-1 text-xs text-ink-soft">{inr(m.product.pricePaise)}</p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-denim-mid">
                      {Math.round(m.score * 100)}% · {m.why}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
            {!matches && !busy && (
              <p className="pt-6 text-sm text-ink-soft">
                Straight-on shots of the full leg work best. We read the wash, the tone
                and the width of the leg opening.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------
   On-device fallback. Averages the image down to a handful of colour
   and tone statistics and scores them against each product's ramp.
   Crude next to CLIP, but it runs with zero infrastructure and it is
   right about wash and darkness surprisingly often.
   ------------------------------------------------------------------ */
async function localMatch(dataUrl: string, products: Product[]): Promise<Match[]> {
  const img = await loadImage(dataUrl);
  const N = 48;
  const c = document.createElement("canvas");
  c.width = N; c.height = N;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, N, N);
  const { data } = ctx.getImageData(0, 0, N, N);

  let r = 0, g = 0, b = 0, n = 0;
  const lums: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Ignore near-white studio background so the garment dominates.
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    if (lum > 0.94) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    lums.push(lum);
  }
  if (!n) return products.slice(0, 6).map((p) => ({ product: p, score: 0.4, why: "no signal" }));
  const avg = [r / n, g / n, b / n] as const;
  lums.sort((x, y) => x - y);
  const median = lums[Math.floor(lums.length / 2)];
  const contrast = (lums.at(-1)! - lums[0]);

  return products.map((p) => {
    const target = hexToRgb(p.ramp[1]);
    const dist = Math.sqrt(
      (avg[0] - target[0]) ** 2 + (avg[1] - target[1]) ** 2 + (avg[2] - target[2]) ** 2,
    ) / 441.67;
    const targetLum = (0.2126 * target[0] + 0.7152 * target[1] + 0.0722 * target[2]) / 255;
    const lumGap = Math.abs(median - targetLum);
    const wearGap = Math.abs(contrast - 0.55) * 0.3;
    const score = Math.max(0, 1 - (dist * 0.55 + lumGap * 0.4 + wearGap));
    const why = lumGap < 0.09 ? "wash match" : dist < 0.22 ? "tone match" : "closest indigo";
    return { product: p, score, why };
  })
    .sort((a, b2) => b2.score - a.score)
    .slice(0, 6);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
