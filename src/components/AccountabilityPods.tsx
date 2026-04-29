import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, Trash2, ChevronLeft, Bell, Activity, Check, Flame } from 'lucide-react'
import { SocialFeed } from './SocialFeed'
import type { Group, MemberVital, GroupTask, GroupTaskCompletion } from '../types'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from '../lib/i18n'

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
  const { t } = useTranslation();

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
    if (!session || !window.confirm('LEAVE_GROUP?')) return
    try {
      await StorageService.leaveGroup(groupId, session.user.id)
      onSelectPod(null)
      fetchGroups()
    } catch (err) {
      console.error('Leave protocol failed:', err)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!session || !window.confirm('DELETE_GROUP?')) return
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

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-ink font-mono">{t('pods.loading')}</div>

  if (selectedPod) {
    return (
      <div className="space-y-6 view-enter pb-20 pt-2 font-mono">
        <button 
          onClick={() => onSelectPod(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-ink/60 hover:text-accent transition-colors mb-2 active:scale-95 px-1"
        >
          <ChevronLeft size={16} /> Back_to_Network
        </button>

        <section className="bg-white border-2 border-border p-5 md:p-8 space-y-6 md:space-y-8 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl md:text-3xl font-black text-ink uppercase tracking-tighter">{selectedPod.name}</h2>
                <div className="px-3 py-1.5 bg-accent-soft border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Flame size={14} fill="currentColor" />
                  Group_Streak: {podMembers[0]?.pod_current_streak ?? 0}
                </div>
              </div>
              <p className="text-sm text-ink/70 leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="w-full md:w-auto text-left md:text-right flex flex-col md:items-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border md:border-none">
              <p className="text-[8px] text-ink/50 uppercase font-black tracking-widest">{t('pods.established')} {new Date(selectedPod.created_at).toLocaleDateString()}</p>
              {selectedPod.created_by === session?.user?.id ? (
                <button onClick={() => handleDeleteGroup(selectedPod.id)} className="text-[10px] font-black text-red-600 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 active:scale-95">
                  <Trash2 size={14} /> Delete_Group
                </button>
              ) : (
                <button onClick={() => handleLeaveGroup(selectedPod.id)} className="text-[10px] font-black text-ink/60 hover:text-red-500 uppercase tracking-widest active:scale-95">
                  Leave_Group
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink/60 font-black flex items-center gap-2">
                  <Activity size={14} className="text-accent" /> Mission_Objectives
                </h3>

                <div className="bg-canvas border border-border p-4 md:p-6 space-y-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {selectedPod.created_by === session?.user?.id && (
                    <div className="border-b border-border/10 pb-6">
                      {isAddingTask ? (
                        <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-3">
                          <input
                            autoFocus
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder={t('pods.new_mission')}
                            className="flex-1 input-primary text-sm py-3"
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 btn-primary py-3">{t('pods.establish')}</button>
                            <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 bg-white border border-border text-ink text-[10px] font-black uppercase hover:bg-canvas transition-all active:scale-95">{t('action.cancel')}</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => setIsAddingTask(true)} className="w-full py-4 border border-dashed border-border text-[10px] font-black uppercase text-ink/50 hover:text-accent hover:border-accent/30 transition-all bg-canvas flex items-center justify-center gap-2 active:scale-[0.98]">
                          <Plus size={14} /> {t('pods.add_mission')}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3">
                    {groupTasks.map((task) => {
                      const isDone = groupCompletions.some(c => c.task_id === task.id && c.user_id === session?.user?.id)
                      return (
                        <div key={task.id} className={`flex items-center justify-between group/task p-4 md:p-5 border-2 transition-all ${isDone ? 'bg-accent-soft border-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white border-border hover:border-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
                          <button onClick={() => handleToggleTask(task.id)} className="flex-1 flex items-center gap-4 text-left">
                            <div className={`w-7 h-7 md:w-6 md:h-6 border-2 transition-all flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-accent border-accent' : 'border-border bg-white'}`}>
                              {isDone && <Check size={16} className="text-white stroke-[4px]" />}
                            </div>
                            <span className={`text-sm md:text-xs font-black uppercase tracking-tight ${isDone ? 'text-accent opacity-50 line-through' : 'text-ink'}`}>
                              {task.title}
                            </span>
                          </button>
                          {selectedPod.created_by === session?.user?.id && (
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-ink/20 hover:text-red-500 md:opacity-0 group-hover/task:opacity-100 transition-all active:scale-90">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {groupTasks.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-border">
                        <p className="text-[10px] text-ink/30 uppercase font-black tracking-widest">{t('pods.no_missions')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink/60 font-black mb-6">{t('pods.feed')}</h3>
                <div className="border-l-2 border-border pl-4 md:pl-6">
                  <SocialFeed session={session} groupId={selectedPod.id} dailyStreak={dailyStreak} onShareStreak={onShareStreak} onSelectUser={onSelectUser} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink/60 font-black flex items-center gap-2">
                <Activity size={14} className="text-accent" /> Neural_Vitals
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {podMembers.sort((a,b) => (b.total_xp || 0) - (a.total_xp || 0)).map((member) => {
                  const isMe = member.id === session?.user?.id
                  const isDone = member.group_tasks_completed > 0
                  return (
                    <div key={member.id} className={`relative bg-white border-2 ${isDone ? 'border-accent bg-accent-soft' : 'border-border'} p-4 space-y-4 group/card transition-all hover:border-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                      <div className="flex items-center gap-3 pr-8">
                        <div className={`flex items-center gap-3 flex-1 min-w-0 ${!isMe && 'cursor-pointer active:scale-95 transition-transform'}`} onClick={() => !isMe && member.id && onSelectUser?.(member.id)}>
                          <div className="w-10 h-10 bg-canvas border-2 border-border flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
                            {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-black text-ink/30">{member.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-black uppercase tracking-tighter truncate ${isMe ? 'text-ink' : 'text-ink/60 group-hover/card:text-accent transition-colors'}`}>{member.username}</p>
                            <p className="text-[8px] font-black text-accent uppercase tracking-widest mt-0.5">{member.total_xp?.toLocaleString()} XP</p>
                          </div>
                        </div>
                      </div>

                      {!isMe && !isDone && (
                        <button 
                          onClick={() => handlePing(member.id, member.username)} 
                          className="absolute top-4 right-4 p-2 border border-border text-ink hover:bg-accent hover:text-white transition-all active:scale-90 flex-shrink-0 bg-white" 
                          title="Ping Member"
                        >
                          <Bell size={14} />
                        </button>
                      )}
                      
                      <div className="flex flex-col gap-2 pt-3 border-t border-border/10">
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDone ? 'text-accent' : 'text-red-500 animate-pulse'}`}>
                          <div className={`w-1 h-1 rounded-full ${isDone ? 'bg-accent shadow-[0_0_5px_var(--color-accent)]' : 'bg-red-500'}`} />
                          {isDone ? 'SYNCED' : 'OFFLINE'}
                        </div>
                        <div className="text-[8px] text-ink/40 font-bold uppercase tracking-widest">
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
          <h2 className="text-[11px] uppercase tracking-[0.3em] text-ink/40 font-black">{t('pods.title')}</h2>
          <p className="text-[8px] text-ink/60 uppercase font-black tracking-widest">{t('pods.subtitle')}</p>
        </div>
        {session && (
          <button onClick={() => setIsCreating(!isCreating)} className="btn-primary py-2 px-4 flex items-center gap-2">
            <Plus size={14} /> {t('pods.create')}
          </button>
        )}
      </section>

      {isCreating && (
        <form onSubmit={handleCreateGroup} className="bg-white border-2 border-accent p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.name_label')}</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., NEURAL_LEARNERS" className="w-full input-primary text-sm py-3" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.desc_label')}</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Define your mission objectives..." className="w-full input-primary text-sm py-3 h-28 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 btn-primary py-4">{t('pods.btn_create')}</button>
            <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-canvas border border-border text-ink py-4 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95">{t('action.cancel')}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some(m => m.user_id === session?.user?.id)
          return (
            <div key={group.id} className="bg-white border-2 border-border p-6 md:p-8 space-y-6 group hover:border-accent transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(124,58,237,1)]">
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-ink uppercase tracking-tighter group-hover:text-accent transition-colors">{group.name}</h3>
                <p className="text-xs text-ink/60 line-clamp-2 leading-relaxed">{group.description}</p>
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-[9px] text-ink/40 uppercase font-black tracking-widest flex items-center gap-2"><Users size={14} /> {group.group_members?.length || 0} Members</span>
                  {group.current_streak! > 0 && <span className="text-[9px] text-accent font-black flex items-center gap-2 uppercase tracking-widest"><Flame size={14} fill="currentColor" /> {group.current_streak} Day_Streak</span>}
                </div>
              </div>

              {group.group_tasks && group.group_tasks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest text-ink/40 font-black flex items-center gap-2">
                    <Activity size={12} className="text-accent" /> {t('pods.missions')}
                  </h4>
                  <div className="space-y-2">
                    {group.group_tasks.slice(0, 3).map(task => (
                      <div key={task.id} className="text-[10px] text-ink/60 font-bold uppercase tracking-widest flex items-center gap-2 bg-canvas px-3 py-2 border-l-2 border-accent">
                        <div className="w-1 h-1 bg-accent/50" />
                        {task.title}
                      </div>
                    ))}
                    {group.group_tasks.length > 3 && (
                      <div className="text-[8px] text-ink/30 font-black uppercase tracking-widest pl-3">
                        + {group.group_tasks.length - 3} MORE_OBJECTIVES
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                {isMember ? (
                  <button onClick={() => onSelectPod(group)} className="w-full py-4 bg-canvas text-accent border-2 border-border text-[10px] font-black uppercase hover:bg-accent hover:text-white transition-all active:scale-[0.98] tracking-[0.2em]">{t('pods.enter')}</button>
                ) : (
                  <button onClick={() => handleJoinGroup(group.id)} className="w-full py-4 bg-accent-soft text-accent border-2 border-accent text-[10px] font-black uppercase hover:bg-accent hover:text-white transition-all active:scale-[0.98] tracking-[0.2em]">{t('pods.join')}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

