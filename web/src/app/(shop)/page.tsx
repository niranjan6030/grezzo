import Link from "next/link";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import Recommendations from "@/components/Recommendations";
import { FactPanel } from "@/components/DenimFacts";
import LensCta from "@/components/LensCta";
import { factsForNow } from "@/lib/facts";
import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";

export default async function Home() {
  const catalogue = mergeCatalogue(await readAdminData());

  /* Each row draws from a shared pool so nothing appears twice on the page.
     Picking independently meant the heaviest jean led "New in", "Atelier"
     and the recommendations at once — on a range this size that reads as a
     broken page rather than a considered one. */
  const used = new Set<string>();
  const take = (list: typeof catalogue, n: number) => {
    const picked: typeof catalogue = [];
    for (const p of list) {
      if (picked.length >= n) break;
      if (used.has(p.id)) continue;
      used.add(p.id);
      picked.push(p);
    }
    return picked;
  };

  // Atelier is the narrower pool, so it chooses first and always fills.
  const atelier = take(catalogue.filter((p) => p.collection === "Atelier"), 3);
  const featured = take(catalogue, 4);

  return (
    <>
      {/* Sits under the fixed header, so the fabric runs to the top edge. */}
      <div className="-mt-[68px]">
        <Hero />
      </div>

      {/* ---- featured row ---- */}
      <section className="px-5 py-24 md:px-10">
        <Reveal>
          <div className="mb-10 flex items-end justify-between pb-4">
            <h2 className="tracked-lg text-lg">New in</h2>
            <Link href="/jeans" className="tracked seam-link text-ink-soft">View all</Link>
          </div>
          <div className="topstitch mb-10 -mt-10" />
        </Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="topstitch mx-5 md:mx-10" />

      {/* ---- editorial split ---- */}
      <section className="grid md:grid-cols-2">
        <div className="denim-weave relative flex min-h-[70vh] items-center px-8 py-24 text-white md:px-16">
          <div className="topstitch-y absolute inset-y-8 right-5 opacity-60" />
          <Reveal>
            <p className="tracked text-thread">The Denim Index</p>
            <h2 className="tracked-lg mt-6 text-4xl leading-tight md:text-5xl">
              Know what<br />you are wearing
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed opacity-80">
              Every pair carries its weight in ounces, its twill direction, its dye method and
              the water it took to finish. Not marketing copy — the specification.
            </p>
            <Link href="/facts"
                  className="tracked mt-10 inline-block border border-white px-10 py-3.5 transition-colors duration-500 hover:bg-white hover:text-denim-raw">
              Read the index
            </Link>
          </Reveal>
        </div>

        <div className="flex min-h-[70vh] items-center bg-white px-8 py-24 md:px-16">
          <Reveal delay={0.12} className="w-full">
            <FactPanel facts={factsForNow(8)} />
          </Reveal>
        </div>
      </section>

      {/* ---- lens ---- */}
      <section className="denim-weave-light relative px-5 py-24 text-center md:px-10">
        <div className="topstitch absolute inset-x-0 top-3" />
        <div className="topstitch absolute inset-x-0 bottom-3" />
        <Reveal>
          <p className="tracked text-denim-mid">Grezzo Lens</p>
          <h2 className="tracked-lg mx-auto mt-6 max-w-3xl text-3xl leading-tight md:text-5xl">
            Photograph any jeans.<br />We find the closest cut.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-ink-soft">
            It reads the wash, the tone and the width of the leg opening, then matches
            against the archive.
          </p>
          <LensCta />
        </Reveal>
      </section>

      {/* ---- atelier ---- */}
      <section className="px-5 py-24 md:px-10">
        <Reveal>
          <div className="mb-10 flex items-end justify-between pb-4">
            <h2 className="tracked-lg text-lg">Atelier</h2>
            <Link href="/jeans?collection=Atelier" className="tracked seam-link text-ink-soft">View all</Link>
          </div>
          <div className="topstitch mb-10 -mt-10" />
        </Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6">
          {atelier.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      <Recommendations exclude={[...used]} />
    </>
  );
}
