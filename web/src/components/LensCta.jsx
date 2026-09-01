"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useLens } from "@/store/useLens";

/** The two ways into Grezzo Lens, put where people are actually reading about
 *  it rather than only as an icon in the header. */
export default function LensCta() {
  const openLens = useLens((s) => s.openLens);

  return (
    <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
      <button
        onClick={openLens}
        className="tracked flex items-center justify-center gap-2.5 bg-denim-deep px-10 py-3.5 text-white transition-colors duration-500 hover:bg-denim-mid"
      >
        <Camera size={16} strokeWidth={1.4} />
        Take a photo
      </button>
      <button
        onClick={openLens}
        className="tracked flex items-center justify-center gap-2.5 border border-denim-deep px-10 py-3.5 transition-colors duration-500 hover:bg-denim-deep hover:text-white"
      >
        <ImagePlus size={16} strokeWidth={1.4} />
        Upload an image
      </button>
    </div>
  );
}
