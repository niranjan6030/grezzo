# GREZZO

Menswear denim, and nothing else. A storefront, an admin console, an
inventory core and two models.

```
Grezzo/
├── web/        Next.js 16 storefront + admin console + API routes
├── ai/         FastAPI: LSTM recommender + CLIP visual search
└── supabase/   Postgres schema, seed, and the seed generator
```

---

## Run it now

```bash
cd web && npm install && npm run dev
```

Open <http://localhost:3000>. The site is fully usable with **no keys at all**:
browsing, colourways, favourites, the bag, recommendations, the lens, the
inventory reservation flow and the admin console all work. Each external
service switches on the moment its keys appear, and the UI says plainly which
mode it is in rather than pretending.

| Without keys | With keys |
|---|---|
| Recommendations from the built-in hybrid model | LSTM sequence model in `ai/` |
| Lens matches on-device by colour and tone | CLIP zero-shot matching |
| Checkout reserves stock, then stops and says Razorpay is not connected | Live Razorpay payment + signature verification |
| Admin edits saved to `web/.data/admin.json` | Saved to Supabase Postgres |
| Bag and favourites in the browser | Also tied to a Firebase account |
| Every payment rail shown, checkout stops before charging | UPI, cards, netbanking, wallets, EMI and COD all live |

To open the console at `/admin`, set one variable:

```bash
# web/.env.local
ADMIN_PASSWORD=choose-something-long
```

### Sign-in works today, with no Firebase account

`web/.env.local` ships pointed at the **Firebase Auth emulator**, so the whole
account flow runs locally against a `demo-grezzo` project that does not exist
anywhere. In a second terminal:

```bash
cd web && npm run emulator
```

Then create an account at `/account` and the rest follows: addresses, checkout,
cash on delivery, order tracking. Needs Java (the emulator is a JVM app) and
nothing else.

Swapping in a real project is three lines — replace the
`NEXT_PUBLIC_FIREBASE_*` values and delete the two `*_AUTH_EMULATOR_HOST`
lines. Section 1 below has the details.

---

## What is actually built

### Accounts and security
Identity is **Firebase Authentication**; Supabase stores data. Sign in with
Google, Apple, email and password, or a phone number and an SMS code.

The browser holds a short-lived Firebase ID token, which is exchanged once for
an httpOnly session cookie. That cookie is what the server trusts — verified
with `firebase-admin` on every protected route, with revocation checked, so a
disabled account stops working immediately rather than whenever its token
happens to expire.

Middleware keeps signed-out visitors off `/account/orders` and `/checkout`, but
it is only a presence check: the Edge runtime cannot run `firebase-admin`. The
real gate is `requireUser()` in each route handler. Forging the cookie gets you
a page shell and a 401 from every API call.

`/api/orders/mine` reads the uid from the verified cookie, never from the
request, so nobody can ask for someone else's orders.

### Checkout
Three steps, each doing one thing:

1. **Bag** — tick what you want to buy now. Anything left unticked stays in the
   bag rather than being forced into the order; people park things they are not
   ready for.
2. **Delivery** — pick from a saved address book, or add one. Up to ten
   addresses, with a default. Addresses are kept against the Firebase uid, so
   they follow a shopper from phone to laptop.
3. **Review & pay** — the whole bill and the delivery address at the top, then
   the coupon field, then payment. Nothing is charged until the last button.

Checkout requires sign-in. Addresses and order tracking both need an identity,
and a cash-on-delivery order with no verified account is not something to hand
a courier.

When the order lands it goes behind the same denim panel the site opens with,
and unzips to reveal the confirmation — with the bill, a link to tracking, and
a way back to shopping. Skippable, and skipped outright under
`prefers-reduced-motion`.

### The Denim Index
Fifty-six facts about how denim is made, served from `/api/facts` on a
**twelve-hour rotation** — a different selection appears each morning and each
evening, the same one for everybody.

The rotation is a deterministic shuffle seeded by the half-day, so the server
and the browser always agree and nothing reshuffles under someone mid-read. The
full index stays browsable at `/facts`; only the featured selection rotates.

There is no third-party denim-facts API behind this, and that is deliberate:
the options were scraping something unverifiable or generating text, and both
mean publishing claims nobody checked under your shop's name. The library is
curated instead. `/api/facts` is a real endpoint though — point it at a CMS
later and nothing else changes.

### Order tracking
`/account/orders` lists every order; `/account/orders/<receipt>` tracks one
through Placed → Confirmed → Shipped → Delivered, with the timestamp of each
step as it actually happened.

It polls every fifteen seconds while the tab is open, and backs off when the
tab is hidden. That is "live" in the sense that matters for a parcel that moves
a few times a day — not a websocket pretending to be more.

Statuses that end an order early — cancelled, refunded, failed — are shown on
their own rather than being forced into the progress line.

The timeline is written by the same code that changes an order's status, so
history and state cannot drift apart. In Postgres that is one statement
(`append_order_status`).

### Payments
Every rail Indian shoppers expect:

| Method | How it settles |
|---|---|
| UPI, card, net banking, wallet, pay later, EMI | Razorpay, with the checkout opening directly on the rail already chosen |
| Cash on delivery | Placed here, collected by the courier — sign-in required, ₹49 handling fee, capped at ₹15,000 |

**Card details never reach this application.** Razorpay's checkout collects
them; we see an order id and a signature.

### Coupons and bank offers
Two different mechanisms, deliberately kept apart:

**Coupon codes** are ours. Percentage, fixed amount or free delivery; scoped to
everything, a collection, a fit or one product; with minimum order, maximum
discount, a date window, total and per-shopper usage limits, and a first-order
flag. The rules live in one file, `web/src/lib/coupons.js`, so the bag and the
checkout can never disagree about whether a code is valid — the bag shows the
discount, and the server re-validates it immediately before charging, because
a code can expire or hit its limit while someone is filling in an address.

Redemptions are counted when an order is actually confirmed, never when a code
is typed, and are keyed on the order id so a retried Razorpay webhook cannot
count the same one twice.

**Bank and card offers** are Razorpay's. "10% off with HDFC credit cards"
cannot be enforced here, because we never see the card — so an offer is created
in the Razorpay dashboard and its Offer id pasted into the console. Razorpay
then checks the real card at payment and applies the discount. An offer without
an Offer id still shows in the bag, labelled *display only*, and deducts
nothing. That label is not decoration: it is the difference between a discount
that works and one that quietly does not.

Every figure in the bag comes from `/api/checkout/quote`. There is no
client-side arithmetic on money anywhere, so what a shopper is shown is what
Razorpay is asked for.

### The storefront
- **The unzip.** A full-screen denim panel splits down a working zipper to
  reveal the store. Everything — teeth, fabric edges, slider — derives from a
  single progress value, so nothing can drift out of sync. Runs once per
  session, skippable, and disabled entirely under `prefers-reduced-motion`.
- **Zara-style motion.** Hard-edged panel wipes between routes, clip-path
  reveals rather than fades, slow drape easing, parallax hero. Written from
  scratch — no Zara code or assets are used.
- **Procedural product imagery.** With no photography, each jean is drawn as
  SVG from its own attributes: the fit sets the silhouette, the rise sets the
  waistband, the wash sets the fade and whiskering. Upload a real photo in the
  admin and it replaces the drawing, per colourway.
- **Colourways** are a real variant axis — own SKU, own stock, own photo.
- **Grezzo Lens.** The camera beside the search field. Photograph any jeans and
  it returns the closest cuts, telling you which engine answered.
- **The Denim Index.** Twenty checkable facts about how denim is made, running
  as a ribbon, a rotating panel, and a reference page.
- **Consent first.** Nothing beyond strictly necessary storage is written until
  a choice is made — the recommender's event log is gated on it, and turning
  personalisation off deletes the history.

### The admin console (`/admin`)
- **Overview** — revenue by day, average order, abandoned checkouts, best
  sellers, low-stock alerts.
- **Coupons & bank offers** — create codes with every limit above; create
  card-linked offers and paste their Razorpay Offer id.
- **Technical drawings from a photo** — upload a product shot and the AI reads
  the cut, the rise and the wash off it, with a confidence for each. Apply them
  and the technical flat is redrawn to match.
- **Transactions** — every checkout, paid or not, with a fulfilment flow
  (paid → shipped → delivered, and cod_pending → shipped for cash orders)
  guarded on both client and server. Each move writes a tracking entry the
  customer sees.
- **Products** — price, compare-at, description, composition, tags; add,
  remove and reorder colourways; upload a photograph per colour (downscaled in
  the browser before upload); revert any product to its built-in values.
- **Inventory** — a colour × size grid you can type straight into, plus
  "book in N to every size" for a delivery.
- **Offers** — percentage or fixed, scoped to everything / a collection / a fit
  / one product, with a schedule. Only the deepest offer applies to any one
  product; they never stack.

Edits are live immediately, and — importantly — **checkout prices are computed
from the same merged catalogue the storefront renders**, so a shopper can never
be shown one price and charged another.

### The inventory core
This is the part standing in for SAP/Oracle. Those are licensed enterprise
systems; what they give a retailer is buildable in Postgres, and that is what
`supabase/schema.sql` does:

- Stock lives per **(product, colour, size, warehouse)** — never one number.
- Every change is an **append-only movement**, so the balance is auditable and
  replayable.
- Checkout takes a **15-minute reservation** rather than decrementing
  immediately, so an abandoned payment never costs you a sale.
- **Allocation** prefers the one warehouse that can ship the whole order, chosen
  by transit time to the delivery pincode, and only splits when it must.
- `commit_reservation` and `release_reservation` are **idempotent**, because
  Razorpay retries webhooks.

### Technical drawings, and why they are not generated
A spec drawing has to be *exact*: consistent line weight, the right leg
opening, seams where seams actually are. Ask an image model for one and it
invents plausible-looking detail — the single thing a technical flat must never
do.

So the admin's "Read from photo" runs CLIP zero-shot classification over the
photograph to identify the cut, the rise and the wash, and the flat is then
**drawn deterministically** from those attributes. It is correct by
construction, and when the model is unsure the seller corrects an attribute
rather than redrawing a picture.

Weight, stretch and composition are deliberately not returned. They cannot be
seen in a photograph, and reporting them confidently would be guessing.

### The models (`ai/`)
An LSTM over browsing sequences for recommendations, and zero-shot CLIP for the
lens. Both are optional, both degrade to a working fallback, and the storefront
reports which one answered. See [`ai/README.md`](ai/README.md).

---

## Setup, service by service

### 1. Firebase — sign-in

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started**, then enable the providers you want:
   **Email/Password**, **Google**, **Apple**, **Phone**.
   - Google needs a support email, nothing else.
   - Apple needs an Apple Developer account ($99/year) and a Services ID.
   - Phone needs no setup for testing; add test numbers under Phone → Advanced
     to avoid burning your free SMS quota.
3. **Project settings → General → Your apps → Web** and copy the config into
   `web/.env.local`:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...
   ```
4. **Project settings → Service accounts → Generate new private key**. Paste the
   whole JSON on one line as `FIREBASE_SERVICE_ACCOUNT`, or set
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
   separately. Without this the server cannot verify anyone, so cash on delivery
   and the orders page stay switched off — by design.
5. **Authentication → Settings → Authorised domains**: add your production
   domain. `localhost` is there already.

The `NEXT_PUBLIC_` values are public by design. Firebase's security comes from
the authorised-domain list and your rules, not from hiding the API key.

### 2. Supabase — database

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **SQL Editor** → paste `supabase/schema.sql` → Run.
3. Generate the seed and run it too:
   ```bash
   cd web && npm run dev            # in another terminal
   node supabase/generate-seed.mjs > supabase/seed.sql
   ```
   Paste `supabase/seed.sql` into the SQL Editor → Run. That creates three
   warehouses, the pincode routing table, every variant, and opening stock
   booked in as receipts.
4. **Project Settings → API**, copy into `web/.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...      # server only, never expose
   ```
5. **Authentication → Providers** → enable Email, and Google / Apple if you
   want them. Add `https://your-domain.com/account` as a redirect URL.

Row-level security is on for every table. Stock tables are reachable only
through the security-definer functions, and `site_config` is service-role only
because it holds pricing overrides.

### 3. Razorpay — payments

Test mode is free, instant and needs no KYC. Five minutes end to end.

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Flip the toggle at the top to **Test Mode** — this matters, live mode needs
   KYC and moves real money.
3. **Settings → API Keys → Generate Test Key.** You get an id (`rzp_test_…`)
   and a secret. **The secret is shown once** — copy it there and then.
4. Paste both into `web/.env.local` (that file is gitignored, and it overrides
   everything in `.env.development`):
   ```bash
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Restart `npm run dev`, then open **/admin** — the Integrations panel at the
   top says whether Razorpay accepted the keys. It makes a real authenticated
   call, so "Connected" means they genuinely work, not merely that they are set.

Then pay with test card **4111 1111 1111 1111**, any future expiry, any CVV,
any name. UPI in test mode offers a success/failure choice rather than a real
app.

**Both keys are required.** A secret with no id leaves payments switched off —
`.env.development` ships exactly that, so `npm run test:razorpay` can check the
signature logic without pretending payments are live.

More detail:
6. **Settings → Webhooks** → add `https://your-domain.com/api/razorpay/webhook`,
   subscribe to `payment.captured`, `payment.failed`, `refund.processed`, and
   copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`.
7. **Settings → Configuration** → enable the methods you want to accept: UPI,
   cards, net banking, wallets, EMI, pay later.
8. For card-linked discounts, create an **Offer** (Offers in the sidebar) and
   paste its `offer_XXXX` id into the console under Coupons → Bank & card
   offers. Razorpay validates the card; we cannot.

The browser callback is verified by HMAC so the shopper gets an answer
immediately; the **webhook is the authoritative** confirmation, and it is what
commits the stock. Run `npm run test:razorpay` to see the signature check
accept a valid signature and reject forged, swapped and malformed ones.

Live keys need KYC — a PAN, a bank account and a business proof. Budget a few
days, and keep using test mode until it clears.

### 4. The AI service

See [`ai/README.md`](ai/README.md). Deploy free on Hugging Face Spaces, then:
```bash
AI_SERVICE_URL=https://your-space.hf.space
```

---

## Deploying

Step-by-step, in the order that avoids blocking yourself:
**[DEPLOY.md](DEPLOY.md)**.

## Deploying free

The whole thing runs on free tiers.

| Piece | Where | Free tier |
|---|---|---|
| Storefront + admin | **Vercel** | 100GB bandwidth/month, custom domains, HTTPS |
| Sign-in | **Firebase Auth** | Unlimited email/Google/Apple; ~10k SMS verifications/month |
| Database | **Supabase** | 500MB Postgres, unlimited API requests |
| AI service | **Hugging Face Spaces** | 2 vCPU, 16GB RAM, sleeps when idle |
| Payments | **Razorpay** | No monthly fee; ~2% per transaction |

### Storefront → Vercel

```bash
cd web
npx vercel            # first run links the project
npx vercel --prod
```

Or push to GitHub and import at [vercel.com/new](https://vercel.com/new) — set
the **root directory to `web`**. Add every variable from `.env.example` under
Settings → Environment Variables before the first production deploy.

**Important:** connect Supabase before going live. Without it the admin console
writes to `web/.data/admin.json`, and serverless filesystems are read-only and
temporary — your edits would vanish on the next deploy. The console warns you
about this on the overview page.

### A domain

- **Free:** `your-project.vercel.app` is included, with HTTPS. That is a real,
  shareable address — you do not need to buy anything to launch.
- **Paid, cheapest sensible:** a `.store` or `.shop` is often ₹200–400 for the
  first year at Namecheap or Cloudflare; `.in` is around ₹500–700. Cloudflare
  Registrar sells at cost with no renewal markup, which matters in year two.
- **Free-as-in-free:** `is-a.dev` and `js.org` give away subdomains for real
  projects. Avoid Freenom `.tk`/`.ml` — those get reclaimed without warning.

Then in Vercel → Settings → Domains → add it, and point the nameservers or the
`CNAME` where Vercel tells you. Certificates are automatic.

---

## The iOS app

`web/capacitor.config.js` wraps the deployed site in a native shell.

```bash
cd web
GREZZO_APP_URL=https://your-domain.com npx cap sync ios
npx cap open ios          # requires Xcode
```

**Xcode is not installed on this machine**, so the `.ipa` has not been built —
the project is scaffolded and configured, and `npx cap open ios` is the next
step once you install Xcode from the Mac App Store.

The shell loads the live site rather than a static bundle, because prices,
offers and stock are read per request and a bundled build would ship prices
that go stale the first time you edit a product. What makes it an app rather
than a bookmark:

- **native camera** for Grezzo Lens (`@capacitor/camera`)
- **haptics** on add-to-bag and checkout
- **native splash screen** and system status bar
- installable, offline-aware shell

Apple's guideline 4.2 rejects web wrappers that add nothing native, so those
are not decoration — they are the difference between approval and rejection.
Publishing needs an Apple Developer account at $99/year. Camera and photo
permission strings are already in `ios/App/App/Info.plist`.

Android is one command away if you want it: `npm i @capacitor/android && npx cap add android`.

### Or skip the App Store
The site is an installable PWA today — manifest, icons, service worker and
offline page are all in `web/public`. On iOS, Share → Add to Home Screen gives
a full-screen app with no $99 fee and no review queue. Worth shipping first.

---

## Honest notes

- **Zara.** The animations, layout language and interaction feel are built from
  scratch to a similar brief. No Zara code, fonts, imagery or assets are used,
  and none should be — that is their intellectual property.
- **SAP/Oracle.** Not included, and not something anyone can hand you: they are
  six-figure licensed systems. `supabase/schema.sql` implements the
  capabilities a retailer actually gets from them, in Postgres.
- **The LSTM** ships untrained. `ai/train_recommender.py` bootstraps it from
  simulated sessions so it has something sensible to say on day one; retrain on
  real traffic from the `events` table as soon as you have a few hundred
  sessions.
- **The contact form** is built but not connected to a mail service, and says
  so on screen instead of silently discarding messages.
- **Order tracking is polling, not push.** Fifteen seconds while the tab is
  open. If you want true real-time, Supabase Realtime on the `orders` table is
  the drop-in — the tracking page already re-renders from a single fetch.
- **Bank/card offers cannot be enforced by this application**, only displayed.
  Razorpay enforces them against the real card. An offer with no Razorpay Offer
  id is labelled *display only* in the bag and deducts nothing.
- **Supabase row-level security denies everything on orders, profiles and
  events.** That is intentional: Postgres cannot verify a Firebase token, so
  authorisation happens in the route handlers and the service role does the
  reads. If you later bridge Firebase into Supabase JWTs, the policies to add
  are written out in `supabase/schema.sql`. Wire up Resend or a
  Supabase Edge Function when you want it live.
- **Product photography** is drawn, not photographed. Upload real photos in the
  admin and they replace the drawings per colourway.

---

## Commands

```bash
cd web
npm run dev            # development
npm run build          # production build
npm run lint           # eslint
npm run test:razorpay  # signature verification suite

cd ai
uvicorn app:app --reload --port 8000
python train_recommender.py            # bootstrap the LSTM
python train_recommender.py --supabase # retrain on real sessions
```
