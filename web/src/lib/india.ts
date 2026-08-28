/** States and union territories, for a picker rather than a free-text box.
 *  Typing a state by hand is how "Karnatka" ends up on a shipping label. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** India Post returns state names that mostly match ours; these are the ones
 *  that do not, so a lookup still selects the right option in the picker. */
const ALIASES: Record<string, string> = {
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "uttaranchal": "Uttarakhand",
  "nct of delhi": "Delhi",
  "national capital territory of delhi": "Delhi",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "jammu & kashmir": "Jammu and Kashmir",
};

/** Match a returned state name to one of ours, or null if it is unrecognised. */
export function normaliseState(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === key);
  if (exact) return exact;
  // "&" and "and" are used interchangeably in the postal data.
  const loose = key.replace(/&/g, "and").replace(/\s+/g, " ");
  return INDIAN_STATES.find((s) => s.toLowerCase() === loose) ?? null;
}
