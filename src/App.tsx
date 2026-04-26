import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import { format, subDays, startOfDay, eachDayOfInterval, parseISO, formatDistanceToNow } from 'date-fns'
import { Trophy, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Flame, Pencil, Trash2, HelpCircle, LogIn, LogOut, User, Bell, X } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Area, AreaChart, Line } from 'recharts'
import { ManualModal } from './components/ManualModal'
import { KanbanBoard } from './components/KanbanBoard'
import { FullscreenChart } from './components/FullscreenChart'
import { RoutineItem } from './components/RoutineItem'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AuthModal } from './components/Auth'
import { StorageService } from './lib/storage'
import type { Routine, RoutineCompletion, Task, TaskBreakdownItem, Profile, Group } from './types'
import type { Session } from '@supabase/supabase-js'
import { calculateXP } from './lib/gamification'
import { Leaderboard } from './components/Leaderboard'
import { Profile as ProfileComponent } from './components/Profile'
import { SocialFeed } from './components/SocialFeed'
import { AccountabilityPods } from './components/AccountabilityPods'
import type { AppNotification } from './types'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'tracker' | 'board' | 'leaderboard' | 'profile' | 'social' | 'pods'>('tracker')
  const [previousView, setPreviousView] = useState<'tracker' | 'board' | 'leaderboard' | 'profile' | 'social' | 'pods'>('leaderboard')
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null)
  const [viewedData, setViewedData] = useState<{ profile: Profile; routines: Routine[]; dailyStreak: number; weeklyStreak: number } | null>(null)
  const [selectedPod, setSelectedPod] = useState<Group | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
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

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null)
  const [editingRoutineTitle, setEditingRoutineTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null)
  const lastUserId = useRef<string | undefined>(undefined)

  const calculateStreaks = (userRoutines: Routine[], userCompletions: RoutineCompletion[]) => {
    if (userRoutines.length === 0 || userCompletions.length === 0) return { daily: 0, weekly: 0 }
    
    const activeRoutineIds = new Set(userRoutines.map(r => r.id))
    const doneDates = new Set(
      userCompletions
        .filter(c => activeRoutineIds.has(c.routine_id))
        .map(c => c.completed_date)
    )

    let daily = 0
    let checkDate = new Date()
    const isDateFinished = (date: Date) => doneDates.has(format(date, 'yyyy-MM-dd'))
    if (!isDateFinished(checkDate)) checkDate = subDays(checkDate, 1)
    while (isDateFinished(checkDate)) {
      daily++
      checkDate = subDays(checkDate, 1)
      if (daily > 10000) break 
    }

    let weekly = 0
    const isWeekSuccessful = (dateInWeek: Date) => {
      const start = startOfDay(subDays(dateInWeek, dateInWeek.getDay())) 
      const weekDays = eachDayOfInterval({ start, end: subDays(start, -6) })
      let activeDaysCount = 0
      weekDays.forEach(d => {
        if (userCompletions.some(c => c.completed_date === format(d, 'yyyy-MM-dd') && activeRoutineIds.has(c.routine_id))) activeDaysCount++
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

    return { daily, weekly }
  }

  const dismissNotification = async (id: string) => {
    try {
      await StorageService.markNotificationAsRead(id)
      setNotifications(notifications.filter(n => n.id !== id))
    } catch (err) {
      console.error('Error dismissing notification:', err)
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
                } catch (createErr: any) {
                  console.error('Profile initialization failed:', createErr)
                  if (mounted) setLoading(false)
                }
              }
            })

          const [routinesData, allCompletions, tasksData, notificationsData] = await Promise.all([
            StorageService.fetchRoutines(currentSession.user.id),
            StorageService.fetchCompletions(currentSession.user.id),
            StorageService.fetchTasks(currentSession.user.id),
            StorageService.fetchNotifications(currentSession.user.id)
          ])
          
          if (mounted) {
            setRoutines(routinesData)
            setCompletions(allCompletions)
            setTasks(tasksData)
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

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
    } catch (err: any) {
      console.error('Error sharing streak:', err)
      alert(`SHARE_FAILURE: ${err.message}`)
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
    if (session) {
      try {
        await StorageService.updateTask(id, { completed_date: dateStr })
        setTasks(tasks.map(t => t.id === id ? { ...t, completed_date: dateStr } : t))
      } catch (err) {
        console.error('Error finalizing task:', err)
      }
    } else {
      setTasks(tasks.map(t => t.id === id ? { ...t, completed_date: dateStr } : t))
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

    if (session) {
      try {
        const result = await StorageService.toggleCompletion(routineId, selectedDateStr, xp, session.user.id, existing?.id)
        if (result) {
          setCompletions([...completions, result])
        } else {
          setCompletions(completions.filter(c => c.id !== existing?.id))
        }
        // Refresh profile
        StorageService.fetchProfile(session.user.id).then(setProfile).catch(console.error)
      } catch (err: any) {
        console.error('Error toggling completion:', err)
        alert(`DATABASE_ERROR: ${err.message || 'Check if you ran the SQL script in Supabase'}`)
      }
    } else {
      if (existing) {
        setCompletions(completions.filter(c => c.id !== existing.id))
      } else {
        const guestCompletion: RoutineCompletion = {
          id: crypto.randomUUID(),
          routine_id: routineId,
          completed_date: selectedDateStr
        }
        setCompletions([...completions, guestCompletion])
      }
    }
  }

  const dailyStats = useMemo(() => {
    const total = filteredRoutines.length
    if (total === 0) return { completed: 0, total: 0, percentage: 0 }
    
    const completed = completions.filter(c => 
      c.completed_date === selectedDateStr && 
      filteredRoutines.some(r => r.id === c.routine_id)
    ).length
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100)
    }
  }, [filteredRoutines, completions, selectedDateStr])

  const dailyStreak = useMemo(() => {
    try {
      if (filteredRoutines.length === 0 || completions.length === 0) return 0
      
      const activeRoutineIds = new Set(filteredRoutines.map(r => r.id))
      const doneDates = new Set(
        completions
          .filter(c => activeRoutineIds.has(c.routine_id))
          .map(c => c.completed_date)
      )

      let streak = 0
      let checkDate = new Date()
      
      const isDateFinished = (date: Date) => {
        return doneDates.has(format(date, 'yyyy-MM-dd'))
      }

      if (!isDateFinished(checkDate)) {
        checkDate = subDays(checkDate, 1)
      }

      while (isDateFinished(checkDate)) {
        streak++
        checkDate = subDays(checkDate, 1)
        if (streak > 10000) break 
      }
      
      return streak
    } catch (err) {
      console.error('Error calculating category dailyStreak:', err)
      return 0
    }
  }, [filteredRoutines, completions])

  const weeklyStreak = useMemo(() => {
    try {
      if (filteredRoutines.length === 0 || completions.length === 0) return 0
      
      const activeRoutineIds = new Set(filteredRoutines.map(r => r.id))
      let streak = 0
      
      const isWeekSuccessful = (dateInWeek: Date) => {
        const start = startOfDay(subDays(dateInWeek, dateInWeek.getDay())) 
        const weekDays = eachDayOfInterval({
          start,
          end: subDays(start, -6)
        })
        
        let activeDaysCount = 0
        
        weekDays.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd')
          const wasActiveOnDay = completions.some(c => 
            c.completed_date === dStr && 
            activeRoutineIds.has(c.routine_id)
          )
          if (wasActiveOnDay) activeDaysCount++
        })
        
        return activeDaysCount >= 3
      }

      let currentCheck = new Date()
      if (!isWeekSuccessful(currentCheck)) {
        currentCheck = subDays(currentCheck, 7)
      }

      while (isWeekSuccessful(currentCheck)) {
        streak++
        currentCheck = subDays(currentCheck, 7)
        if (streak > 500) break 
      }
      
      return streak
    } catch (err) {
      console.error('Error calculating category weeklyStreak:', err)
      return 0
    }
  }, [filteredRoutines, completions])

  const last7Days = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(selectedDate, 6),
      end: selectedDate
    }).map(date => {
      const dStr = format(date, 'yyyy-MM-dd')
      const total = filteredRoutines.length
      const done = completions.filter(c => 
        c.completed_date === dStr && 
        filteredRoutines.some(r => r.id === c.routine_id)
      ).length
      return {
        date: dStr,
        label: format(date, 'EEE'),
        percentage: total > 0 ? (done / total) * 100 : 0
      }
    })
  }, [filteredRoutines, completions, selectedDate])

  const taskBreakdown = useMemo<TaskBreakdownItem[]>(() => {
    try {
      if (filteredRoutines.length === 0) return []
      
      return filteredRoutines.map(routine => {
        const taskCompletions = completions.filter(c => c.routine_id === routine.id)
        if (taskCompletions.length === 0) return { title: routine.title, percentage: 0, startDate: 'N/A', totalCompletions: 0, activeDays: 0 }

        const dates = taskCompletions.map(c => parseISO(c.completed_date)).filter(d => !isNaN(d.getTime()))
        if (dates.length === 0) return { title: routine.title, percentage: 0, startDate: 'N/A', totalCompletions: 0, activeDays: 0 }
        
        const firstDate = startOfDay(dates.reduce((a, b) => a < b ? a : b))
        const today = startOfDay(new Date())
        const activeDays = eachDayOfInterval({ start: firstDate, end: today }).length

        return {
          title: routine.title,
          percentage: Math.round((taskCompletions.length / activeDays) * 100),
          startDate: format(firstDate, 'MMM d, yyyy'),
          totalCompletions: taskCompletions.length,
          activeDays
        }
      })
    } catch (err) {
      console.error('Error in taskBreakdown:', err)
      return []
    }
  }, [filteredRoutines, completions])

  const lifetimeStats = useMemo(() => {
    try {
      if (taskBreakdown.length === 0) return { totalDays: 0, percentage: 0 }
      
      const totalPercentage = taskBreakdown.reduce((acc, task) => acc + task.percentage, 0)
      const averagePercentage = Math.round(totalPercentage / taskBreakdown.length)
      
      const relevantCompletions = completions.filter(c => 
        filteredRoutines.some(r => r.id === c.routine_id)
      )
      const dates = relevantCompletions.map(c => parseISO(c.completed_date)).filter(d => !isNaN(d.getTime()))
      const firstDate = dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : new Date()
      const totalDays = eachDayOfInterval({ start: startOfDay(firstDate), end: startOfDay(new Date()) }).length

      return {
        totalDays,
        percentage: averagePercentage
      }
    } catch (err) {
      console.error('Error in lifetimeStats:', err)
      return { totalDays: 0, percentage: 0 }
    }
  }, [taskBreakdown, completions, filteredRoutines])

  const lifetimeChartData = useMemo(() => {
    try {
      if (completions.length === 0 || filteredRoutines.length === 0) return []
      
      const showTotal = !hiddenRoutines.has('Total')
      const visibleRoutines = filteredRoutines.filter(r => !hiddenRoutines.has(r.title))
      
      const timelineRoutines = showTotal ? filteredRoutines : visibleRoutines
      if (timelineRoutines.length === 0) return []

      const timelineCompletions = completions.filter(c => 
        timelineRoutines.some(r => r.id === c.routine_id)
      )

      const dates = timelineCompletions.map(c => parseISO(c.completed_date)).filter(d => !isNaN(d.getTime()))
      if (dates.length === 0) return []

      const firstDate = startOfDay(dates.reduce((a, b) => a < b ? a : b))
      const today = startOfDay(new Date())
      
      const daysInterval = eachDayOfInterval({
        start: firstDate,
        end: today
      })

      const completionsByDate: Record<string, string[]> = {}
      const relevantCompletions = completions.filter(c => filteredRoutines.some(r => r.id === c.routine_id))
      
      relevantCompletions.forEach(c => {
        if (!completionsByDate[c.completed_date]) completionsByDate[c.completed_date] = []
        completionsByDate[c.completed_date].push(c.routine_id)
      })

      const data: Record<string, string | number>[] = []
      const cumulativeTaskCompletions: Record<string, number> = {}

      const routineStartDates: Record<string, string> = {}
      filteredRoutines.forEach(r => {
        cumulativeTaskCompletions[r.id] = 0
        const taskCompletions = relevantCompletions.filter(c => c.routine_id === r.id)
        if (taskCompletions.length > 0) {
          const first = taskCompletions.reduce((min, c) => c.completed_date < min ? c.completed_date : min, taskCompletions[0].completed_date)
          routineStartDates[r.id] = first
        }
      })

      daysInterval.forEach((date, index) => {
        const dStr = format(date, 'yyyy-MM-dd')
        const entry: Record<string, string | number> = { name: dStr }

        const todayDoneIds = completionsByDate[dStr] || []
        todayDoneIds.forEach(id => {
          if (cumulativeTaskCompletions[id] !== undefined) {
            cumulativeTaskCompletions[id]++
          }
        })

        let dailyTotalPercentage = 0
        let activeTasksOnDay = 0

        filteredRoutines.forEach(routine => {
          const startDate = routineStartDates[routine.id]

          if (startDate && dStr >= startDate) {
            const taskFirstDate = parseISO(startDate)
            const daysActiveForThisTask = eachDayOfInterval({ start: taskFirstDate, end: date }).length
            const taskCount = cumulativeTaskCompletions[routine.id]

            const taskPercentage = (taskCount / daysActiveForThisTask) * 100
            entry[routine.title] = taskPercentage
            dailyTotalPercentage += taskPercentage
            activeTasksOnDay++
          }
        })

        entry['Total'] = activeTasksOnDay > 0 ? (dailyTotalPercentage / activeTasksOnDay) : 0

        if (daysInterval.length < 365 || index % 2 === 0 || index === daysInterval.length - 1) {
          data.push(entry)
        }
      })      
      return data
    } catch (err) {
      console.error('Error in lifetimeChartData:', err)
      return []
    }
  }, [filteredRoutines, completions, hiddenRoutines])

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
      const done = completions.filter(c => 
        c.completed_date === dStr && 
        filteredRoutines.some(r => r.id === c.routine_id)
      ).length
      if (filteredRoutines.length > 0) {
        totalTasks += filteredRoutines.length
        completedTasks += done
        if (done === filteredRoutines.length) perfectDays++
      }
    })
    
    return {
      perfectDays,
      avg: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalExecs: completedTasks
    }
  }, [filteredRoutines, completions, selectedDate])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono">
        INITIALIZING_SYSTEM...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono selection:bg-cyan-500/30 pb-20">
      
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-[60] bg-black/80 backdrop-blur-md border-b border-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
          <header className="space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tighter uppercase">DISBY</h1>
                  <button 
                    onClick={() => setShowManual(true)}
                    className="text-gray-700 hover:text-cyan-400 transition-colors"
                    title="View Manual"
                  >
                    <HelpCircle size={16} />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`relative flex items-center justify-center p-1 transition-colors ${notifications.length > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-700 hover:text-cyan-400'}`}
                      title="Transmissions"
                    >
                      <Bell size={16} />
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[6px] font-black px-1 rounded-full border border-black">
                          {notifications.length}
                        </span>
                      )}
                    </button>
                    {showNotifications && (
                      <div className="absolute top-full left-0 mt-4 w-64 bg-black border border-gray-800 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
                          <span className="text-[8px] uppercase font-black text-gray-500 tracking-[0.2em]">Incoming_Transmissions</span>
                          <button onClick={() => setShowNotifications(false)} className="text-gray-600 hover:text-white">
                            <X size={10} />
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          {notifications.length > 0 ? (
                            notifications.map((n) => (
                              <div key={n.id} className="p-3 border-b border-gray-900 last:border-0 hover:bg-gray-900/50 transition-colors group">
                                <p className="text-[10px] text-gray-300 font-mono leading-relaxed mb-2">{n.content}</p>
                                <div className="flex justify-between items-center">
                                  <span className="text-[7px] text-gray-600 uppercase font-bold">{formatDistanceToNow(new Date(n.created_at))} ago</span>
                                  <button 
                                    onClick={() => dismissNotification(n.id)}
                                    className="text-[7px] uppercase font-black text-cyan-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    [Clear_Link]
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-gray-700">
                              <p className="text-[8px] uppercase font-black tracking-widest">No active links</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex gap-1 bg-gray-900/50 p-1 border border-gray-800">
                    <button
                      onClick={() => setCurrentView('tracker')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'tracker' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Tracker
                    </button>
                    <button
                      onClick={() => setCurrentView('board')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'board' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Board
                    </button>
                    <button
                      onClick={() => setCurrentView('leaderboard')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'leaderboard' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Rank
                    </button>
                    <button
                      onClick={() => setCurrentView('social')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'social' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Global
                    </button>
                    <button
                      onClick={() => setCurrentView('pods')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'pods' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Pods
                    </button>
                    {session && (
                      <button
                        onClick={() => {
                          setViewedProfileId(null)
                          setCurrentView('profile')
                        }}
                        className={`px-3 py-1 text-[10px] font-bold uppercase transition-all ${currentView === 'profile' && !viewedProfileId ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Profile
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                    className="text-gray-600 hover:text-cyan-400 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="flex items-center gap-2 text-cyan-400 bg-cyan-950/20 px-3 py-1 border border-cyan-500/30 hover:bg-cyan-900/40 transition-all text-xs font-bold"
                    >
                      <CalendarIcon size={14} />
                      {format(selectedDate, 'EEE, MMM d, yyyy').toUpperCase()}
                    </button>
                    {showDatePicker && (
                      <div className="absolute top-full left-0 mt-2 z-50 bg-black border border-gray-800 p-3 shadow-2xl space-y-3 min-w-[200px]">
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase text-gray-500 font-bold">Select Date</label>
                          <input 
                            autoFocus
                            type="date" 
                            defaultValue={selectedDateStr}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val && val.length === 10) {
                                const newDate = new Date(val)
                                if (!isNaN(newDate.getTime())) {
                                  setSelectedDate(newDate)
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setShowDatePicker(false)
                            }}
                            className="w-full bg-gray-900 text-white text-xs p-2 border border-gray-800 focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setShowDatePicker(false)}
                            className="flex-1 py-2 text-[9px] bg-cyan-500 text-black font-bold uppercase tracking-widest hover:bg-cyan-400"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedDate(new Date())
                              setShowDatePicker(false)
                            }}
                            className="flex-1 py-2 text-[9px] bg-gray-800 text-white font-bold uppercase tracking-widest hover:bg-gray-700"
                          >
                            Today
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setSelectedDate(subDays(selectedDate, -1))}
                    className="text-gray-600 hover:text-cyan-400 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>

                  {selectedDateStr !== format(new Date(), 'yyyy-MM-dd') && (
                    <button 
                      onClick={() => setSelectedDate(new Date())}
                      className="ml-2 px-2 py-1 text-[9px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all uppercase tracking-widest"
                    >
                      TODAY
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex gap-6">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-orange-500">
                      <Flame size={18} fill="currentColor" />
                      <span className="text-2xl font-black">{dailyStreak}</span>
                    </div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest">Daily</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-cyan-400">
                      <Trophy size={18} />
                      <span className="text-2xl font-black">{weeklyStreak}</span>
                    </div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest">Weekly</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 pt-1">
                  {session ? (
                    <button 
                      onClick={() => supabase.auth.signOut()}
                      className="text-gray-700 hover:text-red-500 transition-colors"
                      title="Logout"
                    >
                      <LogOut size={16} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all text-[8px] font-black uppercase tracking-[0.2em]"
                    >
                      <LogIn size={12} />
                      Login
                    </button>
                  )}
                  {session && profile && (
                    <div className="flex items-center gap-2 text-[8px] text-gray-600 uppercase font-bold">
                      <div className="w-4 h-4 bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                        ) : (
                          <User size={10} />
                        )}
                      </div>
                      {profile.username}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {dateStrip.map((date) => {
                const isActive = format(date, 'yyyy-MM-dd') === selectedDateStr
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                return (
                  <button
                    key={date.toString()}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center py-2 border transition-all ${
                      isActive 
                        ? 'bg-cyan-500 border-cyan-500 text-black font-black' 
                        : 'bg-gray-950 border-gray-900 text-gray-500 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-[8px] uppercase tracking-tighter opacity-70">
                      {format(date, 'EEE')}
                    </span>
                    <span className="text-sm">
                      {format(date, 'd')}
                    </span>
                    {isToday && !isActive && (
                      <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1" />
                    )}
                  </button>
                )
              })}
            </div>
          </header>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8 pt-4 space-y-8">
        {currentView === 'tracker' ? (
          <>
            <section className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            {categories.map(cat => (
              <div key={cat} className="flex">
                {editingCategory === cat ? (
                  <input
                    autoFocus
                    type="text"
                    value={newCategoryTitle}
                    onChange={(e) => setNewCategoryTitle(e.target.value)}
                    onBlur={updateCategoryName}
                    onKeyDown={(e) => e.key === 'Enter' && updateCategoryName()}
                    className="bg-gray-900 border border-cyan-500 text-[10px] uppercase tracking-widest px-3 py-1 text-white font-mono focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setActiveCategory(cat)}
                    onDoubleClick={() => {
                      setEditingCategory(cat)
                      setNewCategoryTitle(cat)
                    }}
                    className={`px-3 py-1 text-[10px] uppercase tracking-widest border transition-all ${
                      activeCategory === cat 
                        ? 'bg-white text-black border-white font-bold' 
                        : 'border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400'
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
                        className="border border-l-0 border-gray-800 px-2 py-1 text-gray-700 hover:text-cyan-500 transition-colors"
                        title="Rename Section"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {cat !== 'General' && (
                      <button 
                        onClick={() => {
                          setConfirmDelete({
                            isOpen: true,
                            title: 'Danger Zone',
                            message: `DELETE ENTIRE SECTION "${cat.toUpperCase()}" AND ALL ITS HISTORY?`,
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
                        className="border border-l-0 border-gray-800 px-2 py-1 text-gray-700 hover:text-red-500 hover:border-red-900 transition-colors"
                        title="Delete Section"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => setIsAddingCategory(!isAddingCategory)}
              className="px-3 py-1 text-[10px] uppercase tracking-widest border border-dashed border-gray-800 text-gray-600 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
            >
              + NEW_SECTION
            </button>
          </div>
          
          {isAddingCategory && (
            <form onSubmit={addCategory} className="flex gap-2">
              <input 
                autoFocus
                type="text" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="ENTER_SECTION_NAME..."
                className="flex-1 bg-gray-950 border border-gray-800 px-3 py-1 text-[10px] uppercase tracking-widest focus:outline-none focus:border-cyan-500 text-gray-400 font-mono"
              />
              <button type="submit" className="bg-gray-800 text-white px-3 py-1 text-[10px] hover:bg-cyan-600 transition-all">
                CONFIRM
              </button>
            </form>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500">
            <span>{activeCategory}_Progress</span>
            <span className={dailyStats.percentage === 100 ? "text-cyan-400" : ""}>
              {dailyStats.completed}/{dailyStats.total} - {dailyStats.percentage}%
            </span>
          </div>
          <div className="h-3 bg-gray-900 border border-gray-800 rounded-none overflow-hidden p-[2px]">
            <div 
              className="h-full bg-cyan-500 transition-all duration-700 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              style={{ width: `${dailyStats.percentage}%` }}
            />
          </div>
        </section>

        <section className="bg-gray-950/50 border border-gray-900 p-4">
          <div className="grid grid-cols-7 gap-2 h-16 items-end">
            {last7Days.map((day) => (
              <div key={day.date} className="flex flex-col items-center gap-2">
                <div className="w-full bg-gray-900 h-10 relative border border-gray-800 overflow-hidden">
                  <div 
                    className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                    style={{ 
                      height: `${day.percentage}%`, 
                      backgroundColor: day.percentage === 100 ? '#06b6d4' : '#374151' 
                    }}
                  />
                </div>
                <span className="text-[8px] uppercase text-gray-600 font-bold">{day.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">30_Day_Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-950/30 border border-gray-900 p-6 text-center space-y-1">
              <p className="text-[8px] text-gray-600 uppercase tracking-widest">Perfect_Days</p>
              <p className="text-3xl font-black text-white tracking-tight">{thirtyDayStats.perfectDays}</p>
            </div>
            <div className="bg-gray-950/30 border border-gray-900 p-6 text-center space-y-1">
              <p className="text-[8px] text-gray-600 uppercase tracking-widest">Avg_Efficiency</p>
              <p className="text-3xl font-black text-cyan-400 tracking-tight">{thirtyDayStats.avg}%</p>
            </div>
          </div>
        </section>

            <section className="space-y-6 border-t border-gray-900 pt-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold">Lifetime_Performance</h2>
                <p className="text-[10px] text-gray-600 uppercase mt-1">Total Days Tracked: {lifetimeStats.totalDays}</p>
              </div>
              <div className="flex items-center gap-4">
                <FullscreenChart
                  isChartFullscreen={isChartFullscreen}
                  setIsChartFullscreen={setIsChartFullscreen}
                  activeCategory={activeCategory}
                  lifetimeStats={lifetimeStats}
                  lifetimeChartData={lifetimeChartData}
                  hiddenRoutines={hiddenRoutines}
                  setHiddenRoutines={setHiddenRoutines}
                  filteredRoutines={filteredRoutines}
                />
                <div className="text-right">
                  <span className="text-3xl font-black text-cyan-400">{lifetimeStats.percentage}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const next = new Set(hiddenRoutines)
                  if (next.has('Total')) next.delete('Total')
                  else next.add('Total')
                  setHiddenRoutines(next)
                }}
                className={`px-2 py-1 text-[8px] uppercase font-bold border transition-all ${!hiddenRoutines.has('Total') ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-gray-800 text-gray-600 hover:border-gray-700'}`}
              >
                OVERALL_TOTAL
              </button>
              {filteredRoutines.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => {
                    const next = new Set(hiddenRoutines)
                    if (next.has(r.title)) next.delete(r.title)
                    else next.add(r.title)
                    setHiddenRoutines(next)
                  }}
                  className={`px-2 py-1 text-[8px] uppercase font-bold border transition-all ${!hiddenRoutines.has(r.title) ? 'border-transparent bg-gray-900 text-gray-300' : 'border-gray-800 text-gray-700'}`}
                  style={{ borderLeftColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 40%, 40%)` : undefined, borderLeftWidth: '2px' }}
                >
                  {r.title}
                </button>
              ))}
            </div>

            <div className="h-[350px] w-full bg-gray-950/20 border border-gray-900 p-4 pt-8 group">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lifetimeChartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#374151" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                   stroke="#374151"
                   fontSize={9}
                   tickLine={false}
                   axisLine={false}
                   domain={['auto', 'auto']}
                   tickFormatter={(val) => `${Math.round(val)}%`}
                  />
                  <Tooltip
                   contentStyle={{ backgroundColor: '#000', border: '1px solid #1f2937', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                   itemStyle={{ padding: '0px' }}
                   cursor={{ stroke: '#1f2937' }}
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   formatter={(val: any) => [`${Number(val || 0).toFixed(1)}%`, '']}
                  />
                  {!hiddenRoutines.has('Total') && (
                   <Area
                     type="natural"
                     dataKey="Total"
                     stroke="#06b6d4"
                     strokeWidth={3}
                     fillOpacity={1}
                     fill="url(#colorTotal)"
                     dot={false}
                     activeDot={{ r: 4, fill: '#06b6d4', stroke: '#000', strokeWidth: 2 }}
                     animationDuration={1500}
                   />
                  )}
                  {filteredRoutines.map((r, i) => !hiddenRoutines.has(r.title) && (
                   <Line
                     key={r.id}
                     type="natural"
                     dataKey={r.title}
                     stroke={`hsl(${(i * 60) % 360}, 40%, 40%)`}
                     strokeWidth={1.5}
                     dot={false}
                     opacity={0.6}
                     animationDuration={1500}
                   />
                  ))}                  <Brush 
                    dataKey="name" 
                    height={30} 
                    stroke="#1f2937" 
                    fill="#000"
                    travellerWidth={10}
                    gap={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {taskBreakdown.map((task, index) => (
                <div key={index} className="bg-gray-950 border border-gray-900 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block truncate max-w-[150px] font-bold">{task.title}</span>
                      <span className="text-[8px] text-gray-600 uppercase block tracking-tighter">Started: {task.startDate}</span>
                    </div>
                    <span className="text-xl font-black text-cyan-500">{task.percentage}%</span>
                  </div>
                  
                  <div className="h-1 bg-gray-900 overflow-hidden">
                    <div 
                      className="h-full bg-gray-700 transition-all duration-1000"
                      style={{ width: `${task.percentage}%`, backgroundColor: task.percentage > 80 ? '#06b6d4' : '#374151' }}
                    />
                  </div>

                  <div className="flex justify-between text-[8px] text-gray-500 uppercase tracking-widest pt-1">
                    <span>{task.totalCompletions} Completions</span>
                    <span>{task.activeDays} Days Active</span>
                  </div>
                </div>
              ))}
            </div>
            </section>

        <section className="space-y-4">
          <form onSubmit={addRoutine} className="flex gap-2">
            <input 
              type="text" 
              value={newRoutineTitle}
              onChange={(e) => setNewRoutineTitle(e.target.value)}
              placeholder={`NEW_${activeCategory.toUpperCase()}_PROTOCOL...`}
              className="flex-1 bg-gray-900 border border-gray-800 px-4 py-2 focus:outline-none focus:border-cyan-500 text-sm text-gray-400 font-mono"
            />
            <button type="submit" className="bg-white text-black px-4 py-2 hover:bg-cyan-500 hover:text-white transition-all duration-300">
              <Plus size={18} />
            </button>
          </form>

          <div className="space-y-2">
            {filteredRoutines.length === 0 && (
              <div className="text-center py-10 border border-dashed border-gray-800 text-gray-700 text-[10px] tracking-widest">
                NO_PROTOCOLS_IN_{activeCategory.toUpperCase()}
              </div>
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
                      title: 'Danger Zone',
                      message: `DELETE "${title.toUpperCase()}" AND ALL HISTORY?`,
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
      />
      ) : (
      <ProfileComponent 
        profile={viewedProfileId ? viewedData?.profile || null : profile} 
        routines={viewedProfileId ? viewedData?.routines || [] : routines} 
        dailyStreak={viewedProfileId ? viewedData?.dailyStreak || 0 : dailyStreak} 
        weeklyStreak={viewedProfileId ? viewedData?.weeklyStreak || 0 : weeklyStreak} 
        onProfileUpdate={viewedProfileId ? undefined : setProfile}
        isPublic={!!viewedProfileId}
        onBack={() => {
          setViewedProfileId(null)
          setCurrentView(previousView)
        }}
      />
    )}      </div>

      {showManual && <ManualModal onClose={() => setShowManual(false)} />}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      
      {confirmDelete && (
        <ConfirmDialog
          isOpen={confirmDelete.isOpen}
          title={confirmDelete.title}
          message={confirmDelete.message}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

export default App
