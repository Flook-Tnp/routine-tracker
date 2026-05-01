import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns'
import { StorageService } from '../lib/storage'
import type { Routine, Profile as ProfileType, RoutineCompletion } from '../types'
import { Zap, Camera, Edit2, Check, X, Trash2, Flame, Trophy, Scissors } from 'lucide-react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../lib/image'
import { useTranslation } from '../lib/i18n'

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
  const { t } = useTranslation();

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

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showTrophyRoom || imageToCrop) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showTrophyRoom, imageToCrop])

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
    <div className="text-center py-20 space-y-6 font-mono">
      <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-none animate-spin mx-auto" />
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-ink/40">{t('profile.loading')}</p>
        <p className="text-[8px] text-ink/20 font-black">Status: Establishing secure connection to profile sector</p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <button 
          onClick={() => onBack ? onBack() : window.location.reload()}
          className="btn-primary w-64"
        >
          {onBack ? 'Return_to_Standings' : 'Re-Initialize_System'}
        </button>
        {!isPublic && (
          <button 
            onClick={() => import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut())}
            className="text-[10px] font-black uppercase tracking-widest text-ink/40 hover:text-red-500 transition-colors"
          >
            [Force_Log_Out_Stale_Session]
          </button>
        )}
      </div>
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
    <div className="space-y-12 view-enter font-mono">
      {isPublic && (
        <button 
          onClick={onBack}
          className="text-[10px] uppercase tracking-widest text-ink/40 hover:text-accent transition-colors flex items-center gap-2 font-black active:scale-95 px-1"
        >
          <X size={14} /> [Exit_Neural_Link]
        </button>
      )}

      {/* Cropper Modal */}
      {imageToCrop && createPortal(
        <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-white border-2 border-border shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col">
            <div className="p-4 border-b-2 border-border flex justify-between items-center bg-canvas">
              <span className="text-[10px] uppercase font-black text-accent tracking-[0.3em] flex items-center gap-2">
                <Scissors size={14} /> [Identity_Adjustment_Protocol]
              </span>
              <button onClick={() => setImageToCrop(null)} className="text-ink/40 hover:text-accent transition-colors">
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

            <div className="p-6 space-y-6 bg-white">
              <div className="space-y-3">
                <div className="flex justify-between text-[8px] uppercase font-black text-ink/40 tracking-widest">
                  <span>{t('profile.zoom')}</span>
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
                  className="w-full h-1 bg-canvas rounded-none appearance-none cursor-pointer accent-accent"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleSaveCrop}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] border-2 border-border hover:bg-black transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none disabled:opacity-50"
                >
                  {isUploading ? t('profile.saving') : t('profile.save_picture')}
                </button>
                <button 
                  onClick={() => setImageToCrop(null)}
                  className="px-8 py-4 bg-canvas text-ink/40 text-[10px] font-black uppercase tracking-[0.2em] border-2 border-border hover:bg-white transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <section className="text-center space-y-6">
        <div className="relative inline-block">
          <div className="p-1.5 border-2 border-accent rounded-full mb-2 overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(124,58,237,1)]">
            <div className="w-28 h-28 bg-canvas rounded-full flex items-center justify-center text-4xl font-black text-accent overflow-hidden">
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
                className="p-2.5 bg-white border-2 border-border rounded-full text-accent hover:bg-accent hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <Camera size={16} className={isUploading ? 'animate-pulse' : ''} />
              </button>
              {profile.avatar_url && (
                <button 
                  onClick={handleAvatarDelete}
                  disabled={isUploading}
                  className="p-2.5 bg-white border-2 border-border rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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
            <div className="flex items-center gap-2 bg-white border-2 border-accent px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <input
                autoFocus
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-transparent text-xl font-black text-ink uppercase tracking-tighter outline-none w-48 text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleUsernameUpdate()}
              />
              <button onClick={handleUsernameUpdate} className="text-accent hover:text-ink active:scale-90">
                <Check size={20} />
              </button>
              <button onClick={() => { setIsEditing(false); setNewUsername(profile.username); }} className="text-ink/40 hover:text-red-600 active:scale-90">
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group">
              <h2 className="text-3xl font-black text-ink uppercase tracking-tighter md:text-4xl">{profile.username || 'Anonymous_User'}</h2>
              {!isPublic && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-ink/20 hover:text-accent transition-colors md:opacity-0 group-hover:opacity-100"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          )}
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center flex-wrap gap-2">
              {profile.badges?.map((badge) => (
                <div key={badge.id} className="px-3 py-1.5 bg-accent-soft border border-accent/20 text-[10px] uppercase font-black text-accent flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-sm">{badge.icon}</span>
                  {badge.name}
                </div>
              ))}
              {(!profile.badges || profile.badges.length === 0) && (
                <p className="text-[10px] text-ink/20 uppercase tracking-[0.2em] font-black">{t('profile.no_badges')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-2 border-border p-8 space-y-2 text-center relative group overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Zap size={24} className="text-accent mx-auto mb-2" />
          <p className="text-[10px] text-ink/40 uppercase tracking-[0.2em] font-black">{t('profile.lifetime_xp')}</p>
          <p className="text-4xl font-black text-ink tracking-tighter">{(profile.lifetime_xp || profile.total_xp || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white border-2 border-border p-8 space-y-2 text-center relative group overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Flame size={24} fill="currentColor" className="text-accent mx-auto mb-2" />
          <p className="text-[10px] text-ink/40 uppercase tracking-[0.2em] font-black">{t('profile.daily_streak')}</p>
          <p className="text-4xl font-black text-ink tracking-tighter">{dailyStreak || 0}</p>
        </div>
        <div className="bg-white border-2 border-border p-8 space-y-2 text-center relative group overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Trophy size={24} className="text-accent mx-auto mb-2" />
          <p className="text-[10px] text-ink/40 uppercase tracking-[0.2em] font-black">{t('profile.weekly_streak')}</p>
          <p className="text-4xl font-black text-ink tracking-tighter">{weeklyStreak || 0}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-ink/40 font-black border-b-2 border-border pb-3">{t('profile.categories')}</h3>
        <div className="flex flex-wrap gap-3">
          {categoriesList.map(cat => {
            const isSelected = selectedCategory === cat
            const streak = categoryStreaks[cat] || 0
            const wStreak = categoryWeeklyStreaks[cat] || 0
            return (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`px-4 py-3 border-2 text-[10px] uppercase tracking-widest font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  isSelected 
                    ? 'bg-accent border-border text-white' 
                    : 'bg-white border-border text-ink hover:bg-canvas'
                }`}
              >
                {cat}
                {isSelected && (
                  <div className="flex items-center">
                    <span className="flex items-center gap-1 border-l border-white/20 pl-2 ml-1 animate-in slide-in-from-left-2 duration-300">
                      <Flame size={12} fill="currentColor" />
                      {streak}
                    </span>
                    <span className="flex items-center gap-1 border-l border-white/20 pl-2 ml-1 animate-in slide-in-from-left-2 duration-300">
                      <Trophy size={12} />
                      {wStreak}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
          {categoriesList.length === 0 && (
            <p className="text-[10px] text-ink/20 uppercase tracking-[0.2em] font-black">{t('profile.no_categories')}</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-ink/40 font-black border-b-2 border-border pb-3">{t('profile.achievements')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Streak Evolving Badge */}
          <button 
            onClick={() => setShowTrophyRoom('streak')}
            className="group relative bg-white border-2 border-border p-8 flex flex-col items-center gap-4 transition-all hover:border-accent shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(124,58,237,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={16} className="text-accent" />
            </div>
            
            <div className="relative">
              <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-500">
                {streakProgress.current?.icon || '⏳'}
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-ink/40">{t('profile.consistency')}</p>
              <h4 className="text-2xl font-black text-ink uppercase tracking-tighter">
                {streakProgress.current?.name || 'Initiating...'}
              </h4>
            </div>

            {streakProgress.next && (
              <div className="w-full space-y-2 mt-2">
                <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-ink/40">
                  <span>Next: {streakProgress.next.name}</span>
                  <span>{dailyStreak} / {streakProgress.next.count} Days</span>
                </div>
                <div className="h-1.5 w-full bg-canvas border-2 border-border/10 overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${Math.min(100, (dailyStreak / streakProgress.next.count) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>

          {/* XP Evolving Badge */}
          <button 
            onClick={() => setShowTrophyRoom('xp')}
            className="group relative bg-white border-2 border-border p-8 flex flex-col items-center gap-4 transition-all hover:border-accent shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(124,58,237,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={16} className="text-accent" />
            </div>

            <div className="relative">
              <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-500">
                {xpProgress.current?.icon || '💎'}
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-ink/40">{t('profile.experience')}</p>
              <h4 className="text-2xl font-black text-ink uppercase tracking-tighter">
                {xpProgress.current?.name || 'Initiating...'}
              </h4>
            </div>

            {xpProgress.next && (
              <div className="w-full space-y-2 mt-2">
                <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-ink/40">
                  <span>Next: {xpProgress.next.name}</span>
                  <span>{(profile?.lifetime_xp || profile?.total_xp || 0).toLocaleString()} / {xpProgress.next.count.toLocaleString()} XP</span>
                </div>
                <div className="h-1.5 w-full bg-canvas border-2 border-border/10 overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${Math.min(100, ((profile?.lifetime_xp || profile?.total_xp || 0) / xpProgress.next.count) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>
        </div>
      </section>

      {!isPublic && (
        <section className="pt-8 border-t-2 border-border">
          <button
            onClick={() => {
              import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut())
            }}
            className="w-full py-5 bg-canvas border-2 border-border text-ink/40 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            [Log_Out]
          </button>
        </section>
      )}
      {/* Trophy Room Modal */}
      {showTrophyRoom && createPortal(
        <div className="fixed inset-0 z-[110] bg-white/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-300">
          <div className="w-full h-full md:h-auto md:max-w-6xl bg-white border-none md:border-2 md:border-border shadow-none md:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] flex flex-col md:max-h-[90vh]">
            <div className="p-6 md:p-8 border-b-2 border-border flex justify-between items-center bg-canvas">
              <span className="text-xs md:text-sm uppercase font-black text-accent tracking-[0.4em] flex items-center gap-3">
                <Trophy size={20} /> [Trophy_Room_Protocol: {showTrophyRoom.toUpperCase()}]
              </span>
              <button onClick={() => setShowTrophyRoom(null)} className="text-ink/40 hover:text-accent transition-colors p-2">
                <X size={32} />
              </button>
            </div>

            <div className="p-6 md:p-12 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {(showTrophyRoom === 'streak' ? STREAK_MILESTONES : XP_MILESTONES).map((m) => {
                  const totalXp = profile?.lifetime_xp || profile?.total_xp || 0
                  const isEarned = showTrophyRoom === 'streak' 
                    ? (dailyStreak >= m.count && uniqueLoggingDays >= m.count)
                    : (totalXp >= m.count)
                  
                  return (
                    <div 
                      key={m.id}
                      className={`relative p-6 border-2 flex flex-col items-center text-center gap-4 transition-all duration-500 ${
                        isEarned 
                          ? 'bg-white border-accent shadow-[4px_4px_0px_0px_rgba(124,58,237,1)]' 
                          : 'bg-canvas/30 border-dashed border-border/20 opacity-40'
                      }`}
                    >
                      <div className={`text-6xl transition-transform duration-700 ${isEarned ? 'scale-110' : 'scale-90 grayscale'}`}>
                        {m.icon}
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className={`text-xs font-black uppercase tracking-widest ${isEarned ? 'text-ink' : 'text-ink/40'}`}>
                          {m.name}
                        </h5>
                        <p className="text-[9px] text-ink/60 font-black uppercase tracking-tighter">
                          {isEarned ? 'Protocol_Verified' : `Target: ${m.count.toLocaleString()} ${showTrophyRoom === 'streak' ? 'Days' : 'XP'}`}
                        </p>
                      </div>

                      {isEarned ? (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      ) : (
                        <div className="mt-2 w-full h-1 bg-border/10 overflow-hidden">
                           <div 
                             className="h-full bg-ink/10 transition-all duration-1000"
                             style={{ width: `${Math.min(100, ( (showTrophyRoom === 'streak' ? dailyStreak : totalXp) / m.count) * 100)}%` }}
                           />
                        </div>
                      )}

                      <div className={`px-2 py-1 text-[7px] font-black uppercase tracking-widest border ${
                        isEarned ? 'bg-accent text-white border-accent' : 'bg-white text-ink/20 border-border/10'
                      }`}>
                        {isEarned ? 'UNLOCKED' : 'LOCKED'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="p-4 border-t-2 border-border bg-canvas">
              <button 
                onClick={() => setShowTrophyRoom(null)}
                className="w-full py-4 bg-white border-2 border-border text-ink/40 text-[10px] font-black uppercase tracking-widest hover:text-ink hover:border-accent transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Close_Archive
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
