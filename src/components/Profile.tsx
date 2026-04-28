import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns'
import { StorageService } from '../lib/storage'
import type { Routine, Profile as ProfileType, RoutineCompletion } from '../types'
import { Zap, Camera, Edit2, Check, X, Trash2, Flame, Trophy, Scissors } from 'lucide-react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../lib/image'

interface ProfileProps {
  profile: ProfileType | null
  routines: Routine[]
  dailyStreak: number
  weeklyStreak: number
  onProfileUpdate?: (profile: ProfileType) => void
  isPublic?: boolean
  onBack?: () => void
}

const STREAK_MILESTONES = [
  { id: 'Streak_3', name: 'Spark', count: 3, icon: '✨' },
  { id: 'Streak_7', name: 'Ignition', count: 7, icon: '🔥' },
  { id: 'Streak_30', name: 'Flame', count: 30, icon: '🔥' },
  { id: 'Streak_100', name: 'Bonfire', count: 100, icon: '🔥' },
  { id: 'Streak_365', name: 'Inferno', count: 365, icon: '🔥' },
  { id: 'Streak_730', name: 'Supernova', count: 730, icon: '💥' },
  { id: 'Streak_1000', name: 'Solar Flare', count: 1000, icon: '☀️' },
  { id: 'Streak_1825', name: 'Stellar Core', count: 1825, icon: '💎' }
]

const XP_MILESTONES = [
  { id: 'XP_1000', name: 'Initiate', count: 1000, icon: '💎' },
  { id: 'XP_5000', name: 'Adept', count: 5000, icon: '💎' },
  { id: 'XP_10000', name: 'Veteran', count: 10000, icon: '💎' },
  { id: 'XP_25000', name: 'Elite', count: 25000, icon: '⚔️' },
  { id: 'XP_50000', name: 'Master', count: 50000, icon: '🏆' },
  { id: 'XP_100000', name: 'Grandmaster', count: 100000, icon: '👑' },
  { id: 'XP_250000', name: 'Legend', count: 250000, icon: '🌌' }
]

export function Profile({ profile, routines, dailyStreak, weeklyStreak, onProfileUpdate, isPublic, onBack }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState(profile?.username || '')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  // Count unique physical days for the UI check as well
  const [uniqueLoggingDays, setUniqueLoggingDays] = useState(0)
  const [showTrophyRoom, setShowTrophyRoom] = useState<'streak' | 'xp' | null>(null)

  // Update local state when profile changes (essential when switching between users)
  useEffect(() => {
    if (profile?.username) {
      setNewUsername(profile.username)
    }
  }, [profile?.username])

  // Count unique physical days for the UI check
  useEffect(() => {
    if (profile?.id) {
      StorageService.fetchCompletions(profile.id).then(fetchedCompletions => {
        if (!Array.isArray(fetchedCompletions)) return
        setCompletions(fetchedCompletions)
        const count = new Set(
          fetchedCompletions
            .filter(c => c && c.completed_date)
            .map(c => c.completed_date)
        ).size
        setUniqueLoggingDays(count)
      }).catch(err => console.error('Failed to fetch completions for streak check:', err))
    }
  }, [profile?.id, dailyStreak])

  // Permanently award badges if they don't exist
  const checkMilestones = async () => {
    if (isPublic || !profile) return
    
    const currentBadges = profile.badges || []
    const newBadges = [...currentBadges]
    let changed = false

    // Anti-Cheat: Count how many UNIQUE PHYSICAL DAYS the user actually opened the app and logged work.
    const routineCompletions = await StorageService.fetchCompletions(profile.id)
    const completionsCount = new Set(
      routineCompletions
        .filter(c => c && c.created_at)
        .map(c => c.created_at!.split('T')[0])
    ).size

    const milestones = [
      ...STREAK_MILESTONES.map(m => ({ ...m, check: dailyStreak >= m.count && completionsCount >= m.count })),
      ...XP_MILESTONES.map(m => ({ ...m, check: (profile.total_xp || 0) >= m.count }))
    ]

    milestones.forEach(m => {
      if (m.check && !currentBadges.some(b => b.id.toLowerCase() === m.id.toLowerCase())) {
        newBadges.push({ id: m.id, name: m.name, icon: m.icon })
        changed = true
      }
    })

    if (changed) {
      try {
        await StorageService.updateProfile(profile.id, { badges: newBadges })
        if (onProfileUpdate) onProfileUpdate({ ...profile, badges: newBadges })
      } catch (err) {
        console.error('Failed to permanently award badges:', err)
      }
    }
  }

  // Check milestones whenever stats change
  useEffect(() => {
    if (profile) {
      checkMilestones()
    }
  }, [dailyStreak, profile?.total_xp])

  const { categoryStreaks, categoryWeeklyStreaks } = useMemo(() => {
    const streaks: Record<string, number> = {}
    const wStreaks: Record<string, number> = {}
    const cats = Array.from(new Set((routines || []).map(r => r.category || 'General')))
    
    cats.forEach(cat => {
      const categoryRoutines = routines.filter(r => (r.category || 'General') === cat)
      const categoryRoutineIds = new Set(categoryRoutines.map(r => r.id))
      const doneDates = new Set(
        completions
          .filter(c => categoryRoutineIds.has(c.routine_id))
          .map(c => c.completed_date)
      )

      // Calculate Daily Streak
      let streak = 0
      let checkDate = new Date()
      const isDateFinished = (date: Date) => doneDates.has(format(date, 'yyyy-MM-dd'))

      if (!isDateFinished(checkDate)) checkDate = subDays(checkDate, 1)
      while (isDateFinished(checkDate)) {
        streak++
        checkDate = subDays(checkDate, 1)
        if (streak > 10000) break 
      }
      streaks[cat] = streak

      // Calculate Weekly Streak (3+ completions per week)
      let wStreak = 0
      const isWeekSuccessful = (dateInWeek: Date) => {
        const start = startOfDay(subDays(dateInWeek, dateInWeek.getDay()))
        const weekDays = eachDayOfInterval({ start, end: subDays(start, -6) })
        let activeDaysCount = 0
        weekDays.forEach(d => {
          if (doneDates.has(format(d, 'yyyy-MM-dd'))) activeDaysCount++
        })
        return activeDaysCount >= 3
      }
      
      let currentCheck = new Date()
      if (!isWeekSuccessful(currentCheck)) currentCheck = subDays(currentCheck, 7)
      while (isWeekSuccessful(currentCheck)) {
        wStreak++
        currentCheck = subDays(currentCheck, 7)
        if (wStreak > 500) break
      }
      wStreaks[cat] = wStreak
    })
    return { categoryStreaks: streaks, categoryWeeklyStreaks: wStreaks }
  }, [routines, completions])

  const categoriesList = Array.from(new Set((routines || []).map(r => r.category || 'General')))

  const onCropComplete = useCallback((_preventedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Achievement Logic: Evolving Badges
  const streakProgress = useMemo(() => {
    const highest = [...STREAK_MILESTONES].reverse().find(m => dailyStreak >= m.count && uniqueLoggingDays >= m.count)
    const next = STREAK_MILESTONES.find(m => dailyStreak < m.count || uniqueLoggingDays < m.count)
    return { current: highest, next }
  }, [dailyStreak, uniqueLoggingDays])

  const xpProgress = useMemo(() => {
    const totalXp = profile?.lifetime_xp || profile?.total_xp || 0
    const highest = [...XP_MILESTONES].reverse().find(m => totalXp >= m.count)
    const next = XP_MILESTONES.find(m => totalXp < m.count)
    return { current: highest, next }
  }, [profile?.lifetime_xp, profile?.total_xp])

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result as string)
    })
    reader.readAsDataURL(file)
  }

  const handleSaveCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels || !profile) return

    try {
      setIsUploading(true)
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels)
      if (!croppedImageBlob) throw new Error('Could not crop image')

      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' })
      const url = await StorageService.uploadAvatar(profile.id, file)
      await StorageService.updateProfile(profile.id, { avatar_url: url })
      
      if (onProfileUpdate) onProfileUpdate({ ...profile, avatar_url: url })
      setImageToCrop(null)
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

      {/* Cropper Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-gray-950 border border-gray-800 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-900 flex justify-between items-center bg-black/50">
              <span className="text-[10px] uppercase font-black text-cyan-500 tracking-[0.3em] flex items-center gap-2">
                <Scissors size={14} /> [Identity_Adjustment_Protocol]
              </span>
              <button onClick={() => setImageToCrop(null)} className="text-gray-600 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="relative h-[300px] md:h-[400px] bg-black">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-6 space-y-6 bg-gray-950">
              <div className="space-y-3">
                <div className="flex justify-between text-[8px] uppercase font-black text-gray-600 tracking-widest">
                  <span>Zoom_Magnitude</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-gray-900 rounded-none appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleSaveCrop}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isUploading ? 'SYNCHRONIZING...' : 'ESTABLISH_NEURAL_LINK'}
                </button>
                <button 
                  onClick={() => setImageToCrop(null)}
                  className="px-8 py-4 bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-all active:scale-[0.98]"
                >
                  ABORT
                </button>
              </div>
            </div>
          </div>
        </div>
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
            onChange={handleFileChange} 
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
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter md:text-4xl">{profile.username || 'Anonymous_User'}</h2>
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
          <p className="text-4xl font-black text-white tracking-tighter">{(profile.lifetime_xp || profile.total_xp || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-8 space-y-2 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Flame size={24} fill="currentColor" className="text-orange-500 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Daily_Streak</p>
          <p className="text-4xl font-black text-white tracking-tighter">{dailyStreak || 0}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-8 space-y-2 text-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Trophy size={24} className="text-cyan-400 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Weekly_Streak</p>
          <p className="text-4xl font-black text-white tracking-tighter">{weeklyStreak || 0}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-600 font-black border-b border-gray-900 pb-3">Active_Neural_Sectors</h3>
        <div className="flex flex-wrap gap-2">
          {categoriesList.map(cat => {
            const isSelected = selectedCategory === cat
            const streak = categoryStreaks[cat] || 0
            const wStreak = categoryWeeklyStreaks[cat] || 0
            return (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`px-4 py-2 border text-[10px] uppercase tracking-widest font-black shadow-sm transition-all flex items-center gap-2 active:scale-95 ${
                  isSelected 
                    ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-600'
                }`}
              >
                {cat}
                {isSelected && (
                  <div className="flex items-center">
                    <span className="flex items-center gap-1 border-l border-black/20 pl-2 ml-1 animate-in slide-in-from-left-2 duration-300">
                      <Flame size={12} fill="currentColor" />
                      {streak}
                    </span>
                    <span className="flex items-center gap-1 border-l border-black/20 pl-2 ml-1 animate-in slide-in-from-left-2 duration-300">
                      <Trophy size={12} />
                      {wStreak}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
          {categoriesList.length === 0 && (
            <p className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold">No active sectors established</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-600 font-black border-b border-gray-900 pb-3">Achievement_Protocol</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Streak Evolving Badge */}
          <button 
            onClick={() => setShowTrophyRoom('streak')}
            className="group relative bg-gray-950/30 border border-gray-900 p-6 flex flex-col items-center gap-4 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={12} className="text-cyan-500" />
            </div>
            
            <div className="relative">
              <div className="text-5xl mb-2 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:scale-110 transition-transform duration-500">
                {streakProgress.current?.icon || '⏳'}
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Consistancy_Protocol</p>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                {streakProgress.current?.name || 'Initiating...'}
              </h4>
            </div>

            {streakProgress.next && (
              <div className="w-full space-y-2 mt-2">
                <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-gray-600">
                  <span>Next: {streakProgress.next.name}</span>
                  <span>{dailyStreak} / {streakProgress.next.count} Days</span>
                </div>
                <div className="h-1 w-full bg-gray-900 overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-1000"
                    style={{ width: `${Math.min(100, (dailyStreak / streakProgress.next.count) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>

          {/* XP Evolving Badge */}
          <button 
            onClick={() => setShowTrophyRoom('xp')}
            className="group relative bg-gray-950/30 border border-gray-900 p-6 flex flex-col items-center gap-4 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={12} className="text-cyan-500" />
            </div>

            <div className="relative">
              <div className="text-5xl mb-2 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:scale-110 transition-transform duration-500">
                {xpProgress.current?.icon || '💎'}
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Accumulation_Protocol</p>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                {xpProgress.current?.name || 'Initiating...'}
              </h4>
            </div>

            {xpProgress.next && (
              <div className="w-full space-y-2 mt-2">
                <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-gray-600">
                  <span>Next: {xpProgress.next.name}</span>
                  <span>{(profile?.lifetime_xp || profile?.total_xp || 0).toLocaleString()} / {xpProgress.next.count.toLocaleString()} XP</span>
                </div>
                <div className="h-1 w-full bg-gray-900 overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-1000"
                    style={{ width: `${Math.min(100, ((profile?.lifetime_xp || profile?.total_xp || 0) / xpProgress.next.count) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>
        </div>
      </section>

      {!isPublic && (
        <section className="pt-8 border-t border-gray-900">
          <button 
            onClick={() => {
              import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut())
            }}
            className="w-full py-4 bg-red-950/20 border border-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            [Terminate_Session]
          </button>
        </section>
      )}

      {/* Trophy Room Modal */}
      {showTrophyRoom && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-gray-950 border border-gray-900 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-900 flex justify-between items-center bg-black/50">
              <span className="text-[10px] uppercase font-black text-cyan-500 tracking-[0.3em] flex items-center gap-2">
                <Trophy size={14} /> [Trophy_Room_Protocol: {showTrophyRoom.toUpperCase()}]
              </span>
              <button onClick={() => setShowTrophyRoom(null)} className="text-gray-600 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {(showTrophyRoom === 'streak' ? STREAK_MILESTONES : XP_MILESTONES).map((m) => {
                const totalXp = profile?.lifetime_xp || profile?.total_xp || 0
                const isEarned = showTrophyRoom === 'streak' 
                  ? (dailyStreak >= m.count && uniqueLoggingDays >= m.count)
                  : (totalXp >= m.count)
                
                return (
                  <div 
                    key={m.id}
                    className={`p-4 border flex items-center gap-6 transition-all duration-500 ${
                      isEarned 
                        ? 'bg-cyan-500/5 border-cyan-500/30' 
                        : 'bg-gray-950/50 border-gray-900/50 opacity-40 grayscale'
                    }`}
                  >
                    <div className="text-4xl">{m.icon}</div>
                    <div className="flex-1">
                      <h5 className={`text-sm font-black uppercase tracking-widest ${isEarned ? 'text-cyan-400' : 'text-gray-600'}`}>
                        {m.name}
                      </h5>
                      <p className="text-[10px] text-gray-700 font-mono">
                        Requirement: {m.count.toLocaleString()} {showTrophyRoom === 'streak' ? 'Days' : 'XP'}
                      </p>
                    </div>
                    {isEarned ? (
                      <div className="px-2 py-1 bg-cyan-500 text-black text-[8px] font-black uppercase tracking-widest">
                        Unlocked
                      </div>
                    ) : (
                      <div className="text-[8px] text-gray-800 font-black uppercase tracking-widest">
                        Locked
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            <div className="p-4 border-t border-gray-900 bg-black/30">
              <button 
                onClick={() => setShowTrophyRoom(null)}
                className="w-full py-3 bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                Close_Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
