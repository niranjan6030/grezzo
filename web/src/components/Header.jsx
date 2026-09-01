"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { ALL_FITS, ALL_WASHES } from "@/lib/products";
import { useCatalogue } from "./CatalogueProvider";
import { useCartCount, useStore } from "@/store/useStore";
import VisualSearch from "./VisualSearch";
import { useLens } from "@/store/useLens";

const NAV = [
  { href: "/jeans", label: "All Jeans" },
  { href: "/jeans?collection=Core", label: "Core" },
  { href: "/jeans?collection=Atelier", label: "Atelier" },
  { href: "/jeans?collection=Utility", label: "Utility" },
  { href: "/jeans?collection=Studio", label: "Studio" },
  { href: "/facts", label: "Denim Index" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [solid, setSolid] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCartCount();
  // Only the home page has a full-bleed hero to sit on top of.
  const overHero = pathname === "/" && !solid;
  const favCount = useStore((s) => s.favourites.length);
  const { products } = useCatalogue();
  const lensOpen = useLens((s) => s.open);
  const openLens = useLens((s) => s.openLens);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Navigating away closes whatever was open. Adjusting during render rather
  // than in an effect avoids a frame where the old page's menu is still up.
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen || lensOpen ? "hidden" : "";
  }, [menuOpen, lensOpen]);

  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return products
      .filter((p) =>
        [p.name, p.fit, p.wash, p.collection, ...p.tags].join(" ").toLowerCase().includes(t),
      )
      .slice(0, 5);
  }, [q, products]);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/jeans?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          overHero
            ? "bg-transparent text-white"
            : "bg-white/92 text-ink shadow-[0_1px_0_var(--line)] backdrop-blur-md"
        }`}
        style={{ transitionTimingFunction: "var(--ease-drape)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 md:px-10">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex items-center gap-3 transition-opacity hover:opacity-55"
          >
            <Menu size={20} strokeWidth={1.25} />
            <span className="tracked hidden md:inline">Menu</span>
          </button>

          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <span className="tracked-lg text-[1.15rem] md:text-[1.5rem]">GREZZO</span>
          </Link>

          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              className="transition-opacity hover:opacity-55"
            >
              {searchOpen ? (
                <X size={20} strokeWidth={1.25} />
              ) : (
                <Search size={20} strokeWidth={1.25} />
              )}
            </button>

            {/* The lens — image search sits next to the search field, as asked. */}
            <button
              onClick={() => openLens()}
              aria-label="Search by photo"
              className="group relative transition-opacity hover:opacity-55"
            >
              <Camera size={20} strokeWidth={1.25} />
              <span
                className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-thread
                               animate-pulse"
              />
            </button>

            <Link
              href="/favourites"
              aria-label="Favourites"
              className="relative transition-opacity hover:opacity-55"
            >
              <Heart size={20} strokeWidth={1.25} />
              {favCount > 0 && <Badge n={favCount} light={overHero} />}
            </Link>

            <Link
              href="/account"
              aria-label="Account"
              className="hidden transition-opacity hover:opacity-55 sm:block"
            >
              <User size={20} strokeWidth={1.25} />
            </Link>

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative transition-opacity hover:opacity-55"
            >
              <ShoppingBag size={20} strokeWidth={1.25} />
              {cartCount > 0 && <Badge n={cartCount} light={overHero} />}
            </Link>
          </div>
        </div>

        {/* search drawer — morphs open rather than appearing */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-line bg-white"
            >
              <form
                onSubmit={submit}
                className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-6"
              >
                <Search size={18} strokeWidth={1.25} className="text-ink-soft" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="SEARCH JEANS, FITS, WASHES"
                  className="tracked w-full bg-transparent outline-none placeholder:text-ink-soft"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    openLens();
                  }}
                  className="tracked flex items-center gap-2 whitespace-nowrap text-denim-mid seam-link"
                >
                  <Camera size={16} strokeWidth={1.25} /> Photo
                </button>
              </form>
              {suggestions.length > 0 && (
                <div className="mx-auto max-w-3xl px-5 pb-6">
                  {suggestions.map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.slug}`}
                      className="tracked flex justify-between border-t border-line py-3 hover:text-denim-mid"
                    >
                      <span>{p.name}</span>
                      <span className="text-ink-soft">
                        {p.fit} · {p.wash}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ---- full-screen menu: panels wipe in like fabric being unfolded ---- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-white"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
          >
            <div className="flex items-center justify-between px-5 py-4 md:px-10">
              <span className="tracked-lg text-[1.15rem]">GREZZO</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={22} strokeWidth={1.25} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-1 px-6 md:px-16">
              {NAV.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ y: 34, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22 + i * 0.055, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={item.href}
                    className="tracked-lg block py-3 text-[7vw] leading-none md:text-[3.4vw] hover:text-denim-mid transition-colors"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <div className="topstitch mx-6 md:mx-16" />
            <div className="flex flex-wrap gap-x-8 gap-y-2 px-6 py-8 md:px-16">
              {[...ALL_FITS.slice(0, 5), ...ALL_WASHES.slice(0, 4)].map((t) => (
                <Link
                  key={t}
                  href={`/jeans?q=${encodeURIComponent(t)}`}
                  className="tracked text-ink-soft seam-link"
                >
                  {t}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VisualSearch />
    </>
  );
}

function Badge({ n, light }) {
  return (
    <span
      className={`absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center
                      rounded-full px-1 text-[0.6rem] font-medium ${
                        light ? "bg-white text-denim-deep" : "bg-denim-deep text-white"
                      }`}
    >
      {n}
    </span>
  );
}
