-- Run in the Supabase SQL Editor. Public visitors can insert enquiries but cannot read them.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  phone text not null
    check (char_length(btrim(phone)) between 7 and 20),
  email text
    check (email is null or char_length(email) <= 254),
  package_name text not null
    check (char_length(package_name) between 1 and 120),
  preferred_date date,
  date_flexibility text
    check (
      date_flexibility is null
      or date_flexibility in (
        'Exact dates',
        'Flexible by a few days',
        'Flexible by a few weeks',
        'Just exploring for now'
      )
    ),
  adults integer not null default 1 check (adults between 1 and 20),
  children integer not null default 0 check (children between 0 and 20),
  infants integer not null default 0 check (infants between 0 and 20),
  message text
    check (message is null or char_length(message) <= 2000),
  source text not null
    check (source in ('home_modal', 'contact_page')),
  created_at timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx
  on public.enquiries (created_at desc);

alter table public.enquiries enable row level security;

revoke all on public.enquiries from anon, authenticated;
grant insert (
  name,
  phone,
  email,
  package_name,
  preferred_date,
  date_flexibility,
  adults,
  children,
  infants,
  message,
  source
)
  on public.enquiries to anon, authenticated;

drop policy if exists "Anyone can submit enquiries" on public.enquiries;
create policy "Anyone can submit enquiries"
  on public.enquiries
  for insert
  to anon, authenticated
  with check (true);
