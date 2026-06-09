-- Table for profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  total_xp INTEGER DEFAULT 0,
  lifetime_xp INTEGER DEFAULT 0,
  badges JSONB DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quarterly leaderboard scores. This gives seasonal rank its own durable source of truth.
CREATE TABLE IF NOT EXISTS leaderboard_season_scores (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  season_key TEXT NOT NULL,
  season_label TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, season_key)
);

-- Table for accountability pods (groups)
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_streak INT DEFAULT 0,
  max_streak INT DEFAULT 0,
  last_streak_date DATE
);

-- Private group access codes are kept out of public group listings
CREATE TABLE group_access_codes (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE PRIMARY KEY,
  access_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for group members
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Table for group-specific objectives
CREATE TABLE group_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking group task completions
CREATE TABLE group_task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES group_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(task_id, user_id, completed_date)
);

-- Table for routines
CREATE TABLE routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Table for completions
CREATE TABLE routine_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(routine_id, completed_date)
);

-- Table for Kanban tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  category TEXT NOT NULL DEFAULT 'General',
  completed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for recurring/ongoing task activity logs
CREATE TABLE task_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, logged_date)
);

-- Table for social posts
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for comments
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for reactions
CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

-- Pings table
CREATE TABLE pings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_routine_completions_routine_id ON routine_completions(routine_id);
CREATE INDEX idx_routine_completions_completed_date ON routine_completions(completed_date);
CREATE INDEX idx_routines_user_id ON routines(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_task_logs_user_id ON task_logs(user_id);
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_logged_date ON task_logs(logged_date);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_group_id ON posts(group_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_tasks_group_id ON group_tasks(group_id);
CREATE INDEX idx_groups_visibility ON groups(visibility);
CREATE INDEX IF NOT EXISTS idx_leaderboard_season_scores_season_key ON leaderboard_season_scores(season_key);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_season_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can create own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Season scores are viewable by everyone" ON leaderboard_season_scores;
CREATE POLICY "Season scores are viewable by everyone" ON leaderboard_season_scores FOR SELECT USING (true);

CREATE POLICY "Groups viewable by everyone" ON groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can manage groups" ON groups FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Group access codes manageable by creators" ON group_access_codes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_access_codes.group_id
      AND groups.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_access_codes.group_id
      AND groups.created_by = auth.uid()
  )
);

CREATE POLICY "Members viewable by everyone" ON group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_members.group_id
      AND (groups.visibility = 'public' OR groups.created_by = auth.uid())
  )
);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Tasks viewable by members" ON group_tasks FOR SELECT USING (true);
CREATE POLICY "Group creators can create tasks" ON group_tasks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_tasks.group_id
      AND groups.created_by = auth.uid()
  )
);
CREATE POLICY "Group creators can update tasks" ON group_tasks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_tasks.group_id
      AND groups.created_by = auth.uid()
  )
);
CREATE POLICY "Group creators can delete tasks" ON group_tasks FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_tasks.group_id
      AND groups.created_by = auth.uid()
  )
);
CREATE POLICY "Completions viewable by everyone" ON group_task_completions FOR SELECT USING (true);
CREATE POLICY "Users can complete group tasks" ON group_task_completions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Routines viewable by everyone" ON routines FOR SELECT USING (true); CREATE POLICY "Routines manageable by owners" ON routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Completions viewable by everyone" ON routine_completions FOR SELECT USING (true); CREATE POLICY "Completions manageable by owners" ON routine_completions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tasks manageable by owners" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Task logs manageable by owners" ON task_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_logs.task_id
      AND tasks.user_id = auth.uid()
  )
);

CREATE POLICY "Posts viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Reactions viewable by everyone" ON reactions FOR SELECT USING (true);
CREATE POLICY "Users can create own reactions" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Helpers for seasonal XP
CREATE OR REPLACE FUNCTION current_season_key(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
  SELECT EXTRACT(YEAR FROM target_date)::INT || '-Q' || EXTRACT(QUARTER FROM target_date)::INT;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION current_season_label(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
  SELECT 'Q' || EXTRACT(QUARTER FROM target_date)::INT || ' ' || EXTRACT(YEAR FROM target_date)::INT;
$$ LANGUAGE sql IMMUTABLE;

-- Backfill seasonal scores from existing personal and group completion history.
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

-- RPC for XP
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

CREATE OR REPLACE FUNCTION join_group_with_code(target_group_id UUID, provided_code TEXT DEFAULT NULL)
RETURNS TABLE (user_id UUID, group_id UUID) AS $$
DECLARE
  group_visibility TEXT;
  expected_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT visibility INTO group_visibility
  FROM groups
  WHERE id = target_group_id;

  IF group_visibility IS NULL THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;

  IF group_visibility = 'private' THEN
    SELECT access_code INTO expected_code
    FROM group_access_codes
    WHERE group_access_codes.group_id = target_group_id;

    IF expected_code IS NULL OR provided_code IS NULL OR expected_code != provided_code THEN
      RAISE EXCEPTION 'INVALID_GROUP_CODE';
    END IF;
  END IF;

  INSERT INTO group_members (group_id, user_id)
  SELECT target_group_id, auth.uid()
  WHERE NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = auth.uid()
  );

  RETURN QUERY SELECT auth.uid(), target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master Function for Pod Vitals & Streaks
DROP FUNCTION IF EXISTS get_pod_member_vitals(uuid, date);

CREATE OR REPLACE FUNCTION get_pod_member_vitals(target_group_id UUID, target_date DATE)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  total_xp INT,
  routines_total INT,
  routines_completed_today INT,
  group_tasks_total INT,
  group_tasks_completed INT,
  last_activity_date DATE,
  pod_current_streak INT,
  pod_max_streak INT
) AS $$
DECLARE
  streak_current INT;
  streak_max INT;
  last_date DATE;
  member_count INT;
  active_member_count INT;
  threshold FLOAT;
  creator_id UUID;
  check_date DATE;
  last_success_date DATE;
BEGIN
  -- 1. Auto-Kick & Context
  SELECT current_streak, max_streak, last_streak_date, created_by 
  INTO streak_current, streak_max, last_date, creator_id 
  FROM groups g WHERE g.id = target_group_id;

  DELETE FROM group_members
  WHERE group_id = target_group_id
    AND user_id IN (
      SELECT m.user_id
      FROM group_members m
      LEFT JOIN group_task_completions gtc ON gtc.user_id = m.user_id
      WHERE m.group_id = target_group_id
        AND m.user_id != creator_id
      GROUP BY m.user_id
      HAVING (MAX(gtc.completed_date) < CURRENT_DATE - INTERVAL '7 days')
         OR (MAX(gtc.completed_date) IS NULL AND MAX(m.joined_at) < CURRENT_DATE - INTERVAL '7 days')
    );

  SELECT COUNT(*)::INT INTO member_count FROM group_members WHERE group_id = target_group_id;

  -- 2. Define Threshold
  IF member_count <= 2 THEN threshold := 1.0;
  ELSIF member_count <= 9 THEN threshold := 0.6;
  ELSE threshold := 0.4;
  END IF;

  -- 3. Derive streak from completion history instead of trusting cached counters.
  IF member_count >= 1 THEN
    streak_current := 0;
    check_date := target_date;
    last_success_date := NULL;

    SELECT COUNT(DISTINCT gtc.user_id)::INT INTO active_member_count
    FROM group_task_completions gtc
    JOIN group_tasks gt ON gtc.task_id = gt.id
    WHERE gt.group_id = target_group_id AND gtc.completed_date = check_date;

    -- Keep today's streak alive if today is not checked in yet but yesterday was.
    IF active_member_count = 0 OR active_member_count::FLOAT / member_count < threshold THEN
      check_date := check_date - 1;
    END IF;

    LOOP
      SELECT COUNT(DISTINCT gtc.user_id)::INT INTO active_member_count
      FROM group_task_completions gtc
      JOIN group_tasks gt ON gtc.task_id = gt.id
      WHERE gt.group_id = target_group_id AND gtc.completed_date = check_date;

      EXIT WHEN active_member_count = 0 OR active_member_count::FLOAT / member_count < threshold;

      streak_current := streak_current + 1;
      IF last_success_date IS NULL THEN last_success_date := check_date; END IF;
      check_date := check_date - 1;
      IF streak_current > 10000 THEN EXIT; END IF;
    END LOOP;

    UPDATE groups AS g
    SET current_streak = streak_current,
        max_streak = GREATEST(COALESCE(g.max_streak, 0), streak_current),
        last_streak_date = last_success_date
    WHERE g.id = target_group_id;

    streak_max := GREATEST(COALESCE(streak_max, 0), streak_current);
  END IF;

  -- 4. Data Retrieval
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    COALESCE((SELECT COUNT(*)::INT FROM routines r WHERE r.user_id = p.id AND r.is_active = true), 0),
    COALESCE((SELECT COUNT(*)::INT FROM routine_completions rc 
     WHERE rc.user_id = p.id AND rc.completed_date = target_date), 0),
    COALESCE((SELECT COUNT(*)::INT FROM group_tasks gt WHERE gt.group_id = target_group_id), 0),
    COALESCE((SELECT COUNT(DISTINCT gtc.task_id)::INT FROM group_task_completions gtc 
     JOIN group_tasks gt ON gtc.task_id = gt.id
     WHERE gtc.user_id = p.id AND gt.group_id = target_group_id AND gtc.completed_date = target_date), 0),
    (SELECT MAX(completed_date) FROM group_task_completions gtc JOIN group_tasks gt ON gtc.task_id = gt.id WHERE gtc.user_id = p.id AND gt.group_id = target_group_id),
    COALESCE(streak_current, 0),
    COALESCE(streak_max, 0)
  FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  WHERE gm.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Social Ping Logic
CREATE OR REPLACE FUNCTION ping_user(target_user_id UUID, target_group_id UUID)
RETURNS JSON AS $$
DECLARE
  last_ping TIMESTAMP;
  sender_id UUID;
  sender_name TEXT;
BEGIN
  sender_id := auth.uid();
  SELECT username INTO sender_name FROM profiles WHERE id = sender_id;
  
  IF sender_id = target_user_id THEN
    RETURN json_build_object('success', false, 'message', 'SELF_PING_PROHIBITED');
  END IF;

  SELECT created_at INTO last_ping
  FROM pings
  WHERE pings.sender_id = auth.uid() 
    AND pings.receiver_id = target_user_id
    AND pings.group_id = target_group_id
  ORDER BY created_at DESC LIMIT 1;

  IF last_ping IS NOT NULL AND last_ping > (now() - interval '24 hours') THEN
    RETURN json_build_object('success', false, 'message', 'PROTOCOL_COOLDOWN', 'next_available', (last_ping + interval '24 hours'));
  END IF;

  INSERT INTO pings (sender_id, receiver_id, group_id) VALUES (sender_id, target_user_id, target_group_id);
  INSERT INTO notifications (user_id, type, content)
  VALUES (target_user_id, 'ping', 'Incoming_Transmission: @' || sender_name || ' is requesting a status update in your Pod!');

  RETURN json_build_object('success', true, 'message', 'PING_TRANSMITTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
