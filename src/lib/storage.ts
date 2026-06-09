import { supabase } from './supabase'
import type { Routine, RoutineCompletion, Task, TaskLog, Profile, Post, Group, Comment, Reaction, AppNotification, MemberVital, GroupTask, GroupTaskCompletion, LeaderboardEntry, LeaderboardPeriod } from '../types'

function getCurrentSeasonKey() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${quarter}`
}

function isRpcSignatureError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = error.message || ''
  return error.code === 'PGRST202' || message.includes('Could not find the function') || message.includes('target_date')
}

async function updateXp(rpcName: 'increment_xp' | 'decrement_xp', userId: string, amount: number, dateStr: string) {
  const { error } = await supabase.rpc(rpcName, { amount, user_id: userId, target_date: dateStr })
  if (!error) return null

  if (isRpcSignatureError(error)) {
    const { error: legacyError } = await supabase.rpc(rpcName, { amount, user_id: userId })
    return legacyError
  }

  return error
}

export const StorageService = {
  async fetchRoutines(userId: string): Promise<Routine[]> {
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
    if (error) throw error
    return data as Routine[]
  },

  async fetchCompletions(userId: string): Promise<RoutineCompletion[]> {
    // 1. Get total count first for efficient parallel fetching
    // Use a standard select with a limit of 1 to be safer than 'head: true'
    const { count, error: countError } = await supabase
      .from('routine_completions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .limit(1)
    
    if (countError) throw countError
    if (count === null || count === 0) return []

    // 2. Fetch all completions in parallel chunks of 1000
    const chunkSize = 1000
    const chunks = Math.ceil(count / chunkSize)
    const promises = []

    for (let i = 0; i < chunks; i++) {
      promises.push(
        supabase
          .from('routine_completions')
          .select('*')
          .eq('user_id', userId)
          .order('completed_date', { ascending: true })
          .range(i * chunkSize, (i + 1) * chunkSize - 1)
      )
    }

    const results = await Promise.all(promises)
    const allCompletions: RoutineCompletion[] = []

    for (const result of results) {
      if (result.error) throw result.error
      if (result.data) {
        allCompletions.push(...(result.data as RoutineCompletion[]))
      }
    }

    return allCompletions
  },

  async fetchTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Task[]
  },

  async fetchTaskLogs(userId: string): Promise<TaskLog[]> {
    const { data, error } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
    if (error) {
      if (error.code === '42P01') {
        console.warn('TASK_LOGS_TABLE_MISSING: apply the latest Supabase schema to enable task activity history.')
        return []
      }
      throw error
    }
    return data as TaskLog[]
  },

  async addRoutine(routine: Partial<Routine>, userId?: string): Promise<Routine> {
    const { data, error } = await supabase
      .from('routines')
      .insert([{ ...routine, user_id: userId }])
      .select()
    if (error) throw error
    return data[0] as Routine
  },

  async updateRoutine(id: string, updates: Partial<Routine>): Promise<void> {
    const { error } = await supabase
      .from('routines')
      .update(updates)
      .eq('id', id)
    if (error) throw error
  },

  async deleteRoutine(id: string): Promise<void> {
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async toggleCompletion(routineId: string, dateStr: string, xpEarned: number, userId?: string, existingId?: string): Promise<RoutineCompletion | null> {
    if (existingId) {
      const { error } = await supabase
        .from('routine_completions')
        .delete()
        .eq('id', existingId)
      if (error) throw error
      
      if (userId) {
        const rpcErr = await updateXp('decrement_xp', userId, xpEarned, dateStr)
        if (rpcErr) console.error('XP_DECREMENT_FAILED:', rpcErr)
      }
      return null
    } else {
      const { data, error } = await supabase
        .from('routine_completions')
        .insert([{ routine_id: routineId, completed_date: dateStr, xp_earned: xpEarned, user_id: userId }])
        .select()
      if (error) throw error

      if (userId) {
        const rpcErr = await updateXp('increment_xp', userId, xpEarned, dateStr)
        if (rpcErr) console.error('XP_INCREMENT_FAILED:', rpcErr)
      }
      return data[0] as RoutineCompletion
    }
  },

  async addTask(task: Partial<Task>, userId?: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...task, user_id: userId }])
      .select()
    if (error) throw error
    return data[0] as Task
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
    if (error) throw error
  },

  async upsertTaskLog(taskId: string, userId: string, loggedDate: string, note: string): Promise<TaskLog> {
    const { data, error } = await supabase
      .from('task_logs')
      .upsert(
        {
          task_id: taskId,
          user_id: userId,
          logged_date: loggedDate,
          note: note.trim() || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'task_id,logged_date' }
      )
      .select()
      .single()
    if (error) throw error
    return data as TaskLog
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async updateCategory(oldCategory: string, newCategory: string): Promise<void> {
    const { error: routineError } = await supabase
      .from('routines')
      .update({ category: newCategory })
      .eq('category', oldCategory)
    if (routineError) throw routineError

    const { error: taskError } = await supabase
      .from('tasks')
      .update({ category: newCategory })
      .eq('category', oldCategory)
    if (taskError) throw taskError
  },

  async deleteCategory(category: string): Promise<void> {
    const { error: routineError } = await supabase
      .from('routines')
      .delete()
      .eq('category', category)
    if (routineError) throw routineError

    const { error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('category', category)
    if (taskError) throw taskError
  },

  async fetchProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as Profile
  },

  async createProfile(userId: string, username: string): Promise<Profile> {
    const uniqueUsername = `${username}_${Math.random().toString(36).substring(2, 5)}`
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ id: userId, username: uniqueUsername, total_xp: 0, badges: [] }])
      .select()
      .single()
    
    if (error) {
      // If it already exists, just fetch it
      if (error.code === '23505') {
        return this.fetchProfile(userId)
      }
      throw error
    }
    return data as Profile
  },

  async fetchLeaderboard(period: LeaderboardPeriod = 'season'): Promise<LeaderboardEntry[]> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
    if (error) throw error

    const { data: allCompletions, error: allCompletionsError } = await supabase
      .from('routine_completions')
      .select('user_id, xp_earned, completed_date')
    if (allCompletionsError) {
      console.warn('LEADERBOARD_COMPLETION_HISTORY_UNAVAILABLE:', allCompletionsError)
    }

    const allTimeXpByUser = new Map<string, number>()
    ;(allCompletions || []).forEach((completion) => {
      const userId = completion.user_id as string | null
      if (!userId) return
      const xp = Number(completion.xp_earned || 0)
      allTimeXpByUser.set(userId, (allTimeXpByUser.get(userId) || 0) + xp)
    })

    const { data: groupMembers, error: groupMembersError } = await supabase
      .from('group_members')
      .select('group_id')
    if (groupMembersError) {
      console.warn('LEADERBOARD_GROUP_MEMBERS_UNAVAILABLE:', groupMembersError)
    }

    const groupMemberCounts = new Map<string, number>()
    ;(groupMembers || []).forEach((member) => {
      const groupId = member.group_id as string | null
      if (!groupId) return
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) || 0) + 1)
    })

    const { data: groupCompletions, error: groupCompletionsError } = await supabase
      .from('group_task_completions')
      .select('user_id, completed_date, group_tasks(group_id)')
    if (groupCompletionsError) {
      console.warn('LEADERBOARD_GROUP_COMPLETIONS_UNAVAILABLE:', groupCompletionsError)
    }

    if (period === 'all_time') {
      return (profiles as Profile[])
        .map((profile) => {
          const score = Math.max(profile.lifetime_xp || 0, profile.total_xp || 0, allTimeXpByUser.get(profile.id) || 0)
          return {
            ...profile,
            score,
            rank: 0,
            period
          }
        })
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
    }

    const now = new Date()
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const start = new Date(Date.UTC(now.getFullYear(), quarterStartMonth, 1))
    const end = new Date(Date.UTC(now.getFullYear(), quarterStartMonth + 3, 0))
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    const seasonKey = getCurrentSeasonKey()
    const seasonXpByUser = new Map<string, number>()
    const seasonScoreUsers = new Set<string>()
    const { data: seasonScores, error: seasonScoresError } = await supabase
      .from('leaderboard_season_scores')
      .select('user_id, xp')
      .eq('season_key', seasonKey)

    if (!seasonScoresError) {
      ;(seasonScores || []).forEach((scoreRow) => {
        const userId = scoreRow.user_id as string | null
        if (!userId) return
        seasonXpByUser.set(userId, Number(scoreRow.xp || 0))
        seasonScoreUsers.add(userId)
      })
    } else {
      console.warn('LEADERBOARD_SEASON_SCORES_UNAVAILABLE:', seasonScoresError)
    }

    ;(allCompletions || []).forEach((completion) => {
      const userId = completion.user_id as string | null
      if (!userId) return
      if (seasonScoreUsers.has(userId)) return
      if (completion.completed_date < startStr || completion.completed_date > endStr) return
      const xp = Number(completion.xp_earned || 0)
      seasonXpByUser.set(userId, (seasonXpByUser.get(userId) || 0) + xp)
    })

    ;(groupCompletions || []).forEach((completion) => {
      const userId = completion.user_id as string | null
      if (!userId) return
      if (seasonScoreUsers.has(userId)) return
      if (completion.completed_date < startStr || completion.completed_date > endStr) return

      const groupTask = Array.isArray(completion.group_tasks) ? completion.group_tasks[0] : completion.group_tasks
      const groupId = groupTask?.group_id as string | null | undefined
      if (!groupId || (groupMemberCounts.get(groupId) || 0) <= 1) return

      seasonXpByUser.set(userId, (seasonXpByUser.get(userId) || 0) + 5)
    })

    return (profiles as Profile[])
      .map((profile) => {
        const allTimeScore = Math.max(profile.lifetime_xp || 0, profile.total_xp || 0, allTimeXpByUser.get(profile.id) || 0)
        const rawSeasonScore = seasonXpByUser.get(profile.id) || 0
        return {
          ...profile,
          score: allTimeScore > 0 ? Math.min(rawSeasonScore, allTimeScore) : rawSeasonScore,
          rank: 0,
          period
        }
      })
      .sort((a, b) => (b.score - a.score) || ((allTimeXpByUser.get(b.id) || b.lifetime_xp || b.total_xp || 0) - (allTimeXpByUser.get(a.id) || a.lifetime_xp || a.total_xp || 0)))
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    if (error) throw error
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Math.random()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return data.publicUrl
  },

  async deleteAvatar(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
    if (error) throw error
  },

  async fetchPosts(groupId?: string): Promise<Post[]> {
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles (username, avatar_url),
        comments (*, profiles (username, avatar_url)),
        reactions (*, profiles (username, avatar_url))
      `)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'comments', ascending: true })
    
    if (groupId) {
      query = query.eq('group_id', groupId)
    } else {
      query = query.is('group_id', null)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Post[]
  },

  async createPost(content: string, userId: string, type: string = 'manual', metadata: Record<string, unknown> = {}, groupId?: string): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .insert([{ content, user_id: userId, type, metadata, group_id: groupId }])
      .select()
    if (error) throw error
    return data[0] as Post
  },

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
    if (error) throw error
  },

  async updatePost(postId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .update({ content })
      .eq('id', postId)
    if (error) throw error
  },

  async addComment(postId: string, content: string, userId: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert([{ post_id: postId, content, user_id: userId }])
      .select()
    if (error) throw error
    return data[0] as Comment
  },

  async updateComment(commentId: string, content: string): Promise<void> {
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', commentId)
      .select()
    
    if (error) throw error
    if (!data || data.length === 0) throw new Error('PERMISSION_DENIED: RLS policy blocked the update.')
  },

  async deleteComment(commentId: string): Promise<void> {
    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .select()
    
    if (error) throw error
    if (!data || data.length === 0) throw new Error('PERMISSION_DENIED: RLS policy blocked the deletion.')
  },

  async toggleReaction(postId: string, emoji: string, userId: string): Promise<Reaction | null> {
    const { data: existing } = await supabase
      .from('reactions')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('id', existing.id)
      if (error) throw error
      return null
    } else {
      const { data, error } = await supabase
        .from('reactions')
        .insert([{ post_id: postId, emoji, user_id: userId }])
        .select()
      if (error) throw error
      return data[0] as Reaction
    }
  },

  async fetchGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (user_id),
        group_tasks (id, title)
      `)
    if (error) throw error
    return data as Group[]
  },

  async createGroup(name: string, description: string, userId: string, visibility: 'public' | 'private' = 'public', accessCode?: string): Promise<Group> {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert([{ name, description, created_by: userId, visibility }])
      .select()
      .single()
    if (groupError) throw groupError

    if (visibility === 'private' && accessCode?.trim()) {
      const { error: codeError } = await supabase
        .from('group_access_codes')
        .insert({ group_id: group.id, access_code: accessCode.trim() })
      if (codeError) throw codeError
    }

    // Automatically join the group
    await this.joinGroup(group.id, userId)
    return group as Group
  },

  async fetchGroupAccessCode(groupId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('group_access_codes')
      .select('access_code')
      .eq('group_id', groupId)
      .maybeSingle()

    if (error) throw error
    return data?.access_code ?? null
  },

  async joinGroup(groupId: string, userId: string, accessCode?: string): Promise<{ user_id: string; group_id: string }> {
    const { data: joined, error: joinError } = await supabase
      .rpc('join_group_with_code', {
        target_group_id: groupId,
        provided_code: accessCode?.trim() || null
      })

    if (!joinError && joined) return joined as { user_id: string; group_id: string }

    if (joinError && joinError.code !== '42883') throw joinError

    const { data, error } = await supabase
      .from('group_members')
      .insert([{ group_id: groupId, user_id: userId }])
      .select()
    if (error) throw error
    return data[0]
  },

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
    if (error) throw error
  },

  async deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
    if (error) throw error
  },

  async updateGroup(groupId: string, updates: Partial<Group>, accessCode?: string): Promise<Group> {
    const { data, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single()
    if (error) throw error

    if (updates.visibility === 'private' && accessCode?.trim()) {
      const { error: codeError } = await supabase
        .from('group_access_codes')
        .upsert({ group_id: groupId, access_code: accessCode.trim(), updated_at: new Date().toISOString() })
      if (codeError) throw codeError
    }

    if (updates.visibility === 'public') {
      const { error: codeDeleteError } = await supabase
        .from('group_access_codes')
        .delete()
        .eq('group_id', groupId)
      if (codeDeleteError) throw codeDeleteError
    }

    return data as Group
  },

  async fetchGroupTasks(groupId: string): Promise<GroupTask[]> {
    const { data, error } = await supabase
      .from('group_tasks')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  async createGroupTask(groupId: string, title: string, description?: string): Promise<GroupTask> {
    const { data, error } = await supabase
      .from('group_tasks')
      .insert({ group_id: groupId, title, description })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteGroupTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('group_tasks')
      .delete()
      .eq('id', taskId)
    if (error) throw error
  },

  async fetchGroupTaskCompletions(groupId: string, date: string): Promise<GroupTaskCompletion[]> {
    // First get the task IDs for this group
    const { data: tasks } = await supabase
      .from('group_tasks')
      .select('id')
      .eq('group_id', groupId)
    
    if (!tasks || tasks.length === 0) return []
    const taskIds = tasks.map(t => t.id)

    // Then get completions for those tasks
    const { data, error } = await supabase
      .from('group_task_completions')
      .select('*')
      .in('task_id', taskIds)
      .eq('completed_date', date)
    
    if (error) throw error
    return data as GroupTaskCompletion[]
  },

  async toggleGroupTask(taskId: string, userId: string, date: string): Promise<void> {
    const { data: existing } = await supabase
      .from('group_task_completions')
      .select('id')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('completed_date', date)
      .maybeSingle()

    if (existing) {
      await supabase.from('group_task_completions').delete().eq('id', existing.id)
      
      // Decrement XP when unchecking
      const { data: task } = await supabase.from('group_tasks').select('group_id').eq('id', taskId).single()
      if (task) {
        const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', task.group_id)
        if (members && members.length > 1) {
          const rpcErr = await updateXp('decrement_xp', userId, 5, date)
          if (rpcErr) console.error('GROUP_XP_DECREMENT_FAILED:', rpcErr)
        }
      }
    } else {
      await supabase.from('group_task_completions').insert({
        task_id: taskId,
        user_id: userId,
        completed_date: date
      })

      // Bonus XP for active group participation
      const { data: task } = await supabase.from('group_tasks').select('group_id').eq('id', taskId).single()
      if (task) {
        const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', task.group_id)
        if (members && members.length > 1) {
          const rpcErr = await updateXp('increment_xp', userId, 5, date)
          if (rpcErr) console.error('GROUP_XP_INCREMENT_FAILED:', rpcErr)
        }
      }
    }
  },

  async fetchPodMembers(groupId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        profiles (*)
      `)
      .eq('group_id', groupId)
    
    if (error) throw error
    const rows = (data || []) as unknown as { profiles: Profile | Profile[] | null }[]
    return rows.flatMap((row) => {
      if (!row.profiles) return []
      return Array.isArray(row.profiles) ? row.profiles : [row.profiles]
    })
  },

  async fetchMemberVitals(groupId: string, date?: string): Promise<MemberVital[]> {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .rpc('get_pod_member_vitals', { target_group_id: groupId, target_date: targetDate })
    if (error) throw error
    return data as MemberVital[]
  },

  async pingUser(targetUserId: string, groupId: string): Promise<{ success: boolean; message: string; next_available?: string }> {
    const { data, error } = await supabase
      .rpc('ping_user', { target_user_id: targetUserId, target_group_id: groupId })
    
    if (error) throw error
    return data
  },

  async fetchNotifications(userId: string): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as AppNotification[]
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) throw error
  }
}
