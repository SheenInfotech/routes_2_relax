-- Supabase Auth stores email/password credentials in auth.users.
-- This table stores only the user's optional contact profile data.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  contact_phone text,
  full_name text check (full_name is null or char_length(full_name) <= 80),
  address text check (address is null or char_length(address) <= 500),
  mobile_no text check (mobile_no is null or char_length(mobile_no) <= 20),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text check (full_name is null or char_length(full_name) <= 80),
  add column if not exists address text check (address is null or char_length(address) <= 500),
  add column if not exists mobile_no text check (mobile_no is null or char_length(mobile_no) <= 20),
  add column if not exists avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

update public.profiles
set mobile_no = contact_phone
where mobile_no is null and contact_phone is not null;

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, email, full_name, address, mobile_no, avatar_path, updated_at)
  on public.profiles to authenticated;
grant update (id, email, full_name, address, mobile_no, avatar_path, updated_at)
  on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, contact_phone, mobile_no)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'contact_phone', ''),
    nullif(new.raw_user_meta_data ->> 'contact_phone', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      contact_phone = excluded.contact_phone,
      updated_at = pg_catalog.now();

  return new;
end;
$$;

revoke all on function public.sync_auth_user_profile() from public, anon, authenticated;

drop trigger if exists sync_auth_user_profile on auth.users;
create trigger sync_auth_user_profile
  after insert or update on auth.users
  for each row execute function public.sync_auth_user_profile();

insert into public.profiles (id, email, contact_phone, mobile_no)
select
  id,
  email,
  nullif(raw_user_meta_data ->> 'contact_phone', ''),
  nullif(raw_user_meta_data ->> 'contact_phone', '')
from auth.users
on conflict (id) do update
set email = excluded.email,
    contact_phone = excluded.contact_phone,
    updated_at = pg_catalog.now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own profile pictures" on storage.objects;
create policy "Users can read their own profile pictures"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own profile pictures" on storage.objects;
create policy "Users can upload their own profile pictures"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can replace their own profile pictures" on storage.objects;
create policy "Users can replace their own profile pictures"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own profile pictures" on storage.objects;
create policy "Users can delete their own profile pictures"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  rating smallint not null check (rating between 1 and 5),
  package_name text not null default 'Not specified'
    check (char_length(package_name) <= 120),
  feedback text not null
    check (char_length(trim(feedback)) between 1 and 3000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_approved_rating_created_idx
  on public.reviews (rating desc, created_at desc)
  where approved = true;

alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;
grant select (id, display_name, rating, package_name, feedback, approved, created_at)
  on public.reviews to anon, authenticated;
grant insert (user_id, display_name, rating, package_name, feedback)
  on public.reviews to authenticated;

drop policy if exists "Anyone can read approved reviews" on public.reviews;
create policy "Anyone can read approved reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (approved = true);

drop policy if exists "Users can read their own reviews" on public.reviews;
create policy "Users can read their own reviews"
  on public.reviews
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can submit own reviews" on public.reviews;
create policy "Authenticated users can submit own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id and approved = false);

create or replace function public.get_my_reviews()
returns table (
  id uuid,
  rating smallint,
  package_name text,
  feedback text,
  approved boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.package_name, r.feedback, r.approved, r.created_at
  from public.reviews as r
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.get_my_reviews() from public, anon, authenticated;
grant execute on function public.get_my_reviews() to authenticated;
