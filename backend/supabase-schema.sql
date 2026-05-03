-- Podsecntra database schema (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  image text not null,
  description text not null,
  rating numeric(3,2) not null default 4.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  customer_name text,
  customer_email text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'active' check (status in ('active','abandoned','completed')),
  order_id text,
  payment_session_id text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cart_sessions_status on public.cart_sessions(status);
create index if not exists idx_cart_sessions_last_activity on public.cart_sessions(last_activity_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  cf_order_id text,
  payment_session_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_zip text,
  items jsonb not null default '[]'::jsonb,
  amount numeric(10,2) not null default 0,
  payment_status text not null default 'ACTIVE',
  cart_session_id uuid references public.cart_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_cart_sessions_updated_at on public.cart_sessions;
create trigger trg_cart_sessions_updated_at
before update on public.cart_sessions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();
