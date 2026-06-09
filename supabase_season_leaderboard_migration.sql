-- Run this in Supabase SQL Editor to enable durable quarterly leaderboard XP.

CREATE TABLE IF NOT EXISTS leaderboard_season_scores (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  season_key TEXT NOT NULL,
  season_label TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, season_key)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_season_scores_season_key
ON leaderboard_season_scores(season_key);

ALTER TABLE leaderboard_season_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Season scores are viewable by everyone" ON leaderboard_season_scores;
CREATE POLICY "Season scores are viewable by everyone"
ON leaderboard_season_scores FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION current_season_key(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
  SELECT EXTRACT(YEAR FROM target_date)::INT || '-Q' || EXTRACT(QUARTER FROM target_date)::INT;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION current_season_label(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
  SELECT 'Q' || EXTRACT(QUARTER FROM target_date)::INT || ' ' || EXTRACT(YEAR FROM target_date)::INT;
$$ LANGUAGE sql IMMUTABLE;

WITH season_xp AS (
  SELECT
    rc.user_id,
    current_season_key(rc.completed_date) AS season_key,
    current_season_label(rc.completed_date) AS season_label,
    COALESCE(rc.xp_earned, 0)::INT AS xp
  FROM routine_completions rc
  WHERE rc.user_id IS NOT NULL

  UNION ALL

  SELECT
    gtc.user_id,
    current_season_key(gtc.completed_date) AS season_key,
    current_season_label(gtc.completed_date) AS season_label,
    5 AS xp
  FROM group_task_completions gtc
  JOIN group_tasks gt ON gt.id = gtc.task_id
  WHERE gtc.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM group_members gm
      WHERE gm.group_id = gt.group_id
      GROUP BY gm.group_id
      HAVING COUNT(*) > 1
    )
)
INSERT INTO leaderboard_season_scores (user_id, season_key, season_label, xp, updated_at)
SELECT user_id, season_key, season_label, SUM(xp)::INT, NOW()
FROM season_xp
GROUP BY user_id, season_key, season_label
ON CONFLICT (user_id, season_key) DO UPDATE
SET xp = EXCLUDED.xp,
    season_label = EXCLUDED.season_label,
    updated_at = NOW();

DROP FUNCTION IF EXISTS increment_xp(UUID, INTEGER);
DROP FUNCTION IF EXISTS decrement_xp(UUID, INTEGER);

CREATE OR REPLACE FUNCTION increment_xp(user_id UUID, amount INTEGER, target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != $1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF $2 < 0 OR $2 > 100 THEN
    RAISE EXCEPTION 'INVALID_XP_AMOUNT';
  END IF;

  UPDATE profiles
  SET total_xp = total_xp + $2,
      lifetime_xp = lifetime_xp + $2,
      updated_at = NOW()
  WHERE id = $1;

  INSERT INTO leaderboard_season_scores (user_id, season_key, season_label, xp, updated_at)
  VALUES ($1, current_season_key($3), current_season_label($3), $2, NOW())
  ON CONFLICT (user_id, season_key) DO UPDATE
  SET xp = leaderboard_season_scores.xp + EXCLUDED.xp,
      season_label = EXCLUDED.season_label,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_xp(user_id UUID, amount INTEGER, target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != $1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF $2 < 0 OR $2 > 100 THEN
    RAISE EXCEPTION 'INVALID_XP_AMOUNT';
  END IF;

  UPDATE profiles
  SET total_xp = GREATEST(total_xp - $2, 0),
      updated_at = NOW()
  WHERE id = $1;

  INSERT INTO leaderboard_season_scores (user_id, season_key, season_label, xp, updated_at)
  VALUES ($1, current_season_key($3), current_season_label($3), 0, NOW())
  ON CONFLICT (user_id, season_key) DO UPDATE
  SET xp = GREATEST(leaderboard_season_scores.xp - $2, 0),
      season_label = EXCLUDED.season_label,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
