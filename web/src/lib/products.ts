import type { Fit, Product, Rise, Wash } from "./types";

type Seed = Omit<Product, "vector" | "colours" | "wash" | "ramp"> & { washes: Wash[] };

/** One ramp per wash, shared across the range — a stone wash should not look
 *  like a different colour depending on which jean it is on. */
export const WASH_RAMP: Record<Wash, [string, string, string]> = {
  "Raw Indigo":    ["#0b1524", "#182a44", "#33486a"],
  "Rinse":         ["#101c2f", "#243652", "#47597b"],
  "Dark Stone":    ["#111c2e", "#22344f", "#42597d"],
  "Mid Stone":     ["#1b2c44", "#3a5175", "#7385a1"],
  "Light Stone":   ["#4a5f7d", "#8394ac", "#c0c9d5"],
  "Bleach":        ["#8e9aa9", "#c2c9d2", "#e8ebee"],
  "Ecru":          ["#b8ae9a", "#dbd3c3", "#f0ebe1"],
  "Black Overdye": ["#0a0c10", "#181b21", "#333840"],
};

export const washCode = (w: Wash) => w.toLowerCase().replace(/\s+/g, "-");

/* Ordered attribute scales — these double as the axes of the content-based
   feature vector, so "Skinny" sits next to "Slim" and far from "Baggy". */
const FITS: Fit[] = ["Skinny", "Slim", "Tapered", "Straight", "Regular", "Bootcut", "Relaxed", "Wide Leg", "Baggy"];
const RISES: Rise[] = ["Low", "Mid", "High"];
const WASHES: Wash[] = ["Raw Indigo", "Rinse", "Dark Stone", "Mid Stone", "Light Stone", "Bleach", "Ecru", "Black Overdye"];

/* Menswear waist sizes, in inches. */
const STD = [28, 30, 31, 32, 33, 34, 36, 38, 40];

const seeds: Seed[] = [
  {
    id: "gz-001", slug: "selvedge-column-high-rise", name: "Selvedge Column",
    pricePaise: 799000, fit: "Straight", rise: "High", washes: ["Raw Indigo", "Rinse", "Black Overdye"], sizes: STD,
    fabric: "100% cotton, unsanforised Japanese selvedge", weightOz: 14.5, stretchPct: 0, collection: "Atelier",
    story: "Woven on shuttle looms at 32 picks a minute — a tenth of modern speed. It arrives stiff, and takes about six months to become yours.",
    tags: ["selvedge", "raw", "japanese", "heavyweight", "straight"],
  },
  {
    id: "gz-002", slug: "kyoto-wide-leg", name: "Kyoto Wide Leg",
    pricePaise: 549000, comparePaise: 699000, fit: "Wide Leg", rise: "High",
    washes: ["Mid Stone", "Light Stone", "Dark Stone"], sizes: STD,
    fabric: "99% cotton, 1% elastane", weightOz: 11, stretchPct: 2, collection: "Atelier",
    story: "The leg opening is 26cm — deliberately wider than the hip — so the fabric falls in a single unbroken line from waist to floor.",
    tags: ["wide", "high-rise", "drapey", "statement"],
  },
  {
    id: "gz-003", slug: "midnight-skinny", name: "Midnight Skinny",
    pricePaise: 399000, fit: "Skinny", rise: "Mid", washes: ["Black Overdye", "Raw Indigo", "Dark Stone"], sizes: STD,
    fabric: "92% cotton, 6% polyester, 2% elastane", weightOz: 10, stretchPct: 18, collection: "Core",
    story: "Overdyed twice in reactive black so the indigo underneath only shows at the seams, where the thread pulls tight.",
    tags: ["skinny", "black", "stretch", "everyday"],
  },
  {
    id: "gz-004", slug: "bleach-cloud-baggy", name: "Bleach Cloud Baggy",
    pricePaise: 629000, fit: "Baggy", rise: "High", washes: ["Bleach", "Light Stone", "Ecru"], sizes: STD,
    fabric: "100% cotton", weightOz: 12.5, stretchPct: 0, collection: "Studio",
    story: "Bleached with ozone rather than chlorine — the same result using 95% less water and no discharge into the river.",
    tags: ["baggy", "bleach", "light", "oversized", "sustainable"],
  },
  {
    id: "gz-005", slug: "rinse-straight-classic", name: "Rinse Straight",
    pricePaise: 349000, fit: "Straight", rise: "Mid", washes: ["Rinse", "Dark Stone", "Raw Indigo"], sizes: STD,
    fabric: "100% cotton", weightOz: 12, stretchPct: 0, collection: "Core",
    story: "One rinse, nothing else. The wash you would get after wearing raw denim home in the rain.",
    tags: ["straight", "classic", "rinse", "everyday"],
  },
  {
    id: "gz-006", slug: "atelier-bootcut", name: "Atelier Bootcut",
    pricePaise: 579000, fit: "Bootcut", rise: "High", washes: ["Dark Stone", "Mid Stone", "Black Overdye"], sizes: STD,
    fabric: "98% cotton, 2% elastane", weightOz: 11.5, stretchPct: 5, collection: "Atelier",
    story: "Cut narrow through the thigh and released from the knee at exactly 18 degrees — enough to clear a boot, not enough to sweep the floor.",
    tags: ["bootcut", "flare", "dark", "tailored"],
  },
  {
    id: "gz-007", slug: "workwear-relaxed-carpenter", name: "Workwear Carpenter",
    pricePaise: 519000, fit: "Relaxed", rise: "Mid", washes: ["Mid Stone", "Light Stone", "Dark Stone"], sizes: STD,
    fabric: "100% cotton duck-faced denim", weightOz: 13.5, stretchPct: 0, collection: "Utility",
    story: "Hammer loop, rule pocket, triple-needle felled seams. Built to the 1930s pattern, which was built to survive a job site.",
    tags: ["carpenter", "relaxed", "utility", "workwear", "heavyweight"],
  },
  {
    id: "gz-008", slug: "ecru-slim-tapered", name: "Ecru Slim Taper",
    pricePaise: 459000, fit: "Tapered", rise: "Mid", washes: ["Ecru", "Bleach", "Light Stone"], sizes: STD,
    fabric: "100% undyed cotton", weightOz: 11, stretchPct: 0, collection: "Studio",
    story: "Never dyed at all. What denim looks like before indigo — which is to say, what the cotton actually looks like.",
    tags: ["ecru", "undyed", "slim", "taper", "natural"],
  },
  {
    id: "gz-009", slug: "stonewash-loose", name: "Stonewash Loose",
    pricePaise: 429000, fit: "Regular", rise: "High", washes: ["Light Stone", "Bleach", "Mid Stone"], sizes: STD,
    fabric: "100% cotton", weightOz: 12, stretchPct: 0, collection: "Core",
    story: "Tumbled with pumice from Icelandic volcanic fields. Each stone lasts about forty washes before it dissolves into sand.",
    tags: ["loose", "stonewash", "vintage", "relaxed", "90s"],
  },
  {
    id: "gz-010", slug: "indigo-slim-stretch", name: "Indigo Slim Stretch",
    pricePaise: 379000, fit: "Slim", rise: "Mid", washes: ["Dark Stone", "Mid Stone", "Black Overdye"], sizes: STD,
    fabric: "94% cotton, 4% polyester, 2% elastane", weightOz: 10.5, stretchPct: 22, collection: "Core",
    story: "Recovery yarn in the weft means the knee stops bagging by four o'clock. The single most requested fix in denim.",
    tags: ["slim", "stretch", "dark", "comfort", "everyday"],
  },
  {
    id: "gz-011", slug: "painter-wide-ecru", name: "Painter Wide",
    pricePaise: 599000, fit: "Wide Leg", rise: "High", washes: ["Ecru", "Bleach", "Light Stone"], sizes: STD,
    fabric: "100% organic cotton", weightOz: 12.5, stretchPct: 0, collection: "Studio",
    story: "Double-knee, dropped crotch, side rule pocket. Modelled on the trousers house painters wore before overalls existed.",
    tags: ["painter", "wide", "ecru", "organic", "utility"],
  },
  {
    id: "gz-012", slug: "raw-skinny-selvedge", name: "Raw Skinny Selvedge",
    pricePaise: 689000, fit: "Skinny", rise: "High", washes: ["Raw Indigo", "Rinse", "Black Overdye"], sizes: STD,
    fabric: "98% cotton, 2% elastane selvedge", weightOz: 12.5, stretchPct: 8, collection: "Atelier",
    story: "Rare thing: a selvedge denim with give. Woven at half width on a vintage loom, then cut so the red line runs down the outseam.",
    tags: ["selvedge", "raw", "skinny", "high-rise", "premium"],
  },
  {
    id: "gz-013", slug: "loose-tapered", name: "Loose Taper",
    pricePaise: 469000, fit: "Tapered", rise: "High", washes: ["Mid Stone", "Light Stone", "Dark Stone"], sizes: STD,
    fabric: "100% cotton", weightOz: 11.5, stretchPct: 0, collection: "Core",
    story: "Full through the thigh, closed down hard below the knee. The shape that lets a heavy boot sit under a jean without the leg stacking.",
    tags: ["taper", "loose", "roomy", "boots"],
  },
  {
    id: "gz-014", slug: "heavy-regular-14oz", name: "Heavy Regular 14oz",
    pricePaise: 559000, fit: "Regular", rise: "Mid", washes: ["Rinse", "Dark Stone", "Raw Indigo"], sizes: STD,
    fabric: "100% cotton, sanforised", weightOz: 14, stretchPct: 0, collection: "Utility",
    story: "Fourteen ounces per square yard. Heavy enough that the creases behind the knee become permanent — and become a record of how you move.",
    tags: ["heavyweight", "regular", "rinse", "durable"],
  },
  {
    id: "gz-015", slug: "bleach-bootcut", name: "Bleach Bootcut",
    pricePaise: 539000, fit: "Bootcut", rise: "Mid", washes: ["Bleach", "Light Stone", "Ecru"], sizes: STD,
    fabric: "97% cotton, 3% elastane", weightOz: 10.5, stretchPct: 12, collection: "Studio",
    story: "The flare starts at mid-calf, not the knee, which is what separates a 70s line from a 90s one.",
    tags: ["flare", "bootcut", "bleach", "retro", "70s"],
  },
  {
    id: "gz-016", slug: "utility-baggy-cargo", name: "Utility Baggy",
    pricePaise: 649000, fit: "Baggy", rise: "Mid", washes: ["Dark Stone", "Mid Stone", "Black Overdye"], sizes: STD,
    fabric: "100% cotton", weightOz: 13, stretchPct: 0, collection: "Utility",
    story: "Two bellowed side pockets set on the seam rather than the front, so they stay flat when empty.",
    tags: ["baggy", "cargo", "utility", "dark", "streetwear"],
  },
];

/** Normalised feature vector — the content half of the recommender, and the
 *  metadata the LSTM service embeds alongside each item id. */
function featureVector(p: Seed): number[] {
  return [
    FITS.indexOf(p.fit) / (FITS.length - 1),
    RISES.indexOf(p.rise) / (RISES.length - 1),
    WASHES.indexOf(p.washes[0]) / (WASHES.length - 1),
    Math.min(p.pricePaise / 1000000, 1),
    Math.min(p.weightOz / 16, 1),
    p.stretchPct / 25,
  ];
}

export const PRODUCTS: Product[] = seeds.map((s) => {
  const colours = s.washes.map((w) => ({ code: washCode(w), wash: w, ramp: WASH_RAMP[w] }));
  return {
    ...s,
    colours,
    wash: colours[0].wash,
    ramp: colours[0].ramp,
    vector: featureVector(s),
  };
});

export const colourOf = (p: Product, code?: string) =>
  p.colours.find((c) => c.code === code) ?? p.colours[0];

export const bySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const byId = (id: string) => PRODUCTS.find((p) => p.id === id);

export const COLLECTIONS = [...new Set(PRODUCTS.map((p) => p.collection))];
export const ALL_FITS = [...new Set(PRODUCTS.map((p) => p.fit))];
export const WASH_NAMES = Object.keys(WASH_RAMP) as Wash[];

export const ALL_WASHES = [...new Set(PRODUCTS.flatMap((p) => p.colours.map((c) => c.wash)))];

export const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(paise / 100);
