import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, Trash2, ChevronLeft, Bell, Activity, Check, Flame } from 'lucide-react'
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
  selectedDateStr: string
}

export function AccountabilityPods({ session, onShareStreak, dailyStreak, onSelectUser, selectedPod, onSelectPod, selectedDateStr }: PodsProps) {
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

  const fetchGroupData = useCallback(async (groupId: string, date: string) => {
    try {
      setLoading(true)

      const [vitalsResult, tasksResult, completionsResult] = await Promise.allSettled([
        StorageService.fetchMemberVitals(groupId, date),
        StorageService.fetchGroupTasks(groupId),
        StorageService.fetchGroupTaskCompletions(groupId, date)
      ])

      if (vitalsResult.status === 'fulfilled' && vitalsResult.value.length > 0) {
        setPodMembers(vitalsResult.value)
      } else {
        console.warn('Vitals failed, using fallback')
        if (vitalsResult.status === 'rejected') console.error(vitalsResult.reason)
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
      fetchGroupData(selectedPod.id, selectedDateStr)
    }
  }, [selectedPod, selectedDateStr, fetchGroupData])

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
    if (!session || !window.confirm('LEAVE_POD?')) return
    try {
      await StorageService.leaveGroup(groupId, session.user.id)
      onSelectPod(null)
      fetchGroups()
    } catch (err) {
      console.error('Leave protocol failed:', err)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!session || !window.confirm('TERMINATE_POD?')) return
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
      fetchGroupData(selectedPod.id, selectedDateStr)
    } catch (err) {
      console.error('Failed to add mission:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('DELETE_MISSION?')) return
    try {
      await StorageService.deleteGroupTask(taskId)
      setGroupTasks(groupTasks.filter(t => t.id !== taskId))
      if (selectedPod) fetchGroupData(selectedPod.id, selectedDateStr)
    } catch (err) {
      console.error('Failed to delete mission:', err)
    }
  }

  const handleToggleTask = async (taskId: string) => {
    if (!session || !selectedPod) return
    
    // 1. Optimistic Update for Checkbox
    const existing = groupCompletions.find(c => c.task_id === taskId && c.user_id === session.user.id)
    const oldCompletions = [...groupCompletions]
    const oldVitals = [...podMembers]

    if (existing) {
      setGroupCompletions(groupCompletions.filter(c => c.id !== existing.id))
      // Optimistically update vitals count
      setPodMembers(podMembers.map(m => m.id === session.user.id ? { ...m, group_tasks_completed: Math.max(0, m.group_tasks_completed - 1) } : m))
    } else {
      const tempId = crypto.randomUUID()
      setGroupCompletions([...groupCompletions, { id: tempId, task_id: taskId, user_id: session.user.id, completed_date: selectedDateStr }])
      // Optimistically update vitals count
      setPodMembers(podMembers.map(m => m.id === session.user.id ? { ...m, group_tasks_completed: m.group_tasks_completed + 1 } : m))
    }

    try {
      await StorageService.toggleGroupTask(taskId, session.user.id, selectedDateStr)
      // Silently refresh data in background without showing loading state
      StorageService.fetchMemberVitals(selectedPod.id, selectedDateStr).then(vitals => {
        if (vitals && vitals.length > 0) setPodMembers(vitals)
      }).catch(console.error)
      
      StorageService.fetchGroupTaskCompletions(selectedPod.id, selectedDateStr).then(setGroupCompletions).catch(console.error)
    } catch (err) {
      console.error('Task synchronization failed:', err)
      // Rollback on error
      setGroupCompletions(oldCompletions)
      setPodMembers(oldVitals)
      alert('SYNCHRONIZATION_ERROR: Please check your connection.')
    }
  }

  const handlePing = async (userId: string, username: string) => {
    if (!selectedPod) return
    try {
      const result = await StorageService.pingUser(userId, selectedPod.id)
      if (result.success) alert(`Ping sent to ${username}.`)
      else alert(result.message)
    } catch (err: any) {
      console.error('Ping failed:', err)
    }
  }

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-500 font-mono">Synchronizing...</div>

  if (selectedPod) {
    return (
      <div className="space-y-6 view-enter pb-20 pt-2 font-mono">
        <button 
          onClick={() => onSelectPod(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-2 active:scale-95 px-1"
        >
          <ChevronLeft size={16} /> Back_to_Network
        </button>

        <section className="bg-gray-950 border border-gray-900 p-5 md:p-8 space-y-6 md:space-y-8 relative">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">{selectedPod.name}</h2>
                <div className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                  <Flame size={14} fill="currentColor" />
                  Squad_Streak: {podMembers[0]?.pod_current_streak ?? 0}
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="w-full md:w-auto text-left md:text-right flex flex-col md:items-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-gray-900 md:border-none">
              <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Protocol_Established {new Date(selectedPod.created_at).toLocaleDateString()}</p>
              {selectedPod.created_by === session?.user?.id ? (
                <button onClick={() => handleDeleteGroup(selectedPod.id)} className="text-[10px] font-black text-red-900 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 active:scale-95">
                  <Trash2 size={14} /> Terminate_Pod
                </button>
              ) : (
                <button onClick={() => handleLeaveGroup(selectedPod.id)} className="text-[10px] font-black text-gray-700 hover:text-white uppercase tracking-widest active:scale-95">
                  Leave_Pod
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black flex items-center gap-2">
                  <Activity size={14} className="text-cyan-500" /> Mission_Objectives
                </h3>

                <div className="bg-gray-900/10 border border-gray-900 p-4 md:p-6 space-y-6">
                  {selectedPod.created_by === session?.user?.id && (
                    <div className="border-b border-gray-800 pb-6">
                      {isAddingTask ? (
                        <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-3">
                          <input
                            autoFocus
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="ENTER_NEW_MISSION..."
                            className="flex-1 input-primary text-sm py-3"
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 btn-primary py-3">Establish</button>
                            <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 bg-gray-800 text-gray-400 text-[10px] font-black uppercase hover:text-white transition-all active:scale-95">Abort</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => setIsAddingTask(true)} className="w-full py-4 border border-dashed border-gray-800 text-[10px] font-black uppercase text-gray-600 hover:text-cyan-500 hover:border-cyan-500/30 transition-all bg-black/20 flex items-center justify-center gap-2 active:scale-[0.98]">
                          <Plus size={14} /> Add_Mission_Protocol
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3">
                    {groupTasks.map((task) => {
                      const isDone = groupCompletions.some(c => c.task_id === task.id && c.user_id === session?.user?.id)
                      return (
                        <div key={task.id} className={`flex items-center justify-between group/task p-4 md:p-5 border transition-all ${isDone ? 'bg-cyan-500/5 border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]' : 'bg-black/40 border-gray-900 hover:border-gray-700'}`}>
                          <button onClick={() => handleToggleTask(task.id)} className="flex-1 flex items-center gap-4 text-left">
                            <div className={`w-7 h-7 md:w-6 md:h-6 border-2 transition-all flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-cyan-500 border-cyan-500' : 'border-gray-800 bg-black'}`}>
                              {isDone && <Check size={16} className="text-black stroke-[4px]" />}
                            </div>
                            <span className={`text-sm md:text-xs font-black uppercase tracking-tight ${isDone ? 'text-cyan-400 opacity-50 line-through' : 'text-gray-200'}`}>
                              {task.title}
                            </span>
                          </button>
                          {selectedPod.created_by === session?.user?.id && (
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-gray-800 hover:text-red-500 md:opacity-0 group-hover/task:opacity-100 transition-all active:scale-90">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {groupTasks.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-gray-900 rounded">
                        <p className="text-[10px] text-gray-700 uppercase font-black tracking-widest">NO_MISSIONS_ASSIGNED</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black mb-6">Pod_Pulse_Feed</h3>
                <div className="border-l-2 border-gray-900 pl-4 md:pl-6">
                  <SocialFeed session={session} groupId={selectedPod.id} dailyStreak={dailyStreak} onShareStreak={onShareStreak} onSelectUser={onSelectUser} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-black flex items-center gap-2">
                <Activity size={14} className="text-cyan-500" /> Neural_Vitals
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {podMembers.sort((a,b) => (b.total_xp || 0) - (a.total_xp || 0)).map((member) => {
                  const isMe = member.id === session?.user?.id
                  const isDone = member.group_tasks_completed > 0
                  return (
                    <div key={member.id} className={`relative bg-black border ${isDone ? 'border-cyan-500/30 bg-cyan-500/[0.02]' : 'border-gray-900'} p-4 space-y-4 group/card transition-all hover:border-gray-700 shadow-sm`}>
                      <div className="flex items-center gap-3 pr-8">
                        <div className={`flex items-center gap-3 flex-1 min-w-0 ${!isMe && 'cursor-pointer active:scale-95 transition-transform'}`} onClick={() => !isMe && member.id && onSelectUser?.(member.id)}>
                          <div className="w-10 h-10 bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
                            {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-black text-gray-600">{member.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-black uppercase tracking-tighter truncate ${isMe ? 'text-white' : 'text-gray-400 group-hover/card:text-cyan-400 transition-colors'}`}>{member.username}</p>
                            <p className="text-[8px] font-black text-cyan-600 uppercase tracking-widest mt-0.5">{member.total_xp?.toLocaleString()} XP</p>
                          </div>
                        </div>
                      </div>

                      {!isMe && !isDone && (
                        <button 
                          onClick={() => handlePing(member.id, member.username)} 
                          className="absolute top-4 right-4 p-2 border border-gray-800 text-gray-700 hover:bg-white hover:text-black transition-all active:scale-90 flex-shrink-0 bg-black/50" 
                          title="Ping Member"
                        >
                          <Bell size={14} />
                        </button>
                      )}
                      
                      <div className="flex flex-col gap-2 pt-3 border-t border-gray-900/50">
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDone ? 'text-cyan-500' : 'text-red-900 animate-pulse'}`}>
                          <div className={`w-1 h-1 rounded-full ${isDone ? 'bg-cyan-500 shadow-[0_0_5px_#06b6d4]' : 'bg-red-900'}`} />
                          {isDone ? 'SYNCED' : 'OFFLINE'}
                        </div>
                        <div className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                          {member.group_tasks_completed}/{member.group_tasks_total || groupTasks.length} MISSIONS
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8 view-enter pt-2 font-mono">
      <section className="flex justify-between items-end px-1">
        <div className="space-y-1">
          <h2 className="text-[11px] uppercase tracking-[0.3em] text-gray-500 font-black">Accountability_Network</h2>
          <p className="text-[8px] text-gray-700 uppercase font-black tracking-widest">Global_Pods_Overview</p>
        </div>
        {session && (
          <button onClick={() => setIsCreating(!isCreating)} className="btn-primary py-2 px-4 flex items-center gap-2">
            <Plus size={14} /> Initialize_Pod
          </button>
        )}
      </section>

      {isCreating && (
        <form onSubmit={handleCreateGroup} className="bg-gray-950 border border-cyan-500/30 p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-gray-600 font-black tracking-widest">Pod_Identifier</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., NEURAL_LEARNERS" className="w-full input-primary text-sm py-3" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-gray-600 font-black tracking-widest">Protocol_Objectives</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Define your mission objectives..." className="w-full input-primary text-sm py-3 h-28 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 btn-primary py-4">Establish_Link</button>
            <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-gray-900 text-gray-500 py-4 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all active:scale-95">Abort</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some(m => m.user_id === session?.user?.id)
          return (
            <div key={group.id} className="bg-gray-950/40 border border-gray-900 p-6 md:p-8 space-y-6 group hover:border-gray-700 transition-all hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">{group.name}</h3>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{group.description}</p>
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2"><Users size={14} /> {group.group_members?.length || 0} Members</span>
                  {group.current_streak! > 0 && <span className="text-[9px] text-orange-500 font-black flex items-center gap-2 uppercase tracking-widest"><Flame size={14} fill="currentColor" /> {group.current_streak} Day_Streak</span>}
                </div>
              </div>
              <div className="pt-2">
                {isMember ? (
                  <button onClick={() => onSelectPod(group)} className="w-full py-4 bg-gray-900 text-cyan-400 border border-gray-800 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all active:scale-[0.98] tracking-[0.2em]">Enter_Dashboard</button>
                ) : (
                  <button onClick={() => handleJoinGroup(group.id)} className="w-full py-4 bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all active:scale-[0.98] tracking-[0.2em]">Join_Pod_Protocol</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

