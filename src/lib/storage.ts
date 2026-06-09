import { supabase } from './supabase'
import type { Routine, RoutineCompletion, Task, TaskLog, Profile, Post, Group, Comment, Reaction, AppNotification, MemberVital, GroupTask, GroupTaskCompletion, LeaderboardEntry, LeaderboardPeriod } from '../types'

type XpLedger = {
  allTimeXpByUser: Map<string, number>
  seasonXpByUser: Map<string, number>
}

type XpLedgerRow = {
  user_id: string | null
  total_xp: number | null
  season_xp: number | null
}

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const { count, error: countError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })

  if (countError) throw countError
  if (!count) return []

  const chunkSize = 1000
  const chunks = Math.ceil(count / chunkSize)
  const requests = Array.from({ length: chunks }, (_, index) =>
    supabase
      .from(table)
      .select(select)
      .range(index * chunkSize, (index + 1) * chunkSize - 1)
  )

  const results = await Promise.all(requests)
  const rows: T[] = []

  for (const result of results) {
    if (result.error) throw result.error
    rows.push(...((result.data || []) as T[]))
  }

  return rows
}

function getCurrentQuarterRange() {
  const now = new Date()
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
  const start = new Date(Date.UTC(now.getFullYear(), quarterStartMonth, 1))
  const end = new Date(Date.UTC(now.getFullYear(), quarterStartMonth + 3, 0))

  return {
    startStr: start.toISOString().split('T')[0],
    endStr: end.toISOString().split('T')[0]
  }
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
    if (!legacyError) return null
  }

  const directError = await adjustProfileXpDirectly(rpcName, userId, amount)
  if (directError) return directError

  console.warn('XP_RPC_FALLBACK_USED:', error)
  return null
}

async function adjustProfileXpDirectly(rpcName: 'increment_xp' | 'decrement_xp', userId: string, amount: number) {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('total_xp, lifetime_xp')
    .eq('id', userId)
    .single()

  if (fetchError) return fetchError

  const currentTotal = Number(profile?.total_xp || 0)
  const currentLifetime = Number(profile?.lifetime_xp || 0)
  const updates = rpcName === 'increment_xp'
    ? {
        total_xp: currentTotal + amount,
        lifetime_xp: currentLifetime + amount,
        updated_at: new Date().toISOString()
      }
    : {
        total_xp: Math.max(0, currentTotal - amount),
        updated_at: new Date().toISOString()
      }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  return updateError
}

export const StorageService = {
  async fetchXpLedger(): Promise<XpLedger> {
    const targetDate = new Date().toISOString().split('T')[0]
    const { data: rpcLedger, error: rpcLedgerError } = await supabase
      .rpc('get_xp_ledger', { target_date: targetDate })

    if (!rpcLedgerError && rpcLedger) {
      const allTimeXpByUser = new Map<string, number>()
      const seasonXpByUser = new Map<string, number>()

      ;(rpcLedger as XpLedgerRow[]).forEach((row) => {
        if (!row.user_id) return
        allTimeXpByUser.set(row.user_id, Number(row.total_xp || 0))
        seasonXpByUser.set(row.user_id, Number(row.season_xp || 0))
      })

      return { allTimeXpByUser, seasonXpByUser }
    }

    console.warn('XP_LEDGER_RPC_UNAVAILABLE:', rpcLedgerError)

    const { startStr, endStr } = getCurrentQuarterRange()
    const allTimeXpByUser = new Map<string, number>()
    const seasonXpByUser = new Map<string, number>()

    let allCompletions: { user_id: string | null; xp_earned: number | null; completed_date: string }[] = []
    try {
      allCompletions = await fetchAllRows('routine_completions', 'user_id, xp_earned, completed_date')
    } catch (error) {
      console.warn('XP_LEDGER_COMPLETION_HISTORY_UNAVAILABLE:', error)
    }

    allCompletions.forEach((completion) => {
      const userId = completion.user_id as string | null
      if (!userId) return
      const xp = Number(completion.xp_earned || 0)
      const completedDate = completion.completed_date as string

      allTimeXpByUser.set(userId, (allTimeXpByUser.get(userId) || 0) + xp)
      if (completedDate >= startStr && completedDate <= endStr) {
        seasonXpByUser.set(userId, (seasonXpByUser.get(userId) || 0) + xp)
      }
    })

    let groupMembers: { group_id: string | null }[] = []
    try {
      groupMembers = await fetchAllRows('group_members', 'group_id')
    } catch (error) {
      console.warn('XP_LEDGER_GROUP_MEMBERS_UNAVAILABLE:', error)
    }

    const groupMemberCounts = new Map<string, number>()
    groupMembers.forEach((member) => {
      const groupId = member.group_id as string | null
      if (!groupId) return
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) || 0) + 1)
    })

    let groupCompletions: {
      user_id: string | null
      completed_date: string
      group_tasks: { group_id: string | null } | { group_id: string | null }[] | null
    }[] = []
    try {
      groupCompletions = await fetchAllRows('group_task_completions', 'user_id, completed_date, group_tasks(group_id)')
    } catch (error) {
      console.warn('XP_LEDGER_GROUP_COMPLETIONS_UNAVAILABLE:', error)
    }

    groupCompletions.forEach((completion) => {
      const userId = completion.user_id as string | null
      if (!userId) return

      const groupTask = Array.isArray(completion.group_tasks) ? completion.group_tasks[0] : completion.group_tasks
      const groupId = groupTask?.group_id as string | null | undefined
      if (!groupId || (groupMemberCounts.get(groupId) || 0) <= 1) return

      const completedDate = completion.completed_date as string
      allTimeXpByUser.set(userId, (allTimeXpByUser.get(userId) || 0) + 5)
      if (completedDate >= startStr && completedDate <= endStr) {
        seasonXpByUser.set(userId, (seasonXpByUser.get(userId) || 0) + 5)
      }
    })

    return { allTimeXpByUser, seasonXpByUser }
  },

  async reconcileProfileXp(userId: string): Promise<Profile> {
    const profile = await this.fetchRawProfile(userId)
    const ledger = await this.fetchXpLedger()
    const ledgerXp = ledger.allTimeXpByUser.get(userId) || 0
    const totalXp = Math.max(0, ledgerXp)
    const lifetimeXp = Math.max(profile.lifetime_xp || 0, totalXp)

    if ((profile.total_xp || 0) !== totalXp || (profile.lifetime_xp || 0) < lifetimeXp) {
      await this.updateProfile(userId, {
        total_xp: totalXp,
        lifetime_xp: lifetimeXp,
        updated_at: new Date().toISOString()
      })
      return { ...profile, total_xp: totalXp, lifetime_xp: lifetimeXp, updated_at: new Date().toISOString() }
    }

    return profile
  },

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
        await this.reconcileProfileXp(userId)
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
        await this.reconcileProfileXp(userId)
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
    const profile = await this.fetchRawProfile(userId)
    const ledger = await this.fetchXpLedger()
    const totalXp = ledger.allTimeXpByUser.get(userId) || 0

    return {
      ...profile,
      total_xp: totalXp,
      lifetime_xp: Math.max(profile.lifetime_xp || 0, totalXp)
    }
  },

  async fetchRawProfile(userId: string): Promise<Profile> {
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

    const ledger = await this.fetchXpLedger()

    if (period === 'all_time') {
      return (profiles as Profile[])
        .map((profile) => {
          const score = ledger.allTimeXpByUser.get(profile.id) || 0
          return {
            ...profile,
            total_xp: score,
            lifetime_xp: Math.max(profile.lifetime_xp || 0, score),
            score,
            rank: 0,
            period
          }
        })
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
    }

    return (profiles as Profile[])
      .map((profile) => {
        const allTimeScore = ledger.allTimeXpByUser.get(profile.id) || 0
        const rawSeasonScore = ledger.seasonXpByUser.get(profile.id) || 0
        const score = Math.min(rawSeasonScore, allTimeScore)
        return {
          ...profile,
          total_xp: allTimeScore,
          lifetime_xp: Math.max(profile.lifetime_xp || 0, allTimeScore),
          score,
          rank: 0,
          period
        }
      })
      .sort((a, b) => (b.score - a.score) || ((ledger.allTimeXpByUser.get(b.id) || 0) - (ledger.allTimeXpByUser.get(a.id) || 0)))
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
          await this.reconcileProfileXp(userId)
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
          await this.reconcileProfileXp(userId)
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
    const members = rows.flatMap((row) => {
      if (!row.profiles) return []
      return Array.isArray(row.profiles) ? row.profiles : [row.profiles]
    })
    const ledger = await this.fetchXpLedger()
    return members.map((member) => ({
      ...member,
      total_xp: ledger.allTimeXpByUser.get(member.id) || 0,
      lifetime_xp: Math.max(member.lifetime_xp || 0, ledger.allTimeXpByUser.get(member.id) || 0)
    }))
  },

  async fetchMemberVitals(groupId: string, date?: string): Promise<MemberVital[]> {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .rpc('get_pod_member_vitals', { target_group_id: groupId, target_date: targetDate })
    if (error) throw error
    const ledger = await this.fetchXpLedger()
    return (data as MemberVital[]).map((member) => ({
      ...member,
      total_xp: ledger.allTimeXpByUser.get(member.id) || 0
    }))
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
