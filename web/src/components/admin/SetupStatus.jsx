"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleSlash, Loader2, RefreshCw, Wrench } from "lucide-react";

import { Card } from "./ui";

const LOOK = {
  live: { icon: Check, cls: "bg-denim-deep text-white", label: "Connected" },
  local: { icon: Wrench, cls: "bg-thread/25 text-[#5f5230]", label: "Local only" },
  off: { icon: CircleSlash, cls: "bg-denim-wash text-ink-soft", label: "Not set up" },
  broken: { icon: AlertTriangle, cls: "bg-red-100 text-red-800", label: "Needs attention" },
};

/** What is wired up, checked live rather than guessed from environment
 *  variables — a key that is present but rejected looks fine until someone
 *  tries to pay. */
export default function SetupStatus() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((j) => setRows(j.integrations ?? []))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setRows(j.integrations ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="mb-8 p-6">
      <div className="flex items-center justify-between">
        <p className="tracked">Integrations</p>
        <button
          onClick={load}
          disabled={busy}
          className="tracked flex items-center gap-2 text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} strokeWidth={1.6} />
          )}
          Re-check
        </button>
      </div>

      {rows === null ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line">
          {rows.map((r) => {
            const look = LOOK[r.state];
            const Icon = look.icon;
            return (
              <div key={r.id} className="flex items-start gap-4 py-3.5">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${look.cls}`}
                >
                  <Icon size={12} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="text-sm">{r.name}</p>
                    <p className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">
                      {look.label}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
