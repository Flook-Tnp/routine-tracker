import { useState, useRef } from 'react'
import { StorageService } from '../lib/storage'
import type { Routine, Profile as ProfileType } from '../types'
import { Award, Zap, Target, Camera, Edit2, Check, X, Trash2 } from 'lucide-react'

interface ProfileProps {
  profile: ProfileType | null
  routines: Routine[]
  dailyStreak: number
  weeklyStreak: number
  onProfileUpdate?: (profile: ProfileType) => void
  isPublic?: boolean
  onBack?: () => void
}

export function Profile({ profile, routines, dailyStreak, weeklyStreak, onProfileUpdate, isPublic, onBack }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState(profile?.username || '')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!profile) return (
    <div className="text-center py-20 space-y-6">
      <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Synchronizing_Neural_Identity...</p>
        <p className="text-[8px] text-gray-700 font-mono">Status: Establishing secure connection to profile sector</p>
      </div>
      <button 
        onClick={() => onBack ? onBack() : window.location.reload()}
        className="btn-primary"
      >
        {onBack ? 'Return_to_Standings' : 'Re-Initialize_System'}
      </button>
    </div>
  )

  const handleUsernameUpdate = async () => {
    if (isPublic) return
    if (!newUsername.trim() || newUsername === profile.username) {
      setIsEditing(false)
      return
    }
    try {
      await StorageService.updateProfile(profile.id, { username: newUsername })
      if (onProfileUpdate) onProfileUpdate({ ...profile, username: newUsername })
      setIsEditing(false)
    } catch (err: any) {
      console.error('Update failed:', err)
      alert(`UPDATE_FAILURE: ${err.message || 'Username might be taken'}`)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPublic) return
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const url = await StorageService.uploadAvatar(profile.id, file)
      await StorageService.updateProfile(profile.id, { avatar_url: url })
      if (onProfileUpdate) onProfileUpdate({ ...profile, avatar_url: url })
    } catch (err: any) {
      console.error('Upload failed:', err)
      alert(`UPLOAD_FAILURE: ${err.message || 'Check Supabase Storage settings'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAvatarDelete = async () => {
    if (isPublic || !profile || !profile.avatar_url) return
    if (!confirm('Are you sure you want to delete your profile picture?')) return

    try {
      setIsUploading(true)
      await StorageService.deleteAvatar(profile.id)
      if (onProfileUpdate) onProfileUpdate({ ...profile, avatar_url: null })
    } catch (err: any) {
      console.error('Delete failed:', err)
      alert(`DELETE_FAILURE: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const categoriesList = Array.from(new Set(routines.map(r => r.category || 'General')))
  
  return (
    <div className="space-y-12 view-enter">
      {isPublic && (
        <button 
          onClick={onBack}
          className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-cyan-500 transition-colors flex items-center gap-2 font-black active:scale-95"
        >
          <X size={14} /> [Exit_Neural_Link]
        </button>
      )}
      <section className="text-center space-y-6">
        <div className="relative inline-block">
          <div className="p-1.5 border border-cyan-500/30 rounded-full mb-2 overflow-hidden bg-gray-950">
            <div className="w-28 h-28 bg-gray-900 rounded-full flex items-center justify-center text-4xl font-black text-cyan-500 overflow-hidden shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                profile.username?.[0]?.toUpperCase() || 'U'
              )}
            </div>
          </div>
          {!isPublic && (
            <div className="flex justify-center gap-3 absolute -bottom-2 left-1/2 -translate-x-1/2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 bg-black border border-gray-800 rounded-full text-cyan-500 hover:text-white hover:border-cyan-500 transition-all shadow-2xl disabled:opacity-50 active:scale-90"
              >
                <Camera size={16} className={isUploading ? 'animate-pulse' : ''} />
              </button>
              {profile.avatar_url && (
                <button 
                  onClick={handleAvatarDelete}
                  disabled={isUploading}
                  className="p-2.5 bg-black border border-gray-800 rounded-full text-red-500 hover:text-white hover:border-red-500 transition-all shadow-2xl disabled:opacity-50 active:scale-90"
                  title="Delete Profile Picture"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="flex flex-col items-center gap-3 pt-4">
          {isEditing && !isPublic ? (
            <div className="flex items-center gap-2 bg-gray-950 border border-cyan-500/50 px-4 py-2 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <input
                autoFocus
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-transparent text-xl font-black text-white uppercase tracking-tighter outline-none w-48 text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleUsernameUpdate()}
              />
              <button onClick={handleUsernameUpdate} className="text-cyan-500 hover:text-cyan-400 active:scale-90">
                <Check size={20} />
              </button>
              <button onClick={() => { setIsEditing(false); setNewUsername(profile.username); }} className="text-gray-600 hover:text-red-400 active:scale-90">
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter md:text-4xl">{profile.username}</h2>
              {!isPublic && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-700 hover:text-cyan-500 transition-colors md:opacity-0 group-hover:opacity-100"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          )}
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center flex-wrap gap-2">
              {profile.badges?.map((badge) => (
                <div key={badge.id} className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 text-[10px] uppercase font-black text-cyan-400 flex items-center gap-2">
                  <span className="text-sm">{badge.icon}</span>
                  {badge.name}
                </div>
              ))}
              {(!profile.badges || profile.badges.length === 0) && (
                <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold">NO_BADGES_IDENTIFIED</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-950 border border-gray-900 p-8 space-y-2 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Zap size={24} className="text-orange-500 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Lifetime_XP</p>
          <p className="text-4xl font-black text-white tracking-tighter">{(profile.lifetime_xp || profile.total_xp).toLocaleString()}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-8 space-y-2 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Award size={24} className="text-cyan-400 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Daily_Streak</p>
          <p className="text-4xl font-black text-white tracking-tighter">{dailyStreak}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-8 space-y-2 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Target size={24} className="text-purple-500 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Weekly_Goal</p>
          <p className="text-4xl font-black text-white tracking-tighter">{weeklyStreak}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-600 font-black border-b border-gray-900 pb-3">Active_Neural_Sectors</h3>
        <div className="flex flex-wrap gap-2">
          {categoriesList.map(cat => (
            <span key={cat} className="px-4 py-2 bg-gray-950 border border-gray-800 text-[10px] uppercase tracking-widest text-gray-300 font-black shadow-sm">
              {cat}
            </span>
          ))}
          {categoriesList.length === 0 && (
            <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold">No active sectors established</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-600 font-black border-b border-gray-900 pb-3">Achievement_Protocol</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Streak_7', 'Streak_30', 'Streak_100', 'XP_1000'].map(id => {
            const hasBadge = profile.badges?.some((b) => b.id.toLowerCase() === id.toLowerCase())
            return (
              <div key={id} className={`p-6 border text-center space-y-3 transition-all duration-500 ${hasBadge ? 'bg-cyan-500/5 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-gray-950/30 border-gray-900 grayscale opacity-40 hover:grayscale-0 hover:opacity-100'}`}>
                <div className="text-3xl mb-1">
                  {id.includes('Streak') ? '🔥' : '💎'}
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">{id.replace('_', ' ')}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
