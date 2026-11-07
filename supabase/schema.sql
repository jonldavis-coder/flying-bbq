-- Flying BBQ schema, row level security, and rate limits.
-- Run this once in the Supabase SQL editor for a new project.
-- Then create an account on the site and add yourself as owner:
--   insert into public.owners (user_id)
--   select id from auth.users where email = 'you@example.com';
-- Never put the service-role key in this repository.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null default 'Cook',
  name text not null check (char_length(name) between 3 and 120),
  story text not null default '' check (char_length(story) <= 2000),
  country text not null,
  region text not null,
  base_type text not null,
  heat text not null,
  flavor text not null default '',
  fun_fact text not null default '',
  yield_text text not null,
  prep_minutes integer not null check (prep_minutes between 0 and 1440),
  cook_minutes integer not null check (cook_minutes between 0 and 1440),
  servings integer not null check (servings between 1 and 100),
  uses jsonb not null,
  diets jsonb not null default '[]'::jsonb,
  ingredients jsonb not null,
  steps jsonb not null,
  photo_url text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint dishes_time_present check (prep_minutes + cook_minutes > 0),
  constraint dishes_ingredients_array check (jsonb_typeof(ingredients) = 'array'),
  constraint dishes_steps_array check (jsonb_typeof(steps) = 'array')
);

create table if not exists public.dish_flags (
  slug text primary key,
  hidden boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  dish_slug text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Cook',
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.twists (
  id uuid primary key default gen_random_uuid(),
  dish_slug text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Cook',
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 2 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hearts (
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_slug)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_slug text not null,
  stars integer not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, dish_slug)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reporter_name text not null default 'Cook',
  target_type text not null check (target_type in ('dish', 'comment', 'twist')),
  target_id text not null,
  dish_slug text not null default '',
  reason text not null check (char_length(reason) between 2 and 80),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists dishes_created_idx on public.dishes (created_at desc);
create index if not exists comments_dish_idx on public.comments (dish_slug, created_at);
create index if not exists twists_dish_idx on public.twists (dish_slug, created_at);
create index if not exists hearts_slug_idx on public.hearts (dish_slug);
create index if not exists ratings_slug_idx on public.ratings (dish_slug);

create or replace function public.am_i_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.owners where user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  clean_name text;
begin
  raw_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Cook');
  clean_name := left(regexp_replace(raw_name, '[^a-zA-Z0-9 ._-]', '', 'g'), 40);
  if clean_name is null or length(btrim(clean_name)) = 0 then
    clean_name := 'Cook';
  end if;
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), clean_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prepare_dish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  new.author_id := auth.uid();
  new.author_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Cook');
  new.hidden := false;
  if jsonb_array_length(new.ingredients) < 1 or jsonb_array_length(new.ingredients) > 40 then
    raise exception 'Add between 1 and 40 ingredients';
  end if;
  if jsonb_array_length(new.steps) < 1 or jsonb_array_length(new.steps) > 30 then
    raise exception 'Add between 1 and 30 steps';
  end if;
  select count(*) into recent_count
  from public.dishes
  where author_id = auth.uid()
    and created_at > now() - interval '1 hour';
  if recent_count >= 3 then
    raise exception 'Rate limit exceeded. Please wait and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists dishes_prepare on public.dishes;
create trigger dishes_prepare
  before insert on public.dishes
  for each row execute function public.prepare_dish();

create or replace function public.prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  new.author_id := auth.uid();
  new.author_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Cook');
  new.hidden := false;
  select count(*) into recent_count
  from public.comments
  where author_id = auth.uid()
    and created_at > now() - interval '10 minutes';
  if recent_count >= 8 then
    raise exception 'Rate limit exceeded. Please wait and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_prepare on public.comments;
create trigger comments_prepare
  before insert on public.comments
  for each row execute function public.prepare_comment();

create or replace function public.prepare_twist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  new.author_id := auth.uid();
  new.author_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Cook');
  new.hidden := false;
  select count(*) into recent_count
  from public.twists
  where author_id = auth.uid()
    and created_at > now() - interval '10 minutes';
  if recent_count >= 6 then
    raise exception 'Rate limit exceeded. Please wait and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists twists_prepare on public.twists;
create trigger twists_prepare
  before insert on public.twists
  for each row execute function public.prepare_twist();

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  new.reporter_id := auth.uid();
  new.reporter_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Cook');
  select count(*) into recent_count
  from public.reports
  where reporter_id = auth.uid()
    and created_at > now() - interval '1 hour';
  if recent_count >= 5 then
    raise exception 'Rate limit exceeded. Please wait and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_prepare on public.reports;
create trigger reports_prepare
  before insert on public.reports
  for each row execute function public.prepare_report();

create or replace function public.dish_stats()
returns table (
  dish_slug text,
  heart_count integer,
  rating_avg numeric,
  rating_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with slugs as (
    select hearts.dish_slug from public.hearts
    union
    select ratings.dish_slug from public.ratings
  )
  select
    slugs.dish_slug,
    (select count(*)::integer from public.hearts where hearts.dish_slug = slugs.dish_slug) as heart_count,
    (select round(avg(ratings.stars)::numeric, 1) from public.ratings where ratings.dish_slug = slugs.dish_slug) as rating_avg,
    (select count(*)::integer from public.ratings where ratings.dish_slug = slugs.dish_slug) as rating_count
  from slugs;
$$;

create or replace function public.my_dish_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return '{"hearts":[],"ratings":[]}'::jsonb;
  end if;
  return jsonb_build_object(
    'hearts', coalesce((select jsonb_agg(dish_slug) from public.hearts where user_id = uid), '[]'::jsonb),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object('slug', dish_slug, 'stars', stars))
      from public.ratings
      where user_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.owners enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_flags enable row level security;
alter table public.comments enable row level security;
alter table public.twists enable row level security;
alter table public.hearts enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.am_i_owner());

drop policy if exists "update own display name" on public.profiles;
create policy "update own display name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "read dishes" on public.dishes;
create policy "read dishes" on public.dishes
  for select to anon, authenticated
  using (hidden = false or author_id = auth.uid() or public.am_i_owner());

drop policy if exists "insert own dishes" on public.dishes;
create policy "insert own dishes" on public.dishes
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "owner updates dishes" on public.dishes;
create policy "owner updates dishes" on public.dishes
  for update to authenticated
  using (public.am_i_owner())
  with check (public.am_i_owner());

drop policy if exists "author or owner deletes dishes" on public.dishes;
create policy "author or owner deletes dishes" on public.dishes
  for delete to authenticated
  using (author_id = auth.uid() or public.am_i_owner());

drop policy if exists "read flags" on public.dish_flags;
create policy "read flags" on public.dish_flags
  for select to anon, authenticated
  using (true);

drop policy if exists "owner writes flags" on public.dish_flags;
create policy "owner writes flags" on public.dish_flags
  for all to authenticated
  using (public.am_i_owner())
  with check (public.am_i_owner());

drop policy if exists "read comments" on public.comments;
create policy "read comments" on public.comments
  for select to anon, authenticated
  using (hidden = false or author_id = auth.uid() or public.am_i_owner());

drop policy if exists "insert comments" on public.comments;
create policy "insert comments" on public.comments
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "owner hides comments" on public.comments;
create policy "owner hides comments" on public.comments
  for update to authenticated
  using (public.am_i_owner())
  with check (public.am_i_owner());

drop policy if exists "delete own comments" on public.comments;
create policy "delete own comments" on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.am_i_owner());

drop policy if exists "read twists" on public.twists;
create policy "read twists" on public.twists
  for select to anon, authenticated
  using (hidden = false or author_id = auth.uid() or public.am_i_owner());

drop policy if exists "insert twists" on public.twists;
create policy "insert twists" on public.twists
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "owner hides twists" on public.twists;
create policy "owner hides twists" on public.twists
  for update to authenticated
  using (public.am_i_owner())
  with check (public.am_i_owner());

drop policy if exists "delete own twists" on public.twists;
create policy "delete own twists" on public.twists
  for delete to authenticated
  using (author_id = auth.uid() or public.am_i_owner());

drop policy if exists "read own hearts" on public.hearts;
create policy "read own hearts" on public.hearts
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own hearts" on public.hearts;
create policy "insert own hearts" on public.hearts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "delete own hearts" on public.hearts;
create policy "delete own hearts" on public.hearts
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "read own ratings" on public.ratings;
create policy "read own ratings" on public.ratings
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own ratings" on public.ratings;
create policy "insert own ratings" on public.ratings
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own ratings" on public.ratings;
create policy "update own ratings" on public.ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "insert reports" on public.reports;
create policy "insert reports" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "owner reads reports" on public.reports;
create policy "owner reads reports" on public.reports
  for select to authenticated
  using (public.am_i_owner());

grant select (id, display_name, created_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.dishes to anon, authenticated;
grant insert, update, delete on public.dishes to authenticated;
grant select on public.dish_flags to anon, authenticated;
grant insert, update on public.dish_flags to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
grant select on public.twists to anon, authenticated;
grant insert, update, delete on public.twists to authenticated;
grant select, insert, delete on public.hearts to authenticated;
grant select, insert, update on public.ratings to authenticated;
grant insert, select on public.reports to authenticated;

grant execute on function public.am_i_owner() to anon, authenticated;
grant execute on function public.dish_stats() to anon, authenticated;
grant execute on function public.my_dish_activity() to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('dish-photos', 'dish-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read dish photos" on storage.objects;
create policy "Public read dish photos" on storage.objects
  for select to public
  using (bucket_id = 'dish-photos');

drop policy if exists "Upload own dish photos" on storage.objects;
create policy "Upload own dish photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dish-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Delete own dish photos" on storage.objects;
create policy "Delete own dish photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dish-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
