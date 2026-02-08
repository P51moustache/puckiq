-- Fix: games_above_900 should be REAL, not INTEGER
-- The NHL Edge API returns decimal values like 0.25 for this field
ALTER TABLE edge_goalie_stats ALTER COLUMN games_above_900 TYPE REAL;
