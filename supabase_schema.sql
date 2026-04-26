-- Table for profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  total_xp INTEGER DEFAULT 0,
  lifetime_xp INTEGER DEFAULT 0,
  badges JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  UNIQUE(routine_id, completed_date)
);

-- Table for Kanban tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in-progress', 'done'
  category TEXT NOT NULL DEFAULT 'General',
  completed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for social posts
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'milestone'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for comments
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for reactions
CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routine_completions_routine_id ON routine_completions(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_completed_date ON routine_completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_routines_category ON routines(category);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_id ON routine_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);

-- RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Profile Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Routine Policies
CREATE POLICY "Routines are viewable by everyone" ON routines FOR SELECT USING (true);
CREATE POLICY "Users can manage their own routines" ON routines FOR ALL USING (auth.uid() = user_id);

-- Completion Policies
CREATE POLICY "Completions are viewable by everyone" ON routine_completions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own completions" ON routine_completions FOR ALL USING (auth.uid() = user_id);

-- Task Policies
CREATE POLICY "Users can manage their own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

-- Social Policies
CREATE POLICY "Public posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create their own comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public reactions are viewable by everyone" ON reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own reactions" ON reactions FOR ALL USING (auth.uid() = user_id);

-- Table for accountability pods (groups)
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for group members
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Indexes for groups
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- RLS for groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups are viewable by everyone" ON groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can manage their own groups" ON groups FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Group members are viewable by everyone" ON group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- Update posts to include group_id
ALTER TABLE posts ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts(group_id);


-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC for incrementing/decrementing XP
CREATE OR REPLACE FUNCTION increment_xp(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    total_xp = total_xp + amount,
    lifetime_xp = lifetime_xp + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_xp(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    total_xp = GREATEST(0, total_xp - amount),
    lifetime_xp = GREATEST(0, lifetime_xp - amount)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pings table to track social nudges
CREATE TABLE IF NOT EXISTS pings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup of daily pings
CREATE INDEX IF NOT EXISTS pings_sender_receiver_idx ON pings (sender_id, receiver_id, created_at);

-- Function to ping a user with rate limiting (once per 24h per pair)
CREATE OR REPLACE FUNCTION ping_user(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  last_ping TIMESTAMP;
  sender_id UUID;
BEGIN
  sender_id := auth.uid();
  
  -- Check if user is pinging themselves
  IF sender_id = target_user_id THEN
    RETURN json_build_object('success', false, 'message', 'SELF_PING_PROHIBITED');
  END IF;

  -- Get the last ping time for this specific pair
  SELECT created_at INTO last_ping
  FROM pings
  WHERE pings.sender_id = ping_user.sender_id 
    AND pings.receiver_id = target_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if 24 hours have passed
  IF last_ping IS NOT NULL AND last_ping > (now() - interval '24 hours') THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'PROTOCOL_COOLDOWN', 
      'next_available', (last_ping + interval '24 hours')
    );
  END IF;

  -- Record the ping
  INSERT INTO pings (sender_id, receiver_id)
  VALUES (sender_id, target_user_id);

  RETURN json_build_object('success', true, 'message', 'PING_TRANSMITTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notifications table for in-app alerts
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ping', 'achievement', etc.
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update the ping_user function to also create a notification
CREATE OR REPLACE FUNCTION ping_user(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  last_ping TIMESTAMP;
  sender_id UUID;
  sender_name TEXT;
BEGIN
  sender_id := auth.uid();
  
  -- Get sender name
  SELECT username INTO sender_name FROM profiles WHERE id = sender_id;
  
  -- Check if user is pinging themselves
  IF sender_id = target_user_id THEN
    RETURN json_build_object('success', false, 'message', 'SELF_PING_PROHIBITED');
  END IF;

  -- Get the last ping time for this specific pair
  SELECT created_at INTO last_ping
  FROM pings
  WHERE pings.sender_id = ping_user.sender_id 
    AND pings.receiver_id = target_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if 24 hours have passed
  IF last_ping IS NOT NULL AND last_ping > (now() - interval '24 hours') THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'PROTOCOL_COOLDOWN', 
      'next_available', (last_ping + interval '24 hours')
    );
  END IF;

  -- Record the ping
  INSERT INTO pings (sender_id, receiver_id)
  VALUES (sender_id, target_user_id);

  -- Create the in-app notification
  INSERT INTO notifications (user_id, type, content)
  VALUES (target_user_id, 'ping', 'Incoming_Transmission: @' || sender_name || ' is requesting a status update on your protocols!');

  RETURN json_build_object('success', true, 'message', 'PING_TRANSMITTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add group_id to pings to allow per-pod rate limiting
ALTER TABLE pings ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- Update the ping_user function to include group_id
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

  -- Check last ping time FOR THIS SPECIFIC GROUP
  SELECT created_at INTO last_ping
  FROM pings
  WHERE pings.sender_id = ping_user.sender_id 
    AND pings.receiver_id = target_user_id
    AND pings.group_id = target_group_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_ping IS NOT NULL AND last_ping > (now() - interval '24 hours') THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'PROTOCOL_COOLDOWN', 
      'next_available', (last_ping + interval '24 hours')
    );
  END IF;

  -- Record the ping with group context
  INSERT INTO pings (sender_id, receiver_id, group_id)
  VALUES (sender_id, target_user_id, target_group_id);

  INSERT INTO notifications (user_id, type, content)
  VALUES (target_user_id, 'ping', 'Incoming_Transmission: @' || sender_name || ' is requesting a status update in your Pod!');

  RETURN json_build_object('success', true, 'message', 'PING_TRANSMITTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pod member vitals (progress and status)
CREATE OR REPLACE FUNCTION get_pod_member_vitals(target_group_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  total_xp BIGINT,
  routines_total INT,
  routines_completed_today INT,
  last_activity_date DATE
) AS $$
BEGIN
  -- Logic to prune inactive members (older than 7 days)
  DELETE FROM group_members
  WHERE group_id = target_group_id
    AND user_id IN (
      SELECT m.user_id
      FROM group_members m
      LEFT JOIN routine_completions c ON c.user_id = m.user_id
      WHERE m.group_id = target_group_id
      GROUP BY m.user_id
      HAVING MAX(c.completed_date) < CURRENT_DATE - INTERVAL '7 days'
         OR (MAX(c.completed_date) IS NULL AND m.joined_at < CURRENT_DATE - INTERVAL '7 days')
    );

  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    (SELECT COUNT(*)::INT FROM routines r WHERE r.user_id = p.id AND r.is_active = true) as routines_total,
    (SELECT COUNT(*)::INT FROM routine_completions rc 
     WHERE rc.user_id = p.id AND rc.completed_date = CURRENT_DATE) as routines_completed_today,
    (SELECT MAX(completed_date) FROM routine_completions rc WHERE rc.user_id = p.id) as last_activity_date
  FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  WHERE gm.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add joined_at to group_members if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_members' AND column_name='joined_at') THEN
    ALTER TABLE group_members ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Add streak tracking to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_streak INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS last_streak_date DATE;

-- Update the vitals function to also update group streaks
CREATE OR REPLACE FUNCTION get_pod_member_vitals(target_group_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  total_xp BIGINT,
  routines_total INT,
  routines_completed_today INT,
  last_activity_date DATE,
  pod_current_streak INT,
  pod_max_streak INT
) AS $$
DECLARE
  member_count INT;
  synergy_pct FLOAT;
  threshold FLOAT;
  last_date DATE;
  today DATE := CURRENT_DATE;
BEGIN
  -- 1. Run the Auto-Kick Purge (Inactive for 7 days)
  DELETE FROM group_members
  WHERE group_id = target_group_id
    AND user_id IN (
      SELECT m.user_id
      FROM group_members m
      LEFT JOIN routine_completions c ON c.user_id = m.user_id
      WHERE m.group_id = target_group_id
        AND m.user_id != (SELECT created_by FROM groups WHERE id = target_group_id) -- Don't kick owner
      GROUP BY m.user_id, m.joined_at
      HAVING (MAX(c.completed_date) < today - INTERVAL '7 days')
         OR (MAX(c.completed_date) IS NULL AND m.joined_at < today - INTERVAL '7 days')
    );

  -- 2. Calculate Synergy for Yesterday (to check if streak continues)
  SELECT COUNT(*)::INT INTO member_count FROM group_members WHERE group_id = target_group_id;
  
  -- Define threshold based on group size
  IF member_count <= 1 THEN threshold := 1.0;
  ELSIF member_count <= 5 THEN threshold := 0.8;
  ELSE threshold := 0.7;
  END IF;

  -- Get current group streak data
  SELECT last_streak_date, current_streak INTO last_date, pod_current_streak FROM groups WHERE id = target_group_id;

  -- 3. Streak Maintenance Logic (Run once per day)
  IF last_date IS NULL OR last_date < today THEN
    -- Check yesterday's synergy
    SELECT 
      AVG(CASE WHEN r_total > 0 THEN (r_done::FLOAT / r_total) ELSE 0 END) INTO synergy_pct
    FROM (
      SELECT 
        gm.user_id,
        (SELECT COUNT(*)::INT FROM routines r WHERE r.user_id = gm.user_id AND r.is_active = true) as r_total,
        (SELECT COUNT(*)::INT FROM routine_completions rc 
         WHERE rc.user_id = gm.user_id AND rc.completed_date = today - INTERVAL '1 day') as r_done
      FROM group_members gm
      WHERE gm.group_id = target_group_id
    ) member_stats;

    IF synergy_pct >= threshold THEN
      -- Increment Streak
      UPDATE groups 
      SET current_streak = current_streak + 1,
          max_streak = GREATEST(max_streak, current_streak + 1),
          last_streak_date = today
      WHERE id = target_group_id;
    ELSIF last_date < today - INTERVAL '1 day' THEN
      -- Reset Streak if they missed a day entirely
      UPDATE groups SET current_streak = 0, last_streak_date = today WHERE id = target_group_id;
    END IF;
  END IF;

  -- Final Refresh values for return
  SELECT current_streak, max_streak INTO pod_current_streak, pod_max_streak FROM groups WHERE id = target_group_id;

  -- 4. Return member vitals
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    COALESCE((SELECT COUNT(*)::INT FROM routines r WHERE r.user_id = p.id AND r.is_active = true), 0),
    COALESCE((SELECT COUNT(*)::INT FROM routine_completions rc 
     WHERE rc.user_id = p.id AND rc.completed_date = today), 0),
    (SELECT MAX(completed_date) FROM routine_completions rc WHERE rc.user_id = p.id),
    pod_current_streak,
    pod_max_streak
  FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  WHERE gm.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Table for group-specific objectives
CREATE TABLE IF NOT EXISTS group_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Table for tracking group task completions
CREATE TABLE IF NOT EXISTS group_task_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES group_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(task_id, user_id, completed_date)
);

-- 3. Redefine Vitals to focus on SHARED OBJECTIVES
CREATE OR REPLACE FUNCTION get_pod_member_vitals(target_group_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  total_xp BIGINT,
  routines_total INT, -- Total tasks in the group
  routines_completed_today INT, -- Tasks this specific user did today
  last_activity_date DATE,
  pod_current_streak INT,
  pod_max_streak INT
) AS $$
DECLARE
  member_count INT;
  sync_count INT; -- Number of members who did AT LEAST ONE task yesterday
  threshold FLOAT;
  last_date DATE;
  today DATE := CURRENT_DATE;
BEGIN
  -- 1. Auto-Kick inactive (7 days)
  DELETE FROM group_members
  WHERE group_id = target_group_id
    AND user_id IN (
      SELECT m.user_id
      FROM group_members m
      LEFT JOIN group_task_completions c ON c.user_id = m.user_id
      WHERE m.group_id = target_group_id
        AND m.user_id != (SELECT created_by FROM groups WHERE id = target_group_id)
      GROUP BY m.user_id, m.joined_at
      HAVING (MAX(c.completed_date) < today - INTERVAL '7 days')
         OR (MAX(c.completed_date) IS NULL AND m.joined_at < today - INTERVAL '7 days')
    );

  -- 2. Group Streak Logic (At least 1 task per person)
  SELECT COUNT(*)::INT INTO member_count FROM group_members WHERE group_id = target_group_id;
  
  -- Solo = 100%, 2-5 = 80%, 6+ = 70% of members must be active
  IF member_count <= 1 THEN threshold := 1.0;
  ELSIF member_count <= 5 THEN threshold := 0.8;
  ELSE threshold := 0.7;
  END IF;

  SELECT last_streak_date, current_streak INTO last_date, pod_current_streak FROM groups WHERE id = target_group_id;

  IF (last_date IS NULL OR last_date < today) AND (SELECT COUNT(*) FROM group_tasks WHERE group_id = target_group_id) > 0 THEN
    -- How many members did >= 1 task yesterday?
    SELECT COUNT(DISTINCT user_id)::INT INTO sync_count
    FROM group_task_completions gtc
    JOIN group_tasks gt ON gtc.task_id = gt.id
    WHERE gt.group_id = target_group_id AND gtc.completed_date = today - INTERVAL '1 day';

    IF (sync_count::FLOAT / member_count) >= threshold THEN
      UPDATE groups SET current_streak = current_streak + 1, max_streak = GREATEST(max_streak, current_streak + 1), last_streak_date = today WHERE id = target_group_id;
    ELSIF last_date < today - INTERVAL '1 day' THEN
      UPDATE groups SET current_streak = 0, last_streak_date = today WHERE id = target_group_id;
    END IF;
  END IF;

  -- 3. Return members with their group task progress
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    (SELECT COUNT(*)::INT FROM group_tasks WHERE group_id = target_group_id),
    (SELECT COUNT(DISTINCT gtc.task_id)::INT FROM group_task_completions gtc 
     JOIN group_tasks gt ON gtc.task_id = gt.id
     WHERE gtc.user_id = p.id AND gt.group_id = target_group_id AND gtc.completed_date = today),
    (SELECT MAX(completed_date) FROM group_task_completions gtc 
     JOIN group_tasks gt ON gtc.task_id = gt.id
     WHERE gtc.user_id = p.id AND gt.group_id = target_group_id),
    g.current_streak,
    g.max_streak
  FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Final robust version of get_pod_member_vitals
CREATE OR REPLACE FUNCTION get_pod_member_vitals(target_group_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  total_xp BIGINT,
  routines_total INT,
  routines_completed_today INT,
  group_tasks_total INT,
  group_tasks_completed INT,
  last_activity_date DATE,
  pod_current_streak INT,
  pod_max_streak INT
) AS $$
DECLARE
  today DATE := CURRENT_DATE;
  streak_current INT;
  streak_max INT;
  last_date DATE;
  member_count INT;
  active_member_count INT;
BEGIN
  -- 1. Refresh Streak Logic (Strict: All members must do at least one group task)
  SELECT COUNT(*)::INT INTO member_count FROM group_members WHERE group_id = target_group_id;
  SELECT current_streak, max_streak, last_streak_date INTO streak_current, streak_max, last_date FROM groups WHERE groups.id = target_group_id;

  IF (last_date IS NULL OR last_date < today) AND (SELECT COUNT(*) FROM group_tasks WHERE group_id = target_group_id) > 0 THEN
    SELECT COUNT(DISTINCT user_id)::INT INTO active_member_count
    FROM group_task_completions gtc
    JOIN group_tasks gt ON gtc.task_id = gt.id
    WHERE gt.group_id = target_group_id AND gtc.completed_date = today - INTERVAL '1 day';

    IF member_count > 0 AND active_member_count = member_count THEN
      UPDATE groups 
      SET current_streak = COALESCE(current_streak, 0) + 1,
          max_streak = GREATEST(COALESCE(max_streak, 0), COALESCE(current_streak, 0) + 1),
          last_streak_date = today
      WHERE id = target_group_id;
    ELSIF last_date < today - INTERVAL '1 day' THEN
      UPDATE groups SET current_streak = 0, last_streak_date = today WHERE id = target_group_id;
    END IF;
    
    -- Re-fetch updated streak values
    SELECT current_streak, max_streak INTO streak_current, streak_max FROM groups WHERE id = target_group_id;
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    -- Personal Routine Metrics
    COALESCE((SELECT COUNT(*)::INT FROM routines r WHERE r.user_id = p.id AND r.is_active = true), 0),
    COALESCE((SELECT COUNT(*)::INT FROM routine_completions rc 
     WHERE rc.user_id = p.id AND rc.completed_date = today), 0),
    -- Group Task Metrics
    COALESCE((SELECT COUNT(*)::INT FROM group_tasks gt WHERE gt.group_id = target_group_id), 0),
    COALESCE((SELECT COUNT(DISTINCT gtc.task_id)::INT FROM group_task_completions gtc 
     JOIN group_tasks gt ON gtc.task_id = gt.id
     WHERE gtc.user_id = p.id AND gt.group_id = target_group_id AND gtc.completed_date = today), 0),
    -- Meta
    (SELECT MAX(completed_date) FROM routine_completions rc WHERE rc.user_id = p.id),
    COALESCE(streak_current, 0),
    COALESCE(streak_max, 0)
  FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  WHERE gm.group_id = target_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
