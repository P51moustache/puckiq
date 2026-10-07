-- live-poller authentication without a shared secret.
--
-- The every-minute cron job (supabase/cron/live-poller.sql) mints a single-use ticket here and sends
-- it in the request body; live-poller (deployed with JWT verification off) redeems it by deleting
-- the row, and only accepts tickets younger than two minutes. Minting needs SQL access to this
-- project, so nobody else can trigger the poller, and no service-role key has to live in Vault,
-- a file or cron.job.

create table if not exists public.poller_tickets (
  ticket uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Service role only (the Edge Function); clients get nothing.
alter table public.poller_tickets enable row level security;
revoke all on table public.poller_tickets from public, anon, authenticated;

-- Mint one ticket, sweeping any the poller never redeemed (e.g. a request that timed out).
create or replace function public.issue_poller_ticket()
returns uuid
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.poller_tickets where created_at < now() - interval '10 minutes';
  insert into public.poller_tickets default values returning ticket;
$$;

revoke all on function public.issue_poller_ticket() from public, anon, authenticated;
