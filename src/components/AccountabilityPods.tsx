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

      const [vitalsResult, tasksResult, completionsResult] = await Promise.allSettled([
        StorageService.fetchMemberVitals(groupId),
        StorageService.fetchGroupTasks(groupId),
        StorageService.fetchGroupTaskCompletions(groupId, date)
      ])

      if (vitalsResult.status === 'fulfilled' && vitalsResult.value.length > 0) {
        setPodMembers(vitalsResult.value)
      } else {
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
      fetchGroupData(selectedPod.id)
    } catch (err) {
      console.error('Failed to add mission:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('DELETE_MISSION?')) return
    try {
      await StorageService.deleteGroupTask(taskId)
      setGroupTasks(groupTasks.filter(t => t.id !== taskId))
      if (selectedPod) fetchGroupData(selectedPod.id)
    } catch (err) {
      console.error('Failed to delete mission:', err)
    }
  }

  const handleToggleTask = async (taskId: string) => {
    if (!session || !selectedPod) return
    const date = new Date().toISOString().split('T')[0]
    try {
      await StorageService.toggleGroupTask(taskId, session.user.id, date)
      
      const existing = groupCompletions.find(c => c.task_id === taskId && c.user_id === session.user.id)
      if (existing) {
        setGroupCompletions(groupCompletions.filter(c => c.id !== existing.id))
      } else {
        setGroupCompletions([...groupCompletions, { id: Math.random().toString(), task_id: taskId, user_id: session.user.id, completed_date: date }])
      }
      
      setTimeout(() => fetchGroupData(selectedPod.id), 500)
    } catch (err) {
      console.error('Task synchronization failed:', err)
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
      <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 pb-20 pt-4 font-mono">
        <button 
          onClick={() => onSelectPod(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft size={14} /> Back_to_Network
        </button>

        <section className="bg-gray-950 border border-gray-900 p-8 space-y-8 relative">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedPod.name}</h2>
                <div className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                  <Flame size={14} fill="currentColor" />
                  Squad_Streak: {podMembers[0]?.pod_current_streak ?? 0}
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <p className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Protocol_Established {new Date(selectedPod.created_at).toLocaleDateString()}</p>
              {selectedPod.created_by === session?.user?.id ? (
                <button onClick={() => handleDeleteGroup(selectedPod.id)} className="text-[8px] font-black text-red-900 hover:text-red-500 uppercase tracking-widest flex items-center gap-1">
                  <Trash2 size={10} /> Terminate_Pod
                </button>
              ) : (
                <button onClick={() => handleLeaveGroup(selectedPod.id)} className="text-[8px] font-black text-gray-700 hover:text-white uppercase tracking-widest">
                  Leave_Pod
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                <Activity size={12} className="text-cyan-500" /> Mission_Objectives
              </h3>

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
                          placeholder="ENTER_NEW_MISSION..."
                          className="flex-1 bg-black border border-gray-800 px-4 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                        />
                        <button type="submit" className="px-4 bg-cyan-500 text-black text-[10px] font-black uppercase hover:bg-white transition-all">Establish</button>
                        <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 bg-gray-800 text-gray-400 text-[10px] font-black uppercase hover:text-white transition-all">Abort</button>
                      </form>
                    ) : (
                      <button onClick={() => setIsAddingTask(true)} className="w-full py-3 border border-dashed border-gray-800 text-[9px] font-black uppercase text-gray-600 hover:text-cyan-500 transition-all bg-black/20 flex items-center justify-center gap-2">
                        <Plus size={12} /> Add_Mission_Protocol
                      </button>
                    )}
                  </div>
                )}

                <div className="grid gap-3">
                  {groupTasks.map((task) => {
                    const isDone = groupCompletions.some(c => c.task_id === task.id && c.user_id === session?.user?.id)
                    return (
                      <div key={task.id} className={`flex items-center justify-between group/task p-4 border transition-all ${isDone ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-black/40 border-gray-900 hover:border-gray-800'}`}>
                        <button onClick={() => handleToggleTask(task.id)} className="flex-1 flex items-center gap-4 text-left">
                          <div className={`w-6 h-6 border-2 transition-all flex items-center justify-center ${isDone ? 'bg-cyan-500 border-cyan-500' : 'border-gray-800 bg-black'}`}>
                            {isDone && <Check size={14} className="text-black stroke-[4px]" />}
                          </div>
                          <span className={`text-xs font-black uppercase tracking-tight ${isDone ? 'text-cyan-400 opacity-50' : 'text-gray-200'}`}>
                            {task.title}
                          </span>
                        </button>
                        {selectedPod.created_by === session?.user?.id && (
                          <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-gray-800 hover:text-red-500 opacity-0 group-hover/task:opacity-100 transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {groupTasks.length === 0 && <p className="text-[10px] text-gray-700 text-center py-10 uppercase font-black">No missions assigned.</p>}
                </div>
              </div>

              <div className="pt-6">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-6">Pod_Pulse</h3>
                <SocialFeed session={session} groupId={selectedPod.id} dailyStreak={dailyStreak} onShareStreak={onShareStreak} onSelectUser={onSelectUser} />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                <Activity size={12} className="text-cyan-500" /> Neural_Vitals
              </h3>
              <div className="space-y-3">
                {podMembers.sort((a,b) => (b.total_xp || 0) - (a.total_xp || 0)).map((member) => {
                  const isMe = member.id === session?.user?.id
                  const isDone = member.group_tasks_completed > 0
                  return (
                    <div key={member.id} className={`bg-black/60 border ${isDone ? 'border-cyan-500/20' : 'border-gray-900'} p-3 space-y-2 group/card`}>
                      <div className="flex justify-between items-center">
                        <div className={`flex items-center gap-2 ${!isMe && 'cursor-pointer'}`} onClick={() => !isMe && member.id && onSelectUser?.(member.id)}>
                          <div className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                            {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-gray-600">{member.username?.[0]}</span>}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-tighter ${isMe ? 'text-white' : 'text-gray-400 group-hover/card:text-cyan-400'}`}>{member.username}</p>
                            <p className="text-[6px] font-bold text-cyan-700 uppercase tracking-widest">{member.total_xp} XP</p>
                          </div>
                        </div>
                        {!isMe && !isDone && (
                          <button onClick={() => handlePing(member.id, member.username)} className="p-1.5 border border-gray-800 text-gray-700 hover:bg-white hover:text-black transition-all">
                            <Bell size={10} />
                          </button>
                        )}
                      </div>
                      <div className={`text-[8px] font-black uppercase ${isDone ? 'text-cyan-500' : 'text-red-900 animate-pulse'}`}>
                        {isDone ? 'PROTOCOL_SYNCED' : 'CRITICAL_OFFLINE'}
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-mono">
      <section className="flex justify-between items-end">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Accountability_Pods</h2>
        {session && (
          <button onClick={() => setIsCreating(!isCreating)} className="px-3 py-1 border border-cyan-500/30 text-cyan-400 text-[8px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all flex items-center gap-2">
            <Plus size={12} /> Initialize_Pod
          </button>
        )}
      </section>

      {isCreating && (
        <form onSubmit={handleCreateGroup} className="bg-gray-950 border border-cyan-500/30 p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] uppercase text-gray-600 font-bold">Pod_Name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., NEURAL_LEARNERS" className="w-full bg-black border border-gray-900 px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase text-gray-600 font-bold">Objective</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Define protocols..." className="w-full bg-black border border-gray-900 px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 h-24 resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-cyan-500 text-black py-2 text-[10px] font-black uppercase tracking-widest">Initialize</button>
            <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-gray-900 text-gray-500 py-2 text-[10px] font-black uppercase tracking-widest">Abort</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some(m => m.user_id === session?.user?.id)
          return (
            <div key={group.id} className="bg-gray-950/50 border border-gray-900 p-6 space-y-4 group">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">{group.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest flex items-center gap-1"><Users size={10} /> {group.group_members?.length || 0} Members</span>
                  {group.current_streak! > 0 && <span className="text-[8px] text-orange-500 font-black flex items-center gap-1"><Flame size={10} fill="currentColor" /> {group.current_streak} Day_Streak</span>}
                </div>
              </div>
              <div className="pt-2">
                {isMember ? (
                  <button onClick={() => onSelectPod(group)} className="w-full py-2 bg-gray-900 text-cyan-400 border border-gray-800 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all">Enter_Dashboard</button>
                ) : (
                  <button onClick={() => handleJoinGroup(group.id)} className="w-full py-2 bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all">Join_Pod</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
