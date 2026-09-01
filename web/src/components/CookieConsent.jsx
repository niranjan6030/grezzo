"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";

/** Consent gate. Nothing beyond strictly necessary storage is written until
 *  a choice is made — the recommender's event log is gated on it too. */
export default function CookieConsent() {
  const consent = useStore((s) => s.consent);
  const setConsent = useStore((s) => s.setConsent);
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState(false);
  const [draft, setDraft] = useState({ analytics: true, personalisation: true, marketing: false });

  // Wait for zustand to rehydrate so the banner doesn't flash for returning visitors.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const show = mounted && !consent.decided;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-white/97 backdrop-blur-md"
          role="dialog"
          aria-label="Cookie preferences"
        >
          <div className="mx-auto max-w-6xl px-5 py-6 md:px-10">
            <p className="tracked">Cookies</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
              We use strictly necessary cookies to keep your bag and session working. With your
              permission we also measure how the site is used and remember what you browse so the
              recommendations mean something. You can change this at any time.
            </p>

            <AnimatePresence>
              {detail && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Row
                      label="Strictly necessary"
                      desc="Bag, session, security. Cannot be switched off."
                      checked
                      disabled
                    />
                    <Row
                      label="Analytics"
                      desc="Aggregate page and product performance."
                      checked={draft.analytics}
                      onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
                    />
                    <Row
                      label="Personalisation"
                      desc="Powers the recommendation model on your browsing."
                      checked={draft.personalisation}
                      onChange={(v) => setDraft((d) => ({ ...d, personalisation: v }))}
                    />
                    <Row
                      label="Marketing"
                      desc="Off by default. Ad measurement across other sites."
                      checked={draft.marketing}
                      onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() =>
                  setConsent({ analytics: true, personalisation: true, marketing: true })
                }
                className="tracked bg-denim-deep px-8 py-3 text-white transition-colors hover:bg-denim-mid"
              >
                Accept all
              </button>
              <button
                onClick={() =>
                  setConsent({ analytics: false, personalisation: false, marketing: false })
                }
                className="tracked border border-denim-deep px-8 py-3 transition-colors hover:bg-denim-wash"
              >
                Reject all
              </button>
              {detail ? (
                <button onClick={() => setConsent(draft)} className="tracked px-4 py-3 seam-link">
                  Save choices
                </button>
              ) : (
                <button
                  onClick={() => setDetail(true)}
                  className="tracked px-4 py-3 seam-link text-ink-soft"
                >
                  Manage
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, desc, checked, disabled, onChange }) {
  return (
    <label
      className={`flex items-start gap-3 border border-line p-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--denim-deep)]"
      />
      <span>
        <span className="tracked block">{label}</span>
        <span className="mt-1 block text-xs text-ink-soft">{desc}</span>
      </span>
    </label>
  );
}
