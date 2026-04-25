import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { Users, Plus, UserPlus, LogOut, ArrowRight, Trash2 } from 'lucide-react'
import type { Group } from '../types'
import type { Session } from '@supabase/supabase-js'

interface AccountabilityPodsProps {
  session: Session | null
}

export function AccountabilityPods({ session }: AccountabilityPodsProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

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
    fetchGroups()
  }, [fetchGroups])

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

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-500">Synchronizing_Pod_Network...</div>

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
                    <button className="flex items-center gap-2 text-cyan-400 text-[8px] font-black uppercase tracking-widest hover:text-cyan-300">
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
