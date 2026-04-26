import { supabase } from './supabase'
import type { Routine, RoutineCompletion, Task, Profile, Post, Group, Comment, Reaction } from '../types'

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
    let allCompletions: RoutineCompletion[] = []
    let from = 0
    let to = 999
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('routine_completions')
        .select('*')
        .eq('user_id', userId)
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

  async fetchTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
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

  async fetchLeaderboard(): Promise<Partial<Profile>[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, total_xp, lifetime_xp, avatar_url, badges')
      .order('total_xp', { ascending: false })
      .limit(10)
    if (error) throw error
    return data
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
        reactions (*)
      `)
      .order('created_at', { ascending: false })
    
    if (groupId) {
      query = query.eq('group_id', groupId)
    } else {
      query = query.is('group_id', null)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Post[]
  },

  async createPost(content: string, userId: string, type: string = 'manual', metadata: any = {}, groupId?: string): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .insert([{ content, user_id: userId, type, metadata, group_id: groupId }])
      .select()
    if (error) throw error
    return data[0] as Post
  },

  async fetchPodMembers(groupId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        profiles!group_members_user_id_fkey (*)
      `)
      .eq('group_id', groupId)
    
    if (error) {
      // Fallback for different join syntax or if FK is named differently
      const { data: retryData, error: retryError } = await supabase
        .from('group_members')
        .select(`
          profiles (*)
        `)
        .eq('group_id', groupId)
      
      if (retryError) throw retryError
      return (retryData?.map((d: any) => d.profiles).filter(Boolean) || []) as Profile[]
    }
    
    return (data?.map((d: any) => d.profiles).filter(Boolean) || []) as Profile[]
  },

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .delete()
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
  },

  async pingUser(targetUserId: string): Promise<{ success: boolean; message: string; next_available?: string }> {
    const { data, error } = await supabase
      .rpc('ping_user', { target_user_id: targetUserId })
    
    if (error) throw error
    return data
  },

  async fetchNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Notification[]
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) throw error
  }
}
