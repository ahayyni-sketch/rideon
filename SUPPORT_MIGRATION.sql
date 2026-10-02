-- RIDEON customer service / consultation migration
-- Run this once in Supabase SQL Editor if the existing schema.sql was already executed.

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  motorcycle text,
  category text not null,
  message text not null,
  urgency text not null default 'normal' check (urgency in ('normal','soon','unsafe')),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  staff_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_messages_customer_time_idx on public.support_messages(customer_id, created_at desc);

drop trigger if exists support_messages_updated_at on public.support_messages;
create trigger support_messages_updated_at before update on public.support_messages for each row execute function public.set_updated_at();

alter table public.support_messages enable row level security;

drop policy if exists support_customer_select on public.support_messages;
create policy support_customer_select on public.support_messages for select
using (customer_id = auth.uid() or public.is_staff());

drop policy if exists support_customer_insert on public.support_messages;
create policy support_customer_insert on public.support_messages for insert
with check (customer_id = auth.uid());

drop policy if exists support_staff_update on public.support_messages;
create policy support_staff_update on public.support_messages for update
using (public.is_staff()) with check (public.is_staff());

drop policy if exists roadside_customer_update on public.roadside_requests;
create policy roadside_customer_update on public.roadside_requests for update
using (customer_id = auth.uid()) with check (customer_id = auth.uid());

do $$ begin
  begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end;
end $$;
