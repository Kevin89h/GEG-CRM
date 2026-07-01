create table if not exists geg_guinee.shipments (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('container', 'parcel')),
  carrier text not null,
  tracking_number text not null,
  description text,
  status text not null default 'in_transit' check (status in ('in_transit', 'arrived', 'delayed', 'delivered')),
  eta date,
  origin text,
  destination text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
