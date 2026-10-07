-- League Room (PuckIQ season two): a private room for the members of one fantasy league.
-- Contract: docs/plans/2026-10-06-season-two.md (section 2) and types/league.ts.
--
-- Reads:  members of a room can SELECT that room's rows in all four tables. The policies call
--         is_room_member(), which is SECURITY DEFINER so it never recurses into room_members' RLS.
-- Writes: only through the SECURITY DEFINER RPCs below. Clients have no insert/update/delete.
-- Errors: RPCs raise SQLSTATE P0001 (plpgsql's default for RAISE EXCEPTION) whose message is one of
--         not_signed_in, invalid_code, room_not_found, room_full, not_member, not_owner, invalid_name,
--         invalid_roster, invalid_opponent, rate_limited, invalid_dues, cannot_remove_self, invalid_input.
--         not_member always means the CALLER is not in the room; a target user who is not in the
--         room is invalid_input.
-- Leaving: one AFTER DELETE trigger on room_members hands ownership to the earliest-joined member
--         and deletes a room when its last member goes, so leave_room, remove_member and account
--         deletion (auth.users cascade) all follow the same rule.

-- ------------------------------------------------------------------------------------------------
-- Constants shared by table checks and RPCs
-- ------------------------------------------------------------------------------------------------

-- ROOM_REACTIONS in types/league.ts (fire, rotating light, tears of joy, salt, cold face, clap).
create or replace function public._room_reactions()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[U&'\+01F525', U&'\+01F6A8', U&'\+01F602', U&'\+01F9C2', U&'\+01F976', U&'\+01F44F']::text[];
$$;

-- ------------------------------------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------------------------------------

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- ROOM_CODE_ALPHABET x ROOM_CODE_LENGTH (no I, O, 0, 1).
  code text not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  platform text not null check (platform in ('yahoo', 'espn', 'fantrax', 'other')),
  league_size integer not null check (league_size between 4 and 20),
  slots jsonb not null default '{}'::jsonb check (jsonb_typeof(slots) = 'object'),
  scoring jsonb not null default '{}'::jsonb check (jsonb_typeof(scoring) = 'object'),
  owner_id uuid references auth.users (id) on delete set null,
  -- RoomDues with snake_case keys: amount, currency, deadline, payouts, pot_link.
  dues jsonb not null
    default '{"amount": null, "currency": "USD", "deadline": null, "payouts": [], "pot_link": null}'::jsonb
    check (jsonb_typeof(dues) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 40),
  -- FantasyPlayer[] (at most 30).
  roster jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(roster) = 'array' then jsonb_array_length(roster) <= 30 else false end),
  roster_updated_at timestamptz not null default now(),
  -- This week's opponent: another member of the same room. Cleared automatically when they leave.
  opponent_user_id uuid,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_opponent_not_self check (opponent_user_id is distinct from user_id),
  constraint room_members_opponent_fkey foreign key (room_id, opponent_user_id)
    references public.room_members (room_id, user_id) on delete set null (opponent_user_id)
);

create table if not exists public.room_dues_status (
  room_id uuid not null,
  user_id uuid not null,
  paid boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_dues_status_member_fkey foreign key (room_id, user_id)
    references public.room_members (room_id, user_id) on delete cascade
);

create table if not exists public.room_reactions (
  id bigint generated always as identity primary key,
  room_id uuid not null,
  from_user_id uuid not null,
  to_user_id uuid not null,
  emoji text not null check (emoji = any (public._room_reactions())),
  created_at timestamptz not null default now(),
  -- A member's sent and received reactions go when they leave.
  constraint room_reactions_from_fkey foreign key (room_id, from_user_id)
    references public.room_members (room_id, user_id) on delete cascade,
  constraint room_reactions_to_fkey foreign key (room_id, to_user_id)
    references public.room_members (room_id, user_id) on delete cascade
);

comment on table public.rooms is 'League Room: one fantasy league. Members read via RLS; writes only through RPCs.';
comment on table public.room_members is 'League Room membership: team name, roster and weekly opponent per member.';
comment on table public.room_dues_status is 'League Room dues checkmarks (tracking only; PuckIQ never moves money).';
comment on table public.room_reactions is 'League Room preset reactions (no free text). Purged after 7 days.';

create index if not exists rooms_owner_id_idx on public.rooms (owner_id);
create index if not exists room_members_user_id_idx on public.room_members (user_id);
create index if not exists room_members_opponent_idx
  on public.room_members (room_id, opponent_user_id) where opponent_user_id is not null;
create index if not exists room_reactions_from_idx on public.room_reactions (room_id, from_user_id, created_at);
create index if not exists room_reactions_to_idx on public.room_reactions (room_id, to_user_id);
create index if not exists room_reactions_created_at_idx on public.room_reactions (created_at);

-- ------------------------------------------------------------------------------------------------
-- Row level security: members-only reads, no client writes
-- ------------------------------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_dues_status enable row level security;
alter table public.room_reactions enable row level security;

revoke all on table public.rooms, public.room_members, public.room_dues_status, public.room_reactions
  from anon, authenticated;
revoke all on sequence public.room_reactions_id_seq from anon, authenticated;
grant select on table public.rooms, public.room_members, public.room_dues_status, public.room_reactions
  to authenticated;

create or replace function public.is_room_member(room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = is_room_member.room and m.user_id = auth.uid()
  );
$$;

drop policy if exists "Members read their rooms" on public.rooms;
create policy "Members read their rooms" on public.rooms
  for select to authenticated using (public.is_room_member(id));

drop policy if exists "Members read room members" on public.room_members;
create policy "Members read room members" on public.room_members
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists "Members read room dues" on public.room_dues_status;
create policy "Members read room dues" on public.room_dues_status
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists "Members read room reactions" on public.room_reactions;
create policy "Members read room reactions" on public.room_reactions
  for select to authenticated using (public.is_room_member(room_id));

-- ------------------------------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ------------------------------------------------------------------------------------------------

-- The signed-in user, or not_signed_in.
create or replace function public._room_uid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  return v_uid;
end;
$$;

-- Room and team names: whitespace collapsed and trimmed, 1-40 characters, no control characters,
-- no links (names are shown to every member; there is no free text anywhere else).
create or replace function public._room_clean_name(p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_name) not between 1 and 40
     or v_name ~ '[[:cntrl:]]'
     or v_name ~* '(https?://|www\.)' then
    raise exception 'invalid_name';
  end if;
  return v_name;
end;
$$;

-- FantasyPlayer[]: a JSON array of at most 30 objects, each with an integer playerId > 0 and a
-- playerName string. Other keys are kept as sent (the app owns that shape); size is capped.
create or replace function public._room_check_roster(p_roster jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_item jsonb;
  v_id numeric;
begin
  if p_roster is null or jsonb_typeof(p_roster) <> 'array' then
    raise exception 'invalid_roster';
  end if;
  -- 30 players at a few hundred bytes each; the cap stops oversized payloads, not real rosters.
  if jsonb_array_length(p_roster) > 30 or octet_length(p_roster::text) > 32768 then
    raise exception 'invalid_roster';
  end if;
  for v_item in select value from jsonb_array_elements(p_roster) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_roster';
    end if;
    if jsonb_typeof(v_item -> 'playerId') is distinct from 'number'
       or jsonb_typeof(v_item -> 'playerName') is distinct from 'string' then
      raise exception 'invalid_roster';
    end if;
    v_id := (v_item ->> 'playerId')::numeric;
    -- NHL ids are positive integers; alerts store them as int4.
    if v_id <= 0 or v_id <> trunc(v_id) or v_id > 2147483647 then
      raise exception 'invalid_roster';
    end if;
    if char_length(v_item ->> 'playerName') not between 1 and 80 then
      raise exception 'invalid_roster';
    end if;
  end loop;
  return p_roster;
end;
$$;

-- Lineup slots and scoring weights: a JSON object of at most p_max_keys numeric values within
-- [p_min, p_max] (whole numbers when p_whole). Raises invalid_input.
create or replace function public._room_check_numbers(
  p_value jsonb, p_max_keys integer, p_min numeric, p_max numeric, p_whole boolean
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_key text;
  v_val jsonb;
  v_num numeric;
  v_count integer := 0;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_input';
  end if;
  for v_key, v_val in select key, value from jsonb_each(p_value) loop
    v_count := v_count + 1;
    if v_count > p_max_keys or char_length(v_key) not between 1 and 32 or jsonb_typeof(v_val) <> 'number' then
      raise exception 'invalid_input';
    end if;
    v_num := (v_val #>> '{}')::numeric;
    if v_num < p_min or v_num > p_max or (p_whole and v_num <> trunc(v_num)) then
      raise exception 'invalid_input';
    end if;
  end loop;
  return p_value;
end;
$$;

-- RoomDues with snake_case keys. Missing keys take EMPTY_DUES defaults; unknown keys (for example a
-- camelCase potLink) are rejected so a mapping mistake fails loudly. Returns the normalized object.
create or replace function public._room_check_dues(p_dues jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  -- Sanity caps, not business rules: dues are tracking only.
  c_max_amount constant numeric := 1000000;
  c_max_payouts constant integer := 20;
  v_key text;
  v_amount jsonb;
  v_currency text;
  v_deadline jsonb;
  v_date date;
  v_payouts jsonb;
  v_out_payouts jsonb := '[]'::jsonb;
  v_places integer[] := '{}';
  v_item jsonb;
  v_place numeric;
  v_payout numeric;
  v_link jsonb;
begin
  if p_dues is null or jsonb_typeof(p_dues) <> 'object' then
    raise exception 'invalid_dues';
  end if;
  for v_key in select jsonb_object_keys(p_dues) loop
    if v_key not in ('amount', 'currency', 'deadline', 'payouts', 'pot_link') then
      raise exception 'invalid_dues';
    end if;
  end loop;

  v_amount := coalesce(p_dues -> 'amount', 'null'::jsonb);
  if jsonb_typeof(v_amount) = 'number' then
    if (v_amount #>> '{}')::numeric not between 0 and c_max_amount then
      raise exception 'invalid_dues';
    end if;
  elsif jsonb_typeof(v_amount) <> 'null' then
    raise exception 'invalid_dues';
  end if;

  if jsonb_typeof(coalesce(p_dues -> 'currency', 'null'::jsonb)) = 'null' then
    v_currency := 'USD';
  elsif jsonb_typeof(p_dues -> 'currency') = 'string' and p_dues ->> 'currency' in ('USD', 'CAD') then
    v_currency := p_dues ->> 'currency';
  else
    raise exception 'invalid_dues';
  end if;

  v_deadline := coalesce(p_dues -> 'deadline', 'null'::jsonb);
  if jsonb_typeof(v_deadline) = 'string' then
    if (v_deadline #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'invalid_dues';
    end if;
    begin
      v_date := (v_deadline #>> '{}')::date;
    exception when others then
      raise exception 'invalid_dues';
    end;
  elsif jsonb_typeof(v_deadline) <> 'null' then
    raise exception 'invalid_dues';
  end if;

  v_payouts := coalesce(p_dues -> 'payouts', 'null'::jsonb);
  if jsonb_typeof(v_payouts) = 'array' then
    if jsonb_array_length(v_payouts) > c_max_payouts then
      raise exception 'invalid_dues';
    end if;
    for v_item in select value from jsonb_array_elements(v_payouts) loop
      if jsonb_typeof(v_item) <> 'object' then
        raise exception 'invalid_dues';
      end if;
      if jsonb_typeof(v_item -> 'place') is distinct from 'number'
         or jsonb_typeof(v_item -> 'amount') is distinct from 'number'
         or exists (select 1 from jsonb_object_keys(v_item) k where k not in ('place', 'amount')) then
        raise exception 'invalid_dues';
      end if;
      v_place := (v_item ->> 'place')::numeric;
      v_payout := (v_item ->> 'amount')::numeric;
      if v_place <> trunc(v_place) or v_place not between 1 and c_max_payouts
         or v_payout not between 0 and c_max_amount
         or v_place::integer = any (v_places) then
        raise exception 'invalid_dues';
      end if;
      v_places := v_places || v_place::integer;
      v_out_payouts := v_out_payouts || jsonb_build_array(
        jsonb_build_object('place', v_item -> 'place', 'amount', v_item -> 'amount'));
    end loop;
  elsif jsonb_typeof(v_payouts) <> 'null' then
    raise exception 'invalid_dues';
  end if;

  v_link := coalesce(p_dues -> 'pot_link', 'null'::jsonb);
  if jsonb_typeof(v_link) = 'string' then
    if char_length(v_link #>> '{}') > 500 or (v_link #>> '{}') !~ '^https://[^\s/?#]+[^\s]*$' then
      raise exception 'invalid_dues';
    end if;
  elsif jsonb_typeof(v_link) <> 'null' then
    raise exception 'invalid_dues';
  end if;

  return jsonb_build_object(
    'amount', v_amount,
    'currency', v_currency,
    'deadline', v_deadline,
    'payouts', v_out_payouts,
    'pot_link', v_link
  );
end;
$$;

-- A new invite code: 6 characters from ROOM_CODE_ALPHABET (32 symbols, so byte % 32 is unbiased),
-- drawn from gen_random_uuid()'s strong random bytes 0-5. Retries on collision.
create or replace function public._room_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c_max_attempts constant integer := 20;
  v_bytes bytea;
  v_code text;
begin
  for attempt in 1..c_max_attempts loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(c_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
    end loop;
    if not exists (select 1 from public.rooms where code = v_code) then
      return v_code;
    end if;
  end loop;
  -- 32^6 codes: unreachable in practice.
  raise exception 'invalid_input';
end;
$$;

-- Caps how many rooms one account can be in (Pro keeps up to 5 teams; this only stops abuse).
create or replace function public._room_check_user_room_count(p_user uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  c_max_rooms constant integer := 20;
begin
  if (select count(*) from public.room_members where user_id = p_user) >= c_max_rooms then
    raise exception 'invalid_input';
  end if;
end;
$$;

-- Locks the room for an owner-only change. Raises room_not_found, not_member or not_owner.
create or replace function public._room_owned(p_room uuid)
returns public.rooms
language plpgsql
volatile
set search_path = public
as $$
declare
  v_uid uuid := public._room_uid();
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  if v_room.owner_id is distinct from v_uid then
    raise exception 'not_owner';
  end if;
  return v_room;
end;
$$;

-- Raises room_not_found or not_member when the caller is not in the room.
create or replace function public._room_member_missing(p_room uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room) then
    raise exception 'room_not_found';
  end if;
  raise exception 'not_member';
end;
$$;

create or replace function public._room_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public._room_touch_updated_at();

-- After a member row goes (leave, remove, account deletion): the earliest-joined remaining member
-- becomes owner if the owner left; the last one out deletes the room.
create or replace function public._room_after_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
begin
  perform 1 from public.rooms where id = old.room_id for update;
  if not found then
    return null; -- the room itself is being deleted
  end if;
  select m.user_id into v_next
    from public.room_members m
   where m.room_id = old.room_id
   order by m.joined_at, m.user_id
   limit 1;
  if v_next is null then
    delete from public.rooms where id = old.room_id;
  else
    update public.rooms
       set owner_id = v_next
     where id = old.room_id and (owner_id is null or owner_id = old.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists room_members_after_delete on public.room_members;
create trigger room_members_after_delete
  after delete on public.room_members
  for each row execute function public._room_after_member_delete();

-- ------------------------------------------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------------------------------------------

-- New room with a unique code; the caller becomes owner, first member and gets a dues row.
create or replace function public.create_room(
  p_name text,
  p_platform text,
  p_league_size integer,
  p_slots jsonb,
  p_scoring jsonb,
  p_team_name text,
  p_roster jsonb
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._room_uid();
  v_name text;
  v_team text;
  v_roster jsonb;
  v_room public.rooms;
begin
  v_name := public._room_clean_name(p_name);
  v_team := public._room_clean_name(p_team_name);
  v_roster := public._room_check_roster(p_roster);
  if p_platform is null or p_platform not in ('yahoo', 'espn', 'fantrax', 'other') then
    raise exception 'invalid_input';
  end if;
  if p_league_size is null or p_league_size not between 4 and 20 then
    raise exception 'invalid_input';
  end if;
  -- Slot counts are small whole numbers; scoring weights are signed decimals (goals against < 0).
  perform public._room_check_numbers(p_slots, 16, 0, 20, true);
  perform public._room_check_numbers(p_scoring, 32, -100, 100, false);
  perform public._room_check_user_room_count(v_uid);

  insert into public.rooms (code, name, platform, league_size, slots, scoring, owner_id)
  values (public._room_new_code(), v_name, p_platform, p_league_size, p_slots, p_scoring, v_uid)
  returning * into v_room;

  insert into public.room_members (room_id, user_id, team_name, roster)
  values (v_room.id, v_uid, v_team, v_roster);

  insert into public.room_dues_status (room_id, user_id)
  values (v_room.id, v_uid);

  return v_room;
end;
$$;

-- Join by invite code (case-insensitive). A member who joins again updates their name and roster.
create or replace function public.join_room(p_code text, p_team_name text, p_roster jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._room_uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_team text;
  v_roster jsonb;
  v_room public.rooms;
  v_members integer;
begin
  if v_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_code';
  end if;
  v_team := public._room_clean_name(p_team_name);
  v_roster := public._room_check_roster(p_roster);

  -- The row lock serializes joins so two people cannot both take the last seat.
  select * into v_room from public.rooms where code = v_code for update;
  if not found then
    raise exception 'room_not_found';
  end if;

  update public.room_members
     set team_name = v_team, roster = v_roster, roster_updated_at = now()
   where room_id = v_room.id and user_id = v_uid;
  if found then
    return v_room;
  end if;

  select count(*) into v_members from public.room_members where room_id = v_room.id;
  if v_members >= v_room.league_size then
    raise exception 'room_full';
  end if;
  perform public._room_check_user_room_count(v_uid);

  insert into public.room_members (room_id, user_id, team_name, roster)
  values (v_room.id, v_uid, v_team, v_roster);
  insert into public.room_dues_status (room_id, user_id)
  values (v_room.id, v_uid)
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$$;

-- Leave a room. Ownership hand-over and deleting an empty room happen in the member-delete trigger.
create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._room_uid();
begin
  -- Serializes concurrent leaves so the last two members cannot both miss each other.
  perform 1 from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  delete from public.room_members where room_id = p_room and user_id = v_uid;
  if not found then
    raise exception 'not_member';
  end if;
end;
$$;

-- Update my own membership. A null team name or roster keeps the current one; p_opponent is always
-- written (null clears it) and must be another member of the same room.
create or replace function public.update_membership(
  p_room uuid,
  p_team_name text,
  p_roster jsonb,
  p_opponent uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._room_uid();
  v_team text;
  v_roster jsonb;
begin
  perform 1 from public.room_members where room_id = p_room and user_id = v_uid for update;
  if not found then
    perform public._room_member_missing(p_room);
  end if;
  if p_team_name is not null then
    v_team := public._room_clean_name(p_team_name);
  end if;
  if p_roster is not null then
    v_roster := public._room_check_roster(p_roster);
  end if;
  if p_opponent is not null and (
       p_opponent = v_uid
       or not exists (select 1 from public.room_members where room_id = p_room and user_id = p_opponent)
     ) then
    raise exception 'invalid_opponent';
  end if;

  update public.room_members
     set team_name = coalesce(v_team, team_name),
         roster = coalesce(v_roster, roster),
         roster_updated_at = case when v_roster is null then roster_updated_at else now() end,
         opponent_user_id = p_opponent
   where room_id = p_room and user_id = v_uid;
end;
$$;

-- Owner only. A null name or dues keeps the current value.
create or replace function public.update_room(p_room uuid, p_name text, p_dues jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms := public._room_owned(p_room);
  v_name text;
  v_dues jsonb;
begin
  if p_name is not null then
    v_name := public._room_clean_name(p_name);
  end if;
  if p_dues is not null then
    v_dues := public._room_check_dues(p_dues);
  end if;
  update public.rooms
     set name = coalesce(v_name, name),
         dues = coalesce(v_dues, dues)
   where id = p_room
  returning * into v_room;
  return v_room;
end;
$$;

-- Owner only: tick or untick a member's dues.
create or replace function public.set_dues_paid(p_room uuid, p_user uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._room_owned(p_room);
  if p_paid is null or p_user is null
     or not exists (select 1 from public.room_members where room_id = p_room and user_id = p_user) then
    raise exception 'invalid_input';
  end if;
  insert into public.room_dues_status (room_id, user_id, paid, updated_at)
  values (p_room, p_user, p_paid, now())
  on conflict (room_id, user_id) do update set paid = excluded.paid, updated_at = now();
end;
$$;

-- Owner only, never self. Removing someone who already left is a no-op.
create or replace function public.remove_member(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms := public._room_owned(p_room);
begin
  if p_user is null then
    raise exception 'invalid_input';
  end if;
  if p_user = v_room.owner_id then
    raise exception 'cannot_remove_self';
  end if;
  delete from public.room_members where room_id = p_room and user_id = p_user;
end;
$$;

-- Owner only: a fresh invite code (the old link stops working).
create or replace function public.rotate_room_code(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms := public._room_owned(p_room);
begin
  update public.rooms set code = public._room_new_code() where id = p_room returning * into v_room;
  return v_room;
end;
$$;

-- A preset reaction from me to a member. At most 30 per sender per room per rolling hour;
-- reactions older than 7 days are purged on the way in.
create or replace function public.react(p_room uuid, p_to_user uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_per_hour constant integer := 30;
  v_uid uuid := public._room_uid();
  v_recent integer;
begin
  -- Locking my member row serializes my own reactions so the hourly cap is exact.
  perform 1 from public.room_members where room_id = p_room and user_id = v_uid for update;
  if not found then
    perform public._room_member_missing(p_room);
  end if;
  if p_emoji is null or not (p_emoji = any (public._room_reactions())) then
    raise exception 'invalid_input';
  end if;
  if p_to_user is null
     or not exists (select 1 from public.room_members where room_id = p_room and user_id = p_to_user) then
    raise exception 'invalid_input';
  end if;

  delete from public.room_reactions where created_at < now() - interval '7 days';

  select count(*) into v_recent
    from public.room_reactions
   where room_id = p_room and from_user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= c_per_hour then
    raise exception 'rate_limited';
  end if;

  insert into public.room_reactions (room_id, from_user_id, to_user_id, emoji)
  values (p_room, v_uid, p_to_user, p_emoji);
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- Function privileges: RPCs for signed-in users only; helpers for nobody but their owner.
-- (Supabase's default privileges grant EXECUTE to anon and authenticated, so revoke explicitly.)
-- ------------------------------------------------------------------------------------------------

revoke all on function public.create_room(text, text, integer, jsonb, jsonb, text, jsonb) from public, anon;
revoke all on function public.join_room(text, text, jsonb) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
revoke all on function public.update_membership(uuid, text, jsonb, uuid) from public, anon;
revoke all on function public.update_room(uuid, text, jsonb) from public, anon;
revoke all on function public.set_dues_paid(uuid, uuid, boolean) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.rotate_room_code(uuid) from public, anon;
revoke all on function public.react(uuid, uuid, text) from public, anon;
revoke all on function public.is_room_member(uuid) from public, anon;

grant execute on function public.create_room(text, text, integer, jsonb, jsonb, text, jsonb) to authenticated;
grant execute on function public.join_room(text, text, jsonb) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.update_membership(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.update_room(uuid, text, jsonb) to authenticated;
grant execute on function public.set_dues_paid(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.rotate_room_code(uuid) to authenticated;
grant execute on function public.react(uuid, uuid, text) to authenticated;
-- RLS policies call this as the querying user.
grant execute on function public.is_room_member(uuid) to authenticated;

revoke all on function public._room_reactions() from public, anon, authenticated;
revoke all on function public._room_uid() from public, anon, authenticated;
revoke all on function public._room_clean_name(text) from public, anon, authenticated;
revoke all on function public._room_check_roster(jsonb) from public, anon, authenticated;
revoke all on function public._room_check_numbers(jsonb, integer, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public._room_check_dues(jsonb) from public, anon, authenticated;
revoke all on function public._room_new_code() from public, anon, authenticated;
revoke all on function public._room_check_user_room_count(uuid) from public, anon, authenticated;
revoke all on function public._room_owned(uuid) from public, anon, authenticated;
revoke all on function public._room_member_missing(uuid) from public, anon, authenticated;
revoke all on function public._room_touch_updated_at() from public, anon, authenticated;
revoke all on function public._room_after_member_delete() from public, anon, authenticated;
