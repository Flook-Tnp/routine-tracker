import { supabase } from './supabase'
import type { Routine, RoutineCompletion, Task, Profile, Post, Group, Comment, Reaction } from '../types'

export const StorageService = {
  async fetchRoutines(): Promise<Routine[]> {
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('is_active', true)
    if (error) throw error
    return data as Routine[]
  },

  async fetchCompletions(): Promise<RoutineCompletion[]> {
    let allCompletions: RoutineCompletion[] = []
    let from = 0
    let to = 999
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('routine_completions')
        .select('*')
        .order('completed_date', { ascending: true })
        .range(from, to)
      
      if (error) throw error

      if (data && data.length > 0) {
        allCompletions = [...allCompletions, ...(data as RoutineCompletion[])]
        if (data.length < 1000) {
          hasMore = false
        } else {
          from += 1000
          to += 1000
        }
      } else {
        hasMore = false
      }
      
      if (from > 1000000) break 
    }
    return allCompletions
  },

  async fetchTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Task[]
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
        const { error: rpcErr } = await supabase.rpc('decrement_xp', { amount: xpEarned, user_id: userId })
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
        const { error: rpcErr } = await supabase.rpc('increment_xp', { amount: xpEarned, user_id: userId })
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

  async fetchLeaderboard(): Promise<Partial<Profile>[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, total_xp, badges')
      .order('total_xp', { ascending: false })
      .limit(10)
    if (error) throw error
    return data
  },

  async fetchPosts(): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles (username),
        comments (*, profiles (username)),
        reactions (*)
      `)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Post[]
  },

  async createPost(content: string, userId: string, type: string = 'manual', metadata: any = {}): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .insert([{ content, user_id: userId, type, metadata }])
      .select()
    if (error) throw error
    return data[0] as Post
  },

  async addComment(postId: string, content: string, userId: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert([{ post_id: postId, content, user_id: userId }])
      .select()
    if (error) throw error
    return data[0] as Comment
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
        group_members (user_id)
      `)
    if (error) throw error
    return data as Group[]
  },

  async createGroup(name: string, description: string, userId: string): Promise<Group> {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert([{ name, description, created_by: userId }])
      .select()
      .single()
    if (groupError) throw groupError

    // Automatically join the group
    await this.joinGroup(group.id, userId)
    return group as Group
  },

  async joinGroup(groupId: string, userId: string): Promise<{ user_id: string; group_id: string }> {
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
  }
}
