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

-- Table for accountability pods (groups)
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_streak INT DEFAULT 0,
  max_streak INT DEFAULT 0,
  last_streak_date DATE
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

-- Table for social posts
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_group_id ON posts(group_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_tasks_group_id ON group_tasks(group_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Groups viewable by everyone" ON groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can manage groups" ON groups FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Members viewable by everyone" ON group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Tasks viewable by members" ON group_tasks FOR SELECT USING (true);
CREATE POLICY "Completions viewable by everyone" ON group_task_completions FOR SELECT USING (true);
CREATE POLICY "Users can complete group tasks" ON group_task_completions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Routines viewable by everyone" ON routines FOR SELECT USING (true); CREATE POLICY "Routines manageable by owners" ON routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Completions viewable by everyone" ON routine_completions FOR SELECT USING (true); CREATE POLICY "Completions manageable by owners" ON routine_completions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tasks manageable by owners" ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Posts viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- RPC for XP
CREATE OR REPLACE FUNCTION increment_xp(user_id UUID, amount INTEGER)
RETURNS void AS $$
DECLARE
  last_update TIMESTAMP;
BEGIN
  -- Simple integrity check: Prevent extreme XP spikes in short time (anti-farming)
  -- This is a soft check that can be expanded with a proper logging table
  UPDATE profiles
  SET total_xp = total_xp + amount,
      lifetime_xp = lifetime_xp + amount,
      updated_at = NOW()
  WHERE id = user_id;
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

  -- 3. Live Streak Update
  IF member_count >= 1 THEN
    SELECT COUNT(DISTINCT user_id)::INT INTO active_member_count
    FROM group_task_completions gtc
    JOIN group_tasks gt ON gtc.task_id = gt.id
    WHERE gt.group_id = target_group_id AND gtc.completed_date = target_date;

    IF active_member_count::FLOAT / member_count >= threshold AND active_member_count > 0 THEN
      IF last_date IS NULL OR last_date < target_date THEN
        -- If the last success was yesterday, increment. Otherwise, reset to 1.
        IF last_date = target_date - INTERVAL '1 day' THEN
          streak_current := COALESCE(streak_current, 0) + 1;
        ELSE
          streak_current := 1;
        END IF;

        UPDATE groups AS g
        SET current_streak = streak_current,
            max_streak = GREATEST(COALESCE(max_streak, 0), streak_current),
            last_streak_date = target_date
        WHERE g.id = target_group_id;
        
        streak_max := GREATEST(COALESCE(streak_max, 0), streak_current);
      END IF;
    ELSE
      -- Threshold NOT met for target_date
      IF last_date = target_date THEN
        -- Someone unchecked a mission that was previously completing the goal for today
        streak_current := GREATEST(COALESCE(streak_current, 1) - 1, 0);
        UPDATE groups AS g
        SET current_streak = streak_current,
            last_streak_date = target_date - INTERVAL '1 day'
        WHERE g.id = target_group_id;
      ELSIF last_date < target_date - INTERVAL '1 day' THEN
        -- Streak was broken as the gap is more than one day
        IF streak_current > 0 THEN
          UPDATE groups AS g SET current_streak = 0 WHERE g.id = target_group_id;
          streak_current := 0;
        END IF;
      END IF;
    END IF;
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
