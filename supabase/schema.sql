-- =====================================================================
-- GREZZO — Postgres schema
--
-- This is the part that stands in for SAP/Oracle at Inditex scale. The
-- shape is deliberately the same one enterprise retail runs on:
--
--   · stock is held per (variant, warehouse) — never a single number
--   · every change is an append-only movement, so stock is auditable
--     and can be replayed
--   · checkout takes a time-limited reservation instead of decrementing
--     immediately, so an abandoned payment never loses a sale
--   · allocation prefers one warehouse that can ship the whole order,
--     chosen by transit time to the delivery pincode
--
-- Run this once in the Supabase SQL editor, then seed.sql.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists vector;      -- image + item embeddings

-- ---------------------------------------------------------------------
-- Site configuration
--
-- One row holding the admin console's JSON blob: product overrides,
-- offers, uploaded photography and stock counts. A single row rather
-- than a table per concept, because it is read whole on every page
-- render and written whole by the console.
-- ---------------------------------------------------------------------
create table if not exists site_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table if not exists products (
  id           text primary key,
  slug         text unique not null,
  name         text not null,
  price_paise  integer not null check (price_paise > 0),
  compare_paise integer,
  fit          text not null,
  rise         text not null,
  wash         text not null,
  fabric       text,
  weight_oz    numeric(4,1),
  stretch_pct  integer default 0,
  collection   text,
  story        text,
  tags         text[] default '{}',
  active       boolean default true,
  -- CLIP image embedding, written by the AI service (see ../ai)
  embedding    vector(512),
  created_at   timestamptz default now()
);

create index if not exists products_collection_idx on products (collection);
create index if not exists products_tags_idx on products using gin (tags);

-- Vector index for Grezzo Lens. ivfflat needs rows before it is useful;
-- build it after seeding embeddings.
create index if not exists products_embedding_idx
  on products using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Colour is a real variant axis, not a label: it has its own stock.
create table if not exists variants (
  sku        text primary key,          -- product-colour-size
  product_id text not null references products(id) on delete cascade,
  colour     text not null,             -- colourway code, e.g. "dark-stone"
  size       integer not null,
  unique (product_id, colour, size)
);

create index if not exists variants_product_idx on variants (product_id, colour);

-- ---------------------------------------------------------------------
-- Warehouses and routing
-- ---------------------------------------------------------------------
create table if not exists warehouses (
  code      text primary key,
  name      text not null,
  city      text,
  state     text,
  pincode   text,
  priority  integer default 100,        -- tie-breaker: lower ships first
  active    boolean default true
);

-- Serviceability by pincode prefix. Real deployments replace this with a
-- courier's pincode master; the shape stays the same.
create table if not exists warehouse_zones (
  warehouse_code text not null references warehouses(code) on delete cascade,
  pincode_prefix text not null,
  transit_days   integer not null default 5,
  primary key (warehouse_code, pincode_prefix)
);

-- ---------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------
create table if not exists inventory (
  sku            text not null references variants(sku) on delete cascade,
  warehouse_code text not null references warehouses(code) on delete cascade,
  on_hand        integer not null default 0 check (on_hand >= 0),
  safety_stock   integer not null default 0 check (safety_stock >= 0),
  updated_at     timestamptz default now(),
  primary key (sku, warehouse_code)
);

do $$ begin
  create type movement_kind as enum
    ('receipt', 'issue', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'cycle_count');
exception when duplicate_object then null; end $$;

-- Append-only. Never update or delete a row here.
create table if not exists stock_movements (
  id             bigserial primary key,
  sku            text not null,
  warehouse_code text not null,
  kind           movement_kind not null,
  qty            integer not null,       -- signed: +receipt, -issue
  reference      text,                   -- order id, reservation id, PO number
  note           text,
  created_at     timestamptz default now()
);

create index if not exists movements_sku_idx on stock_movements (sku, created_at desc);
create index if not exists movements_ref_idx on stock_movements (reference);

-- ---------------------------------------------------------------------
-- Reservations — stock held during checkout
-- ---------------------------------------------------------------------
create table if not exists reservations (
  id         text primary key,
  pincode    text,
  status     text not null default 'held'
             check (status in ('held', 'committed', 'released', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists reservations_expiry_idx
  on reservations (expires_at) where status = 'held';

create table if not exists reservation_lines (
  reservation_id text not null references reservations(id) on delete cascade,
  sku            text not null references variants(sku),
  warehouse_code text not null references warehouses(code),
  qty            integer not null check (qty > 0),
  primary key (reservation_id, sku, warehouse_code)
);

-- ---------------------------------------------------------------------
-- Customers and orders
--
-- Identity comes from Firebase Authentication, not Supabase Auth, so
-- `user_id` here is a Firebase uid (a text string) rather than a uuid
-- pointing at auth.users. Nothing in this database can verify a Firebase
-- token, which is why every read and write below goes through the service
-- role from a Next.js route handler that has already verified the session
-- cookie. The RLS policies reflect that: deny by default.
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id         text primary key,          -- Firebase uid
  email      text,
  full_name  text,
  phone      text,
  created_at timestamptz default now()
);

-- Saved delivery addresses. Their own table on purpose: site_config is read
-- whole on every page render, so customer data must not accumulate in it.
create table if not exists addresses (
  id         text primary key,
  user_id    text not null,              -- Firebase uid
  label      text not null default 'Home',
  name       text not null,
  phone      text not null,
  line1      text not null,
  line2      text,
  city       text not null,
  state      text not null,
  pincode    text not null,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists addresses_user_idx on addresses (user_id, is_default desc);

create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text,                    -- Firebase uid
  email              text,
  phone              text,
  pincode            text,
  address            text,
  payment_method     text check (payment_method in
                       ('upi','card','netbanking','wallet','paylater','emi','cod')),
  coupon_code        text,
  coupon_discount_paise integer not null default 0,
  cod_fee_paise      integer not null default 0,
  receipt            text unique not null,
  razorpay_order_id  text unique,
  razorpay_payment_id text,
  status             text not null default 'created'
                     check (status in ('created','paid','cod_pending','failed','signature_failed',
                                       'refunded','cancelled','shipped','delivered')),
  subtotal_paise     integer not null,
  shipping_paise     integer not null default 0,
  total_paise        integer not null,
  reservation_id     text references reservations(id),
  lines              jsonb not null,
  -- Fulfilment history, newest last. This is what the tracking page renders.
  timeline           jsonb not null default '[]'::jsonb,
  paid_at            timestamptz,
  created_at         timestamptz default now()
);

create index if not exists orders_user_idx on orders (user_id, created_at desc);
create index if not exists orders_coupon_idx on orders (coupon_code) where coupon_code is not null;
create index if not exists orders_status_idx on orders (status);

create table if not exists shipments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  warehouse_code text references warehouses(code),
  carrier        text,
  tracking       text,
  status         text default 'packing',
  shipped_at     timestamptz,
  created_at     timestamptz default now()
);

-- Move an order along and record the step in one statement, so the status
-- and its history can never disagree.
--
-- Razorpay confirms a payment twice: once from the browser callback, once
-- from the webhook. Both are wanted, since either can be lost — the shopper
-- closes the tab, or the webhook is delayed. Whichever lands second must not
-- add a duplicate step to the history the tracking page draws, which is why
-- a transition to the status already held is a no-op. Guarding in the route
-- handlers is not enough: they read the status and act on it separately, so
-- two confirmations arriving together can both see the old value.
create or replace function append_order_status(
  p_order_id uuid, p_status text, p_entry jsonb
) returns void
language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update orders
  set status = p_status,
      timeline = timeline || p_entry
  where id = p_order_id
    and status is distinct from p_status;
end $$;

-- ---------------------------------------------------------------------
-- Behavioural events — training data for the LSTM recommender
-- ---------------------------------------------------------------------
create table if not exists events (
  id         bigserial primary key,
  user_id    text,                       -- Firebase uid when signed in
  anon_id    text,                       -- device id when signed out
  session_id text,
  kind       text not null check (kind in ('view','favourite','add_to_cart','purchase','search')),
  product_id text references products(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists events_session_idx on events (session_id, created_at);
create index if not exists events_user_idx on events (user_id, created_at desc);

-- =====================================================================
-- Functions
-- =====================================================================

-- Available = on hand, minus safety stock, minus anything currently held.
create or replace function available_by_variant(p_sku text, p_warehouse text default null)
returns integer
language sql stable as $$
  select coalesce(sum(i.on_hand - i.safety_stock), 0)
       - coalesce((
           select sum(rl.qty)
           from reservation_lines rl
           join reservations r on r.id = rl.reservation_id
           where rl.sku = p_sku
             and (p_warehouse is null or rl.warehouse_code = p_warehouse)
             and r.status = 'held'
             and r.expires_at > now()
         ), 0)
  from inventory i
  where i.sku = p_sku
    and (p_warehouse is null or i.warehouse_code = p_warehouse);
$$;

-- Per-size availability for one colourway on a product page.
create or replace function available_by_size(p_product_id text, p_colour text)
returns table (size integer, available integer)
language sql stable as $$
  select v.size, greatest(available_by_variant(v.sku), 0)::integer
  from variants v
  where v.product_id = p_product_id
    and v.colour = p_colour
  order by v.size;
$$;

-- ---------------------------------------------------------------------
-- reserve_stock
--
-- Tries hardest to hold the whole order in ONE warehouse — a single
-- parcel is cheaper to ship and better for the customer. Falls back to
-- splitting per line only when no single site can cover everything.
--
-- p_lines: [{"product_id":"gz-001","colour":"raw-indigo","size":32,"qty":1}, ...]
-- returns: {"ok":true} | {"ok":false,"unavailable":[...]}
-- ---------------------------------------------------------------------
create or replace function reserve_stock(
  p_reservation_id text,
  p_pincode        text,
  p_ttl_minutes    integer,
  p_lines          jsonb
) returns jsonb
language plpgsql security definer as $$
declare
  v_line          jsonb;
  v_sku           text;
  v_qty           integer;
  v_best          text;
  v_unavailable   jsonb := '[]'::jsonb;
  v_single_site   text;
  v_avail         integer;
begin
  -- Resolve every line to a sku up front and fail loudly on nonsense input.
  --
  -- Dropped first because `on commit drop` only fires at COMMIT: calling
  -- reserve_stock twice inside one transaction otherwise fails with
  -- `relation "_want" already exists`.
  drop table if exists _want;
  create temp table _want (
    sku text primary key, product_id text, colour text, size integer, qty integer
  ) on commit drop;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select v.sku into v_sku
    from variants v
    where v.product_id = v_line->>'product_id'
      and v.colour = v_line->>'colour'
      and v.size = (v_line->>'size')::integer;

    if v_sku is null then
      return jsonb_build_object('ok', false, 'unavailable', jsonb_build_array(
        jsonb_build_object('product_id', v_line->>'product_id',
                           'colour', v_line->>'colour',
                           'size', (v_line->>'size')::integer,
                           'requested', (v_line->>'qty')::integer,
                           'available', 0)));
    end if;

    insert into _want values (v_sku, v_line->>'product_id', v_line->>'colour',
                              (v_line->>'size')::integer, (v_line->>'qty')::integer)
    on conflict (sku) do update set qty = _want.qty + excluded.qty;
  end loop;

  -- Lock the rows we are about to read so two checkouts cannot both win.
  perform 1 from inventory i join _want w on w.sku = i.sku for update;

  -- Can one warehouse cover the whole basket? Prefer fastest to the pincode.
  select wh.code into v_single_site
  from warehouses wh
  left join warehouse_zones wz
    on wz.warehouse_code = wh.code
   and p_pincode is not null
   and left(p_pincode, length(wz.pincode_prefix)) = wz.pincode_prefix
  where wh.active
    and not exists (
      select 1 from _want w
      where coalesce(available_by_variant(w.sku, wh.code), 0) < w.qty
    )
  order by coalesce(wz.transit_days, 99), wh.priority
  limit 1;

  insert into reservations (id, pincode, status, expires_at)
  values (p_reservation_id, p_pincode, 'held', now() + make_interval(mins => p_ttl_minutes))
  on conflict (id) do nothing;

  if v_single_site is not null then
    insert into reservation_lines (reservation_id, sku, warehouse_code, qty)
    select p_reservation_id, w.sku, v_single_site, w.qty from _want w
    on conflict do nothing;
    return jsonb_build_object('ok', true, 'warehouse', v_single_site, 'split', false);
  end if;

  -- Split shipment: best single warehouse per line.
  for v_sku, v_qty in select sku, qty from _want loop
    select wh.code into v_best
    from warehouses wh
    left join warehouse_zones wz
      on wz.warehouse_code = wh.code
     and p_pincode is not null
     and left(p_pincode, length(wz.pincode_prefix)) = wz.pincode_prefix
    where wh.active
      and coalesce(available_by_variant(v_sku, wh.code), 0) >= v_qty
    order by coalesce(wz.transit_days, 99), wh.priority
    limit 1;

    if v_best is null then
      select coalesce(available_by_variant(v_sku), 0) into v_avail;
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', (select product_id from _want where sku = v_sku),
        'colour',     (select colour from _want where sku = v_sku),
        'size',       (select size from _want where sku = v_sku),
        'requested',  v_qty,
        'available',  greatest(v_avail, 0));
    else
      insert into reservation_lines (reservation_id, sku, warehouse_code, qty)
      values (p_reservation_id, v_sku, v_best, v_qty)
      on conflict do nothing;
    end if;
  end loop;

  if jsonb_array_length(v_unavailable) > 0 then
    -- All or nothing: never hold a partial basket.
    delete from reservations where id = p_reservation_id;
    return jsonb_build_object('ok', false, 'unavailable', v_unavailable);
  end if;

  return jsonb_build_object('ok', true, 'split', true);
end $$;

-- ---------------------------------------------------------------------
-- commit_reservation — payment captured, issue the stock for real.
-- Safe to call twice: Razorpay retries webhooks.
-- ---------------------------------------------------------------------
create or replace function commit_reservation(p_reservation_id text)
returns boolean
language plpgsql security definer as $$
declare v_status text;
begin
  select status into v_status from reservations where id = p_reservation_id for update;
  if v_status is null then return false; end if;
  if v_status = 'committed' then return true; end if;      -- already done
  if v_status <> 'held' then return false; end if;

  update inventory i
  set on_hand = i.on_hand - rl.qty, updated_at = now()
  from reservation_lines rl
  where rl.reservation_id = p_reservation_id
    and i.sku = rl.sku
    and i.warehouse_code = rl.warehouse_code;

  insert into stock_movements (sku, warehouse_code, kind, qty, reference, note)
  select rl.sku, rl.warehouse_code, 'issue', -rl.qty, p_reservation_id, 'order committed'
  from reservation_lines rl
  where rl.reservation_id = p_reservation_id;

  update reservations set status = 'committed' where id = p_reservation_id;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- release_reservation — payment failed or abandoned. Idempotent.
-- ---------------------------------------------------------------------
create or replace function release_reservation(p_reservation_id text)
returns boolean
language plpgsql security definer as $$
begin
  update reservations
  set status = 'released'
  where id = p_reservation_id and status = 'held';
  return found;
end $$;

-- Sweeper for holds nobody ever paid for. Schedule with pg_cron:
--   select cron.schedule('expire-holds', '*/5 * * * *', 'select expire_reservations()');
create or replace function expire_reservations()
returns integer
language plpgsql security definer as $$
declare v_count integer;
begin
  update reservations set status = 'expired'
  where status = 'held' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- receive_stock — inbound from a supplier. The only way stock goes up.
-- ---------------------------------------------------------------------
create or replace function receive_stock(
  p_sku text, p_warehouse text, p_qty integer, p_reference text default null
) returns void
language plpgsql security definer as $$
begin
  insert into inventory (sku, warehouse_code, on_hand)
  values (p_sku, p_warehouse, p_qty)
  on conflict (sku, warehouse_code)
  do update set on_hand = inventory.on_hand + p_qty, updated_at = now();

  insert into stock_movements (sku, warehouse_code, kind, qty, reference, note)
  values (p_sku, p_warehouse, 'receipt', p_qty, p_reference, 'goods received');
end $$;

-- =====================================================================
-- Row level security
-- =====================================================================
alter table site_config        enable row level security;
alter table products           enable row level security;
alter table variants           enable row level security;
alter table warehouses         enable row level security;
alter table warehouse_zones    enable row level security;
alter table inventory          enable row level security;
alter table stock_movements    enable row level security;
alter table reservations       enable row level security;
alter table reservation_lines  enable row level security;
alter table orders             enable row level security;
alter table shipments          enable row level security;
alter table addresses          enable row level security;
alter table profiles           enable row level security;
alter table events             enable row level security;

-- Catalogue is public. site_config is deliberately NOT: it holds internal
-- pricing overrides, so it is reachable only through the service role.
create policy "catalogue readable" on products for select using (active);
create policy "variants readable"  on variants for select using (true);

-- Stock levels are not public; the app reads them through the functions,
-- which run as definer. Only the service role touches these tables.
-- Orders, addresses, profiles and events carry no policies at all, which under RLS
-- means the anon and authenticated roles can do nothing with them. That is
-- deliberate: Supabase cannot verify a Firebase token, so authorisation
-- happens in the Next.js route handlers, which check the session cookie
-- with firebase-admin and then use the service role.
--
-- If you later bridge Firebase into Supabase by minting a Supabase JWT
-- with the Firebase uid as `sub`, add policies like:
--   create policy "orders are the customer's own" on orders
--     for select using (auth.jwt() ->> 'sub' = user_id);

-- =====================================================================
-- Function privileges
--
-- RLS above protects the tables, but PostgREST also publishes every
-- function in `public` at /rest/v1/rpc/<name>, and Postgres grants
-- EXECUTE on a new function to the PUBLIC pseudo-role automatically.
-- Without the revoke below, anyone holding the anon key — which ships to
-- every browser — could call receive_stock to invent inventory or
-- append_order_status to mark an arbitrary order paid. Verified by
-- exploiting it against a live project before this was added.
--
-- Revoking from anon and authenticated alone is NOT enough; they inherit
-- the grant from PUBLIC. Revoke from PUBLIC, then grant back to
-- service_role, which is the only identity the route handlers use.
-- =====================================================================
do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('append_order_status','reserve_stock','commit_reservation',
                        'release_reservation','expire_reservations','receive_stock',
                        'available_by_variant','available_by_size')
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;

-- Functions added later inherit the same posture instead of being
-- world-executable from the moment they are created.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- A SECURITY DEFINER function with a mutable search_path can be hijacked by
-- a caller who puts a same-named table earlier in their path. pg_temp last.
alter function append_order_status(uuid, text, jsonb)        set search_path = public, pg_temp;
alter function reserve_stock(text, text, integer, jsonb)     set search_path = public, pg_temp;
alter function commit_reservation(text)                      set search_path = public, pg_temp;
alter function release_reservation(text)                     set search_path = public, pg_temp;
alter function expire_reservations()                         set search_path = public, pg_temp;
alter function receive_stock(text, text, integer, text)      set search_path = public, pg_temp;
alter function available_by_variant(text, text)              set search_path = public, pg_temp;
alter function available_by_size(text, text)                 set search_path = public, pg_temp;

-- =====================================================================
-- Console stock control
--
-- receive_stock only ever adds. The admin console also has to correct a
-- count to an absolute figure after a stocktake, and read the whole grid
-- for a product in one round trip.
-- =====================================================================

create or replace function set_stock(
  p_sku text, p_warehouse text, p_qty integer, p_reference text default null
) returns integer
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_current integer;
  v_delta   integer;
begin
  if p_qty < 0 then
    raise exception 'stock cannot be negative';
  end if;

  select on_hand into v_current
  from inventory where sku = p_sku and warehouse_code = p_warehouse for update;

  if v_current is null then
    insert into inventory (sku, warehouse_code, on_hand) values (p_sku, p_warehouse, 0);
    v_current := 0;
  end if;

  v_delta := p_qty - v_current;
  if v_delta = 0 then return p_qty; end if;

  update inventory set on_hand = p_qty, updated_at = now()
  where sku = p_sku and warehouse_code = p_warehouse;

  -- The correction is recorded rather than applied silently, so a count
  -- that turns out to be wrong can still be explained afterwards.
  insert into stock_movements (sku, warehouse_code, kind, qty, reference, note)
  values (p_sku, p_warehouse, 'cycle_count', v_delta, p_reference, 'counted in console');

  return p_qty;
end $$;

create or replace function stock_grid(p_product_id text)
returns table (sku text, colour text, size integer, on_hand integer, available integer)
language sql stable
set search_path = public, pg_temp as $$
  select v.sku, v.colour, v.size,
         coalesce((select sum(i.on_hand) from inventory i where i.sku = v.sku), 0)::integer,
         greatest(available_by_variant(v.sku), 0)::integer
  from variants v
  where v.product_id = p_product_id
  order by v.colour, v.size;
$$;

revoke all on function set_stock(text, text, integer, text) from public, anon, authenticated;
grant execute on function set_stock(text, text, integer, text) to service_role;
revoke all on function stock_grid(text) from public, anon, authenticated;
grant execute on function stock_grid(text) to service_role;
