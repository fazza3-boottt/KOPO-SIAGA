create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('banjir', 'macet', 'rusak', 'tutup', 'kecelakaan')),
  address text not null check (char_length(address) between 1 and 160),
  description text not null check (char_length(description) between 8 and 500),
  created_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  location_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint reports_coordinates_pair check ((lat is null) = (lng is null))
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'reporter' check (role in ('admin', 'reporter')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can update their own display name" on public.profiles;
create policy "Users can update their own display name"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select role from public.profiles where id = (select auth.uid())));

grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when coalesce(new.raw_user_meta_data->>'role', 'reporter') = 'admin' then 'reporter'
      else 'reporter'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.reports enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Anyone can read reports" on public.reports;
create policy "Anyone can read reports"
  on public.reports for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit pending reports" on public.reports;
drop policy if exists "Anyone can submit reports" on public.reports;
create policy "Anyone can submit reports"
  on public.reports for insert
  to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null);

drop policy if exists "Admins can review reports" on public.reports;
revoke update on public.reports from authenticated;

drop policy if exists "Admins can read their own role" on public.admin_users;
create policy "Admins can read their own role"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert on public.reports to anon, authenticated;
grant select on public.admin_users to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end
$$;

alter table public.reports
  add column if not exists title text not null default '',
  add column if not exists severity text not null default 'sedang',
  add column if not exists verification_note text not null default '',
  add column if not exists rejection_reason text not null default '',
  add column if not exists reporter_id uuid references auth.users(id),
  add column if not exists incident_at timestamptz;

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'Pengumuman',
  urgency text not null default 'normal' check (urgency in ('normal', 'important', 'critical')),
  area text not null default 'Seluruh wilayah',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  primary key (notification_id, user_id)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  regions text[] not null default array['Semua wilayah'],
  push_enabled boolean not null default false
);

create table if not exists public.cctv_cameras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  official_url text,
  embed_url text,
  status text not null default 'belum-tersedia',
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.weather_updates (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  summary text,
  temperature_c double precision,
  humidity_percent double precision,
  wind_kph double precision,
  rain_mm double precision,
  source text,
  is_simulation boolean not null default true,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.cctv_cameras enable row level security;
alter table public.weather_updates enable row level security;
alter table public.admin_activity_logs enable row level security;

drop policy if exists "Anyone can read public notifications" on public.notifications;
create policy "Anyone can read public notifications"
  on public.notifications for select to anon, authenticated using (true);

drop policy if exists "Users read their notification state" on public.notification_recipients;
create policy "Users read their notification state"
  on public.notification_recipients for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users manage their notification state" on public.notification_recipients;
create policy "Users manage their notification state"
  on public.notification_recipients for insert, update to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage notification preferences" on public.notification_preferences;
create policy "Users manage notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Anyone can read public CCTV" on public.cctv_cameras;
create policy "Anyone can read public CCTV"
  on public.cctv_cameras for select to anon, authenticated
  using (is_public = true);

drop policy if exists "Anyone can read weather" on public.weather_updates;
create policy "Anyone can read weather"
  on public.weather_updates for select to anon, authenticated using (true);

grant select on public.notifications, public.cctv_cameras, public.weather_updates to anon, authenticated;
grant select, insert, update on public.notification_recipients, public.notification_preferences to authenticated;
