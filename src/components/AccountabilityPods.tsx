import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, UserPlus, LogOut, ArrowRight, Trash2, ChevronLeft, Bell, Activity, Check, Flame } from 'lucide-react'
import { SocialFeed } from './SocialFeed'
import type { Group, MemberVital, GroupTask, GroupTaskCompletion } from '../types'
import type { Session } from '@supabase/supabase-js'

interface PodsProps {
  session: Session | null
  onShareStreak: () => void
  dailyStreak: number
  onSelectUser?: (userId: string) => void
  selectedPod: Group | null
  onSelectPod: (pod: Group | null) => void
}

export function AccountabilityPods({ session, onShareStreak, dailyStreak, onSelectUser, selectedPod, onSelectPod }: PodsProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [podMembers, setPodMembers] = useState<MemberVital[]>([])
  const [groupTasks, setGroupTasks] = useState<GroupTask[]>([])
  const [groupCompletions, setGroupCompletions] = useState<GroupTaskCompletion[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const fetchGroups = useCallback(async () => {
    try {
      const data = await StorageService.fetchGroups()
      setGroups(data)
    } catch (err) {
      console.error('Failed to fetch pods:', err)
    } finally {
      if (!selectedPod) setLoading(false)
    }
  }, [selectedPod])

  const fetchGroupData = useCallback(async (groupId: string) => {
    try {
      setLoading(true)
      const date = new Date().toISOString().split('T')[0]

      // Parallel fetching with individual error handling
      const [vitalsResult, tasksResult, completionsResult] = await Promise.allSettled([
        StorageService.fetchMemberVitals(groupId),
        StorageService.fetchGroupTasks(groupId),
        StorageService.fetchGroupTaskCompletions(groupId, date)
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
          group_tasks_total: 0,
          group_tasks_completed: 0,
          last_activity_date: null
        })))
      }

      if (tasksResult.status === 'fulfilled') setGroupTasks(tasksResult.value)
      if (completionsResult.status === 'fulfilled') setGroupCompletions(completionsResult.value)

    } catch (err) {
      console.error('Group data sync failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    if (selectedPod) {
      fetchGroupData(selectedPod.id)
    }
  }, [selectedPod, fetchGroupData])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !session) return

    try {
      const pod = await StorageService.createGroup(newName, newDescription, session.user.id)
      setGroups([...groups, pod])
      setNewName('')
      setNewDescription('')
      setIsCreating(false)
      onSelectPod(pod)
    } catch (err) {
      console.error('Pod initialization failed:', err)
      alert('PROTOCOL_ERROR: Failed to establish new pod.')
    }
  }

  const handleJoinGroup = async (groupId: string) => {
    if (!session) return
    try {
      await StorageService.joinGroup(groupId, session.user.id)
      fetchGroups()
      const pod = groups.find(g => g.id === groupId)
      if (pod) onSelectPod(pod)
    } catch (err) {
      console.error('Join protocol failed:', err)
    }
  }

  const handleLeaveGroup = async (groupId: string) => {
    if (!session || !window.confirm('LEAVE_POD: Are you sure? Your progress in this pod will be terminated.')) return
    try {
      await StorageService.leaveGroup(groupId, session.user.id)
      onSelectPod(null)
      fetchGroups()
    } catch (err) {
      console.error('Leave protocol failed:', err)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!session || !window.confirm('TERMINATE_POD: This action is permanent and will delete all pod history.')) return
    try {
      await StorageService.deleteGroup(groupId)
      onSelectPod(null)
      fetchGroups()
    } catch (err) {
      console.error('Termination failed:', err)
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !selectedPod) return
    try {
      const task = await StorageService.createGroupTask(selectedPod.id, newTaskTitle)
      setGroupTasks([...groupTasks, task])
      setNewTaskTitle('')
      setIsAddingTask(false)
    } catch (err) {
      console.error('Failed to add mission protocol:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('DELETE_MISSION: Are you sure?')) return
    try {
      await StorageService.deleteGroupTask(taskId)
      setGroupTasks(groupTasks.filter(t => t.id !== taskId))
    } catch (err) {
      console.error('Failed to delete mission protocol:', err)
    }
  }

  const handleToggleTask = async (taskId: string) => {
    if (!session || !selectedPod) return
    const date = new Date().toISOString().split('T')[0]
    try {
      await StorageService.toggleGroupTask(taskId, session.user.id, date)
      
      // Update local state
      const existing = groupCompletions.find(c => c.task_id === taskId && c.user_id === session.user.id)
      if (existing) {
        setGroupCompletions(groupCompletions.filter(c => c.id !== existing.id))
      } else {
        setGroupCompletions([...groupCompletions, { id: Math.random().toString(), task_id: taskId, user_id: session.user.id, completed_date: date }])
      }
      
      // Refresh vitals after a short delay
      setTimeout(() => fetchGroupData(selectedPod.id), 500)
    } catch (err) {
      console.error('Task synchronization failed:', err)
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
    const totalGroupTasks = podMembers.length > 0 ? podMembers[0].group_tasks_total : 0
    const totalGroupCompletions = podMembers.reduce((acc, m) => acc + m.group_tasks_completed, 0)
    const maxPossibleCompletions = podMembers.length * Math.max(totalGroupTasks, 1)
    const avgProgress = maxPossibleCompletions > 0 ? (totalGroupCompletions / maxPossibleCompletions) : 0

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
                  <div className="px-2 py-0.5 border border-orange-500/30 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Flame size={8} fill="currentColor" />
                    Squad_Streak: {podMembers[0]?.pod_current_streak ?? selectedPod.current_streak ?? 0}
                  </div>
                </div>              </div>
              <p className="text-xs text-gray-500 font-mono leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div>
                <p className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Protocol_Established</p>
                <p className="text-[10px] text-cyan-500 font-mono">{new Date(selectedPod.created_at).toLocaleDateString()}</p>
              </div>
              {selectedPod.created_by === session?.user?.id ? (
                <button 
                  onClick={() => handleDeleteGroup(selectedPod.id)}
                  className="flex items-center gap-1 text-[8px] font-black text-red-900 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  <Trash2 size={10} /> Terminate_Pod
                </button>
              ) : (
                <button 
                  onClick={() => handleLeaveGroup(selectedPod.id)}
                  className="flex items-center gap-1 text-[8px] font-black text-gray-700 hover:text-white transition-colors uppercase tracking-widest"
                >
                  <LogOut size={10} /> Leave_Pod
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Column: Mission Objectives (Primary Focus) */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                  <Activity size={12} className="text-cyan-500" /> Mission_Objectives
                </h3>
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
                            onClick={() => !isMe && member.id && onSelectUser?.(member.id)}
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
                              <div className="flex items-center gap-2">
                                <span className="text-[6px] font-bold text-cyan-700 uppercase tracking-widest">{member.total_xp} XP</span>
                                <div className="w-1 h-1 rounded-full bg-gray-800" />
                                <div className="flex items-center gap-1">
                                  <div className={`w-1 h-1 rounded-full ${statusColor.replace('text-', 'bg-')} ${!isStable && 'animate-pulse'}`} />
                                  <p className={`text-[6px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</p>
                                </div>
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
                            <span>Mission_Sync</span>
                            <span>{member.group_tasks_completed}/{member.group_tasks_total}</span>
                          </div>
                          <div className="h-0.5 bg-gray-900 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-700 ${member.group_tasks_completed > 0 ? 'bg-cyan-500' : 'bg-gray-800'}`}
                              style={{ width: `${(member.group_tasks_completed / Math.max(member.group_tasks_total, 1)) * 100}%` }}
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
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Define the pod's core protocols and objectives..."
              className="w-full bg-black border border-gray-900 px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 h-24 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="submit"
              className="flex-1 bg-cyan-500 text-black py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all"
            >
              Initialize_Pod
            </button>
            <button 
              type="button"
              onClick={() => setIsCreating(false)}
              className="flex-1 bg-gray-900 text-gray-500 py-2 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
            >
              Abort_Protocol
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some(m => m.user_id === session?.user?.id)
          const memberCount = group.group_members?.length || 0
          
          return (
            <div 
              key={group.id} 
              className="bg-gray-950/50 border border-gray-900 p-6 space-y-4 hover:border-gray-800 transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest flex items-center gap-1">
                      <Users size={10} /> {memberCount} Members
                    </span>
                    {group.current_streak && group.current_streak > 0 ? (
                      <span className="text-[8px] text-orange-500 uppercase font-black tracking-widest flex items-center gap-1">
                        <Flame size={10} fill="currentColor" /> {group.current_streak} Day_Streak
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-gray-500 font-mono leading-relaxed line-clamp-2 min-h-[30px]">
                {group.description}
              </p>

              <div className="pt-2">
                {isMember ? (
                  <button 
                    onClick={() => onSelectPod(group)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-gray-900 text-cyan-400 border border-gray-800 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black hover:border-cyan-500 transition-all"
                  >
                    Enter_Dashboard <ArrowRight size={12} />
                  </button>
                ) : (
                  <button 
                    onClick={() => handleJoinGroup(group.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all"
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
