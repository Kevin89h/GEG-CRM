-- GEG CRM — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'sales_rep' check (role in ('admin', 'manager', 'sales_rep')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (auth.uid() is not null);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Accounts ─────────────────────────────────────────────────────────────────
create table public.accounts (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null check (type in ('government', 'enterprise', 'sme')),
  industry    text,
  country     text not null default 'Guinée',
  city        text,
  phone       text,
  email       text,
  website     text,
  notes       text,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Authenticated users can view accounts" on public.accounts
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert accounts" on public.accounts
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update accounts" on public.accounts
  for update using (auth.uid() is not null);

create policy "Admins and managers can delete accounts" on public.accounts
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ─── Contacts ─────────────────────────────────────────────────────────────────
create table public.contacts (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  title       text,
  email       text,
  phone       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "Authenticated users can view contacts" on public.contacts
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert contacts" on public.contacts
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update contacts" on public.contacts
  for update using (auth.uid() is not null);

create policy "Admins and managers can delete contacts" on public.contacts
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ─── Deals ────────────────────────────────────────────────────────────────────
create table public.deals (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  title       text not null,
  stage       text not null default 'lead'
              check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value       numeric(18, 2),
  currency    text not null default 'USD' check (currency in ('USD', 'GNF', 'EUR')),
  probability integer check (probability between 0 and 100),
  close_date  date,
  owner_id    uuid references public.profiles(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.deals enable row level security;

create policy "Authenticated users can view deals" on public.deals
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert deals" on public.deals
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update deals" on public.deals
  for update using (auth.uid() is not null);

create policy "Admins and managers can delete deals" on public.deals
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ─── Activities ───────────────────────────────────────────────────────────────
create table public.activities (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null check (type in ('call', 'meeting', 'email', 'note')),
  subject         text not null,
  notes           text,
  date            timestamptz not null default now(),
  follow_up_date  date,
  completed       boolean not null default false,
  account_id      uuid references public.accounts(id) on delete set null,
  contact_id      uuid references public.contacts(id) on delete set null,
  deal_id         uuid references public.deals(id) on delete set null,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Authenticated users can view activities" on public.activities
  for select using (auth.uid() is not null);

create policy "Users can insert own activities" on public.activities
  for insert with check (auth.uid() = user_id);

create policy "Users can update own activities" on public.activities
  for update using (auth.uid() = user_id);

create policy "Users can delete own activities" on public.activities
  for delete using (auth.uid() = user_id);

-- ─── Timestamps trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute procedure public.set_updated_at();

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

create trigger set_deals_updated_at
  before update on public.deals
  for each row execute procedure public.set_updated_at();

-- ─── Useful indexes ───────────────────────────────────────────────────────────
create index on public.accounts(type);
create index on public.accounts(owner_id);
create index on public.contacts(account_id);
create index on public.deals(account_id);
create index on public.deals(stage);
create index on public.deals(owner_id);
create index on public.activities(user_id);
create index on public.activities(account_id);
create index on public.activities(deal_id);
create index on public.activities(follow_up_date) where completed = false;
