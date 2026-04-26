import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, UserPlus, LogOut, ArrowRight, Trash2, ChevronLeft, Bell, Activity, Check, Flame } from 'lucide-react'
import type { Group, MemberVital, GroupTask, GroupTaskCompletion } from '../types'
import type { Session } from '@supabase/supabase-js'
import { SocialFeed } from './SocialFeed'

interface AccountabilityPodsProps {
  session: Session | null
  onShareStreak: () => void
  dailyStreak: number
  onSelectUser?: (userId: string) => void
  selectedPod: Group | null
  onSelectPod: (pod: Group | null) => void
}

export function AccountabilityPods({ session, onShareStreak, dailyStreak, onSelectUser, selectedPod, onSelectPod }: AccountabilityPodsProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [podMembers, setPodMembers] = useState<MemberVital[]>([])
  const [groupTasks, setGroupTasks] = useState<GroupTask[]>([])
  const [groupCompletions, setGroupCompletions] = useState<GroupTaskCompletion[]>([])
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const fetchGroupData = useCallback(async (groupId: string) => {
    try {
      setLoading(true)
      const date = new Date().toISOString().split('T')[0]

      // Parallel fetching with individual error handling
      const [vitalsResult, tasksResult, completionsResult, groupsResult] = await Promise.allSettled([
        StorageService.fetchMemberVitals(groupId),
        StorageService.fetchGroupTasks(groupId),
        StorageService.fetchGroupTaskCompletions(groupId, date),
        StorageService.fetchGroups() // Refresh group data to get latest streak from DB
      ])

      if (vitalsResult.status === 'fulfilled' && vitalsResult.value.length > 0) {
        setPodMembers(vitalsResult.value)
      } else {
        // FALLBACK: If vitals fail or are empty, fetch basic profiles so the list isn't empty
        console.warn('Vitals failed or empty, using fallback member fetch')
        const basicMembers = await StorageService.fetchPodMembers(groupId)
        setPodMembers(basicMembers.map(m => ({
          id: m.id,
          username: m.username,
          avatar_url: m.avatar_url || null,
          total_xp: m.total_xp,
          routines_total: 0,
          routines_completed_today: 0,
          last_activity_date: null
        })))
      }

      if (tasksResult.status === 'fulfilled') setGroupTasks(tasksResult.value)
      if (completionsResult.status === 'fulfilled') setGroupCompletions(completionsResult.value)
      
      // Update selectedPod in parent if we found it in the refreshed list
      if (groupsResult.status === 'fulfilled') {
        const refreshedPod = groupsResult.value.find(g => g.id === groupId)
        if (refreshedPod) {
          onSelectPod(refreshedPod)
        }
      }

    } catch (err) {
      console.error('Group data sync failed:', err)
    } finally {
      setLoading(false)
    }
  }, [onSelectPod])

  const fetchGroups = useCallback(async () => {
    try {
      const data = await StorageService.fetchGroups()
      setGroups(data)
    } catch (err) {
      console.error('Error fetching groups:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (mounted) {
      if (selectedPod) {
        fetchGroupData(selectedPod.id)
      } else {
        fetchGroups()
      }
    }
    return () => { mounted = false }
  }, [fetchGroups, fetchGroupData, selectedPod])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPod || !newTaskTitle.trim()) return
    try {
      const newTask = await StorageService.createGroupTask(selectedPod.id, newTaskTitle)
      setGroupTasks([...groupTasks, newTask])
      setNewTaskTitle('')
      setIsAddingTask(false)
    } catch (err) {
      console.error('Failed to add task:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('TERMINATE_OBJECTIVE: Are you sure?')) return
    try {
      await StorageService.deleteGroupTask(taskId)
      setGroupTasks(groupTasks.filter(t => t.id !== taskId))
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleToggleTask = async (taskId: string) => {
    if (!session?.user?.id || !selectedPod) return
    
    const date = new Date().toISOString().split('T')[0]
    const isDone = groupCompletions.some(c => c.task_id === taskId && c.user_id === session.user.id)
    
    // OPTIMISTIC UPDATE: Update UI immediately
    if (isDone) {
      setGroupCompletions(prev => prev.filter(c => !(c.task_id === taskId && c.user_id === session.user.id)))
    } else {
      const tempCompletion: GroupTaskCompletion = { 
        id: 'temp-' + Math.random(), 
        task_id: taskId, 
        user_id: session.user.id, 
        completed_date: date 
      }
      setGroupCompletions(prev => [...prev, tempCompletion])
    }

    try {
      await StorageService.toggleGroupTask(taskId, session.user.id, date)
      
      // BACKGROUND SYNC: Get actual server state
      const [newCompletions, newVitals] = await Promise.all([
        StorageService.fetchGroupTaskCompletions(selectedPod.id, date),
        StorageService.fetchMemberVitals(selectedPod.id)
      ])
      setGroupCompletions(newCompletions)
      setPodMembers(newVitals)
    } catch (err) {
      console.error('Failed to toggle task:', err)
      // Rollback on error by re-fetching
      fetchGroupData(selectedPod.id)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !session) return
    try {
      await StorageService.createGroup(newName, newDesc, session.user.id)
      setNewName('')
      setNewDesc('')
      setIsCreating(false)
      fetchGroups()
    } catch (err: any) {
      console.error('Error creating group:', err)
      alert(`POD_INITIALIZATION_FAILURE: ${err.message || 'Check if groups table exists'}`)
    }
  }

  const handleJoin = async (groupId: string) => {
    if (!session) return
    try {
      await StorageService.joinGroup(groupId, session.user.id)
      fetchGroups()
    } catch (err) {
      console.error('Error joining group:', err)
    }
  }

  const handleLeave = async (groupId: string) => {
    if (!session) return
    try {
      await StorageService.leaveGroup(groupId, session.user.id)
      fetchGroups()
    } catch (err) {
      console.error('Error leaving group:', err)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!session || !window.confirm('DELETE_POD: Are you sure? All data will be lost.')) return
    try {
      await StorageService.deleteGroup(groupId)
      fetchGroups()
    } catch (err) {
      console.error('Error deleting group:', err)
      alert('DELETE_FAILURE: Protocol could not be terminated.')
    }
  }

  const handlePing = async (userId: string, username: string) => {
    if (!selectedPod) return
    try {
      const result = await StorageService.pingUser(userId, selectedPod.id)
      if (result.success) {
        alert(`TRANSMISSION_SUCCESS: Nudge sent to ${username}.`)
      } else {
        const timeStr = result.next_available ? new Date(result.next_available).toLocaleTimeString() : 'later'
        alert(`COOLDOWN_ACTIVE: ${result.message}. Try again after ${timeStr}.`)
      }
    } catch (err: any) {
      console.error('Ping failed:', err)
      alert(`LINK_ERROR: ${err.message}`)
    }
  }

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-500">Synchronizing_Pod_Network...</div>

  if (selectedPod) {
    const activeMembersCount = podMembers.filter(m => m.routines_completed_today > 0).length
    const avgProgress = podMembers.length > 0 ? (activeMembersCount / podMembers.length) : 0

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 pb-20 pt-4">
        <button 
          onClick={() => onSelectPod(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft size={14} /> Back_to_Network
        </button>

        <section className="bg-gray-950 border border-gray-900 p-8 space-y-8 relative overflow-hidden">
          {/* Enhanced Synergy Meter */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900/50">
            <div 
              className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-1000 relative" 
              style={{ width: `${avgProgress * 100}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>

          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedPod.name}</h2>
                <div className="flex gap-2">
                  <div className="px-2 py-0.5 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-widest animate-pulse">
                    Synergy: {Math.round(avgProgress * 100)}%
                  </div>
                  {(podMembers[0]?.pod_current_streak !== undefined || selectedPod.current_streak !== undefined) && (
                    <div className="px-2 py-0.5 border border-orange-500/30 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Flame size={8} fill="currentColor" />
                      Squad_Streak: {podMembers[0]?.pod_current_streak ?? selectedPod.current_streak ?? 0}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Protocol_Established</p>
              <p className="text-[10px] text-cyan-500 font-mono">{new Date(selectedPod.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Column: Mission Objectives (Primary Focus) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                  <Activity size={12} className="text-cyan-500" /> Mission_Objectives
                </h3>
                {(podMembers[0]?.pod_current_streak !== undefined || selectedPod.current_streak !== undefined) && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border border-orange-500/30 bg-orange-500/5 text-orange-500 text-[8px] font-black uppercase tracking-widest">
                    <Flame size={10} fill="currentColor" className="animate-pulse" />
                    Collective_Streak: {podMembers[0]?.pod_current_streak ?? selectedPod.current_streak ?? 0}
                  </div>
                )}
              </div>

              <div className="bg-gray-900/20 border border-gray-900 p-6 space-y-6">
                {selectedPod.created_by === session?.user?.id && (
                  <div className="border-b border-gray-800 pb-6">
                    {isAddingTask ? (
                      <form onSubmit={handleAddTask} className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="ENTER_NEW_MISSION_PROTOCOL..."
                          className="flex-1 bg-black border border-gray-800 px-4 py-2 text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500"
                        />
                        <button type="submit" className="px-4 bg-cyan-500 text-black text-[10px] font-black uppercase hover:bg-white transition-all">
                          Establish
                        </button>
                        <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 bg-gray-800 text-gray-400 text-[10px] font-black uppercase hover:text-white transition-all">
                          Abort
                        </button>
                      </form>
                    ) : (
                      <button 
                        onClick={() => setIsAddingTask(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-800 text-[9px] font-black uppercase text-gray-600 hover:text-cyan-500 hover:border-cyan-500/50 transition-all bg-black/20"
                      >
                        <Plus size={12} /> Add_Mission_Protocol
                      </button>
                    )}
                  </div>
                )}

                <div className="grid gap-3">
                  {groupTasks.length > 0 ? (
                    groupTasks.map((task) => {
                      const isDone = groupCompletions.some(c => c.task_id === task.id && c.user_id === session?.user?.id)
                      return (
                        <div key={task.id} className={`flex items-center justify-between group/task p-4 border transition-all ${isDone ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-black/40 border-gray-900 hover:border-gray-800'}`}>
                          <button 
                            onClick={() => handleToggleTask(task.id)}
                            className="flex-1 flex items-center gap-4 text-left"
                          >
                            <div className={`w-6 h-6 border-2 transition-all flex items-center justify-center ${isDone ? 'bg-cyan-500 border-cyan-500' : 'border-gray-800 bg-black group-hover/task:border-gray-600'}`}>
                              {isDone && <Check size={14} className="text-black stroke-[4px]" />}
                            </div>
                            <div>
                              <span className={`text-xs font-black uppercase tracking-tight transition-all ${isDone ? 'text-cyan-400 line-through opacity-50' : 'text-gray-200'}`}>
                                {task.title}
                              </span>
                              {isDone && <p className="text-[7px] text-cyan-700 font-bold uppercase mt-0.5">Objective_Secured</p>}
                            </div>
                          </button>
                          {selectedPod.created_by === session?.user?.id && (
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-2 text-gray-800 hover:text-red-500 transition-colors opacity-0 group-hover/task:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-20 text-center border border-dashed border-gray-900 bg-black/10">
                      <p className="text-[10px] text-gray-700 uppercase font-black tracking-[0.2em]">No Mission Protocols Detected</p>
                      <p className="text-[8px] text-gray-800 uppercase font-bold mt-1 italic">Waiting for command from creator...</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                    <Users size={12} className="text-gray-500" /> Pod_Pulse
                  </h3>
                  {(podMembers[0]?.pod_current_streak !== undefined || selectedPod.current_streak !== undefined) && (
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 animate-in slide-in-from-right-4 duration-500">
                      <Flame size={14} fill="currentColor" className="animate-pulse" />
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black uppercase tracking-tighter">Squad_Streak</span>
                        <span className="text-[8px] font-bold opacity-80 uppercase tracking-widest">{podMembers[0]?.pod_current_streak ?? selectedPod.current_streak ?? 0} Days_Active</span>
                      </div>
                    </div>
                  )}
                </div>
                <SocialFeed 
                  session={session} 
                  groupId={selectedPod.id} 
                  dailyStreak={dailyStreak} 
                  onShareStreak={onShareStreak} 
                  onSelectUser={onSelectUser}
                />
              </div>
            </div>

            {/* Right Column: Squad Vitals (Sidebar) */}
            <div className="space-y-6">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                <Activity size={12} className="text-cyan-500" /> Neural_Vitals
              </h3>
              
              <div className="space-y-3">
                {podMembers.length > 0 ? (
                  podMembers.sort((a,b) => (b.total_xp || 0) - (a.total_xp || 0)).map((member) => {
                    const isMe = member.id === session?.user?.id
                    
                    const isStable = member.routines_completed_today > 0
                    const isCritical = !isStable && new Date().getHours() >= 20 
                    const isDegrading = !isStable && !isCritical && new Date().getHours() >= 14 
                    
                    let statusLabel = 'OFFLINE'
                    let statusColor = 'text-gray-600'
                    let borderColor = 'border-gray-900'

                    if (isStable) {
                      statusLabel = 'SYNCED'
                      statusColor = 'text-cyan-500'
                      borderColor = 'border-cyan-500/20'
                    } else if (isCritical) {
                      statusLabel = 'CRITICAL'
                      statusColor = 'text-red-500'
                      borderColor = 'border-red-900/50'
                    } else if (isDegrading) {
                      statusLabel = 'DEGRADING'
                      statusColor = 'text-orange-500'
                      borderColor = 'border-orange-900/30'
                    }

                    return (
                      <div 
                        key={member.id} 
                        className={`bg-black/60 border ${borderColor} p-3 space-y-3 transition-all relative group/card`}
                      >
                        <div className="flex justify-between items-center">
                          <div 
                            className={`flex items-center gap-2 ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
                            onClick={() => !isMe && onSelectUser?.(member.id)}
                          >
                            <div className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-gray-600">{member.username?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-tighter ${isMe ? 'text-white' : 'text-gray-400 group-hover/card:text-cyan-400'}`}>
                                {member.username}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1 h-1 rounded-full ${statusColor.replace('text-', 'bg-')} ${!isStable && 'animate-pulse'}`} />
                                <p className={`text-[6px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</p>
                              </div>
                            </div>
                          </div>
                          
                          {!isMe && session && !isStable && (
                            <button
                              onClick={() => handlePing(member.id, member.username)}
                              className={`p-1.5 border ${isCritical ? 'border-red-500/30 text-red-500' : 'border-gray-800 text-gray-700'} hover:bg-white hover:text-black transition-all`}
                            >
                              <Bell size={10} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[6px] font-bold uppercase tracking-widest text-gray-700">
                            <span>Mission_Progress</span>
                            <span>{member.routines_completed_today}/{member.routines_total}</span>
                          </div>
                          <div className="h-0.5 bg-gray-900 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-700 ${isStable ? 'bg-cyan-500' : 'bg-gray-800'}`}
                              style={{ width: `${(member.routines_completed_today / Math.max(member.routines_total, 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Accountability_Pods</h2>
          <p className="text-[8px] text-gray-600 uppercase tracking-widest">Protocol: Collective Reinforcement</p>
        </div>
        {session && (
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-3 py-1 border border-cyan-500/30 text-cyan-400 text-[8px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all"
          >
            <Plus size={12} />
            Initialize_Pod
          </button>
        )}
      </section>

      {isCreating && (
        <form onSubmit={handleCreateGroup} className="bg-gray-950 border border-cyan-500/30 p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] uppercase text-gray-600 font-bold">Pod_Name</label>
            <input 
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., NEURAL_LEARNERS_01"
              className="w-full bg-black border border-gray-900 px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase text-gray-600 font-bold">Objective_Description</label>
            <textarea 
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Define the collective mission..."
              className="w-full bg-black border border-gray-900 px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 h-20 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-white text-black py-2 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-white transition-all">
              Establish_Pod
            </button>
            <button type="button" onClick={() => setIsCreating(false)} className="px-6 bg-gray-900 text-gray-500 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 hover:text-white transition-all">
              Abort
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some((m: { user_id: string }) => m.user_id === session?.user?.id)
          return (
            <div key={group.id} className="bg-gray-950 border border-gray-900 p-6 flex flex-col justify-between space-y-4 hover:border-gray-700 transition-all group">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-gray-900 border border-gray-800 text-cyan-500">
                    <Users size={16} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-gray-700 font-mono">[{group.group_members?.length || 0}] Members</span>
                    {group.created_by === session?.user?.id && (
                      <button 
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-gray-800 hover:text-red-500 transition-colors"
                        title="Terminate Pod"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight">{group.name}</h3>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed line-clamp-2">{group.description}</p>
              </div>

              <div className="pt-4 border-t border-gray-900/50 flex justify-between items-center">
                {isMember ? (
                  <>
                    <button 
                      onClick={() => onSelectPod(group)}
                      className="flex items-center gap-2 text-cyan-400 text-[8px] font-black uppercase tracking-widest hover:text-cyan-300"
                    >
                      Access_Pod <ArrowRight size={10} />
                    </button>
                    <button 
                      onClick={() => handleLeave(group.id)}
                      className="text-gray-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <LogOut size={12} />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleJoin(group.id)}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-gray-900 text-gray-400 text-[8px] font-black uppercase tracking-widest border border-gray-800 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
                  >
                    <UserPlus size={12} />
                    Join_Pod
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
