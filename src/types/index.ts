export interface Routine {
  id: string
  title: string
  created_at: string
  is_active: boolean
  category: string
}

export interface RoutineCompletion {
  id: string
  routine_id: string
  completed_date: string
  xp_earned?: number
}

export interface Task {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  category: string
  completed_date: string | null
  created_at: string
}

export interface TaskBreakdownItem {
  title: string
  percentage: number
  startDate: string
  totalCompletions: number
  activeDays: number
}

export interface Profile {
  id: string
  username: string
  total_xp: number
  lifetime_xp: number
  avatar_url?: string | null
  badges: Badge[]
  updated_at: string
}

export interface Badge {
  id: string
  name: string
  icon: string
  description?: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  type: 'manual' | 'milestone'
  metadata: Record<string, any>
  created_at: string
  profiles?: { username: string, avatar_url?: string | null }
  comments?: Comment[]
  reactions?: Reaction[]
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string, avatar_url?: string | null }
}

export interface Reaction {
  id: string
  post_id: string
  user_id: string
  emoji: string
}

export interface Group {
  id: string
  name: string
  description: string
  created_by: string
  created_at: string
  group_members?: { user_id: string }[]
}

export interface AppNotification {
  id: string
  user_id: string
  type: string
  content: string
  is_read: boolean
  created_at: string
}

export interface MemberVital {
  id: string
  username: string
  avatar_url: string | null
  total_xp: number
  routines_total: number
  routines_completed_today: number
  last_activity_date: string | null
  pod_current_streak?: number
  pod_max_streak?: number
}

