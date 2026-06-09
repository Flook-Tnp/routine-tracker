import { lazy, Suspense, useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import { format, subDays, startOfDay, eachDayOfInterval, parseISO, formatDistanceToNow } from 'date-fns'
import { Trophy, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Flame, Pencil, Trash2, LogOut, User, Bell, X, LayoutDashboard, ListTodo, Award, Globe, Users, CircleUser, Maximize2 } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Line } from 'recharts'
import { ManualModal } from './components/ManualModal'
import { RoutineItem } from './components/RoutineItem'
import { ConfirmDialog } from './components/ConfirmDialog'
import { BrutalistDatePicker } from './components/BrutalistDatePicker'
import { AuthModal } from './components/Auth'
import { MissedYesterdayBar } from './components/MissedYesterdayBar'
import { StorageService } from './lib/storage'
import type { Routine, RoutineCompletion, Task, TaskLog, TaskBreakdownItem, Profile, Group } from './types'
import type { Session } from '@supabase/supabase-js'
import { calculateXP } from './lib/gamification'
import { EmptyState } from './components/EmptyState'
import type { AppNotification } from './types'
import { useTranslation } from './lib/i18n'
import { getErrorMessage } from './lib/errors'

const NAV_ITEMS = [
  { id: 'tracker', label: 'nav.tracker', icon: ListTodo, authRequired: false },
  { id: 'board', label: 'nav.board', icon: LayoutDashboard, authRequired: false },
  { id: 'leaderboard', label: 'nav.rank', icon: Award, authRequired: false },
  { id: 'social', label: 'nav.global', icon: Globe, authRequired: false },
  { id: 'pods', label: 'nav.pods', icon: Users, authRequired: false },
  { id: 'profile', label: 'nav.profile', icon: CircleUser, authRequired: true }
] as const;

const CHART_LINE_COLORS = ['#14B8A6', '#EC4899', '#2DD4BF', '#F9A8D4', '#0F766E', '#BE185D']
const TOTAL_CHART_KEY = 'Total'

const KanbanBoard = lazy(() => import('./components/KanbanBoard').then((mod) => ({ default: mod.KanbanBoard })))
const FullscreenChart = lazy(() => import('./components/FullscreenChart').then((mod) => ({ default: mod.FullscreenChart })))
const Leaderboard = lazy(() => import('./components/Leaderboard').then((mod) => ({ default: mod.Leaderboard })))
const ProfileComponent = lazy(() => import('./components/Profile').then((mod) => ({ default: mod.Profile })))
const SocialFeed = lazy(() => import('./components/SocialFeed').then((mod) => ({ default: mod.SocialFeed })))
const AccountabilityPods = lazy(() => import('./components/AccountabilityPods').then((mod) => ({ default: mod.AccountabilityPods })))

function ViewFallback() {
  return (
    <div className="py-20 text-center text-[10px] uppercase tracking-widest text-ink/40 font-black">
      LOADING_VIEW...
    </div>
  )
}

// Pods System Final Verification - Deployment Active
function App() {
  const { t, language, setLanguage } = useTranslation();
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'tracker' | 'board' | 'leaderboard' | 'profile' | 'social' | 'pods'>('tracker')
  const [previousView, setPreviousView] = useState<'tracker' | 'board' | 'leaderboard' | 'profile' | 'social' | 'pods'>('leaderboard')
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null)
  const [viewedData, setViewedData] = useState<{ profile: Profile; routines: Routine[]; completions: RoutineCompletion[]; dailyStreak: number; weeklyStreak: number } | null>(null)
  const [selectedPod, setSelectedPod] = useState<Group | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [activeCategory, setActiveCategory] = useState(() => localStorage.getItem('disby_active_category') || 'General')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  const [hiddenRoutines, setHiddenRoutines] = useState<Set<string>>(new Set())
  const [isAutoZoom, setIsAutoZoom] = useState(false)
  const [authInitialView, setAuthInitialView] = useState<'sign_in' | 'sign_up' | 'forgot_password' | 'update_password'>('sign_in')
  const [dismissedMissedNudges, setDismissedMissedNudges] = useState<Record<string, boolean>>({})

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null)
  const [editingRoutineTitle, setEditingRoutineTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null)
  const lastUserId = useRef<string | undefined>(undefined)
  const dateStripRef = useRef<HTMLDivElement>(null)
  const notificationsRefDesktop = useRef<HTMLDivElement>(null)
  const notificationsRefMobile = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const routineInputRef = useRef<HTMLInputElement>(null)

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (showNotifications) {
        const isOutsideDesktop = notificationsRefDesktop.current && !notificationsRefDesktop.current.contains(event.target as Node)
        const isOutsideMobile = notificationsRefMobile.current && !notificationsRefMobile.current.contains(event.target as Node)

        // On mobile, the desktop ref won't exist or be visible, and vice-versa
        // We only close if it's outside BOTH if both exist, or outside the one that exists
        const outsideAllNotifications = (!notificationsRefDesktop.current || isOutsideDesktop) &&
                                       (!notificationsRefMobile.current || isOutsideMobile)

        if (outsideAllNotifications) {
          setShowNotifications(false)
        }
      }

      if (showDatePicker) {
        if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
          setShowDatePicker(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showNotifications, showDatePicker])

  const calculateStreaks = (userRoutines: Routine[], userCompletions: RoutineCompletion[]) => {
    if (userRoutines.length === 0 || userCompletions.length === 0) return { daily: 0, weekly: 0 }

    // Pre-group completions by routine ID for O(1) access
    const routineCompletionsMap = new Map<string, Set<string>>()
    userCompletions.forEach(c => {
      if (!routineCompletionsMap.has(c.routine_id)) {
        routineCompletionsMap.set(c.routine_id, new Set())
      }
      routineCompletionsMap.get(c.routine_id)?.add(c.completed_date)
    })

    // Calculate streaks for each category separately
    const categories = Array.from(new Set(userRoutines.map(r => r.category || 'General')))
    let maxDaily = 0
    let maxWeekly = 0

    categories.forEach(cat => {
      const catRoutineIds = userRoutines.filter(r => (r.category || 'General') === cat).map(r => r.id)

      // Merge all completion dates for this category
      const doneDates = new Set<string>()
      catRoutineIds.forEach(id => {
        const dates = routineCompletionsMap.get(id)
        if (dates) dates.forEach(d => doneDates.add(d))
      })

      if (doneDates.size === 0) return

      let daily = 0
      let checkDate = new Date()
      const isDateFinished = (date: Date) => doneDates.has(format(date, 'yyyy-MM-dd'))
      if (!isDateFinished(checkDate)) checkDate = subDays(checkDate, 1)
      while (isDateFinished(checkDate)) {
        daily++
        checkDate = subDays(checkDate, 1)
        if (daily > 10000) break
      }
      if (daily > maxDaily) maxDaily = daily

      let weekly = 0
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
        weekly++
        currentCheck = subDays(currentCheck, 7)
        if (weekly > 500) break
      }
      if (weekly > maxWeekly) maxWeekly = weekly
    })

    return { daily: maxDaily, weekly: maxWeekly }
  }

  const dismissNotification = async (id: string) => {
    try {
      await StorageService.markNotificationAsRead(id)
      setNotifications(notifications.filter(n => n.id !== id))
    } catch (err) {
      console.error('Error dismissing notification:', err)
    }
  }

  const handleToggleNotifications = async () => {
    const nextState = !showNotifications
    setShowNotifications(nextState)
    if (nextState && session?.user?.id) {
      try {
        const data = await StorageService.fetchNotifications(session.user.id)
        setNotifications(data)
      } catch (err) {
        console.error('Failed to sync transmissions:', err)
      }
    }
  }

  const handleSelectUser = async (userId: string) => {
    if (session?.user?.id === userId) {
      setViewedProfileId(null)
      setCurrentView('profile')
      return
    }

    try {
      setPreviousView(currentView)
      setCurrentView('profile')
      setViewedProfileId(userId)
      setViewedData(null) // Loading state

      const [targetProfile, targetRoutines, targetCompletions] = await Promise.all([
        StorageService.fetchProfile(userId),
        StorageService.fetchRoutines(userId),
        StorageService.fetchCompletions(userId)
      ])

      const { daily, weekly } = calculateStreaks(targetRoutines, targetCompletions)
      setViewedData({
        profile: targetProfile,
        routines: targetRoutines,
        completions: targetCompletions,
        dailyStreak: daily,
        weeklyStreak: weekly
      })

    } catch (err) {
      console.error('Error fetching user data:', err)
      alert('PROTOCOL_ERROR: Failed to retrieve public profile data')
      setCurrentView('leaderboard')
    }
  }

  const selectedDateStr = useMemo(() => {
    try {
      return format(selectedDate, 'yyyy-MM-dd')
    } catch {
      return format(new Date(), 'yyyy-MM-dd')
    }
  }, [selectedDate])

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const yesterday = useMemo(() => startOfDay(subDays(new Date(), 1)), [])
  const yesterdayStr = useMemo(() => format(yesterday, 'yyyy-MM-dd'), [yesterday])

  // Auto-scroll active date into view
  useEffect(() => {
    if (dateStripRef.current) {
      const activeElement = dateStripRef.current.querySelector('[data-active="true"]')
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [selectedDateStr])

  const dateStrip = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => subDays(selectedDate, 3 - i))
  }, [selectedDate])

  const categories = useMemo(() => {
    const cats = new Set(routines.map(r => r.category || 'General'))
    return Array.from(cats).sort()
  }, [routines])

  const filteredRoutines = useMemo(() => {
    return routines.filter(r => (r.category || 'General') === activeCategory)
  }, [routines, activeCategory])

  const dismissMissedNudge = (key: string) => {
    localStorage.setItem(key, '1')
    setDismissedMissedNudges(prev => ({ ...prev, [key]: true }))
  }

  const trackerMissedYesterdayKey = `missed-yesterday:tracker:${activeCategory}:${yesterdayStr}`
  const hasYesterdayRoutineCompletion = filteredRoutines.some(routine =>
    completions.some(completion => completion.routine_id === routine.id && completion.completed_date === yesterdayStr)
  )
  const shouldShowTrackerMissedYesterday =
    selectedDateStr === todayStr &&
    filteredRoutines.length > 0 &&
    !hasYesterdayRoutineCompletion &&
    !dismissedMissedNudges[trackerMissedYesterdayKey] &&
    localStorage.getItem(trackerMissedYesterdayKey) !== '1'

  const recoverYesterday = () => {
    setSelectedDate(yesterday)
  }

  useEffect(() => {
    let mounted = true

    const handleSession = async (currentSession: Session | null) => {
      if (!mounted) return

      const currentUserId = currentSession?.user?.id
      const identityChanged = currentUserId !== lastUserId.current
      lastUserId.current = currentUserId

      setSession(currentSession)

      if (currentSession?.user) {
        try {
          // Fetch data separately so one failure doesn't block the others
          StorageService.fetchProfile(currentSession.user.id)
            .then(p => mounted && setProfile(p))
            .catch(async (err) => {
              console.error('Profile fetch failed, attempting creation:', err)
              if (currentSession.user.id) {
                try {
                  const newProfile = await StorageService.createProfile(
                    currentSession.user.id,
                    currentSession.user.email?.split('@')[0] || 'User'
                  )
                  if (mounted) {
                    setProfile(newProfile)
                    setLoading(false)
                  }
                } catch (createErr: unknown) {
                  console.error('Profile initialization failed:', createErr)
                  if (mounted) setLoading(false)
                }
              }
            })

          const [routinesData, allCompletions, tasksData, taskLogsData, notificationsData] = await Promise.all([
            StorageService.fetchRoutines(currentSession.user.id),
            StorageService.fetchCompletions(currentSession.user.id),
            StorageService.fetchTasks(currentSession.user.id),
            StorageService.fetchTaskLogs(currentSession.user.id),
            StorageService.fetchNotifications(currentSession.user.id)
          ])

          if (mounted) {
            setRoutines(routinesData)
            setCompletions(allCompletions)
            setTasks(tasksData)
            setTaskLogs(taskLogsData)
            setNotifications(notificationsData)
            setLoading(false)
            if (identityChanged) setCurrentView('tracker')
          }
        } catch (err) {
          console.error('PROTOCOL_ERROR: Data retrieval failed', err)
          if (mounted) setLoading(false)
        }
      } else {
        if (mounted) {
          setProfile(null)
          setRoutines([])
          setCompletions([])
          setTasks([])
          setTaskLogs([])
          setLoading(false)
          if (identityChanged) setCurrentView('tracker')
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthInitialView('update_password')
        setIsAuthModalOpen(true)
      }
      handleSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return

    const interval = setInterval(async () => {
      try {
        const data = await StorageService.fetchNotifications(session.user.id)
        // Only update if count changed or different data to avoid unnecessary renders
        if (data.length !== notifications.length) {
          setNotifications(data)
        }
      } catch (err) {
        console.error('Transmission_Sync_Error:', err)
      }
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [session, notifications.length])

  useEffect(() => {
    localStorage.setItem('disby_active_category', activeCategory)
  }, [activeCategory])

  const handleShareStreak = async () => {
    if (!session || dailyStreak === 0) return
    try {
      const content = `PROTOCOL_MILESTONE: I have achieved a ${dailyStreak}-day streak in ${activeCategory}! 🔥`
      await StorageService.createPost(content, session.user.id, 'milestone', { streak: dailyStreak, category: activeCategory })
      alert('MILESTONE_TRANSMITTED: Your achievement has been shared with the community.')
      setCurrentView('social')
    } catch (err: unknown) {
      console.error('Error sharing streak:', err)
      alert(`SHARE_FAILURE: ${getErrorMessage(err)}`)
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const newTask: Partial<Task> = {
      title: newTaskTitle,
      status: 'todo',
      category: 'General',
      created_at: new Date().toISOString()
    }

    if (session) {
      try {
        const data = await StorageService.addTask(newTask, session.user.id)
        setTasks([data, ...tasks])
      } catch (err) {
        console.error('Error adding task:', err)
      }
    } else {
      const guestTask: Task = {
        ...newTask,
        id: crypto.randomUUID(),
        completed_date: null
      } as Task
      setTasks([guestTask, ...tasks])
    }
    setNewTaskTitle('')
  }

  async function moveTask(id: string, newStatus: 'todo' | 'in-progress' | 'done') {
    const updates: Partial<Task> = { status: newStatus }
    if (newStatus !== 'done') {
      updates.completed_date = null
    }

    if (session) {
      try {
        await StorageService.updateTask(id, updates)
        setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
      } catch (err) {
        console.error('Error moving task:', err)
      }
    } else {
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
    }
  }

  async function finalizeTask(id: string, dateStr: string) {
    const updates: Partial<Task> = { completed_date: dateStr, status: 'done' }
    if (session) {
      try {
        await StorageService.updateTask(id, updates)
        setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
      } catch (err) {
        console.error('Error finalizing task:', err)
      }
    } else {
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
    }
  }

  async function logTask(id: string, dateStr: string, note: string) {
    if (session) {
      try {
        const log = await StorageService.upsertTaskLog(id, session.user.id, dateStr, note)
        setTaskLogs(prev => {
          const exists = prev.some(item => item.task_id === id && item.logged_date === dateStr)
          if (exists) {
            return prev.map(item => item.task_id === id && item.logged_date === dateStr ? log : item)
          }
          return [log, ...prev]
        })
      } catch (err) {
        console.error('Error logging task:', err)
        alert(`LOG_FAILURE: ${getErrorMessage(err)}`)
      }
    } else {
      const now = new Date().toISOString()
      const guestLog: TaskLog = {
        id: crypto.randomUUID(),
        task_id: id,
        logged_date: dateStr,
        note: note.trim() || null,
        created_at: now,
        updated_at: now
      }
      setTaskLogs(prev => {
        const exists = prev.some(item => item.task_id === id && item.logged_date === dateStr)
        if (exists) {
          return prev.map(item => item.task_id === id && item.logged_date === dateStr ? guestLog : item)
        }
        return [guestLog, ...prev]
      })
    }
  }

  async function deleteTask(id: string) {
    if (session) {
      try {
        await StorageService.deleteTask(id)
        setTasks(tasks.filter(t => t.id !== id))
      } catch (err) {
        console.error('Error deleting task:', err)
      }
    } else {
      setTasks(tasks.filter(t => t.id !== id))
    }
  }

  async function updateRoutineTitle(id: string) {
    if (!editingRoutineTitle.trim()) {
      setEditingRoutineId(null)
      return
    }

    if (session) {
      try {
        await StorageService.updateRoutine(id, { title: editingRoutineTitle })
        setRoutines(routines.map(r => r.id === id ? { ...r, title: editingRoutineTitle } : r))
      } catch (err) {
        console.error('Error updating routine title:', err)
      }
    } else {
      setRoutines(routines.map(r => r.id === id ? { ...r, title: editingRoutineTitle } : r))
    }
    setEditingRoutineId(null)
  }

  async function updateCategoryName() {
    if (!newCategoryTitle.trim() || newCategoryTitle === activeCategory) {
      setEditingCategory(null)
      return
    }

    if (session) {
      try {
        await StorageService.updateCategory(activeCategory, newCategoryTitle)
        setRoutines(routines.map(r => r.category === activeCategory ? { ...r, category: newCategoryTitle } : r))
        setTasks(tasks.map(t => t.category === activeCategory ? { ...t, category: newCategoryTitle } : t))
        setActiveCategory(newCategoryTitle)
      } catch (err) {
        console.error('Error updating category name:', err)
      }
    } else {
      setRoutines(routines.map(r => r.category === activeCategory ? { ...r, category: newCategoryTitle } : r))
      setTasks(tasks.map(t => t.category === activeCategory ? { ...t, category: newCategoryTitle } : t))
      setActiveCategory(newCategoryTitle)
    }
    setEditingCategory(null)
  }

  async function addRoutine(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoutineTitle.trim()) return

    const targetCategory = activeCategory || 'General'
    const newRoutine: Partial<Routine> = {
      title: newRoutineTitle,
      category: targetCategory,
      is_active: true,
      created_at: new Date().toISOString()
    }

    if (session) {
      try {
        const data = await StorageService.addRoutine(newRoutine, session.user.id)
        setRoutines([...routines, data])
      } catch (err) {
        console.error('Error adding routine:', err)
      }
    } else {
      const guestRoutine: Routine = {
        ...newRoutine,
        id: crypto.randomUUID(),
      } as Routine
      setRoutines([...routines, guestRoutine])
    }
    setNewRoutineTitle('')
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setActiveCategory(newCategoryName.trim())
    setNewCategoryName('')
    setIsAddingCategory(false)
  }

  async function toggleCompletion(routineId: string) {
    const existing = completions.find(
      c => c.routine_id === routineId && c.completed_date === selectedDateStr
    )

    // Calculate XP based on current streak
    const currentStreak = dailyStreak
    const xp = existing?.xp_earned ?? calculateXP(currentStreak)

    // 1. Optimistic local update
    const oldCompletions = [...completions]
    if (existing) {
      setCompletions(completions.filter(c => c.id !== existing.id))
    } else {
      const tempId = crypto.randomUUID()
      setCompletions([...completions, {
        id: tempId,
        routine_id: routineId,
        completed_date: selectedDateStr,
        xp_earned: xp
      }])
    }

    if (session) {
      try {
        const result = await StorageService.toggleCompletion(routineId, selectedDateStr, xp, session.user.id, existing?.id)

        // Silently sync the actual result from server
        if (result) {
          setCompletions(prev => prev.map(c => c.routine_id === routineId && c.completed_date === selectedDateStr ? result : c))
        }

        // Refresh profile in background without blocking
        StorageService.fetchProfile(session.user.id).then(setProfile).catch(console.error)
      } catch (err: unknown) {
        console.error('Error toggling completion:', err)
        // Rollback on error
        setCompletions(oldCompletions)
        alert(`DATABASE_ERROR: ${getErrorMessage(err, 'Check connection')}`)
      }
    }
  }

  const { dailyStreak, weeklyStreak } = useMemo(() => {
    try {
      if (filteredRoutines.length === 0 || completions.length === 0) return { dailyStreak: 0, weeklyStreak: 0 }

      const activeRoutineIds = new Set(filteredRoutines.map(r => r.id))
      const doneDates = new Set(
        completions
          .filter(c => activeRoutineIds.has(c.routine_id))
          .map(c => c.completed_date)
      )

      // Calculate Category Daily
      let daily = 0
      let checkDate = new Date()
      const isDateFinished = (date: Date) => doneDates.has(format(date, 'yyyy-MM-dd'))
      if (!isDateFinished(checkDate)) checkDate = subDays(checkDate, 1)
      while (isDateFinished(checkDate)) {
        daily++
        checkDate = subDays(checkDate, 1)
        if (daily > 10000) break
      }

      // Calculate Category Weekly
      let weekly = 0
      const isWeekSuccessful = (dateInWeek: Date) => {
        const start = startOfDay(subDays(dateInWeek, dateInWeek.getDay()))
        const weekDays = eachDayOfInterval({ start, end: subDays(start, -6) })
        let activeDaysCount = 0
        weekDays.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd')
          if (completions.some(c => c.completed_date === dStr && activeRoutineIds.has(c.routine_id))) activeDaysCount++
        })
        return activeDaysCount >= 3
      }
      let currentCheck = new Date()
      if (!isWeekSuccessful(currentCheck)) currentCheck = subDays(currentCheck, 7)
      while (isWeekSuccessful(currentCheck)) {
        weekly++
        currentCheck = subDays(currentCheck, 7)
        if (weekly > 500) break
      }

      return { dailyStreak: daily, weeklyStreak: weekly }
    } catch (err) {
      console.error('Error calculating category streaks:', err)
      return { dailyStreak: 0, weeklyStreak: 0 }
    }
  }, [filteredRoutines, completions])

  const routineStartDates = useMemo(() => {
    const starts = new Map<string, string>()
    routines.forEach(routine => {
      starts.set(routine.id, routine.created_at ? routine.created_at.split('T')[0] : todayStr)
    })
    completions.forEach(completion => {
      const current = starts.get(completion.routine_id)
      if (!current || completion.completed_date < current) {
        starts.set(completion.routine_id, completion.completed_date)
      }
    })
    return starts
  }, [routines, completions, todayStr])

  const dailyStats = useMemo(() => {
    const eligibleRoutines = filteredRoutines.filter(r => {
      const start = routineStartDates.get(r.id) || todayStr
      return start <= selectedDateStr
    })
    const eligibleRoutineIds = new Set(eligibleRoutines.map(r => r.id))
    const total = eligibleRoutines.length
    if (total === 0) return { completed: 0, total: 0, percentage: 0 }

    const completed = completions.filter(c =>
      c.completed_date === selectedDateStr &&
      eligibleRoutineIds.has(c.routine_id)
    ).length
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100)
    }
  }, [filteredRoutines, completions, selectedDateStr, todayStr, routineStartDates])

  const last7Days = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(selectedDate, 6),
      end: selectedDate
    }).map(date => {
      const dStr = format(date, 'yyyy-MM-dd')
      const eligibleRoutineIds = new Set(filteredRoutines
        .filter(r => {
          const start = routineStartDates.get(r.id) || todayStr
          return start <= dStr
        })
        .map(r => r.id))
      const total = eligibleRoutineIds.size
      const done = completions.filter(c =>
        c.completed_date === dStr &&
        eligibleRoutineIds.has(c.routine_id)
      ).length
      return {
        date: dStr,
        label: format(date, 'EEE'),
        percentage: total > 0 ? (done / total) * 100 : 0
      }
    })
  }, [filteredRoutines, completions, selectedDate, todayStr, routineStartDates])

  const taskBreakdown = useMemo<TaskBreakdownItem[]>(() => {
    try {
      if (filteredRoutines.length === 0) return []

      const completionsByRoutineId = new Map<string, Set<string>>()
      completions.forEach(c => {
        if (!completionsByRoutineId.has(c.routine_id)) {
          completionsByRoutineId.set(c.routine_id, new Set())
        }
        completionsByRoutineId.get(c.routine_id)?.add(c.completed_date)
      })

      return filteredRoutines.map(routine => {
        const startStr = routineStartDates.get(routine.id) || todayStr
        const habitComps = [...(completionsByRoutineId.get(routine.id) || [])].sort()

        const start = startOfDay(parseISO(startStr))
        const today = startOfDay(new Date())
        const activeDays = eachDayOfInterval({ start, end: today }).length

        const validComps = habitComps.filter(d => d >= startStr).length

        return {
          routineId: routine.id,
          title: routine.title,
          percentage: activeDays > 0 ? Math.min(100, Math.round((validComps / activeDays) * 100)) : 0,
          startDate: format(start, 'MMM d, yyyy'),
          totalCompletions: validComps,
          activeDays
        }
      })
    } catch (err) {
      console.error('Error in taskBreakdown:', err)
      return []
    }
  }, [filteredRoutines, completions, todayStr, routineStartDates])

  const lifetimeStats = useMemo(() => {
    try {
      if (taskBreakdown.length === 0) return { totalDays: 0, percentage: 0 }

      const showTotal = !hiddenRoutines.has(TOTAL_CHART_KEY)
      const relevantBreakdown = taskBreakdown.filter(t =>
        showTotal || !hiddenRoutines.has(t.routineId)
      )

      if (relevantBreakdown.length === 0) return { totalDays: 0, percentage: 0 }

      const totalCompletions = relevantBreakdown.reduce((acc, task) => acc + task.totalCompletions, 0)
      const totalActiveDays = relevantBreakdown.reduce((acc, task) => acc + task.activeDays, 0)
      const weightedPercentage = totalActiveDays > 0 ? Math.round((totalCompletions / totalActiveDays) * 100) : 0

      // Calculate overall total days since the oldest relevant start date
      const creationDates = relevantBreakdown.map(t => parseISO(t.startDate))
      const oldestDate = creationDates.length > 0 ? creationDates.reduce((a, b) => a < b ? a : b) : new Date()
      const totalDays = eachDayOfInterval({ start: startOfDay(oldestDate), end: startOfDay(new Date()) }).length

      return {
        totalDays,
        percentage: Math.min(100, weightedPercentage)
      }
    } catch (err) {
      console.error('Error in lifetimeStats:', err)
      return { totalDays: 0, percentage: 0 }
    }
  }, [taskBreakdown, hiddenRoutines])

  const lifetimeChartData = useMemo(() => {
    try {
      if (completions.length === 0 || filteredRoutines.length === 0) return []

      const showTotal = !hiddenRoutines.has(TOTAL_CHART_KEY)
      const visibleRoutines = filteredRoutines.filter(r => !hiddenRoutines.has(r.id))

      // Focus the timeline ONLY on routines that are currently visible
      const timelineRoutines = showTotal ? filteredRoutines : visibleRoutines
      if (timelineRoutines.length === 0) return []

      const routineIds = timelineRoutines.map(r => r.id)
      const routineById = new Map(timelineRoutines.map(r => [r.id, r]))
      const completionsByRoutineId = new Map<string, Set<string>>()
      completions.forEach(c => {
        if (routineById.has(c.routine_id)) {
          if (!completionsByRoutineId.has(c.routine_id)) {
            completionsByRoutineId.set(c.routine_id, new Set())
          }
          completionsByRoutineId.get(c.routine_id)?.add(c.completed_date)
        }
      })

      const routineIdToTrueStart: Record<string, string> = {}

      timelineRoutines.forEach(routine => {
        routineIdToTrueStart[routine.id] = routineStartDates.get(routine.id) || todayStr
      })

      // 3. Aggregate all relevant completions for the current view
      const completionsByDateByRoutineId: Record<string, Set<string>> = {}
      completions.forEach(c => {
        if (routineById.has(c.routine_id)) {
          if (!completionsByDateByRoutineId[c.completed_date]) {
            completionsByDateByRoutineId[c.completed_date] = new Set()
          }
          completionsByDateByRoutineId[c.completed_date].add(c.routine_id)
        }
      })

      // 4. Generate Dynamic Timeline based ONLY on visible routines
      const timelineStartStr = routineIds.reduce((min, id) => {
        const start = routineIdToTrueStart[id]
        return start < min ? start : min
      }, format(new Date(), 'yyyy-MM-dd'))

      const firstDate = startOfDay(parseISO(timelineStartStr))
      const today = startOfDay(new Date())
      const daysInterval = eachDayOfInterval({ start: firstDate, end: today })

      const data: Record<string, string | number>[] = []
      const cumulativeCounts: Record<string, number> = {}
      routineIds.forEach(id => { cumulativeCounts[id] = 0 })

      daysInterval.forEach((date) => {
        const dStr = format(date, 'yyyy-MM-dd')
        const entry: Record<string, string | number> = { name: dStr }

        const doneToday = completionsByDateByRoutineId[dStr] || new Set()
        doneToday.forEach(id => {
          if (cumulativeCounts[id] !== undefined) cumulativeCounts[id]++
        })

        let dailyTotalPct = 0
        let activeCount = 0

        routineIds.forEach(id => {
          const startStr = routineIdToTrueStart[id]
          if (dStr >= startStr) {
            const startD = parseISO(startStr)
            const daysSinceStart = Math.floor((date.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const rawPct = Math.min(100, (cumulativeCounts[id] / daysSinceStart) * 100)
            const pct = Number(rawPct.toFixed(1))
            entry[id] = pct
            dailyTotalPct += rawPct
            activeCount++
          }
        })

        if (showTotal) {
          const avgPct = activeCount > 0 ? (dailyTotalPct / activeCount) : 0
          entry[TOTAL_CHART_KEY] = Number(avgPct.toFixed(1))
        }
        data.push(entry)
      })
      return data
    } catch (err) {
      console.error('Error in chart data:', err)
      return []
    }
  }, [completions, filteredRoutines, hiddenRoutines, todayStr, routineStartDates])
  // Calculate dynamic Y-axis domain (shared logic with FullscreenChart)
  const yDomain = useMemo(() => {
    if (!isAutoZoom || lifetimeChartData.length === 0) return [0, 100]
    let min = 100, max = 0
    const visibleKeys = [
      ...(!hiddenRoutines.has(TOTAL_CHART_KEY) ? [TOTAL_CHART_KEY] : []),
      ...filteredRoutines.filter(r => !hiddenRoutines.has(r.id)).map(r => r.id)
    ]
    lifetimeChartData.forEach(entry => {
      visibleKeys.forEach(key => {
        const val = Number(entry[key])
        if (!isNaN(val)) {
          if (val < min) min = val
          if (val > max) max = val
        }
      })
    })
    const padding = (max - min) * 0.1 || 5
    return [Math.max(0, Math.floor(min - padding)), Math.min(100, Math.ceil(max + padding))]
  }, [isAutoZoom, lifetimeChartData, hiddenRoutines, filteredRoutines])

  const thirtyDayStats = useMemo(() => {
    const thirtyDays = eachDayOfInterval({
      start: subDays(selectedDate, 29),
      end: selectedDate
    })
    let perfectDays = 0
    let totalTasks = 0
    let completedTasks = 0

    thirtyDays.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const eligibleRoutineIds = new Set(filteredRoutines
        .filter(r => {
          const start = routineStartDates.get(r.id) || todayStr
          return start <= dStr
        })
        .map(r => r.id))
      const done = completions.filter(c =>
        c.completed_date === dStr &&
        eligibleRoutineIds.has(c.routine_id)
      ).length
      if (eligibleRoutineIds.size > 0) {
        totalTasks += eligibleRoutineIds.size
        completedTasks += done
        if (done === eligibleRoutineIds.size) perfectDays++
      }
    })

    return {
      perfectDays,
      avg: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalExecs: completedTasks
    }
  }, [filteredRoutines, completions, selectedDate, todayStr, routineStartDates])

  const remainingToday = Math.max(0, dailyStats.total - dailyStats.completed)
  const selectedDateLabel = format(selectedDate, 'EEEE, MMM d')
  const topRoutine = taskBreakdown.length > 0
    ? taskBreakdown.reduce((best, current) => current.percentage > best.percentage ? current : best, taskBreakdown[0])
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-accent font-mono">
        INITIALIZING_SYSTEM...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-mono selection:bg-accent/30">

      {/* Integrated Header Container - Sticky on All Devices */}
      <div className="sticky top-0 z-[100] bg-white/90 backdrop-blur-xl border-b-2 border-border shadow-[0_8px_24px_rgba(20,184,166,0.12)]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 md:py-6">
          <header className="space-y-4 md:space-y-6">
            {/* Top Row: Title, Notifications, and Identity */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent to-sync tracking-tighter uppercase">{t('app.title')}</h1>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={notificationsRefDesktop}>
                    <button
                      onClick={handleToggleNotifications}
                      className={`relative p-1 transition-colors ${notifications.length > 0 ? 'text-accent animate-pulse' : 'text-gray-500 hover:text-accent'}`}
                    >
                      <Bell size={18} />
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black px-1.5 rounded-full border-2 border-border md:hidden">
                          {notifications.length}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setLanguage(language === 'en' ? 'th' : 'en')} className="p-1 text-[10px] md:text-xs font-bold text-gray-500 hover:text-accent transition-colors uppercase ml-1 md:ml-2 border-2 border-border px-2 bg-white">
                      {language}
                    </button>
                    {showNotifications && (
                      <div className="absolute top-full left-0 mt-4 w-72 md:w-80 bg-white border-2 border-border shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-border bg-canvas flex justify-between items-center">
                          <span className="text-[8px] uppercase font-black text-gray-500 tracking-[0.2em]">{t('notifications.title')}</span>
                          <button onClick={() => setShowNotifications(false)} className="text-gray-600 hover:text-ink">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                          {notifications.length > 0 ? (
                            notifications.map((n) => (
                              <div key={n.id} className="p-4 border-b border-border last:border-0 hover:bg-canvas transition-colors group">
                                <p className="text-xs text-ink font-mono leading-relaxed mb-2">{n.content}</p>
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] text-gray-500 uppercase font-bold">{formatDistanceToNow(new Date(n.created_at))} ago</span>
                                  <button onClick={() => dismissNotification(n.id)} className="text-[8px] uppercase font-black text-accent hover:text-accent/80 opacity-0 group-hover:opacity-100 transition-all">
                                    [Clear]
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-gray-400">
                              <p className="text-[8px] uppercase font-black tracking-widest">{t('notifications.empty')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Identity / Auth */}
              <div className="flex items-center gap-3">
                {session ? (
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] text-ink font-black uppercase tracking-widest truncate max-w-[120px]">{profile?.username || session.user.email?.split('@')[0]}</span>
                      <button onClick={() => supabase.auth.signOut()} className="text-[8px] text-gray-500 hover:text-red-500 uppercase font-black tracking-[0.2em] transition-colors mt-0.5">{t('auth.logout_nav')}</button>
                    </div>
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white border-2 border-border p-0.5 md:p-1 flex items-center justify-center overflow-hidden shadow-sm">
                      {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User size={18} className="text-gray-300" />}
                    </div>
                    <button onClick={() => supabase.auth.signOut()} className="md:hidden text-gray-500 p-1 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsAuthModalOpen(true)} className="btn-primary py-1.5 md:py-2 px-4 md:px-6 text-[10px]">{t('auth.login_nav')}</button>
                )}
              </div>
            </div>

            {/* Desktop Navigation Row - Integrated with Date Controls */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                {/* Date Controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1.5 md:p-2 text-gray-500 hover:text-accent border-2 border-border bg-white active:translate-y-[1px] transition-all"><ChevronLeft size={18} /></button>
                  <div className="relative" ref={datePickerRef}>
                    <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-2 text-accent bg-accent-soft px-3 md:px-4 py-1.5 md:py-2 border-2 border-border hover:bg-accent-soft/80 text-[10px] font-black uppercase tracking-widest transition-all">
                      <CalendarIcon size={14} />
                      {format(selectedDate, 'EEE, MMM d')}
                    </button>
                    {showDatePicker && (
                      <BrutalistDatePicker
                        selectedDate={selectedDate}
                        onSelect={setSelectedDate}
                        onClose={() => setShowDatePicker(false)}
                      />
                    )}
                  </div>
                  <button onClick={() => setSelectedDate(subDays(selectedDate, -1))} className="p-1.5 md:p-2 text-gray-500 hover:text-accent border-2 border-border bg-white active:translate-y-[1px] transition-all"><ChevronRight size={18} /></button>

                  {/* Today Button - Visible on All Devices when not today */}
                  {format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
                    <button
                      onClick={() => setSelectedDate(startOfDay(new Date()))}
                      className="ml-1 px-3 py-2 bg-sync text-white text-[10px] font-black uppercase tracking-widest border-2 border-border active:translate-y-[2px] transition-all shadow-[2px_2px_0px_0px_rgba(236,72,153,0.48)]"
                    >
                      {t('action.today')}
                    </button>
                  )}
                </div>

                {/* Desktop Top Navigation (Hidden on Mobile) */}
                <div className="hidden md:flex gap-1 bg-white p-1 border-2 border-border shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
                  {NAV_ITEMS.map((item) => {
                    if (item.authRequired && !session) return null;
                    const Icon = item.icon;
                    const isActive = currentView === item.id && (item.id !== 'profile' || !viewedProfileId);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'profile') setViewedProfileId(null);
                          setCurrentView(item.id);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase transition-all border-2 border-transparent ${isActive ? 'bg-accent text-white border-border shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]' : 'text-ink/60 hover:text-accent hover:border-border/20'}`}
                      >
                        <Icon size={14} />
                        {t(item.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Streaks Display */}
              <div className="flex items-center gap-6 md:gap-8 bg-canvas/50 md:bg-transparent p-3 md:p-0 border-2 border-dashed border-border md:border-0">
                <div className="flex-1 md:flex-none flex items-center justify-center md:justify-end gap-2 text-accent">
                  <Flame size={18} fill="currentColor" />
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-xl md:text-2xl font-black tracking-tighter text-ink leading-none">{dailyStreak}</span>
                    <p className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest font-black">{t('streak.daily')}</p>
                  </div>
                </div>
                <div className="flex-1 md:flex-none flex items-center justify-center md:justify-end gap-2 text-sync">
                  <Trophy size={18} />
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-xl md:text-2xl font-black tracking-tighter text-ink leading-none">{weeklyStreak}</span>
                    <p className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest font-black">{t('streak.weekly')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Strip */}
            <div
              ref={dateStripRef}
              className="flex md:grid md:grid-cols-7 gap-1 overflow-x-auto md:overflow-x-visible snap-x no-scrollbar pb-1 md:pb-0"
            >
              {dateStrip.map((date) => {
                const isActive = format(date, 'yyyy-MM-dd') === selectedDateStr
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                return (
                  <button
                    key={date.toString()}
                    data-active={isActive}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 w-[48px] md:w-auto flex flex-col items-center py-2 md:py-3 border transition-all snap-center ${
                      isActive
                        ? 'bg-accent border-border text-white font-black shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]'
                        : 'bg-white border-border text-gray-400 hover:border-accent hover:text-accent'
                    }`}
                  >
                    <span className="text-[7px] md:text-[8px] uppercase tracking-tighter opacity-70">
                      {format(date, 'EEE')}
                    </span>
                    <span className="text-xs md:text-sm">
                      {format(date, 'd')}
                    </span>
                    {isToday && !isActive && (
                      <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-accent rounded-full mt-0.5 md:mt-1" />
                    )}
                  </button>
                )
              })}
            </div>
          </header>
        </div>
      </div>

      <div key={currentView} className="max-w-5xl mx-auto p-4 md:p-8 pt-4 md:pt-8 pb-32 space-y-8 md:space-y-12 view-enter">
        <Suspense fallback={<ViewFallback />}>
          {currentView === 'tracker' ? (
            <>
            <section className="space-y-4">
          <div className="flex overflow-x-auto no-scrollbar md:flex-wrap gap-2 items-center -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map(cat => (
              <div key={cat} className="flex-shrink-0 flex">
                {editingCategory === cat ? (
                  <input
                    autoFocus
                    type="text"
                    value={newCategoryTitle}
                    onChange={(e) => setNewCategoryTitle(e.target.value)}
                    onBlur={updateCategoryName}
                    onKeyDown={(e) => e.key === 'Enter' && updateCategoryName()}
                    className="input-primary text-[10px] uppercase tracking-widest px-3 py-1.5 h-[34px] w-[120px]"
                  />
                ) : (
                  <button
                    onClick={() => setActiveCategory(cat)}
                    onDoubleClick={() => {
                      setEditingCategory(cat)
                      setNewCategoryTitle(cat)
                    }}
                    className={`px-4 py-1.5 h-[34px] text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2 ${
                      activeCategory === cat
                        ? 'bg-accent text-white border-border font-black shadow-[2px_2px_0px_0px_rgba(236,72,153,0.48)]'
                        : 'bg-white border-border text-gray-500 hover:border-border hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                )}
                {activeCategory === cat && !editingCategory && (
                  <div className="flex">
                    {cat !== 'General' && (
                      <button
                        onClick={() => {
                          setEditingCategory(cat)
                          setNewCategoryTitle(cat)
                        }}
                        className="border border-l-0 border-border px-3 py-1.5 h-[34px] text-gray-500 hover:text-accent transition-colors flex items-center justify-center bg-white"
                        title="Rename Section"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {cat !== 'General' && (
                      <button
                        onClick={() => {
                          setConfirmDelete({
                            isOpen: true,
                            title: t('danger.zone'),
                            message: t('danger.delete_category', { cat: cat.toUpperCase() }),
                            onConfirm: async () => {
                              if (session) {
                                try {
                                  await StorageService.deleteCategory(cat)
                                } catch (err) {
                                  console.error('Error deleting category:', err)
                                }
                              }
                              setRoutines(routines.filter(r => r.category !== cat))
                              setTasks(tasks.filter(t => t.category !== cat))
                              setActiveCategory('General')
                              setConfirmDelete(null)
                            }
                          })
                        }}
                        className="border border-l-0 border-border px-3 py-1.5 h-[34px] text-gray-500 hover:text-red-500 hover:border-red-500 transition-colors flex items-center justify-center bg-white"
                        title="Delete Section"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => setIsAddingCategory(!isAddingCategory)}
              className="flex-shrink-0 px-4 py-1.5 h-[34px] text-[10px] uppercase tracking-widest border border-dashed border-border text-gray-400 hover:text-accent hover:border-accent transition-all flex items-center gap-2"
            >
              + {t('action.new_category')}
            </button>
          </div>

          {isAddingCategory && (
            <form onSubmit={addCategory} className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <input
                autoFocus
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('action.enter_category_name')}
                className="flex-1 input-primary text-[10px] uppercase tracking-widest py-3"
              />
              <button type="submit" className="bg-accent text-white px-6 py-1 text-[10px] font-black hover:bg-sync transition-all uppercase tracking-widest border border-border">
                {t('common.confirm')}
              </button>
            </form>
          )}
        </section>

        {shouldShowTrackerMissedYesterday && (
          <MissedYesterdayBar
            title={t('recovery.tracker_title')}
            subtitle={t('recovery.tracker_subtitle')}
            actionLabel={t('recovery.log_yesterday')}
            dismissLabel={t('recovery.dismiss')}
            onRecover={recoverYesterday}
            onDismiss={() => dismissMissedNudge(trackerMissedYesterdayKey)}
          />
        )}

        <section className="bg-white border-2 border-border shadow-[6px_6px_0px_0px_rgba(20,184,166,0.34)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 md:p-7 space-y-6 border-b-2 lg:border-b-0 lg:border-r-2 border-border">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">Today Cockpit</p>
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-ink">{activeCategory}</h2>
                  <p className="text-xs md:text-sm text-ink/55 font-bold uppercase tracking-widest">{selectedDateLabel}</p>
                </div>
                <div className="flex items-center gap-3 bg-canvas border-2 border-border px-4 py-3 min-w-[140px]">
                  <Flame size={22} className="text-accent" fill="currentColor" />
                  <div>
                    <p className="text-2xl font-black leading-none">{dailyStreak}</p>
                    <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">{t('streak.daily')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45 font-black">{t('stats.progress')}</p>
                    <p className="text-xs text-ink/60 uppercase tracking-widest font-bold">
                      {dailyStats.total === 0 ? 'Add first habit to begin' : remainingToday === 0 ? 'All clear for this date' : `${remainingToday} left to close`}
                    </p>
                  </div>
                  <p className="text-3xl md:text-5xl font-black tracking-tighter text-accent">{dailyStats.percentage}%</p>
                </div>
                <div className={`h-5 bg-canvas border-2 border-border overflow-hidden p-[3px] relative ${dailyStats.percentage === 100 ? 'ring-2 ring-accent ring-offset-2 animate-success-pop' : ''}`}>
                  <div className="h-full bg-accent transition-all duration-700 ease-out" style={{ width: `${dailyStats.percentage}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="border-2 border-border bg-canvas p-3">
                  <p className="text-xl font-black text-ink">{dailyStats.completed}</p>
                  <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">Done</p>
                </div>
                <div className="border-2 border-border bg-canvas p-3">
                  <p className="text-xl font-black text-ink">{dailyStats.total}</p>
                  <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">Total</p>
                </div>
                <div className="border-2 border-border bg-canvas p-3">
                  <p className="text-xl font-black text-ink">{thirtyDayStats.avg}%</p>
                  <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">30D Avg</p>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-7 space-y-5 bg-accent-soft">
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">Quick Add</p>
                <p className="text-sm text-ink/65 leading-relaxed">Add the next habit to this category, then check it off from the list below.</p>
              </div>
              <form onSubmit={addRoutine} className="space-y-3">
                <input
                  ref={routineInputRef}
                  type="text"
                  value={newRoutineTitle}
                  onChange={(e) => setNewRoutineTitle(e.target.value)}
                  placeholder={t('action.new_habit', { category: activeCategory.toUpperCase() })}
                  className="w-full input-primary text-sm font-mono bg-white"
                />
                <button type="submit" className="w-full btn-primary py-4">
                  <Plus size={18} /> Add Habit
                </button>
              </form>
              <div className="border-2 border-border bg-white p-4 space-y-2">
                <p className="text-[9px] uppercase tracking-[0.24em] text-ink/45 font-black">Best Signal</p>
                <p className="text-sm font-black uppercase tracking-tight text-ink truncate">
                  {topRoutine ? topRoutine.title : 'Awaiting habit data'}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-accent font-black">
                  {topRoutine ? `${topRoutine.percentage}% lifetime consistency` : 'Start with one clear habit'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xs uppercase tracking-[0.3em] text-ink/60 font-black">Today Checklist</h2>
              <p className="text-[10px] text-ink/40 uppercase mt-1">{dailyStats.completed}/{dailyStats.total} complete in {activeCategory}</p>
            </div>
            {dailyStats.percentage === 100 && dailyStats.total > 0 && (
              <span className="text-[9px] uppercase tracking-widest text-accent font-black border-2 border-accent bg-accent-soft px-3 py-2">Mission Complete</span>
            )}
          </div>

          <div className="space-y-2">
            {filteredRoutines.length === 0 && (
              <EmptyState
                icon={ListTodo}
                title={t('status.no_habits', { category: activeCategory })}
                subtitle="Initialize your first habit mission to begin tracking performance."
                action={session ? {
                  label: "INITIALIZE_FIRST_HABIT",
                  onClick: () => routineInputRef.current?.focus()
                } : undefined}
              />
            )}
            {filteredRoutines.map(routine => {
              const isCompleted = completions.some(
                c => c.routine_id === routine.id && c.completed_date === selectedDateStr
              )
              return (
                <RoutineItem
                  key={routine.id}
                  routine={routine}
                  isCompleted={isCompleted}
                  editingRoutineId={editingRoutineId}
                  editingRoutineTitle={editingRoutineTitle}
                  setEditingRoutineId={setEditingRoutineId}
                  setEditingRoutineTitle={setEditingRoutineTitle}
                  toggleCompletion={toggleCompletion}
                  updateRoutineTitle={updateRoutineTitle}
                  deleteRoutine={(id, title) => {
                    setConfirmDelete({
                      isOpen: true,
                      title: t('danger.zone'),
                      message: t('danger.delete_routine', { title: title.toUpperCase() }),
                      onConfirm: async () => {
                        if (session) {
                          try {
                            await StorageService.deleteRoutine(id)
                          } catch (err) {
                            console.error('Error deleting routine:', err)
                          }
                        }
                        setRoutines(routines.filter(r => r.id !== id))
                        setConfirmDelete(null)
                      }
                    })
                  }}
                />
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Last 7 Days</h2>
            <p className="text-[8px] text-gray-400 uppercase tracking-widest">{activeCategory} {t('stats.consistency')}</p>
          </div>
          <div className="bg-white border-2 border-border p-4 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
          <div className="grid grid-cols-7 gap-2 h-16 items-end">
            {last7Days.map((day) => (
              <div key={day.date} className="flex flex-col items-center gap-2">
                <div className="w-full bg-canvas h-10 relative border-2 border-border overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                    style={{
                      height: `${day.percentage}%`,
                      backgroundColor: day.percentage === 100 ? '#EC4899' : '#14B8A6'
                    }}
                  />
                </div>
                <span className="text-[8px] uppercase text-ink/40 font-black tracking-widest">{day.label}</span>
              </div>
            ))}
          </div>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">{t('stats.thirty_days')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border-2 border-border p-6 text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
              <p className="text-[8px] text-gray-500 uppercase tracking-widest">{t('stats.perfect_days')}</p>
              <p className="text-3xl font-black text-ink tracking-tight">{thirtyDayStats.perfectDays}</p>
            </div>
            <div className="bg-white border-2 border-border p-6 text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
              <p className="text-[8px] text-gray-500 uppercase tracking-widest">{t('stats.avg_efficiency')}</p>
              <p className="text-3xl font-black text-accent tracking-tight">{thirtyDayStats.avg}%</p>
            </div>
          </div>
        </section>

            <section className="space-y-6 border-t border-border pt-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold">{t('stats.lifetime')}</h2>
                <p className="text-[10px] text-gray-400 uppercase mt-1">Total Days Tracked: {lifetimeStats.totalDays}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsChartFullscreen(true)}
                  className="p-2 bg-white border-2 border-border text-ink/40 hover:text-accent transition-all shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  title="Fullscreen View"
                >
                  <Maximize2 size={16} />
                </button>
                <div className="text-right">
                  <span className="text-3xl font-black text-accent">{lifetimeStats.percentage}%</span>
                </div>
              </div>            </div>

            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const next = new Set(hiddenRoutines)
                    if (next.has(TOTAL_CHART_KEY)) next.delete(TOTAL_CHART_KEY)
                    else next.add(TOTAL_CHART_KEY)
                    setHiddenRoutines(next)
                  }}
                  className={`px-2 py-1 text-[8px] uppercase font-bold border transition-all ${!hiddenRoutines.has(TOTAL_CHART_KEY) ? 'bg-accent border-border text-white shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]' : 'bg-white border-border text-gray-400 hover:border-border'}`}
                >
                  OVERALL_TOTAL
                </button>
                {filteredRoutines.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      const next = new Set(hiddenRoutines)
                      if (next.has(r.id)) next.delete(r.id)
                      else next.add(r.id)
                      setHiddenRoutines(next)
                    }}
                    className={`px-2 py-1 text-[8px] uppercase font-bold border transition-all ${!hiddenRoutines.has(r.id) ? 'border-border bg-canvas text-ink shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]' : 'border-border bg-white text-gray-400'}`}
                    style={{ borderLeftColor: !hiddenRoutines.has(r.id) ? CHART_LINE_COLORS[i % CHART_LINE_COLORS.length] : undefined, borderLeftWidth: '4px' }}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsAutoZoom(!isAutoZoom)}
                className={`px-3 py-1 border-2 text-[8px] font-black uppercase transition-all shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${isAutoZoom ? 'bg-ink text-white border-border' : 'bg-white border-border text-ink'}`}
              >
                {isAutoZoom ? 'FIXED_SCALE' : 'AUTO_ZOOM_Y'}
              </button>
            </div>

            <div className="h-[350px] w-full bg-white border-2 border-border p-4 pt-8 group shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]">
              {lifetimeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lifetimeChartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EC4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0E4EA" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#241522"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                   stroke="#241522"
                   fontSize={9}
                   tickLine={false}
                   axisLine={false}
                   domain={yDomain}
                   ticks={!isAutoZoom ? [0, 25, 50, 75, 100] : undefined}
                   tickFormatter={(val) => `${Math.round(val)}%`}
                  />
                  <Tooltip
                   contentStyle={{ backgroundColor: '#fff', border: '2px solid #241522', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                   itemStyle={{ padding: '0px', color: '#241522' }}
                   cursor={{ stroke: '#14B8A6', strokeWidth: 2 }}
	                   formatter={(val) => [`${Number(val || 0).toFixed(1)}%`, '']}
                  />
                  {!hiddenRoutines.has(TOTAL_CHART_KEY) && (
                   <Area
                     type="monotone"
                     dataKey={TOTAL_CHART_KEY}
                     name="Total"
                     stroke="#EC4899"
                     strokeWidth={3}
                     fillOpacity={1}
                     fill="url(#colorTotal)"
                     dot={false}
                     activeDot={{ r: 4, fill: '#EC4899', stroke: '#fff', strokeWidth: 2 }}
                     animationDuration={1000}
                   />
                  )}
                  {filteredRoutines.map((r, i) => !hiddenRoutines.has(r.id) && (
                   <Line
                     key={r.id}
                     type="monotone"
                     dataKey={r.id}
                     name={r.title}
                     stroke={CHART_LINE_COLORS[i % CHART_LINE_COLORS.length]}
                     strokeWidth={2}
                     dot={false}
                     opacity={0.6}
                     animationDuration={1000}
                   />
                  ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-ink/30">
                  <div className="w-10 h-10 border-2 border-dashed border-border" />
                  <p className="text-[10px] uppercase tracking-[0.25em] font-black">Awaiting habit data</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {taskBreakdown.filter(t => !hiddenRoutines.has(t.routineId)).map((task, index) => (
                <div key={index} className="bg-white border-2 border-border p-4 space-y-3 shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-gray-500 block truncate max-w-[150px] font-bold">{task.title}</span>
                      <span className="text-[8px] text-gray-400 uppercase block tracking-tighter">Started: {task.startDate}</span>
                    </div>
                    <span className="text-xl font-black text-accent">{task.percentage}%</span>
                  </div>

                  <div className="h-1 bg-canvas overflow-hidden">
                    <div
                      className="h-full transition-all duration-1000"
                      style={{ width: `${task.percentage}%`, backgroundColor: task.percentage > 80 ? '#EC4899' : '#14B8A6' }}
                    />
                  </div>

                  <div className="flex justify-between text-[8px] text-gray-400 uppercase tracking-widest pt-1">
                    <span>{task.totalCompletions} Completions</span>
                    <span>{task.activeDays} Days Active</span>
                  </div>
                </div>
              ))}
            </div>
            </section>

            </>
          ) : currentView === 'board' ? (
            <KanbanBoard
              tasks={tasks}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              addTask={addTask}
              moveTask={moveTask}
              deleteTask={deleteTask}
              selectedDateStr={selectedDateStr}
              finalizeTask={finalizeTask}
              logTask={logTask}
              taskLogs={taskLogs}
            />
          ) : currentView === 'leaderboard' ? (
            <Leaderboard onSelectUser={handleSelectUser} currentUserId={session?.user?.id} />
          ) : currentView === 'social' ? (
            <SocialFeed
              session={session}
              onShareStreak={handleShareStreak}
              dailyStreak={dailyStreak}
              onSelectUser={handleSelectUser}
            />
          ) : currentView === 'pods' ? (
            <AccountabilityPods
              session={session}
              onShareStreak={handleShareStreak}
              dailyStreak={dailyStreak}
              onSelectUser={handleSelectUser}
              selectedPod={selectedPod}
              onSelectPod={setSelectedPod}
              selectedDateStr={selectedDateStr}
              todayStr={todayStr}
              yesterdayStr={yesterdayStr}
              onRecoverYesterday={recoverYesterday}
            />
          ) : (
            <ProfileComponent
              key={viewedProfileId || session?.user?.id || 'guest'}
              profile={viewedProfileId ? viewedData?.profile || null : profile}
              routines={viewedProfileId ? viewedData?.routines || [] : routines}
              completions={viewedProfileId ? viewedData?.completions || [] : completions}
              dailyStreak={viewedProfileId ? viewedData?.dailyStreak || 0 : dailyStreak}
              weeklyStreak={viewedProfileId ? viewedData?.weeklyStreak || 0 : weeklyStreak}
              onProfileUpdate={viewedProfileId ? undefined : setProfile}
              isPublic={!!viewedProfileId}
              onBack={() => {
                setViewedProfileId(null)
                setCurrentView(previousView)
              }}
            />
          )}
        </Suspense>
      </div>

      {showManual && <ManualModal onClose={() => setShowManual(false)} />}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => {
            setIsAuthModalOpen(false)
            setAuthInitialView('sign_in')
          }}
          initialView={authInitialView}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          isOpen={confirmDelete.isOpen}
          title={confirmDelete.title}
          message={confirmDelete.message}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Suspense fallback={null}>
        <FullscreenChart
          isChartFullscreen={isChartFullscreen}
          setIsChartFullscreen={setIsChartFullscreen}
          activeCategory={activeCategory}
          lifetimeStats={lifetimeStats}
          lifetimeChartData={lifetimeChartData}
          hiddenRoutines={hiddenRoutines}
          setHiddenRoutines={setHiddenRoutines}
          filteredRoutines={filteredRoutines}
          isAutoZoom={isAutoZoom}
          setIsAutoZoom={setIsAutoZoom}
        />
      </Suspense>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-lg border-t-4 border-border px-1 py-1 pb-safe shadow-[0_-10px_40px_rgba(20,184,166,0.16)]">
        <div className="flex justify-between items-stretch h-16 max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => {
            if (item.authRequired && !session) return null;
            const Icon = item.icon;
            const isActive = currentView === item.id && (item.id !== 'profile' || !viewedProfileId);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'profile') setViewedProfileId(null);
                  setCurrentView(item.id);
                }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${isActive ? 'bg-accent text-white' : 'text-ink/40'}`}
              >
                <Icon size={20} className={isActive ? 'animate-success-pop' : ''} />
                <span className="text-[7px] font-black uppercase tracking-widest">{t(item.label)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  )
}

export default App
