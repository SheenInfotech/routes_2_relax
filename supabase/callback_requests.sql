-- Run in the Supabase SQL Editor. Public visitors can insert requests but cannot read them.
create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  phone text not null
    check (char_length(btrim(phone)) between 7 and 20),
  best_time text not null default 'Any time'
    check (best_time in ('Any time', 'Morning', 'Afternoon', 'Evening')),
  trip text
    check (trip is null or char_length(trip) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists callback_requests_created_at_idx
  on public.callback_requests (created_at desc);

alter table public.callback_requests enable row level security;

revoke all on public.callback_requests from anon, authenticated;
grant insert (name, phone, best_time, trip)
  on public.callback_requests to anon, authenticated;

drop policy if exists "Anyone can submit callback requests" on public.callback_requests;
create policy "Anyone can submit callback requests"
  on public.callback_requests
  for insert
  to anon, authenticated
  with check (true);
