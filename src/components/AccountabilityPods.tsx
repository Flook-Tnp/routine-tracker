import { useEffect, useState, useCallback, useMemo } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, Trash2, ChevronLeft, Bell, Activity, Check, Flame, ShieldAlert, Pencil, Lock, Globe2, Copy, Target, UserCheck, AlertTriangle, BarChart3 } from 'lucide-react'
import { SocialFeed } from './SocialFeed'
import type { Group, MemberVital, GroupTask, GroupTaskCompletion } from '../types'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from '../lib/i18n'
import { EmptyState } from './EmptyState'
import { MissedYesterdayBar } from './MissedYesterdayBar'
import { getErrorMessage } from '../lib/errors'

interface PodsProps {
  session: Session | null
  onShareStreak: () => void
  dailyStreak: number
  onSelectUser?: (userId: string) => void
  selectedPod: Group | null
  onSelectPod: (pod: Group | null) => void
  selectedDateStr: string
  todayStr: string
  yesterdayStr: string
  onRecoverYesterday: () => void
}

export function AccountabilityPods({ session, onShareStreak, dailyStreak, onSelectUser, selectedPod, onSelectPod, selectedDateStr, todayStr, yesterdayStr, onRecoverYesterday }: PodsProps) {
  const { t } = useTranslation();

  const [groups, setGroups] = useState<Group[]>([])
  const [podMembers, setPodMembers] = useState<MemberVital[]>([])
  const [groupTasks, setGroupTasks] = useState<GroupTask[]>([])
  const [groupCompletions, setGroupCompletions] = useState<GroupTaskCompletion[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>('public')
  const [newAccessCode, setNewAccessCode] = useState('')
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})
  const [isEditingPod, setIsEditingPod] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public')
  const [editAccessCode, setEditAccessCode] = useState('')
  const [ownerAccessCode, setOwnerAccessCode] = useState<string | null>(null)
  const [ownerAccessCodeGroupId, setOwnerAccessCodeGroupId] = useState<string | null>(null)
  const [accessCodeCopied, setAccessCodeCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [yesterdayCompletions, setYesterdayCompletions] = useState<GroupTaskCompletion[]>([])
  const [dismissedMissedNudges, setDismissedMissedNudges] = useState<Record<string, boolean>>({})

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
    let cancelled = false

    StorageService.fetchGroups()
      .then((data) => {
        if (!cancelled) setGroups(data)
      })
      .catch((err) => {
        console.error('Failed to fetch pods:', err)
      })
      .finally(() => {
        if (!cancelled && !selectedPod) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedPod])

  useEffect(() => {
    if (!selectedPod) return
    let cancelled = false

    Promise.allSettled([
      StorageService.fetchMemberVitals(selectedPod.id, selectedDateStr),
      StorageService.fetchGroupTasks(selectedPod.id),
      StorageService.fetchGroupTaskCompletions(selectedPod.id, selectedDateStr)
    ])
      .then(async ([vitalsResult, tasksResult, completionsResult]) => {
        if (cancelled) return

        if (vitalsResult.status === 'fulfilled' && vitalsResult.value.length > 0) {
          setPodMembers(vitalsResult.value)
        } else {
          console.warn('Vitals failed, using fallback')
          if (vitalsResult.status === 'rejected') console.error(vitalsResult.reason)
          const basicMembers = await StorageService.fetchPodMembers(selectedPod.id)
          if (cancelled) return
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
      })
      .catch((err) => {
        console.error('Group data sync failed:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedPod, selectedDateStr])

  useEffect(() => {
    if (!selectedPod || selectedDateStr !== todayStr) {
      return
    }

    let cancelled = false
    StorageService.fetchGroupTaskCompletions(selectedPod.id, yesterdayStr)
      .then((data) => {
        if (!cancelled) setYesterdayCompletions(data)
      })
      .catch((err) => {
        console.error('Yesterday pod completions failed:', err)
        if (!cancelled) setYesterdayCompletions([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedPod, selectedDateStr, todayStr, yesterdayStr])

  useEffect(() => {
    if (!selectedPod || selectedPod.visibility !== 'private' || selectedPod.created_by !== session?.user?.id) {
      return
    }

    let cancelled = false
    StorageService.fetchGroupAccessCode(selectedPod.id)
      .then((code) => {
        if (!cancelled) {
          setOwnerAccessCode(code)
          setOwnerAccessCodeGroupId(selectedPod.id)
        }
      })
      .catch((err) => {
        console.error('Room code fetch failed:', err)
      })

    return () => {
      cancelled = true
    }
  }, [selectedPod, session?.user?.id])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !session) return
    if (newVisibility === 'private' && !newAccessCode.trim()) return
    try {
      const pod = await StorageService.createGroup(newName, newDescription, session.user.id, newVisibility, newAccessCode)
      setGroups([...groups, pod])
      setOwnerAccessCode(newVisibility === 'private' ? newAccessCode.trim() : null)
      setOwnerAccessCodeGroupId(newVisibility === 'private' ? pod.id : null)
      setNewName('')
      setNewDescription('')
      setNewVisibility('public')
      setNewAccessCode('')
      setIsCreating(false)
      onSelectPod(pod)
    } catch (err) {
      console.error('Pod initialization failed:', err)
    }
  }

  const handleJoinGroup = async (groupId: string) => {
    if (!session) return
    try {
      const group = groups.find(g => g.id === groupId)
      const accessCode = group?.visibility === 'private' ? joinCodes[groupId] : undefined
      await StorageService.joinGroup(groupId, session.user.id, accessCode)
      fetchGroups()
      const pod = group || groups.find(g => g.id === groupId)
      if (pod) onSelectPod(pod)
    } catch (err) {
      console.error('Join protocol failed:', err)
      alert(`JOIN_FAILED: ${getErrorMessage(err, 'Check the group code and try again.')}`)
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

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim() || !selectedPod) return
    try {
      const updatedPod = await StorageService.updateGroup(selectedPod.id, {
        name: editName,
        description: editDescription,
        visibility: editVisibility
      }, editAccessCode)
      onSelectPod(updatedPod)
      setGroups(groups.map(g => g.id === updatedPod.id ? updatedPod : g))
      if (editVisibility === 'public') {
        setOwnerAccessCode(null)
        setOwnerAccessCodeGroupId(null)
      } else if (editAccessCode.trim()) {
        setOwnerAccessCode(editAccessCode.trim())
        setOwnerAccessCodeGroupId(updatedPod.id)
      }
      setEditAccessCode('')
      setIsEditingPod(false)
    } catch (err) {
      console.error('Update failed:', err)
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
    } catch (err: unknown) {
      console.error('Ping failed:', err)
      alert(`PING_FAILED: ${getErrorMessage(err, 'Please try again')}`)
    }
  }

  const handleCopyAccessCode = async () => {
    if (!ownerAccessCode) return
    try {
      await navigator.clipboard.writeText(ownerAccessCode)
      setAccessCodeCopied(true)
      window.setTimeout(() => setAccessCodeCopied(false), 1600)
    } catch (err) {
      console.error('Copy room code failed:', err)
      window.prompt(t('pods.room_code'), ownerAccessCode)
    }
  }

  const dismissMissedNudge = (key: string) => {
    localStorage.setItem(key, '1')
    setDismissedMissedNudges(prev => ({ ...prev, [key]: true }))
  }

  const podMissedYesterdayKey = selectedPod ? `missed-yesterday:pod:${selectedPod.id}:${yesterdayStr}` : ''
  const hasYesterdayPodCompletion = yesterdayCompletions.some(completion => completion.user_id === session?.user?.id)
  const shouldShowPodMissedYesterday =
    Boolean(session && selectedPod) &&
    selectedDateStr === todayStr &&
    groupTasks.length > 0 &&
    !hasYesterdayPodCompletion &&
    !dismissedMissedNudges[podMissedYesterdayKey] &&
    localStorage.getItem(podMissedYesterdayKey) !== '1'
  const canViewOwnerAccessCode = selectedPod?.visibility === 'private' && selectedPod.created_by === session?.user?.id
  const visibleOwnerAccessCode = canViewOwnerAccessCode && ownerAccessCodeGroupId === selectedPod?.id ? ownerAccessCode : null
  const memberCount = podMembers.length
  const checkedInMembers = useMemo(() => (
    podMembers.filter(member => (member.group_tasks_completed || 0) > 0)
  ), [podMembers])
  const pendingMembers = useMemo(() => (
    podMembers.filter(member => (member.group_tasks_completed || 0) === 0)
  ), [podMembers])
  const missionCompletionCount = groupCompletions.length
  const missionTargetCount = Math.max(groupTasks.length * Math.max(memberCount, 1), 0)
  const teamCompletionRate = missionTargetCount > 0 ? Math.round((missionCompletionCount / missionTargetCount) * 100) : 0
  const myCompletedMissions = groupCompletions.filter(completion => completion.user_id === session?.user?.id).length
  const sortedPodMembers = useMemo(() => (
    [...podMembers].sort((a, b) => {
      const aDone = (a.group_tasks_completed || 0) > 0
      const bDone = (b.group_tasks_completed || 0) > 0
      if (aDone !== bDone) return aDone ? 1 : -1
      return (b.total_xp || 0) - (a.total_xp || 0)
    })
  ), [podMembers])

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

        {shouldShowPodMissedYesterday && (
          <MissedYesterdayBar
            title={t('recovery.pod_title')}
            subtitle={t('recovery.pod_subtitle')}
            actionLabel={t('recovery.log_yesterday')}
            dismissLabel={t('recovery.dismiss')}
            onRecover={onRecoverYesterday}
            onDismiss={() => dismissMissedNudge(podMissedYesterdayKey)}
          />
        )}

        <section className="bg-white border-2 border-border p-5 md:p-8 space-y-6 md:space-y-8 relative shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
          {isEditingPod ? (
            <form onSubmit={handleUpdateGroup} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.name_label')}</label>
                <input 
                  autoFocus
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full input-primary text-sm py-3" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.desc_label')}</label>
                <textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  className="w-full input-primary text-sm py-3 h-28 resize-none" 
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.visibility')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'public' as const, label: t('pods.public'), icon: Globe2 },
                    { id: 'private' as const, label: t('pods.private'), icon: Lock }
                  ].map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setEditVisibility(option.id)}
                        className={`flex items-center justify-center gap-2 border-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${editVisibility === option.id ? 'border-border bg-accent text-white shadow-[3px_3px_0px_0px_rgba(20,184,166,0.34)]' : 'border-border bg-canvas text-ink/45 hover:text-accent'}`}
                      >
                        <Icon size={14} />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {editVisibility === 'private' && (
                  <input
                    type="text"
                    value={editAccessCode}
                    onChange={(e) => setEditAccessCode(e.target.value)}
                    placeholder={t('pods.new_access_code_placeholder')}
                    className="w-full input-primary text-sm py-3"
                  />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 btn-primary py-3">SAVE_CHANGES</button>
                <button type="button" onClick={() => setIsEditingPod(false)} className="px-6 bg-white border-2 border-border text-ink text-[10px] font-black uppercase hover:bg-canvas transition-all active:scale-95">{t('common.cancel')}</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl md:text-3xl font-black text-ink uppercase tracking-tighter">{selectedPod.name}</h2>
                  <div className="px-3 py-1.5 bg-accent-soft border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
                    <Flame size={14} fill="currentColor" />
                    Group_Streak: {podMembers[0]?.pod_current_streak ?? 0}
                  </div>
                </div>
                <p className="text-sm text-ink/70 leading-relaxed max-w-lg">{selectedPod.description}</p>
              </div>
              <div className="w-full md:w-auto text-left md:text-right flex flex-col md:items-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border md:border-none">
                <p className="text-[8px] text-ink/50 uppercase font-black tracking-widest">{t('pods.established')} {new Date(selectedPod.created_at).toLocaleDateString()}</p>
                {canViewOwnerAccessCode && (
                  <div className="w-full md:w-72 border-2 border-accent bg-accent-soft p-3 text-left shadow-[3px_3px_0px_0px_rgba(236,72,153,0.25)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[8px] uppercase tracking-[0.22em] font-black text-accent flex items-center gap-2">
                        <Lock size={12} />
                        {t('pods.room_code')}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAccessCode}
                        disabled={!visibleOwnerAccessCode}
                        className="text-[8px] uppercase tracking-widest font-black text-accent hover:text-ink flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                      >
                        {accessCodeCopied ? <Check size={12} /> : <Copy size={12} />}
                        {accessCodeCopied ? t('pods.code_copied') : t('pods.copy_code')}
                      </button>
                    </div>
                    <div className="mt-2 bg-white border-2 border-border px-3 py-2 text-sm font-black tracking-[0.18em] text-ink break-all">
                      {visibleOwnerAccessCode || t('status.loading')}
                    </div>
                  </div>
                )}
                {selectedPod.created_by === session?.user?.id ? (
                  <div className="flex flex-col md:items-end gap-3">
                    <button 
                      onClick={() => {
                        setEditName(selectedPod.name)
                        setEditDescription(selectedPod.description || '')
                        setEditVisibility(selectedPod.visibility || 'public')
                        setEditAccessCode('')
                        setIsEditingPod(true)
                      }} 
                      className="text-[10px] font-black text-accent hover:text-accent/80 uppercase tracking-widest flex items-center gap-2 active:scale-95"
                    >
                      <Pencil size={14} /> Edit_Group
                    </button>
                    <button onClick={() => handleDeleteGroup(selectedPod.id)} className="text-[10px] font-black text-red-600 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 active:scale-95">
                      <Trash2 size={14} /> Delete_Group
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleLeaveGroup(selectedPod.id)} className="text-[10px] font-black text-ink/60 hover:text-red-500 uppercase tracking-widest active:scale-95">
                    Leave_Group
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEditingPod && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Team Today', value: `${checkedInMembers.length}/${memberCount || 0}`, sub: 'members checked in', icon: UserCheck, tone: 'accent' },
                { label: 'Missions', value: `${myCompletedMissions}/${groupTasks.length}`, sub: 'your progress', icon: Target, tone: 'sync' },
                { label: 'Completion', value: `${teamCompletionRate}%`, sub: 'team mission rate', icon: BarChart3, tone: 'accent' },
                { label: 'Need Ping', value: pendingMembers.length.toLocaleString(), sub: 'members waiting', icon: AlertTriangle, tone: pendingMembers.length > 0 ? 'warn' : 'sync' }
              ].map((metric) => {
                const Icon = metric.icon
                const toneClass = metric.tone === 'warn' ? 'text-red-500 bg-red-50' : metric.tone === 'sync' ? 'text-sync bg-sync-soft' : 'text-accent bg-accent-soft'
                return (
                  <div key={metric.label} className="bg-canvas border-2 border-border p-4 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">{metric.label}</p>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter text-ink mt-2">{metric.value}</p>
                        <p className="text-[8px] uppercase tracking-widest text-ink/40 font-black mt-1">{metric.sub}</p>
                      </div>
                      <div className={`w-9 h-9 border-2 border-border flex items-center justify-center ${toneClass}`}>
                        <Icon size={16} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink/60 font-black flex items-center gap-2">
                  <Activity size={14} className="text-accent" /> Mission_Objectives
                </h3>

                <div className="bg-canvas border-2 border-border p-4 md:p-6 space-y-6 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
                  {selectedPod.created_by === session?.user?.id && (
                    <div className="border-b-2 border-border/10 pb-6">
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
                            <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 bg-white border-2 border-border text-ink text-[10px] font-black uppercase hover:bg-canvas transition-all active:scale-95">{t('common.cancel')}</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => setIsAddingTask(true)} className="w-full py-4 border-2 border-dashed border-border text-[10px] font-black uppercase text-ink/50 hover:text-accent hover:border-accent/30 transition-all bg-canvas flex items-center justify-center gap-2 active:scale-[0.98]">
                          <Plus size={14} /> {t('pods.add_mission')}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3">
                    {groupTasks.map((task) => {
                      const isDone = groupCompletions.some(c => c.task_id === task.id && c.user_id === session?.user?.id)
                      const completedMembers = groupCompletions.filter(c => c.task_id === task.id).length
                      const completionPercent = memberCount > 0 ? Math.min(100, Math.round((completedMembers / memberCount) * 100)) : 0
                      return (
                        <div key={task.id} className={`group/task p-4 md:p-5 border-2 transition-all space-y-4 ${isDone ? 'bg-accent-soft border-accent shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]' : 'bg-white border-border hover:border-accent shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]'}`}>
                          <div className="flex items-center justify-between gap-4">
                            <button onClick={() => handleToggleTask(task.id)} className="flex-1 flex items-center gap-4 text-left">
                              <div className={`w-7 h-7 md:w-6 md:h-6 border-2 transition-all flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-accent border-accent' : 'border-border bg-white'}`}>
                                {isDone && <Check size={16} className="text-white stroke-[4px]" />}
                              </div>
                              <div className="min-w-0">
                                <span className={`block text-sm md:text-xs font-black uppercase tracking-tight ${isDone ? 'text-accent opacity-60 line-through' : 'text-ink'}`}>
                                  {task.title}
                                </span>
                                <span className="block text-[8px] uppercase tracking-widest text-ink/35 font-black mt-1">
                                  {completedMembers}/{memberCount || 0} members complete
                                </span>
                              </div>
                            </button>
                            {selectedPod.created_by === session?.user?.id && (
                              <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-ink/20 hover:text-red-500 md:opacity-0 group-hover/task:opacity-100 transition-all active:scale-90">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          <div className="h-2 bg-white border-2 border-border overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${isDone ? 'bg-accent' : 'bg-sync'}`} style={{ width: `${completionPercent}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {groupTasks.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-border">
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
                {sortedPodMembers.map((member) => {
                  const isMe = member.id === session?.user?.id
                  const isDone = member.group_tasks_completed > 0
                  const missionTotal = member.group_tasks_total || groupTasks.length
                  const lastActivity = member.last_activity_date ? new Date(member.last_activity_date).toLocaleDateString() : 'No activity yet'
                  return (
                    <div key={member.id} className={`relative bg-white border-2 ${isDone ? 'border-accent bg-accent-soft' : 'border-border'} p-4 space-y-4 group/card transition-all hover:border-accent shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]`}>
                      <div className="flex items-center gap-3 pr-8">
                        <div className={`flex items-center gap-3 flex-1 min-w-0 ${!isMe && 'cursor-pointer active:scale-95 transition-transform'}`} onClick={() => !isMe && member.id && onSelectUser?.(member.id)}>
                          <div className="w-10 h-10 bg-canvas border-2 border-border flex items-center justify-center overflow-hidden shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] flex-shrink-0">
                            {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-black text-ink/30">{member.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-black uppercase tracking-tighter truncate ${isMe ? 'text-ink' : 'text-ink/60 group-hover/card:text-accent transition-colors'}`}>{member.username}</p>
                            <p className="text-[8px] font-black text-accent uppercase tracking-widest mt-0.5">{member.total_xp?.toLocaleString()} XP</p>
                            <p className="text-[7px] font-black text-ink/35 uppercase tracking-widest mt-0.5">{lastActivity}</p>
                          </div>
                        </div>
                      </div>

                      {!isMe && !isDone && (
                        <button 
                          onClick={() => handlePing(member.id, member.username)} 
                          className="absolute top-4 right-4 p-2 border-2 border-border text-ink hover:bg-accent hover:text-white transition-all active:scale-90 flex-shrink-0 bg-white" 
                          title="Ping Member"
                        >
                          <Bell size={14} />
                        </button>
                      )}
                      
                      <div className="flex flex-col gap-2 pt-3 border-t-2 border-border/10">
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDone ? 'text-accent' : 'text-red-500 animate-pulse'}`}>
                          <div className={`w-1 h-1 rounded-full ${isDone ? 'bg-accent shadow-[0_0_5px_var(--color-accent)]' : 'bg-red-500'}`} />
                          {isDone ? 'SYNCED' : 'OFFLINE'}
                        </div>
                        <div className="text-[8px] text-ink/40 font-bold uppercase tracking-widest">
                          {member.group_tasks_completed}/{missionTotal} MISSIONS
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
        <form onSubmit={handleCreateGroup} className="bg-white border-2 border-accent p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.name_label')}</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., NEURAL_LEARNERS" className="w-full input-primary text-sm py-3" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.desc_label')}</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Define your mission objectives..." className="w-full input-primary text-sm py-3 h-28 resize-none" />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] uppercase text-ink/50 font-black tracking-widest">{t('pods.visibility')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'public' as const, label: t('pods.public'), icon: Globe2 },
                { id: 'private' as const, label: t('pods.private'), icon: Lock }
              ].map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setNewVisibility(option.id)}
                    className={`flex items-center justify-center gap-2 border-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${newVisibility === option.id ? 'border-border bg-accent text-white shadow-[3px_3px_0px_0px_rgba(20,184,166,0.34)]' : 'border-border bg-canvas text-ink/45 hover:text-accent'}`}
                  >
                    <Icon size={14} />
                    {option.label}
                  </button>
                )
              })}
            </div>
            {newVisibility === 'private' && (
              <input
                type="text"
                value={newAccessCode}
                onChange={(e) => setNewAccessCode(e.target.value)}
                placeholder={t('pods.access_code_placeholder')}
                className="w-full input-primary text-sm py-3"
              />
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={newVisibility === 'private' && !newAccessCode.trim()} className="flex-1 btn-primary py-4">{t('pods.btn_create')}</button>
            <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-canvas border-2 border-border text-ink py-4 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {groups.length === 0 && !loading && (
        <EmptyState 
          icon={ShieldAlert}
          title="NO_ACTIVE_PODS"
          subtitle="You are currently a lone operative. Join or establish a new accountability group to synchronize performance."
          action={session ? {
            label: t('pods.create'),
            onClick: () => setIsCreating(true)
          } : undefined}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isMember = group.group_members?.some(m => m.user_id === session?.user?.id)
          const groupMemberCount = group.group_members?.length || 0
          const groupMissionCount = group.group_tasks?.length || 0
          const groupStreak = group.current_streak || 0
          return (
            <div key={group.id} className="bg-white border-2 border-border p-6 md:p-8 space-y-6 group hover:border-accent transition-all shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] hover:shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)]">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl md:text-2xl font-black text-ink uppercase tracking-tighter group-hover:text-accent transition-colors">{group.name}</h3>
                  <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${group.visibility === 'private' ? 'border-accent/30 bg-accent-soft text-accent' : 'border-sync/30 bg-sync-soft text-sync'}`}>
                    {group.visibility === 'private' ? <Lock size={10} /> : <Globe2 size={10} />}
                    {group.visibility === 'private' ? t('pods.private') : t('pods.public')}
                  </span>
                </div>
                <p className="text-xs text-ink/60 line-clamp-2 leading-relaxed">{group.description}</p>
                <div className="grid grid-cols-3 gap-2 pt-3">
                  {[
                    { label: t('pods.members'), value: groupMemberCount, icon: Users },
                    { label: t('pods.missions'), value: groupMissionCount, icon: Target },
                    { label: t('pods.day_streak'), value: groupStreak, icon: Flame }
                  ].map((metric) => {
                    const Icon = metric.icon
                    return (
                      <div key={metric.label} className="bg-canvas border-2 border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[7px] text-ink/40 uppercase font-black tracking-widest truncate">{metric.label}</p>
                          <Icon size={12} className="text-accent" />
                        </div>
                        <p className="text-lg font-black text-ink tracking-tighter">{metric.value}</p>
                      </div>
                    )
                  })}
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
                  <button onClick={() => onSelectPod(group)} className="w-full py-4 bg-canvas text-accent border-2 border-border text-[10px] font-black uppercase hover:bg-accent hover:text-white transition-all active:scale-[0.98] tracking-[0.2em] flex items-center justify-center gap-2">
                    <Activity size={14} />
                    {t('pods.enter')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    {group.visibility === 'private' && (
                      <input
                        type="text"
                        value={joinCodes[group.id] || ''}
                        onChange={(e) => setJoinCodes(prev => ({ ...prev, [group.id]: e.target.value }))}
                        placeholder={t('pods.enter_code')}
                        className="w-full input-primary py-3 text-[10px] uppercase tracking-widest"
                      />
                    )}
                    <button
                      onClick={() => handleJoinGroup(group.id)}
                      disabled={group.visibility === 'private' && !joinCodes[group.id]?.trim()}
                      className="w-full py-4 bg-accent-soft text-accent border-2 border-accent text-[10px] font-black uppercase hover:bg-accent hover:text-white transition-all active:scale-[0.98] tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('pods.join')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
