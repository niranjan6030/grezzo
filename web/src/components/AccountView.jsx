"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, Phone } from "lucide-react";
import { AuthError, useAuth } from "./AuthProvider";
import PasswordField from "./PasswordField";
import { emailProblem, passwordProblem } from "@/lib/validation";
import { useStore } from "@/store/useStore";

export default function AccountView() {
  const { configured, ready, user, signOut } = useAuth();
  const next = useSearchParams().get("next");

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-xl px-5 py-20 md:px-10">
      <h1 className="tracked-lg text-3xl md:text-4xl">Account</h1>

      {!configured && <NotConfigured />}

      {configured && user && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <p className="tracked text-ink-soft">Signed in as</p>
          <p className="mt-2 text-lg">{user.displayName || user.email || user.phoneNumber}</p>
          {user.email && user.displayName && (
            <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="tracked bg-denim-deep px-8 py-3 text-white transition-colors hover:bg-denim-mid"
            >
              Your orders
            </Link>
            <button
              onClick={signOut}
              className="tracked border border-denim-deep px-8 py-3 transition-colors hover:bg-denim-wash"
            >
              Sign out
            </button>
          </div>
        </motion.div>
      )}

      {configured && !user && <SignIn redirectTo={next} />}

      <DataSection />
    </section>
  );
}

/* ---------------------------------------------------------------- */

function SignIn({ redirectTo }) {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    createAccount,
    startPhoneSignIn,
    ensureSession,
  } = useAuth();

  const [tab, setTab] = useState("email");
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Only surfaced once someone has left the field or tried to submit —
  // flagging an address as invalid while it is half-typed is just rude.
  const [emailTouched, setEmailTouched] = useState(false);

  const [phone, setPhone] = useState("+91 ");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (redirectTo) {
        // Wait for the server session cookie before navigating, or the
        // middleware on the next page will not see us as signed in yet.
        const ok = await ensureSession();
        if (!ok) {
          setError("Signed in, but the session could not be started. Try once more.");
          return;
        }
        window.location.href = redirectTo;
      }
    } catch (e) {
      const message = e instanceof AuthError ? e.message : "Something went wrong.";
      if (message) setError(message);
    } finally {
      setBusy(null);
    }
  };

  const emailError = emailTouched ? emailProblem(email) : null;

  const submitEmail = () => {
    setEmailTouched(true);
    // The email problem is already shown under its own field; repeating it
    // at the foot of the form just says the same thing twice.
    if (emailProblem(email)) {
      setError(null);
      return;
    }
    if (mode === "signup") {
      const badPassword = passwordProblem(password);
      if (badPassword) {
        setError(badPassword);
        return;
      }
    }
    run("email", () =>
      mode === "signin" ? signInWithEmail(email, password) : createAccount(email, password, name),
    );
  };

  return (
    <div className="mt-10">
      {/* ---- one-tap providers ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => run("google", signInWithGoogle)}
          disabled={busy !== null}
          className="tracked flex items-center justify-center gap-2.5 border border-line py-3.5 transition-colors hover:border-denim-deep disabled:opacity-50"
        >
          <GoogleMark /> {busy === "google" ? "Opening…" : "Continue with Google"}
        </button>
        <button
          onClick={() => run("apple", signInWithApple)}
          disabled={busy !== null}
          className="tracked flex items-center justify-center gap-2.5 border border-line py-3.5 transition-colors hover:border-denim-deep disabled:opacity-50"
        >
          <AppleMark /> {busy === "apple" ? "Opening…" : "Continue with Apple"}
        </button>
      </div>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-line" />
        <span className="tracked text-ink-soft">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* ---- email / phone ---- */}
      <div className="mb-6 flex gap-6">
        {[
          ["email", "Email", Mail],
          ["phone", "Phone", Phone],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={`tracked flex items-center gap-2 pb-2 ${
              tab === key ? "border-b border-denim-deep" : "text-ink-soft"
            }`}
          >
            <Icon size={14} strokeWidth={1.5} /> {label}
          </button>
        ))}
      </div>

      {tab === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitEmail();
          }}
          noValidate
          className="space-y-3"
        >
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NAME"
              autoComplete="name"
              className="field w-full border border-line px-4 py-3.5 outline-none focus:border-denim-deep"
            />
          )}

          <div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="EMAIL"
              className={`field w-full border px-4 py-3.5 outline-none ${
                emailError
                  ? "border-red-400 focus:border-red-500"
                  : "border-line focus:border-denim-deep"
              }`}
            />
            {emailError && <p className="mt-2 text-xs text-red-700">{emailError}</p>}
          </div>

          <PasswordField
            value={password}
            onChange={setPassword}
            showRules={mode === "signup"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          <button
            type="submit"
            disabled={busy !== null}
            className="tracked flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-50"
          >
            {busy === "email" && <Loader2 size={15} className="animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="tracked block w-full pt-2 text-ink-soft seam-link"
          >
            {mode === "signin" ? "Create an account instead" : "I already have an account"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {!confirm ? (
            <>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                className="field w-full border border-line px-4 py-3.5 outline-none focus:border-denim-deep"
              />
              <button
                id="grezzo-recaptcha"
                onClick={() =>
                  run("phone", async () => {
                    const confirmFn = await startPhoneSignIn(
                      phone.replace(/\s/g, ""),
                      "grezzo-recaptcha",
                    );
                    setConfirm(() => confirmFn);
                  })
                }
                disabled={busy !== null}
                className="tracked flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-50"
              >
                {busy === "phone" && <Loader2 size={15} className="animate-spin" />}
                Send code
              </button>
              <p className="text-xs leading-relaxed text-ink-soft">
                Include the country code. We send a six-digit code by SMS — standard message rates
                apply.
              </p>
            </>
          ) : (
            <>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="SIX-DIGIT CODE"
                className="field w-full border border-line px-4 py-3.5 text-center text-lg tracking-[0.5em] outline-none focus:border-denim-deep"
              />
              <button
                onClick={() => run("verify", () => confirm(code))}
                disabled={busy !== null || code.length < 6}
                className="tracked flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-50"
              >
                {busy === "verify" && <Loader2 size={15} className="animate-spin" />}
                Verify and sign in
              </button>
              <button
                onClick={() => {
                  setConfirm(null);
                  setCode("");
                  setError(null);
                }}
                className="tracked block w-full pt-2 text-ink-soft seam-link"
              >
                Use a different number
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-5 text-sm text-red-700">{error}</p>}

      <p className="mt-8 text-xs leading-relaxed text-ink-soft">
        We only ever store what you give us here. Payments are handled by Razorpay — card details
        never touch our servers.
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="denim-weave-light mt-10 p-6">
      <p className="tracked">Sign-in not connected</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Firebase Authentication is wired up but has no project behind it. Add the
        <code className="mx-1 bg-white px-1.5 py-0.5 text-xs">NEXT_PUBLIC_FIREBASE_*</code>
        values to <code className="bg-white px-1.5 py-0.5 text-xs">.env.local</code> — README
        section 1 walks through it. Your bag, favourites and recommendations all work without an
        account in the meantime.
      </p>
    </div>
  );
}

function DataSection() {
  const favCount = useStore((s) => s.favourites.length);
  const eventCount = useStore((s) => s.events.length);
  const consent = useStore((s) => s.consent);
  const setConsent = useStore((s) => s.setConsent);

  return (
    <>
      <div className="topstitch mt-16" />
      <div className="mt-8">
        <p className="tracked">Your data on this device</p>
        <div className="mt-5 space-y-2 text-sm text-ink-soft">
          <p>
            {favCount} favourite{favCount === 1 ? "" : "s"} saved.
          </p>
          <p>
            {consent.personalisation
              ? `${eventCount} browsing events kept for recommendations.`
              : "Personalisation is off — no browsing history is being kept."}
          </p>
        </div>
        <button
          onClick={() => setConsent({ personalisation: !consent.personalisation })}
          className="tracked mt-6 border border-denim-deep px-8 py-3 transition-colors hover:bg-denim-wash"
        >
          {consent.personalisation ? "Turn off personalisation" : "Turn on personalisation"}
        </button>
      </div>
    </>
  );
}

/* Brand marks, inline so there is no external request on the sign-in page. */
function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36.2 45 30.6 45 24z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 40.9 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.2 0 5.4 1.4 6.7 2.6l5.9-5.8C33 4.1 29.9 2 24 2 15.4 2 8 7.1 4.4 14l7.1 5.5c1.8-5.3 6.7-8.8 12.5-8.8z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.3-.9c-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8 2.2-1.2 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.6-1-2.6-3.9zM13.9 4.6c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" />
    </svg>
  );
}
