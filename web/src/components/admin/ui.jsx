"use client";

/* Small shared pieces so every panel in the console looks the same and the
   markup stays out of the way of the actual logic. */

export function Card({ children, className = "" }) {
  return <div className={`border border-line bg-white ${className}`}>{children}</div>;
}

export function PanelHead({ title, sub, action }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="tracked-lg text-2xl">{title}</h1>
        {sub && <p className="mt-2 text-sm text-ink-soft">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <Card className="p-5">
      <p className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      <p className="mt-3 text-2xl font-light tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = "solid",
  type = "button",
  disabled,
  className = "",
}) {
  const styles = {
    solid: "bg-denim-deep text-white hover:bg-denim-mid",
    outline: "border border-denim-deep hover:bg-denim-wash",
    ghost: "text-ink-soft hover:text-ink",
    danger: "border border-red-700 text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`tracked px-5 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-soft">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-denim-deep";

export function Input(props) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props) {
  return (
    <textarea {...props} className={`${inputBase} leading-relaxed ${props.className ?? ""}`} />
  );
}

export function Select(props) {
  return <select {...props} className={`${inputBase} cursor-pointer ${props.className ?? ""}`} />;
}

export function Pill({ tone = "neutral", children }) {
  const styles = {
    neutral: "bg-denim-wash text-ink-soft",
    good: "bg-denim-deep text-white",
    warn: "bg-thread/25 text-[#5f5230]",
    bad: "bg-red-100 text-red-800",
  }[tone];
  return (
    <span
      className={`inline-block px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.16em] ${styles}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }) {
  return <p className="py-16 text-center text-sm text-ink-soft">{children}</p>;
}

/** Money in, rupees out. Every amount in the console is paise internally. */
export const rupees = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);

export const shortDate = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
