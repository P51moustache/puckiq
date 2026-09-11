-- Read-only catalog evidence. Does not read private user rows or push tokens.
-- Run in a privileged SQL session before preparing a production schema migration.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'core_tables', (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('games','standings','skater_season_stats','goalie_season_stats','team_stat_categories','sync_log','user_data','push_tokens','ml_predictions')),
 'write_policies', (SELECT jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'roles',roles,'cmd',cmd,'using',qual,'check',with_check)) FROM pg_policies WHERE schemaname='public' AND cmd<>'SELECT' AND tablename IN ('games','standings','skater_season_stats','goalie_season_stats','team_stat_categories','sync_log','user_data','push_tokens','ml_predictions')),
 'constraints', (SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE conrelid IN ('public.games'::regclass,'public.standings'::regclass,'public.skater_season_stats'::regclass,'public.goalie_season_stats'::regclass,'public.team_stat_categories'::regclass)),
 'views', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND (c.relname LIKE '%trend%' OR c.relname LIKE '%rolling%')),
 'migrations_table', to_regclass('supabase_migrations.schema_migrations'),
 'cron_table', to_regclass('cron.job')
) AS audit;
ROLLBACK;
