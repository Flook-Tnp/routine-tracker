import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns'
import { StorageService } from '../lib/storage'
import type { Routine, Profile as ProfileType, RoutineCompletion } from '../types'
import { Zap, Camera, Edit2, Check, X, Trash2, Flame, Trophy, Scissors, Target, Award } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import getCroppedImg from '../lib/image'
import { useTranslation } from '../lib/i18n'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

interface ProfileProps {
  profile: ProfileType | null
  routines: Routine[]
  completions: RoutineCompletion[]
  dailyStreak: number
  weeklyStreak: number
  onProfileUpdate?: (profile: ProfileType) => void
  isPublic?: boolean
  onBack?: () => void
}

const STREAK_MILESTONES = [
  { id: 'Streak_3', name: 'Spark', count: 3, icon: '✦' },
  { id: 'Streak_7', name: 'Ignition', count: 7, icon: '⚡' },
  { id: 'Streak_30', name: 'Flame', count: 30, icon: '🜂' },
  { id: 'Streak_100', name: 'Beacon', count: 100, icon: '◆' },
  { id: 'Streak_365', name: 'Obelisk', count: 365, icon: '⬟' },
  { id: 'Streak_730', name: 'Comet', count: 730, icon: '☄️' },
  { id: 'Streak_1000', name: 'Solar Flare', count: 1000, icon: '☀️' },
  { id: 'Streak_1825', name: 'Stellar Core', count: 1825, icon: '✺' }
]

const XP_MILESTONES = [
  { id: 'XP_1000', name: 'Initiate', count: 1000, icon: '◇' },
  { id: 'XP_5000', name: 'Adept', count: 5000, icon: '◈' },
  { id: 'XP_10000', name: 'Veteran', count: 10000, icon: '⬢' },
  { id: 'XP_25000', name: 'Elite', count: 25000, icon: '⚔️' },
  { id: 'XP_50000', name: 'Master', count: 50000, icon: '♛' },
  { id: 'XP_100000', name: 'Grandmaster', count: 100000, icon: '👑' },
  { id: 'XP_250000', name: 'Legend', count: 250000, icon: '🌌' }
]

const ALL_MILESTONES = [...STREAK_MILESTONES, ...XP_MILESTONES]
const MILESTONE_BY_ID = new Map(ALL_MILESTONES.map(m => [m.id.toLowerCase(), m]))

export function Profile({ profile, routines, completions: initialCompletions, dailyStreak, weeklyStreak, onProfileUpdate, isPublic, onBack }: ProfileProps) {
  const { t } = useTranslation();

  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Count unique physical days for the UI check as well
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

  const completions = initialCompletions

  const totalXp = useMemo(() => {
    return Math.max(profile?.lifetime_xp || 0, profile?.total_xp || 0)
  }, [profile?.lifetime_xp, profile?.total_xp])

  const uniqueLoggingDays = useMemo(() => {
    return new Set(
      initialCompletions
        .filter(c => c && c.completed_date)
        .map(c => c.completed_date)
    ).size
  }, [initialCompletions])

  // Permanently award badges if they don't exist
  const checkMilestones = useCallback(async () => {
    if (isPublic || !profile) return

    const currentBadges = profile.badges || []
    const newBadges = currentBadges.map((badge) => {
      const milestone = MILESTONE_BY_ID.get(badge.id.toLowerCase())
      if (!milestone) return badge
      return { ...badge, name: milestone.name, icon: milestone.icon }
    })
    let changed = newBadges.some((badge, index) => {
      const original = currentBadges[index]
      return badge.name !== original.name || badge.icon !== original.icon
    })

    // Anti-Cheat: Count how many UNIQUE PHYSICAL DAYS the user actually opened the app and logged work.
    const completionsCount = new Set(
      completions
        .filter(c => c && (c.created_at || c.completed_date))
        .map(c => (c.created_at || c.completed_date).split('T')[0])
    ).size

    const milestones = [
      ...STREAK_MILESTONES.map(m => ({ ...m, check: dailyStreak >= m.count && completionsCount >= m.count })),
      ...XP_MILESTONES.map(m => ({ ...m, check: totalXp >= m.count }))
    ]

    milestones.forEach(m => {
      if (m.check && !newBadges.some(b => b.id.toLowerCase() === m.id.toLowerCase())) {
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
  }, [completions, dailyStreak, isPublic, onProfileUpdate, profile, totalXp])

  // Check milestones whenever stats change
  useEffect(() => {
    if (profile) {
      checkMilestones()
    }
  }, [checkMilestones, profile])

  const { categoryStreaks, categoryWeeklyStreaks } = useMemo(() => {
    const streaks: Record<string, number> = {}
    const wStreaks: Record<string, number> = {}
    const cats = Array.from(new Set((routines || []).map(r => r.category || 'General')))

    // Pre-group completions by routine ID for O(1) access
    const routineCompletionsMap = new Map<string, Set<string>>()
    completions.forEach(c => {
      if (!routineCompletionsMap.has(c.routine_id)) {
        routineCompletionsMap.set(c.routine_id, new Set())
      }
      routineCompletionsMap.get(c.routine_id)?.add(c.completed_date)
    })

    cats.forEach(cat => {
      const categoryRoutines = routines.filter(r => (r.category || 'General') === cat)
      const categoryRoutineIds = categoryRoutines.map(r => r.id)

      // Merge all completion dates for this category
      const doneDates = new Set<string>()
      categoryRoutineIds.forEach(id => {
        const dates = routineCompletionsMap.get(id)
        if (dates) dates.forEach(d => doneDates.add(d))
      })

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

  const categoriesList = useMemo(() => {
    return Array.from(new Set((routines || []).map(r => r.category || 'General')))
  }, [routines])

  const categoryStats = useMemo(() => {
    return categoriesList.map(cat => {
      const categoryRoutines = routines.filter(r => (r.category || 'General') === cat)
      const routineIds = new Set(categoryRoutines.map(r => r.id))
      const categoryCompletions = completions.filter(c => routineIds.has(c.routine_id))
      const activeDays = new Set(categoryCompletions.map(c => c.completed_date)).size

      return {
        name: cat,
        routines: categoryRoutines.length,
        completions: categoryCompletions.length,
        activeDays,
        dailyStreak: categoryStreaks[cat] || 0,
        weeklyStreak: categoryWeeklyStreaks[cat] || 0
      }
    })
  }, [categoriesList, routines, completions, categoryStreaks, categoryWeeklyStreaks])

  const onCropComplete = useCallback((_preventedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Achievement Logic: Evolving Badges
  const streakProgress = useMemo(() => {
    const highest = [...STREAK_MILESTONES].reverse().find(m => dailyStreak >= m.count && uniqueLoggingDays >= m.count)
    const next = STREAK_MILESTONES.find(m => dailyStreak < m.count || uniqueLoggingDays < m.count)
    return { current: highest, next }
  }, [dailyStreak, uniqueLoggingDays])

  const xpProgress = useMemo(() => {
    const highest = [...XP_MILESTONES].reverse().find(m => totalXp >= m.count)
    const next = XP_MILESTONES.find(m => totalXp < m.count)
    return { current: highest, next }
  }, [totalXp])

  const streakGoalRemaining = streakProgress.next ? Math.max(0, streakProgress.next.count - dailyStreak) : 0
  const xpGoalRemaining = xpProgress.next ? Math.max(0, xpProgress.next.count - totalXp) : 0
  const playerTitle = [streakProgress.current?.name, xpProgress.current?.name].filter(Boolean).join(' / ') || 'Initiating'

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
            onClick={() => supabase.auth.signOut()}
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
    } catch (err: unknown) {
      console.error('Update failed:', err)
      alert(`UPDATE_FAILURE: ${getErrorMessage(err, 'Username might be taken')}`)
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
    } catch (err: unknown) {
      console.error('Upload failed:', err)
      alert(`UPLOAD_FAILURE: ${getErrorMessage(err, 'Check Supabase Storage settings')}`)
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
    } catch (err: unknown) {
      console.error('Delete failed:', err)
      alert(`DELETE_FAILURE: ${getErrorMessage(err)}`)
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
          <div className="w-full max-w-xl bg-white border-2 border-border shadow-[12px_12px_0px_0px_rgba(20,184,166,0.34)] relative overflow-hidden flex flex-col">
            <div className="p-4 border-b-2 border-border flex justify-between items-center bg-canvas">
              <span className="text-[10px] uppercase font-black text-accent tracking-[0.3em] flex items-center gap-2">
                <Scissors size={14} /> [Identity_Adjustment_Protocol]
              </span>
              <button onClick={() => setImageToCrop(null)} className="text-ink/40 hover:text-accent transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="relative h-[300px] md:h-[400px] bg-accent">
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
                  className="flex-1 py-4 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] border-2 border-border hover:bg-accent transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] active:shadow-none disabled:opacity-50"
                >
                  {isUploading ? t('profile.saving') : t('profile.save_picture')}
                </button>
                <button
                  onClick={() => setImageToCrop(null)}
                  className="px-8 py-4 bg-canvas text-ink/40 text-[10px] font-black uppercase tracking-[0.2em] border-2 border-border hover:bg-white transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] active:shadow-none"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <section className="bg-white border-2 border-border shadow-[8px_8px_0px_0px_rgba(20,184,166,0.34)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 md:p-8 space-y-6 border-b-2 lg:border-b-0 lg:border-r-2 border-border">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="relative flex-shrink-0 self-center md:self-auto">
                <div className="p-1.5 border-2 border-accent rounded-full overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)]">
                  <div className="w-28 h-28 bg-canvas rounded-full flex items-center justify-center text-4xl font-black text-accent overflow-hidden">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                    ) : (
                      profile.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                </div>
                {!isPublic && (
                  <div className="flex justify-center gap-3 absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2.5 bg-white border-2 border-border rounded-full text-accent hover:bg-accent hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    >
                      <Camera size={16} className={isUploading ? 'animate-pulse' : ''} />
                    </button>
                    {profile.avatar_url && (
                      <button
                        onClick={handleAvatarDelete}
                        disabled={isUploading}
                        className="p-2.5 bg-white border-2 border-border rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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

              <div className="space-y-4 min-w-0 text-center md:text-left">
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">Player Identity</p>
                  {isEditing && !isPublic ? (
                    <div className="flex items-center justify-center md:justify-start gap-2 bg-white border-2 border-accent px-4 py-2 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
                      <input
                        autoFocus
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="bg-transparent text-xl font-black text-ink uppercase tracking-tighter outline-none w-48 text-center md:text-left"
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
                    <div className="flex items-center justify-center md:justify-start gap-3 group">
                      <h2 className="text-3xl font-black text-ink uppercase tracking-tighter md:text-5xl truncate">{profile.username || 'Anonymous_User'}</h2>
                      {!isPublic && (
                        <button
                          onClick={() => {
                            setNewUsername(profile.username)
                            setIsEditing(true)
                          }}
                          className="p-2 text-ink/20 hover:text-accent transition-colors md:opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-ink/60 uppercase tracking-widest font-black">{playerTitle}</p>
                </div>

                <div className="flex justify-center md:justify-start flex-wrap gap-2">
                  {(profile.badges || []).slice(0, 5).map((badge) => {
                    const milestone = MILESTONE_BY_ID.get(badge.id.toLowerCase())
                    return (
                    <div key={badge.id} className="px-3 py-1.5 bg-accent-soft border border-accent/20 text-[10px] uppercase font-black text-accent flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
                      <span className="text-sm">{milestone?.icon || badge.icon}</span>
                      {milestone?.name || badge.name}
                    </div>
                    )
                  })}
                  {(!profile.badges || profile.badges.length === 0) && (
                    <p className="text-[10px] text-ink/20 uppercase tracking-[0.2em] font-black">{t('profile.no_badges')}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-canvas border-2 border-border p-3">
                <Zap size={16} className="text-accent mb-2" />
                <p className="text-xl md:text-2xl font-black text-ink tracking-tighter">{totalXp.toLocaleString()}</p>
                <p className="text-[8px] text-ink/45 uppercase tracking-widest font-black">{t('profile.lifetime_xp')}</p>
              </div>
              <div className="bg-canvas border-2 border-border p-3">
                <Flame size={16} fill="currentColor" className="text-accent mb-2" />
                <p className="text-xl md:text-2xl font-black text-ink tracking-tighter">{dailyStreak || 0}</p>
                <p className="text-[8px] text-ink/45 uppercase tracking-widest font-black">{t('profile.daily_streak')}</p>
              </div>
              <div className="bg-canvas border-2 border-border p-3">
                <Trophy size={16} className="text-accent mb-2" />
                <p className="text-xl md:text-2xl font-black text-ink tracking-tighter">{weeklyStreak || 0}</p>
                <p className="text-[8px] text-ink/45 uppercase tracking-widest font-black">{t('profile.weekly_streak')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-accent-soft space-y-4">
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">Next Unlocks</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white border-2 border-border p-4 space-y-3 shadow-[3px_3px_0px_0px_rgba(236,72,153,0.24)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-canvas border-2 border-border flex items-center justify-center text-2xl">{streakProgress.next?.icon || streakProgress.current?.icon || '✓'}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase truncate">{streakProgress.next?.name || 'All Streak Badges'}</p>
                      <p className="text-[9px] uppercase tracking-widest text-ink/45 font-black">{streakGoalRemaining.toLocaleString()} days remaining</p>
                    </div>
                  </div>
                  <Flame size={20} className="text-accent" fill="currentColor" />
                </div>
                {streakProgress.next && (
                  <div className="h-2 bg-canvas border-2 border-border overflow-hidden p-[2px]">
                    <div className="h-full bg-accent transition-all duration-700" style={{ width: `${Math.min(100, (dailyStreak / streakProgress.next.count) * 100)}%` }} />
                  </div>
                )}
              </div>

              <div className="bg-white border-2 border-border p-4 space-y-3 shadow-[3px_3px_0px_0px_rgba(236,72,153,0.24)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-canvas border-2 border-border flex items-center justify-center text-2xl">{xpProgress.next?.icon || xpProgress.current?.icon || '✓'}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase truncate">{xpProgress.next?.name || 'All XP Badges'}</p>
                      <p className="text-[9px] uppercase tracking-widest text-ink/45 font-black">{xpGoalRemaining.toLocaleString()} XP remaining</p>
                    </div>
                  </div>
                  <Award size={20} className="text-accent" />
                </div>
                {xpProgress.next && (
                  <div className="h-2 bg-canvas border-2 border-border overflow-hidden p-[2px]">
                    <div className="h-full bg-accent transition-all duration-700" style={{ width: `${Math.min(100, (totalXp / xpProgress.next.count) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-ink/40 font-black border-b-2 border-border pb-3">{t('profile.categories')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryStats.map(cat => {
            const isSelected = selectedCategory === cat.name
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                className={`text-left bg-white border-2 p-5 space-y-4 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  isSelected
                    ? 'border-accent shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)]'
                    : 'border-border hover:border-accent'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-black uppercase tracking-tight truncate">{cat.name}</p>
                    <p className="text-[9px] text-ink/45 uppercase tracking-widest font-black">{cat.routines} routines</p>
                  </div>
                  <div className="w-10 h-10 bg-accent-soft border-2 border-accent/20 flex items-center justify-center text-accent">
                    <Target size={18} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-canvas border-2 border-border p-2">
                    <p className="text-lg font-black">{cat.dailyStreak}</p>
                    <p className="text-[7px] uppercase tracking-widest text-ink/40 font-black">Daily</p>
                  </div>
                  <div className="bg-canvas border-2 border-border p-2">
                    <p className="text-lg font-black">{cat.weeklyStreak}</p>
                    <p className="text-[7px] uppercase tracking-widest text-ink/40 font-black">Weekly</p>
                  </div>
                  <div className="bg-canvas border-2 border-border p-2">
                    <p className="text-lg font-black">{cat.activeDays}</p>
                    <p className="text-[7px] uppercase tracking-widest text-ink/40 font-black">Days</p>
                  </div>
                  <div className="bg-canvas border-2 border-border p-2">
                    <p className="text-lg font-black">{cat.completions}</p>
                    <p className="text-[7px] uppercase tracking-widest text-ink/40 font-black">Logs</p>
                  </div>
                </div>
              </button>
            )
          })}
          {categoryStats.length === 0 && (
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
            className="group relative bg-white border-2 border-border p-8 flex flex-col items-center gap-4 transition-all hover:border-accent shadow-[8px_8px_0px_0px_rgba(20,184,166,0.34)] hover:shadow-[8px_8px_0px_0px_rgba(236,72,153,0.48)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={16} className="text-accent" />
            </div>

            <div className="relative">
              <div className="w-20 h-20 bg-accent-soft border-2 border-accent/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform duration-500 shadow-[3px_3px_0px_0px_rgba(236,72,153,0.24)]">
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
            className="group relative bg-white border-2 border-border p-8 flex flex-col items-center gap-4 transition-all hover:border-accent shadow-[8px_8px_0px_0px_rgba(20,184,166,0.34)] hover:shadow-[8px_8px_0px_0px_rgba(236,72,153,0.48)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trophy size={16} className="text-accent" />
            </div>

            <div className="relative">
              <div className="w-20 h-20 bg-accent-soft border-2 border-accent/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform duration-500 shadow-[3px_3px_0px_0px_rgba(236,72,153,0.24)]">
                {xpProgress.current?.icon || '◇'}
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
                  <span>{totalXp.toLocaleString()} / {xpProgress.next.count.toLocaleString()} XP</span>
                </div>
                <div className="h-1.5 w-full bg-canvas border-2 border-border/10 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${Math.min(100, (totalXp / xpProgress.next.count) * 100)}%` }}
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
              supabase.auth.signOut()
            }}
            className="w-full py-5 bg-canvas border-2 border-border text-ink/40 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            [Log_Out]
          </button>
        </section>
      )}
      {/* Trophy Room Modal */}
      {showTrophyRoom && createPortal(
        <div className="fixed inset-0 z-[110] bg-white/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-300">
          <div className="w-full h-full md:h-auto md:max-w-6xl bg-white border-none md:border-2 md:border-border shadow-none md:shadow-[16px_16px_0px_0px_rgba(20,184,166,0.34)] flex flex-col md:max-h-[90vh]">
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
                  const isEarned = showTrophyRoom === 'streak'
                    ? (dailyStreak >= m.count && uniqueLoggingDays >= m.count)
                    : (totalXp >= m.count)

                  return (
                    <div
                      key={m.id}
                      className={`relative p-6 border-2 flex flex-col items-center text-center gap-4 transition-all duration-500 ${
                        isEarned
                          ? 'bg-white border-accent shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)]'
                          : 'bg-canvas/30 border-dashed border-border/20 opacity-40'
                      }`}
                    >
                      <div className={`w-20 h-20 border-2 flex items-center justify-center text-6xl transition-transform duration-700 ${isEarned ? 'scale-110 bg-accent-soft border-accent/20' : 'scale-90 grayscale bg-white border-border/20'}`}>
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
                        <div className="absolute top-2 right-2 w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
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
                className="w-full py-4 bg-white border-2 border-border text-ink/40 text-[10px] font-black uppercase tracking-widest hover:text-ink hover:border-accent transition-all shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
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
