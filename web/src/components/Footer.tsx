import Link from "next/link";
import { FactRibbon } from "./DenimFacts";
import { factsForNow } from "@/lib/facts";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      ["All jeans", "/jeans"], ["Core", "/jeans?collection=Core"],
      ["Atelier", "/jeans?collection=Atelier"], ["Utility", "/jeans?collection=Utility"],
      ["Studio", "/jeans?collection=Studio"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Contact", "/contact"], ["Size & fit", "/contact#fit"], ["Shipping", "/contact#shipping"],
      ["Returns", "/contact#returns"], ["Care", "/facts"],
    ],
  },
  {
    title: "Company",
    links: [
      ["The Denim Index", "/facts"], ["Grezzo Lens", "/jeans"], ["Account", "/account"],
      ["Privacy", "/contact#privacy"], ["Cookies", "/contact#cookies"],
    ],
  },
];

export default function Footer() {
  return (
    <footer>
      <FactRibbon facts={factsForNow(14)} />
      <div className="denim-weave-light px-5 py-16 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="tracked-lg text-xl">GREZZO</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              Grezzo is Italian for raw. Menswear denim only — one garment, made properly:
              woven, dyed and finished with the whole process on the label.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="tracked mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-ink-soft seam-link">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="topstitch mx-auto mt-14 max-w-6xl" />
        <div className="mx-auto mt-6 flex max-w-6xl flex-col gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} Grezzo</span>
          <span>Payments secured by Razorpay · Prices include GST</span>
        </div>
      </div>
    </footer>
  );
}
