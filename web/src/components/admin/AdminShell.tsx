"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgePercent, Boxes, ExternalLink, LayoutDashboard, Loader2,
  LogOut, Receipt, Shirt, Ticket,
} from "lucide-react";
import { useAdmin } from "./AdminProvider";
import { Button, Card, Field, Input } from "./ui";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Transactions", icon: Receipt },
  { href: "/admin/products", label: "Products", icon: Shirt },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/offers", label: "Offers", icon: BadgePercent },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
];

type Gate = "checking" | "unconfigured" | "signed-out" | "signed-in";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<Gate>("checking");
  const pathname = usePathname();
  const { reload } = useAdmin();

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((j) => setGate(!j.configured ? "unconfigured" : j.signedIn ? "signed-in" : "signed-out"))
      .catch(() => setGate("signed-out"));
  }, []);

  // The provider's first fetch may have raced ahead of the session check,
  // so pull the data again the moment we know we are allowed to.
  useEffect(() => { if (gate === "signed-in") reload(); }, [gate, reload]);

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }

  if (gate === "unconfigured") return <Unconfigured />;
  if (gate === "signed-out") return <SignIn onDone={() => setGate("signed-in")} />;

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setGate("signed-out");
  };

  return (
    <div className="flex min-h-screen bg-denim-paper">
      <aside className="denim-weave sticky top-0 hidden h-screen w-56 shrink-0 flex-col justify-between px-6 py-8 text-white md:flex">
        <div>
          <Link href="/" className="tracked-lg text-lg">GREZZO</Link>
          <p className="tracked mt-1.5 text-thread">Console</p>

          <nav className="mt-12 space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                      className={`tracked flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        active ? "bg-white/12 text-white" : "text-white/55 hover:text-white"}`}>
                  <Icon size={15} strokeWidth={1.4} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1">
          <Link href="/" target="_blank"
                className="tracked flex items-center gap-3 px-3 py-2.5 text-white/55 transition-colors hover:text-white">
            <ExternalLink size={15} strokeWidth={1.4} /> View store
          </Link>
          <button onClick={signOut}
                  className="tracked flex w-full items-center gap-3 px-3 py-2.5 text-white/55 transition-colors hover:text-white">
            <LogOut size={15} strokeWidth={1.4} /> Sign out
          </button>
        </div>
      </aside>

      {/* mobile nav */}
      <div className="denim-weave fixed inset-x-0 bottom-0 z-40 flex justify-around py-2 text-white md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-label={label}
                  className={`px-3 py-2 ${active ? "text-white" : "text-white/50"}`}>
              <Icon size={19} strokeWidth={1.4} />
            </Link>
          );
        })}
      </div>

      <main className="min-w-0 flex-1 px-5 py-10 pb-28 md:px-10 md:pb-10">{children}</main>
    </div>
  );
}

function Unconfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-lg p-9">
        <p className="tracked-lg text-xl">Console not enabled</p>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">
          Set <code className="bg-denim-wash px-1.5 py-0.5">ADMIN_PASSWORD</code> in
          your environment and restart. Everything else works without it — this
          only gates the management console.
        </p>
        <pre className="mt-5 overflow-x-auto bg-denim-wash p-4 text-xs">
{`# web/.env.local
ADMIN_PASSWORD=choose-something-long`}
        </pre>
      </Card>
    </div>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not sign in.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="denim-weave hidden flex-1 items-end p-14 text-white lg:flex">
        <div>
          <p className="tracked-lg text-2xl">GREZZO</p>
          <p className="tracked mt-2 text-thread">Console</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="tracked-lg text-2xl">Sign in</h1>
          <p className="mt-3 text-sm text-ink-soft">Management access for the store.</p>

          <div className="mt-8">
            <Field label="Password">
              <Input type="password" value={password} autoFocus required
                     onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>

          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

          <Button type="submit" disabled={busy} className="mt-6 w-full">
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
