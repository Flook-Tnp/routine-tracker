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
