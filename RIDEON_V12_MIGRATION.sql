-- RIDEON V12 Business System Migration
-- Safe to run after the existing RIDEON schema + SUPPORT_MIGRATION.sql.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  name text not null,
  brand text,
  category text not null default 'maintenance',
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reorder_level integer not null default 3 check (reorder_level >= 0),
  unit_cost_idr bigint not null default 0 check (unit_cost_idr >= 0),
  retail_price_idr bigint not null default 0 check (retail_price_idr >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_key text not null,
  product_name text not null,
  brand text,
  quantity integer not null check (quantity > 0),
  unit_price_idr bigint not null check (unit_price_idr >= 0),
  subtotal_idr bigint not null check (subtotal_idr >= 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  mechanic_id uuid references public.profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','assigned','in_progress','quality_check','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  mechanic_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_time_idx on public.notifications(user_id, created_at desc);

-- Starter inventory: real product names already used by the RIDEON Parts catalog.
insert into public.inventory_items(product_key,name,brand,category,stock_qty,reorder_level,unit_cost_idr,retail_price_idr)
values
('motul7100','MOTUL 7100 10W-40 4T 1L','MOTUL','oil',8,3,105000,145000),
('shellax7','Shell Advance AX7 Scooter 10W-40','SHELL','oil',10,3,60000,85000),
('motul_scooter','MOTUL Scooter Expert LE 10W-40','MOTUL','oil',6,3,80000,110000),
('shellultra','Shell Advance Ultra 10W-40','SHELL','oil',5,2,105000,145000),
('kyt_nfr','KYT NFR Full Face Helmet','KYT','helmet',4,1,1450000,1850000),
('njs_kairoz','NJS Kairoz V1','NJS','helmet',5,2,310000,420000),
('maxxis_m6234','MAXXIS Extramaxx M6234W','MAXXIS','tire',6,2,500000,650000),
('pirelli_angel','Pirelli Angel Scooter','PIRELLI','tire',5,2,560000,720000),
('gs_gtz5s','GS Astra GTZ5S Sealed MF','GS ASTRA','battery',7,2,185000,245000),
('motobatt_mbtz7s','MotoBatt MBTZ7S QuadFlex','MOTOBATT','battery',4,2,300000,390000),
('ngk_cpr8','NGK CPR8EA-9 Spark Plug','NGK','maintenance',20,5,28000,45000)
on conflict (product_key) do update set name=excluded.name, brand=excluded.brand, category=excluded.category, retail_price_idr=excluded.retail_price_idr;

create or replace function public.v12_touch_inventory() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute function public.v12_touch_inventory();

drop trigger if exists service_jobs_updated_at on public.service_jobs;
create trigger service_jobs_updated_at before update on public.service_jobs for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;
alter table public.order_items enable row level security;
alter table public.service_jobs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists inventory_public_read on public.inventory_items;
create policy inventory_public_read on public.inventory_items for select using (true);
drop policy if exists inventory_staff_write on public.inventory_items;
create policy inventory_staff_write on public.inventory_items for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists order_items_customer_read on public.order_items;
create policy order_items_customer_read on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_staff())));
drop policy if exists order_items_customer_insert on public.order_items;
create policy order_items_customer_insert on public.order_items for insert with check (exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));

drop policy if exists service_jobs_customer_read on public.service_jobs;
create policy service_jobs_customer_read on public.service_jobs for select using (exists(select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or public.is_staff())));
drop policy if exists service_jobs_staff_write on public.service_jobs;
create policy service_jobs_staff_write on public.service_jobs for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select using (user_id=auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists notifications_staff_insert on public.notifications;
create policy notifications_staff_insert on public.notifications for insert with check (public.is_staff());

do $$ begin
  begin alter publication supabase_realtime add table public.service_jobs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;
