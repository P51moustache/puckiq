-- Migration: Add player_id to ml_predictions and ml_prediction_scores
-- Run this in the Supabase SQL Editor before deploying the code changes.
--
-- Design decision: Use player_id = 0 for non-player-props rows (game_winner,
-- spread, totals) instead of NULL. This avoids PostgreSQL's "NULLs are distinct
-- in UNIQUE constraints" behavior, which would allow duplicate rows and break
-- PostgREST upserts.

-- ============================================================================
-- 1. ml_predictions
-- ============================================================================

-- Add player_id column (default 0 for existing rows)
ALTER TABLE ml_predictions ADD COLUMN IF NOT EXISTS player_id INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint (find the actual constraint name first)
-- The old constraint is on (game_id, model_type, model_version)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'ml_predictions'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 3;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ml_predictions DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Also drop any unique indexes on the old 3-column combo
DROP INDEX IF EXISTS ml_predictions_game_id_model_type_model_version_key;

-- Create new unique constraint including player_id
ALTER TABLE ml_predictions
    ADD CONSTRAINT ml_predictions_game_model_player_unique
    UNIQUE (game_id, model_type, model_version, player_id);

-- ============================================================================
-- 2. ml_prediction_scores
-- ============================================================================

-- Add player_id column (default 0 for existing rows)
ALTER TABLE ml_prediction_scores ADD COLUMN IF NOT EXISTS player_id INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint on (game_id, model_type)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'ml_prediction_scores'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ml_prediction_scores DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Also drop any unique indexes on the old 2-column combo
DROP INDEX IF EXISTS ml_prediction_scores_game_id_model_type_key;

-- Create new unique constraint including player_id
ALTER TABLE ml_prediction_scores
    ADD CONSTRAINT ml_prediction_scores_game_model_player_unique
    UNIQUE (game_id, model_type, player_id);
