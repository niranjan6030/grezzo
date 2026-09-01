/* Shared field rules. Used by the sign-in form and again on the server, so
   the browser and the API never disagree about what counts as valid. */

/**
 * Email. Deliberately not one of the enormous RFC 5322 regexes — those
 * accept things no mail server will and reject addresses that work. This
 * checks the shape people actually get wrong, and the real proof is the
 * confirmation mail arriving.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function emailProblem(value) {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (/\s/.test(email)) return "Email addresses cannot contain spaces.";
  if (!email.includes("@")) return "That is missing an @.";
  if ((email.match(/@/g) ?? []).length > 1) return "That has more than one @.";
  if (!EMAIL.test(email)) return "That does not look like a complete email address.";
  if (email.length > 254) return "That address is too long.";
  return null;
}

/* ------------------------------------------------------------------
   Passwords.

   Firebase will accept six characters. That is not enough for an account
   holding someone's address book and order history, so the rule here is
   stricter — and stated up front rather than sprung on you after you have
   typed something.
   ------------------------------------------------------------------ */

/** Passwords that are long but still the first thing anyone would guess. */
const COMMON = [
  "password",
  "12345678",
  "qwerty",
  "letmein",
  "welcome",
  "admin123",
  "iloveyou",
  "abc12345",
  "password1",
  "qwerty123",
  "1q2w3e4r",
  "denim123",
];

export function passwordRules(value) {
  const lower = value.toLowerCase();
  return [
    { id: "length", label: "At least 8 characters", met: value.length >= 8 },
    {
      id: "case",
      label: "An upper and a lower case letter",
      met: /[a-z]/.test(value) && /[A-Z]/.test(value),
    },
    { id: "number", label: "A number", met: /\d/.test(value) },
    {
      id: "common",
      label: "Not a commonly used password",
      met: value.length > 0 && !COMMON.some((c) => lower.includes(c)),
    },
  ];
}

export const passwordAccepted = (value) => passwordRules(value).every((r) => r.met);

export function passwordProblem(value) {
  if (!value) return "Choose a password.";
  const failed = passwordRules(value).filter((r) => !r.met);
  if (failed.length === 0) return null;
  return `Your password still needs: ${failed.map((f) => f.label.toLowerCase()).join(", ")}.`;
}

/**
 * A 0–4 score for the meter. Length does most of the work, because it
 * genuinely does — a long passphrase beats a short one with a symbol in it.
 */
export function passwordStrength(value) {
  if (!value) return { score: 0, label: "" };

  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^\w\s]/.test(value)) score++;
  if (COMMON.some((c) => value.toLowerCase().includes(c))) score = Math.min(score, 1);

  score = Math.min(score, 4);
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score] };
}
