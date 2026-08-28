import { DENIM_FACTS, factsForNow, nextRotationAt } from "@/lib/facts";
import Reveal from "@/components/Reveal";
import { FactPanel } from "@/components/DenimFacts";

export const metadata = {
  title: "The Denim Index",
  description: "How denim is woven, dyed, finished and cared for — the specification behind the garment.",
};

const TAGS = ["History", "Craft", "Fabric", "Care", "Planet", "Culture"] as const;

export default function FactsPage() {
  const featured = factsForNow(8);
  const rotatesAt = nextRotationAt();

  return (
    <>
      <section className="denim-weave px-5 py-24 text-white md:px-10">
        <Reveal>
          <p className="tracked text-thread">Reference</p>
          <h1 className="tracked-lg mt-6 text-4xl leading-tight md:text-6xl">The Denim Index</h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed opacity-80">
            {DENIM_FACTS.length} things worth knowing about the only fabric we make.
            Checkable, sourced, and occasionally inconvenient for us. A different
            selection is featured every twelve hours — the full index is below.
          </p>
        </Reveal>
        <div className="mt-16 max-w-3xl">
          <FactPanel facts={featured} interval={9000} />
        </div>
        <p className="mt-10 text-[0.62rem] uppercase tracking-[0.18em] opacity-50">
          Next selection {rotatesAt.toLocaleString("en-IN", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </section>

      {/* The whole index, grouped. Nothing is hidden behind the rotation. */}
      {TAGS.map((tag) => {
        const facts = DENIM_FACTS.filter((f) => f.tag === tag);
        if (!facts.length) return null;
        return (
          <section key={tag} className="px-5 py-16 md:px-10">
            <Reveal>
              <h2 className="tracked-lg border-b border-line pb-4 text-lg">{tag}</h2>
            </Reveal>
            <div className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">
              {facts.map((f, i) => (
                <Reveal key={f.short} delay={i * 0.06}>
                  <p className="text-xl font-light leading-snug">{f.short}</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.long}</p>
                </Reveal>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
