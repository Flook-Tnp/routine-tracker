import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, UserPlus, LogOut, ArrowRight, Trash2, ChevronLeft, Zap, Award, Bell, Activity } from 'lucide-react'
import type { Group, MemberVital } from '../types'
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

  const fetchMembers = useCallback(async (groupId: string) => {
    try {
      setLoading(true)
      const data = await StorageService.fetchMemberVitals(groupId)
      setPodMembers(data)
    } catch (err) {
      console.error('Error fetching members:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (mounted) {
      if (selectedPod) {
        fetchMembers(selectedPod.id)
      } else {
        fetchGroups()
      }
    }
    return () => { mounted = false }
  }, [fetchGroups, fetchMembers, selectedPod])

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
    const avgProgress = podMembers.length > 0 
      ? podMembers.reduce((acc, m) => acc + (m.routines_total > 0 ? (m.routines_completed_today / m.routines_total) : 0), 0) / podMembers.length 
      : 0

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
        <button 
          onClick={() => onSelectPod(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
        >
          <ChevronLeft size={14} /> Back_to_Network
        </button>

        <section className="bg-gray-950 border border-gray-900 p-8 space-y-8 relative overflow-hidden">
          {/* Synergy Meter */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-900">
            <div 
              className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000" 
              style={{ width: `${avgProgress * 100}%` }}
            />
          </div>

          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedPod.name}</h2>
                <div className="px-2 py-0.5 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-widest animate-pulse">
                  Synergy: {Math.round(avgProgress * 100)}%
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono leading-relaxed max-w-lg">{selectedPod.description}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Protocol_Established</p>
              <p className="text-[10px] text-cyan-500 font-mono">{new Date(selectedPod.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                <Activity size={12} className="text-cyan-500" /> Neural_Vitals_Grid
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {podMembers.length > 0 ? (
                  podMembers.sort((a,b) => (b.total_xp || 0) - (a.total_xp || 0)).map((member) => {
                    const isMe = member.id === session?.user?.id
                    const progress = member.routines_total > 0 ? (member.routines_completed_today / member.routines_total) : 0
                    
                    // Determine Status
                    const isStable = progress === 1
                    const isCritical = !isStable && new Date().getHours() >= 20 // 8 PM
                    const isDegrading = !isStable && !isCritical && new Date().getHours() >= 14 // 2 PM
                    
                    let statusLabel = 'STABLE'
                    let statusColor = 'text-cyan-500'
                    let borderColor = 'border-gray-900'
                    let pulseClass = 'animate-pulse'

                    if (isCritical) {
                      statusLabel = 'CRITICAL'
                      statusColor = 'text-red-500'
                      borderColor = 'border-red-900/50'
                      pulseClass = 'animate-[pulse_1s_infinite]'
                    } else if (isDegrading) {
                      statusLabel = 'DEGRADING'
                      statusColor = 'text-orange-500'
                      borderColor = 'border-orange-900/30'
                    } else if (isStable) {
                      pulseClass = ''
                    }

                    return (
                      <div 
                        key={member.id} 
                        className={`bg-black border ${borderColor} p-4 space-y-4 transition-all relative group/card ${!isMe && 'hover:border-cyan-500/30'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div 
                            className={`flex items-center gap-3 ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
                            onClick={() => !isMe && onSelectUser?.(member.id)}
                          >
                            <div className={`w-10 h-10 bg-gray-900 border ${isStable ? 'border-cyan-500/50' : 'border-gray-800'} flex items-center justify-center overflow-hidden relative`}>
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-gray-500">{member.username?.[0]}</span>
                              )}
                              {!isStable && <div className={`absolute inset-0 border-2 ${statusColor.replace('text-', 'border-')}/20 ${pulseClass}`} />}
                            </div>
                            <div>
                              <p className={`text-xs font-black uppercase tracking-tighter ${isMe ? 'text-white' : 'text-gray-300 group-hover/card:text-cyan-400'}`}>
                                {member.username} {isMe && '(YOU)'}
                              </p>
                              <p className={`text-[7px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</p>
                            </div>
                          </div>
                          
                          {!isMe && session && !isStable && (
                            <button
                              onClick={() => handlePing(member.id, member.username)}
                              className={`p-2 border ${isCritical ? 'border-red-500/30 text-red-500' : 'border-gray-800 text-gray-600'} hover:bg-white hover:text-black transition-all`}
                              title="Transmit Nudge"
                            >
                              <Bell size={12} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-gray-600">
                            <span>Today_Sync</span>
                            <span>{Math.round(progress * 100)}%</span>
                          </div>
                          <div className="h-1 bg-gray-900 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${isStable ? 'bg-cyan-500' : isCritical ? 'bg-red-500' : 'bg-orange-500'}`}
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-end pt-2 border-t border-gray-900/50">
                          <div className="flex items-center gap-1 text-orange-500">
                            <Zap size={10} fill="currentColor" />
                            <span className="text-[10px] font-black">{(member.total_xp || 0).toLocaleString()}</span>
                          </div>
                          <p className="text-[6px] text-gray-700 uppercase font-black">Last_Active: {member.last_activity_date || 'Unknown'}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-full py-10 text-center border border-dashed border-gray-900">
                    <p className="text-[8px] text-gray-700 uppercase tracking-widest">No active neural signatures</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold flex items-center gap-2">
                <Award size={12} className="text-orange-500" /> Pod_Pulse
              </h3>
              <SocialFeed 
                session={session} 
                groupId={selectedPod.id} 
                dailyStreak={dailyStreak} 
                onShareStreak={onShareStreak} 
                onSelectUser={onSelectUser}
              />
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
