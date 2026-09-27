-- In-app feedback from PuckIQ 3.x. The app can only insert; reading is dashboard/service-role only.
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('bug', 'idea', 'praise', 'other')),
  message text not null check (char_length(message) between 3 and 4000),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  app_version text check (char_length(app_version) <= 32),
  build text check (char_length(build) <= 16),
  platform text check (char_length(platform) <= 16),
  os_version text check (char_length(os_version) <= 32),
  device text check (char_length(device) <= 64),
  is_pro boolean,
  screen text check (char_length(screen) <= 64),
  user_id uuid references auth.users (id) on delete set null
);

comment on table public.app_feedback is 'In-app feedback (Settings > Send feedback). Insert-only for clients; read in the dashboard.';

alter table public.app_feedback enable row level security;

drop policy if exists "Clients can send feedback" on public.app_feedback;
create policy "Clients can send feedback"
  on public.app_feedback
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create index if not exists app_feedback_created_at_idx on public.app_feedback (created_at desc);
