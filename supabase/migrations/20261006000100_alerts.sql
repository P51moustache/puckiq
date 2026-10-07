-- Player alerts (PuckIQ season two): scratch and goal pushes for the NHL players a device follows.
-- Contract: docs/plans/2026-10-06-season-two.md (section 2, Alerts).
--
-- Service role only. Edge Functions write these tables (register-alerts, live-poller); RLS is on
-- with no policies and anon/authenticated hold no table privileges, so clients never see tokens.
-- No account is involved: a device is identified only by its Expo push token.

create table if not exists public.alert_devices (
  expo_push_token text primary key
    check (char_length(expo_push_token) <= 200 and expo_push_token ~ '^Expo(nent)?PushToken\[.+\]$'),
  -- NHL player ids this device follows (the app's roster). Matched with && on the GIN index.
  player_ids integer[] not null default '{}'
    check (cardinality(player_ids) <= 150 and array_position(player_ids, null) is null),
  -- { "scratches": boolean, "goals": boolean }
  prefs jsonb not null default '{"scratches": true, "goals": true}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  platform text check (platform in ('ios', 'android')),
  app_version text check (char_length(app_version) <= 32),
  updated_at timestamptz not null default now()
);

create index if not exists alert_devices_player_ids_idx on public.alert_devices using gin (player_ids);

-- What the live poller has already seen per game, so each scratch and goal is announced once.
create table if not exists public.live_game_state (
  game_id bigint primary key,
  game_date date not null,
  game_state text not null,
  scratch_ids integer[] not null default '{}',
  goal_event_ids integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists live_game_state_game_date_idx on public.live_game_state (game_date);

-- One row per push sent: (token, 'goal:{gameId}:{eventId}' | 'scratch:{gameId}:{playerId}').
-- The poller claims a row before sending, so overlapping runs never push twice. Rows go with
-- their device and are purged after a few days.
create table if not exists public.alert_log (
  expo_push_token text not null references public.alert_devices (expo_push_token) on delete cascade,
  event_key text not null check (char_length(event_key) <= 80),
  sent_at timestamptz not null default now(),
  primary key (expo_push_token, event_key)
);

create index if not exists alert_log_sent_at_idx on public.alert_log (sent_at);

comment on table public.alert_devices is 'Expo push token + followed NHL player ids for scratch/goal alerts. Service role only.';
comment on table public.live_game_state is 'Live poller memory: scratches and goal events already seen per NHL game. Service role only.';
comment on table public.alert_log is 'Alert dedupe: one row per (push token, event). Service role only.';

alter table public.alert_devices enable row level security;
alter table public.live_game_state enable row level security;
alter table public.alert_log enable row level security;

revoke all on table public.alert_devices, public.live_game_state, public.alert_log from anon, authenticated;
