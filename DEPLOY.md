# Going live

Ordered so nothing blocks anything else. Steps 1–4 get you a working public
site. Step 5 (taking real money) is the only one with a waiting period.

---

## First, two things worth being clear about

**Razorpay test keys do not expire.** There is no 90-day limit on them — test
mode is permanent and free, and the id and secret keep working indefinitely.
If you were told otherwise, that was probably a different gateway; several
sandbox environments do expire, Razorpay's does not.

What test mode *cannot* do is move real money. For that you need **live keys**,
and those require KYC: a PAN, a bank account and a business proof, verified by
Razorpay. That is a legal check on your identity as a merchant, so it is
genuinely something only you can complete — nobody can do it on your behalf,
and there is no way around it for any Indian gateway.

**There is no separate "deploy Razorpay" step.** Razorpay is an API your
deployed site calls; it is not a service you deploy. When your friend
"deployed Razorpay through Vercel", what they deployed was an app that talks to
Razorpay — exactly what this repo already is. Once the keys are in Vercel's
environment variables, it works.

---

## 1. Supabase — the database

Do this first: everything else stores data in it.

1. Create a project at [supabase.com](https://supabase.com). Free tier is fine.
   Save the database password somewhere; you will not be shown it again.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. Generate and run the seed:
   ```bash
   cd web && npm run dev          # in another terminal
   node ../supabase/generate-seed.mjs > ../supabase/seed.sql
   ```
   Paste `supabase/seed.sql` into the SQL Editor → **Run**. That creates three
   warehouses, pincode routing, every variant, and opening stock.
4. **Project Settings → API** — copy three values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` **(server only — never put
     this in anything prefixed `NEXT_PUBLIC_`)**

## 2. Firebase — sign-in

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
   Analytics is optional; skip it if you like.
2. **Build → Authentication → Get started**, then enable:
   - **Email/Password** — one toggle, done.
   - **Google** — needs a support email. Nothing else.
   - **Phone** — works immediately. Free quota is generous; add test numbers
     under Phone → Advanced while developing so you do not burn it.
   - **Apple** — needs an Apple Developer account ($99/yr). Skip unless you
     are shipping the iOS app.
3. **Project settings → General → Your apps → Web (`</>`)** → register the app.
   Copy the config into these:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
   ```
4. **Project settings → Service accounts → Generate new private key.** A JSON
   file downloads. Paste its entire contents, on one line, as
   `FIREBASE_SERVICE_ACCOUNT`. Without this the server cannot verify anyone,
   so checkout and order tracking stay off.
5. **Authentication → Settings → Authorised domains** → add your production
   domain once you have it (step 4). `localhost` is already there.

**Leave the emulator variables unset in production.** If
`FIREBASE_AUTH_EMULATOR_HOST` is set on Vercel, the live site will try to reach
a local emulator and every sign-in will fail.

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import it.
3. **Set the Root Directory to `web`.** This is the step people miss — the repo
   root has no `package.json`, so the build fails without it.
4. Add every variable from steps 1 and 2 under **Environment Variables**, plus:
   ```
   ADMIN_PASSWORD=<something long>
   ADMIN_SESSION_SECRET=<something long and different>
   ```
5. Deploy.

The build succeeds with no variables at all, so a first deploy will never fail
on configuration — each feature simply reports itself as unconfigured. Check
**/admin → Integrations** afterwards; it tests each service live rather than
just checking a variable is present.

## 4. A domain

You already have a working URL — `your-project.vercel.app`, with HTTPS. That is
a real address you can share today. Buy a domain when you want the name, not
because the site needs one.

When you do:

| Registrar | Why |
|---|---|
| **Cloudflare Registrar** | Sells at wholesale cost with no renewal markup. Cheapest over years, and the difference compounds. |
| **Namecheap** | Cheap first year, marked-up renewals. Read the renewal price, not the offer price. |
| **GoDaddy** | Avoid. Aggressive upsells and expensive renewals. |

Rough Indian pricing: `.in` ₹500–800/yr, `.store` and `.shop` often ₹200–400
for year one then ₹1,500–3,000 after, `.com` ₹900–1,200/yr and the most stable.
**Check the renewal price before buying** — the cheap first year is the hook.

Avoid free `.tk` / `.ml` domains. They get reclaimed without warning, and
losing the domain means losing every customer link to your store.

Then: **Vercel → Settings → Domains → Add**, and point the nameservers or add
the `CNAME` where Vercel tells you. Certificates are automatic. Afterwards, add
the domain to Firebase's authorised domains (step 2.5) or Google sign-in will
break on the new address.

## 5. Razorpay — real payments

**Start with test keys today.** They work forever, they cost nothing, and the
whole checkout runs on them. Do the KYC in parallel.

### Test keys (five minutes)
1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Toggle to **Test Mode** at the top.
3. **Settings → API Keys → Generate Test Key.** The secret shows **once**.
4. In Vercel: `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET`.
5. Pay with card `4111 1111 1111 1111`, any future expiry, any CVV.

### Live keys (a few days)
1. **Settings → Account & Settings → Business/KYC.** You will need:
   - PAN (personal, or the company's)
   - Bank account in the same name as the PAN
   - Business proof — for a sole proprietor, GST registration, Udyam/MSME
     registration, or a shop licence usually suffices
   - Address proof
2. Razorpay reviews it. Usually 2–4 working days.
3. Once approved, toggle to **Live Mode** → **Generate Live Key**, and replace
   the two variables in Vercel. Nothing in the code changes.
4. **Settings → Webhooks** → add `https://your-domain.com/api/razorpay/webhook`,
   subscribe to `payment.captured`, `payment.failed` and `refund.processed`,
   and put the signing secret in `RAZORPAY_WEBHOOK_SECRET`. The webhook is the
   authoritative confirmation — without it, orders confirm on the browser
   callback alone, which is weaker.

The Integrations panel says **LIVE MODE — real money will move** when live keys
are in, so you cannot confuse the two by accident.

---

## Order of work, if you want it as a list

1. Supabase project + schema + seed → 3 variables
2. Firebase project + providers → 5 variables
3. Push to GitHub, import to Vercel, **root directory `web`**, paste variables
4. Razorpay test keys → 2 variables. Checkout now works end to end.
5. Start Razorpay KYC. Swap to live keys when it clears.
6. Buy a domain whenever you want the name. Add it to Vercel *and* to
   Firebase's authorised domains.
