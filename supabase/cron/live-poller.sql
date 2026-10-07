-- PuckIQ live-poller schedule. TEMPLATE: run by hand in the Supabase SQL editor; it is not a
-- migration and `supabase db push` never applies it (pg_cron, pg_net and Vault are platform features).
--
-- Calls the live-poller Edge Function every minute through pg_cron + pg_net, and runs a daily
-- retention cleanup for League Room reactions and the alert tables. The service-role key is read
-- from Vault when each job runs, so no secret lives in this file, in cron.job or in a migration.
--
-- One-time setup (project yobqysvorsmcoselrtuq, Dashboard -> SQL editor):
--   1. Copy the legacy service_role key: Project Settings -> API Keys -> Legacy API keys -> service_role
--      (a JWT starting with "eyJ"). live-poller keeps JWT verification on and requires the
--      service_role claim, so the anon key and the new sb_secret_... keys are rejected.
--   2. Store it in Vault. Paste the key over the placeholder, run this one line, then clear the editor
--      so the key is not left in the saved query history:
--
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'puckiq_service_role_key', 'live-poller cron auth');
--
--      To rotate it later:
--        select vault.update_secret(
--          (select id from vault.secrets where name = 'puckiq_service_role_key'), '<NEW_SERVICE_ROLE_KEY>');
--   3. Run everything below. Re-running is safe: cron.schedule replaces a job with the same name.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'puckiq-live-poller',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://yobqysvorsmcoselrtuq.supabase.co/functions/v1/live-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'puckiq_service_role_key'
      )
    ),
    body := '{}'::jsonb,
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
-- Expect 200 with {"ok":true,...}. 403 means the Vault key is not the service_role JWT.

-- ------------------------------------------------------------------------------------------------
-- Unschedule. Run on its own. Pausing the poller in the off-season is fine; keep the cleanup job
-- running (it is what enforces the retention promises above).
--
--   select cron.unschedule('puckiq-live-poller');
--   select cron.unschedule('puckiq-daily-cleanup');   -- only if League Room and alerts are retired
--
-- To resume, run the matching cron.schedule(...) statement above again.
-- ------------------------------------------------------------------------------------------------
