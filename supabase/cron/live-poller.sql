-- PuckIQ live-poller schedule. TEMPLATE: run by hand in the Supabase SQL editor; it is not a
-- migration and `supabase db push` never applies it (pg_cron and pg_net are platform features).
--
-- Calls the live-poller Edge Function every minute through pg_cron + pg_net, and runs a daily
-- retention cleanup for League Room reactions and the alert tables. Each poller call carries a
-- single-use ticket minted by public.issue_poller_ticket() (migration 20261006000200), so there is
-- no secret to store: no service-role key in Vault, in this file or in cron.job.
--
-- Prerequisites (project yobqysvorsmcoselrtuq): migrations 20261006000000..000200 applied, and
-- live-poller deployed with JWT verification OFF (functions deploy live-poller --no-verify-jwt).
-- Run everything below in the SQL editor. Re-running is safe: cron.schedule replaces a job with the
-- same name.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'puckiq-live-poller',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://yobqysvorsmcoselrtuq.supabase.co/functions/v1/live-poller',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('ticket', public.issue_poller_ticket()),
    -- pg_net's default is 5 s; a busy night with slow NHL responses can take longer than that.
    timeout_milliseconds := 55000
  );
  $job$
);

-- Daily retention (09:17 UTC, between game nights). The privacy policy promises these windows, so
-- they cannot depend on someone reacting again or on a game being on:
--   reactions 7 days, alert dedupe log 3 days, poller game memory 7 days.
select cron.schedule(
  'puckiq-daily-cleanup',
  '17 9 * * *',
  $job$
  delete from public.room_reactions where created_at < now() - interval '7 days';
  delete from public.alert_log where sent_at < now() - interval '3 days';
  delete from public.live_game_state where game_date < current_date - 7;
  $job$
);

-- Check it a minute or two later:
--   select jobid, jobname, schedule, active from cron.job where jobname like 'puckiq-%';
--   select status, return_message, start_time from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'puckiq-live-poller')
--     order by start_time desc limit 5;
--   select status_code, left(content::text, 200) as body, created from net._http_response
--     order by created desc limit 5;
-- Expect 200 with {"ok":true,...}. 403 means the ticket was rejected: live-poller still has JWT
-- verification on (401 from the gateway), or migration 20261006000200 is missing.

-- ------------------------------------------------------------------------------------------------
-- Unschedule. Run on its own. Pausing the poller in the off-season is fine; keep the cleanup job
-- running (it is what enforces the retention promises above).
--
--   select cron.unschedule('puckiq-live-poller');
--   select cron.unschedule('puckiq-daily-cleanup');   -- only if League Room and alerts are retired
--
-- To resume, run the matching cron.schedule(...) statement above again.
-- ------------------------------------------------------------------------------------------------
