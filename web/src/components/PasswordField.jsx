"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { passwordRules, passwordStrength } from "@/lib/validation";

/**
 * A password field that tells you the rules before you break them, rather
 * than rejecting you after you have committed to something.
 *
 * The checklist only appears while creating an account — showing it on
 * sign-in would be nagging someone about a password they already have.
 */
export default function PasswordField({
  value,
  onChange,
  showRules,
  autoComplete,
  placeholder = "PASSWORD",
}) {
  const [visible, setVisible] = useState(false);
  const rules = passwordRules(value);
  const { score, label } = passwordStrength(value);

  const barColour = ["bg-red-400", "bg-red-400", "bg-thread", "bg-denim-light", "bg-denim-deep"][
    score
  ];

  return (
    <div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="field w-full border border-line px-4 py-3.5 pr-12 outline-none focus:border-denim-deep"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-soft transition-colors hover:text-ink"
        >
          {visible ? <EyeOff size={16} strokeWidth={1.4} /> : <Eye size={16} strokeWidth={1.4} />}
        </button>
      </div>

      {showRules && value.length > 0 && (
        <>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-[3px] flex-1 transition-colors duration-300 ${
                    i < score ? barColour : "bg-line"
                  }`}
                />
              ))}
            </div>
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">{label}</span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                    r.met ? "bg-denim-deep text-white" : "border border-line"
                  }`}
                >
                  {r.met && <Check size={8} strokeWidth={3} />}
                </span>
                <span className={r.met ? "text-ink-soft line-through" : "text-ink-soft"}>
                  {r.label}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
