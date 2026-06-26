-- GEG ERP — Module Stock
-- Exécuter dans Supabase SQL Editor après schema.sql

-- ─── Catégories de produits ──────────────────────────────────────────────────
create table public.product_categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  color      text not null default 'blue',
  created_at timestamptz not null default now()
);

alter table public.product_categories enable row level security;
create policy "Auth users view categories" on public.product_categories for select using (auth.uid() is not null);
create policy "Admins manage categories" on public.product_categories for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- Données initiales
insert into public.product_categories (name, color) values
  ('Lubrifiants', 'blue'),
  ('Graisses', 'yellow'),
  ('Pneus', 'gray'),
  ('Batteries', 'green');

-- ─── Conditionnements (formats) ──────────────────────────────────────────────
create table public.units (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null,  -- ex: "1000 L", "20 L", "18 kg", "500 mL"
  type  text not null default 'volume' check (type in ('volume','weight','unit'))
);

alter table public.units enable row level security;
create policy "Auth users view units" on public.units for select using (auth.uid() is not null);
create policy "Admins manage units" on public.units for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

insert into public.units (name, type) values
  ('1000 L',  'volume'),
  ('200 L',   'volume'),
  ('20 L',    'volume'),
  ('5 L',     'volume'),
  ('4 L',     'volume'),
  ('1 L',     'volume'),
  ('500 mL',  'volume'),
  ('18 kg',   'weight'),
  ('Unité',   'unit');

-- ─── Produits ────────────────────────────────────────────────────────────────
create table public.products (
  id              uuid primary key default uuid_generate_v4(),
  reference       text unique,
  name            text not null,
  category_id     uuid references public.product_categories(id) on delete set null,
  unit_id         uuid references public.units(id) on delete set null,
  description     text,
  buy_price       numeric(18,2),
  sell_price      numeric(18,2),
  currency        text not null default 'USD' check (currency in ('USD','GNF','EUR')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.products enable row level security;
create policy "Auth users view products" on public.products for select using (auth.uid() is not null);
create policy "Auth users insert products" on public.products for insert with check (auth.uid() is not null);
create policy "Auth users update products" on public.products for update using (auth.uid() is not null);

create trigger set_products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

create index on public.products(category_id);
create index on public.products(is_active);

-- ─── Entrepôts / Sites ───────────────────────────────────────────────────────
create table public.warehouses (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  city       text,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.warehouses enable row level security;
create policy "Auth users view warehouses" on public.warehouses for select using (auth.uid() is not null);
create policy "Admins manage warehouses" on public.warehouses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- ─── Niveaux de stock (table matérielle) ─────────────────────────────────────
-- Mise à jour automatique par trigger sur stock_moves
create table public.stock_levels (
  id           uuid primary key default uuid_generate_v4(),
  product_id   uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity     numeric(18,3) not null default 0,
  updated_at   timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

alter table public.stock_levels enable row level security;
create policy "Auth users view stock" on public.stock_levels for select using (auth.uid() is not null);
create policy "System can update stock" on public.stock_levels for all using (auth.uid() is not null);

-- ─── Mouvements de stock ─────────────────────────────────────────────────────
create table public.stock_moves (
  id                uuid primary key default uuid_generate_v4(),
  type              text not null check (type in ('in','out','transfer','adjustment')),
  product_id        uuid not null references public.products(id) on delete restrict,
  from_warehouse_id uuid references public.warehouses(id) on delete restrict,
  to_warehouse_id   uuid references public.warehouses(id) on delete restrict,
  quantity          numeric(18,3) not null check (quantity > 0),
  reference         text,          -- N° de bon de livraison, facture, etc.
  notes             text,
  date              timestamptz not null default now(),
  user_id           uuid not null references public.profiles(id),
  created_at        timestamptz not null default now()
);

alter table public.stock_moves enable row level security;
create policy "Auth users view moves" on public.stock_moves for select using (auth.uid() is not null);
create policy "Auth users insert moves" on public.stock_moves for insert with check (auth.uid() = user_id);

create index on public.stock_moves(product_id);
create index on public.stock_moves(type);
create index on public.stock_moves(date desc);

-- ─── Trigger: mise à jour automatique de stock_levels ────────────────────────
create or replace function public.apply_stock_move()
returns trigger language plpgsql security definer as $$
begin
  -- Entrée (in) : crédit vers to_warehouse
  if new.type = 'in' then
    insert into public.stock_levels (product_id, warehouse_id, quantity)
      values (new.product_id, new.to_warehouse_id, new.quantity)
      on conflict (product_id, warehouse_id)
      do update set quantity = stock_levels.quantity + new.quantity, updated_at = now();

  -- Sortie (out) : débit depuis from_warehouse
  elsif new.type = 'out' then
    insert into public.stock_levels (product_id, warehouse_id, quantity)
      values (new.product_id, new.from_warehouse_id, -new.quantity)
      on conflict (product_id, warehouse_id)
      do update set quantity = stock_levels.quantity - new.quantity, updated_at = now();

  -- Transfert : débit source + crédit destination
  elsif new.type = 'transfer' then
    insert into public.stock_levels (product_id, warehouse_id, quantity)
      values (new.product_id, new.from_warehouse_id, -new.quantity)
      on conflict (product_id, warehouse_id)
      do update set quantity = stock_levels.quantity - new.quantity, updated_at = now();
    insert into public.stock_levels (product_id, warehouse_id, quantity)
      values (new.product_id, new.to_warehouse_id, new.quantity)
      on conflict (product_id, warehouse_id)
      do update set quantity = stock_levels.quantity + new.quantity, updated_at = now();

  -- Ajustement : force la quantité absolue dans to_warehouse
  elsif new.type = 'adjustment' then
    insert into public.stock_levels (product_id, warehouse_id, quantity)
      values (new.product_id, new.to_warehouse_id, new.quantity)
      on conflict (product_id, warehouse_id)
      do update set quantity = new.quantity, updated_at = now();
  end if;

  return new;
end;
$$;

create trigger on_stock_move_insert
  after insert on public.stock_moves
  for each row execute procedure public.apply_stock_move();
