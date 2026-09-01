"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Reveal from "./Reveal";
import { SUPPORT_EMAIL } from "@/lib/site";

const SECTIONS = [
  {
    id: "fit",
    title: "Size & fit",
    body: "Sizes are the menswear waist measurement in inches. If you are between sizes, size down in anything with stretch and size up in raw denim — unsanforised cotton relaxes about half an inch in the first week. Every product page lists the rise and the leg opening in centimetres.",
  },
  {
    id: "shipping",
    title: "Shipping",
    body: "Free above ₹3,000, otherwise ₹149. Orders are allocated to the warehouse nearest your pincode that holds every size in the order, so it arrives as one parcel. Metro pincodes: 2–3 working days. Elsewhere: 4–6.",
  },
  {
    id: "returns",
    title: "Returns & exchanges",
    body: "Thirty days, unworn, tags attached, free both ways. Exchanges for a different size hold your replacement in stock the moment you start the return, so you do not lose it while the parcel is in transit.",
  },
  {
    id: "privacy",
    title: "Privacy",
    body: "We keep your email, order history and delivery addresses. Browsing history is used for recommendations only if you allowed personalisation, is stored against your device rather than your name, and is deleted when you turn personalisation off.",
  },
  {
    id: "cookies",
    title: "Cookies",
    body: "Strictly necessary cookies keep your bag and session alive and cannot be switched off. Analytics, personalisation and marketing are each opt-in and can be changed any time from your account page.",
  },
];

export default function ContactView() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", order: "", message: "" });

  const submit = (e) => {
    e.preventDefault();
    // No mail backend is connected — say so instead of pretending it sent.
    setSent(true);
  };

  return (
    <>
      <section className="denim-weave px-5 py-24 text-white md:px-10">
        <Reveal>
          <p className="tracked text-thread">Contact</p>
          <h1 className="tracked-lg mt-6 text-4xl leading-tight md:text-6xl">Talk to us</h1>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-4">
          {[
            { icon: Mail, label: "Email", value: SUPPORT_EMAIL },
            { icon: Phone, label: "Phone", value: "+91 80 4718 2200" },
            { icon: Clock, label: "Hours", value: "Mon–Sat, 10:00–19:00 IST" },
            { icon: MapPin, label: "Studio", value: "Indiranagar, Bengaluru 560038" },
          ].map(({ icon: Icon, label, value }, i) => (
            <Reveal key={label} delay={i * 0.07}>
              <Icon size={20} strokeWidth={1.1} className="text-thread" />
              <p className="tracked mt-4 opacity-60">{label}</p>
              <p className="mt-2 text-sm">{value}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2">
        <div className="px-5 py-20 md:px-10">
          <Reveal>
            <h2 className="tracked-lg text-lg">Send a message</h2>
          </Reveal>
          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="denim-weave-light mt-8 p-7"
            >
              <p className="tracked">Not delivered</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                The form is built but no mail service is connected yet, so this message has not gone
                anywhere. Wire up Resend or Supabase Edge Functions or write to {SUPPORT_EMAIL} in
                the meantime.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-3">
              {[
                ["name", "NAME"],
                ["email", "EMAIL"],
                ["order", "ORDER NUMBER (OPTIONAL)"],
              ].map(([k, ph]) => (
                <input
                  key={k}
                  required={k !== "order"}
                  type={k === "email" ? "email" : "text"}
                  placeholder={ph}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="field w-full border border-line px-4 py-3.5 outline-none focus:border-denim-deep"
                />
              ))}
              <textarea
                required
                rows={6}
                placeholder="MESSAGE"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="field w-full border border-line px-4 py-3.5 outline-none focus:border-denim-deep"
              />
              <button className="tracked w-full bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid">
                Send
              </button>
            </form>
          )}
        </div>

        <div className="denim-weave-light px-5 py-20 md:px-10">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.05}>
              <div id={s.id} className="mb-10 scroll-mt-24">
                <h3 className="tracked">{s.title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
