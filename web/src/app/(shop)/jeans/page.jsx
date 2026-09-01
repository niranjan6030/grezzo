import { Suspense } from "react";
import JeansBrowser from "@/components/JeansBrowser";

export const metadata = { title: "All jeans" };

export default function JeansPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-24 md:px-10">
          <p className="tracked">Loading…</p>
        </div>
      }
    >
      <JeansBrowser />
    </Suspense>
  );
}
