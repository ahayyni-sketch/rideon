-- RIDEON production schema for Supabase Postgres
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_type where typname='user_role' and typnamespace='public'::regnamespace) then create type public.user_role as enum ('customer','mechanic','workshop','admin'); end if;
  if not exists (select 1 from pg_type where typname='booking_status' and typnamespace='public'::regnamespace) then create type public.booking_status as enum ('pending','confirmed','in_progress','completed','cancelled'); end if;
  if not exists (select 1 from pg_type where typname='roadside_status' and typnamespace='public'::regnamespace) then create type public.roadside_status as enum ('requested','accepted','en_route','arrived','in_service','completed','cancelled'); end if;
  if not exists (select 1 from pg_type where typname='payment_status' and typnamespace='public'::regnamespace) then create type public.payment_status as enum ('unpaid','pending','paid','failed','expired','refunded'); end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'RIDEON Rider',
  phone text,
  role public.user_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand text not null,
  model text not null,
  plate_number text,
  year int,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_type text not null,
  scheduled_at timestamptz not null,
  notes text,
  status public.booking_status not null default 'pending',
  assigned_mechanic_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadside_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  issue text not null,
  phone text,
  address_text text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  status public.roadside_status not null default 'requested',
  assigned_mechanic_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mechanic_locations (
  id bigint generated always as identity primary key,
  roadside_request_id uuid not null references public.roadside_requests(id) on delete cascade,
  mechanic_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists mechanic_locations_request_time_idx on public.mechanic_locations(roadside_request_id, recorded_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('service','parts','roadside')),
  reference_id uuid,
  description text not null,
  amount_idr bigint not null check (amount_idr > 0),
  payment_status public.payment_status not null default 'unpaid',
  midtrans_order_id text unique,
  midtrans_token text,
  midtrans_transaction_id text,
  payment_type text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders(id) on delete set null,
  midtrans_order_id text,
  transaction_status text,
  status_code text,
  gross_amount text,
  payment_type text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
drop trigger if exists roadside_updated_at on public.roadside_requests;
create trigger roadside_updated_at before update on public.roadside_requests for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name','RIDEON Rider'),
    new.raw_user_meta_data->>'phone'
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('mechanic','workshop','admin'));
$$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.roadside_requests enable row level security;
alter table public.mechanic_locations enable row level security;
alter table public.orders enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

drop policy if exists vehicles_owner on public.vehicles;
create policy vehicles_owner on public.vehicles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists bookings_customer on public.bookings;
create policy bookings_customer on public.bookings for select using (customer_id = auth.uid() or public.is_staff());
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert with check (customer_id = auth.uid());
drop policy if exists bookings_staff_update on public.bookings;
create policy bookings_staff_update on public.bookings for update using (public.is_staff()) with check (public.is_staff());

-- Customers can create/read their roadside jobs; staff can operate them.
drop policy if exists roadside_customer_select on public.roadside_requests;
create policy roadside_customer_select on public.roadside_requests for select using (customer_id = auth.uid() or public.is_staff());
drop policy if exists roadside_customer_insert on public.roadside_requests;
create policy roadside_customer_insert on public.roadside_requests for insert with check (customer_id = auth.uid());
drop policy if exists roadside_staff_update on public.roadside_requests;
create policy roadside_staff_update on public.roadside_requests for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists location_customer_select on public.mechanic_locations;
create policy location_customer_select on public.mechanic_locations for select using (
  exists(select 1 from public.roadside_requests r where r.id = roadside_request_id and (r.customer_id = auth.uid() or public.is_staff()))
);
drop policy if exists location_mechanic_insert on public.mechanic_locations;
create policy location_mechanic_insert on public.mechanic_locations for insert with check (
  mechanic_id = auth.uid() and exists(select 1 from public.roadside_requests r where r.id = roadside_request_id and r.assigned_mechanic_id = auth.uid())
);

drop policy if exists orders_customer on public.orders;
create policy orders_customer on public.orders for select using (customer_id = auth.uid() or public.is_staff());
drop policy if exists orders_customer_insert on public.orders;
create policy orders_customer_insert on public.orders for insert with check (customer_id = auth.uid());
drop policy if exists orders_customer_update on public.orders;
create policy orders_customer_update on public.orders for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Payment events are server-only; no client policy intentionally.

-- Realtime: use Postgres Changes for the initial implementation. For high-volume tracking,
-- migrate tracking updates to Realtime Broadcast as the product scales.
do $$ begin
  begin alter publication supabase_realtime add table public.roadside_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mechanic_locations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bookings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
end $$;

-- Optional: make a mechanic account manually after the user signs up:
-- update public.profiles set role='mechanic' where id='USER_UUID';
