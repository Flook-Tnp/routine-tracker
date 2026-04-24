import { useEffect, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from 'date-fns'
import { CheckCircle2, Circle, Trophy, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Flame, Pencil, Trash2, HelpCircle, Maximize2, Minimize2 } from 'lucide-react'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Area, AreaChart } from 'recharts'

// --- TYPES ---
export interface Routine {
  id: string
  title: string
  created_at: string
  is_active: boolean
  category: string
}

export interface RoutineCompletion {
  id: string
  routine_id: string
  completed_date: string
}

function App() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [activeCategory, setActiveCategory] = useState('General')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  const [hiddenRoutines, setHiddenRoutines] = useState<Set<string>>(new Set())

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null)
  const [editingRoutineTitle, setEditingRoutineTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')

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

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: routinesData, error: routinesError } = await supabase.from('routines').select('*').eq('is_active', true)
      if (routinesError) throw routinesError
      if (routinesData) setRoutines(routinesData)
      
      let allCompletions: any[] = []
      let from = 0
      let to = 999
      let hasMore = true

      while (hasMore) {
        console.log(`Fetching records ${from} to ${to}...`)
        const { data, error } = await supabase
          .from('routine_completions')
          .select('*')
          .order('completed_date', { ascending: true })
          .range(from, to)
        
        if (error) {
          console.error('Fetch error:', error)
          break
        }

        if (data && data.length > 0) {
          allCompletions = [...allCompletions, ...data]
          if (data.length < 1000) {
            hasMore = false
          } else {
            from += 1000
            to += 1000
          }
        } else {
          hasMore = false
        }
        
        if (from > 1000000) break // Increased hard limit to 1 million records
        }

        console.log('Final completion count:', allCompletions.length)
        setCompletions(allCompletions)
        } catch (err) {
        console.error('Fatal data fetch error:', err)
        } finally {
        setLoading(false)
        }
        }

        useEffect(() => {
        fetchData()
        }, [])

        async function updateRoutineTitle(id: string) {
        if (!editingRoutineTitle.trim()) {
        setEditingRoutineId(null)
        return
        }

        const { error } = await supabase
        .from('routines')
        .update({ title: editingRoutineTitle })
        .eq('id', id)

        if (!error) {
        setRoutines(routines.map(r => r.id === id ? { ...r, title: editingRoutineTitle } : r))
        }
        setEditingRoutineId(null)
        }

        async function updateCategoryName() {
        if (!newCategoryTitle.trim() || newCategoryTitle === activeCategory) {
        setEditingCategory(null)
        return
        }

        const { error } = await supabase
        .from('routines')
        .update({ category: newCategoryTitle })
        .eq('category', activeCategory)

        if (!error) {
        setRoutines(routines.map(r => r.category === activeCategory ? { ...r, category: newCategoryTitle } : r))
        setActiveCategory(newCategoryTitle)
        }
        setEditingCategory(null)
        }

        async function addRoutine(e: React.FormEvent) {
        e.preventDefault()
        if (!newRoutineTitle.trim()) return

        // Explicitly ensure category is passed and fallback to 'General'
        const targetCategory = activeCategory || 'General'

        const { data, error } = await supabase
        .from('routines')
        .insert([{ title: newRoutineTitle, category: targetCategory }])
        .select()

        if (error) {
        console.error('Error adding routine:', error)
        return
        }

        if (data) {
        setRoutines([...routines, data[0]])
        setNewRoutineTitle('')
        }
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

    if (existing) {
      await supabase.from('routine_completions').delete().eq('id', existing.id)
      setCompletions(completions.filter(c => c.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('routine_completions')
        .insert([{ routine_id: routineId, completed_date: selectedDateStr }])
        .select()
      
      if (data) {
        setCompletions([...completions, data[0]])
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
      
      // Use a Set of completion dates ONLY for the currently active category
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

  const taskBreakdown = useMemo(() => {
    try {
      if (filteredRoutines.length === 0) return []
      
      return filteredRoutines.map(routine => {
        const taskCompletions = completions.filter(c => c.routine_id === routine.id)
        if (taskCompletions.length === 0) return { title: routine.title, percentage: 0 }

        // Use the actual range of dates this task has been active
        const dates = taskCompletions.map(c => parseISO(c.completed_date)).filter(d => !isNaN(d.getTime()))
        if (dates.length === 0) return { title: routine.title, percentage: 0 }
        
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
      
      // Total days tracked for the entire category
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
      
      // Determine which routines should define our timeline
      // If Total is shown, we show the whole category history.
      // If Total is hidden, we zoom to the earliest start of the visible routines.
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

      // Pre-group completions by date for O(1) lookup
      const completionsByDate: Record<string, string[]> = {}
      const relevantCompletions = completions.filter(c => filteredRoutines.some(r => r.id === c.routine_id))
      
      relevantCompletions.forEach(c => {
        if (!completionsByDate[c.completed_date]) completionsByDate[c.completed_date] = []
        completionsByDate[c.completed_date].push(c.routine_id)
      })

      const data: any[] = []
      const cumulativeTaskCompletions: Record<string, number> = {}

      // Pre-determine the start date for EACH routine to calculate independent elapsed days
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
        const entry: any = { name: dStr }

        // Update cumulative counts for this day
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

          // A task is only "active" on this specific chart day if we have reached or passed its first completion date
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

        // Reduce density for long periods (show every 2 days if over 1 year)
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
                  <h1 className="text-2xl font-bold text-white tracking-tighter uppercase">ROUTINE_TRACKER</h1>
                  <button 
                    onClick={() => setShowManual(true)}
                    className="text-gray-700 hover:text-cyan-400 transition-colors"
                    title="View Manual"
                  >
                    <HelpCircle size={16} />
                  </button>
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

                  {/* Go to Today Button */}
                  {selectedDateStr !== format(new Date(), 'yyyy-MM-dd') && (
                    <button 
                      onClick={() => setSelectedDate(new Date())}
                      className="ml-2 px-2 py-1 text-[9px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all uppercase tracking-widest"
                    >
                      TODAY
                    </button>
                  )}
                  </div>
                  </div>              <div className="flex gap-6">
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
            </div>

            {/* Quick Date Strip */}
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

        {/* Category Switcher */}
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
                        onClick={async () => {
                          if (window.confirm(`DELETE ENTIRE SECTION "${cat.toUpperCase()}" AND ALL ITS HISTORY?`)) {
                            await supabase.from('routines').delete().eq('category', cat)
                            setRoutines(routines.filter(r => r.category !== cat))
                            setActiveCategory('General')
                          }
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

        {/* Progress Bar */}
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

        {/* Weekly Overview */}
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

        {/* 30 Day Stats */}
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

            {/* Lifetime Dashboard */}
            <section className="space-y-6 border-t border-gray-900 pt-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold">Lifetime_Performance</h2>
                <p className="text-[10px] text-gray-600 uppercase mt-1">Total Days Tracked: {lifetimeStats.totalDays}</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsChartFullscreen(true)}
                  className="p-2 bg-gray-950 border border-gray-800 text-gray-500 hover:text-cyan-400 transition-all shadow-lg"
                  title="Fullscreen View"
                >
                  <Maximize2 size={16} />
                </button>
                <div className="text-right">
                  <span className="text-3xl font-black text-cyan-400">{lifetimeStats.percentage}%</span>
                </div>
              </div>
            </div>

            {/* Task Visibility Toggles */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (hiddenRoutines.has('Total')) {
                    const next = new Set(hiddenRoutines)
                    next.delete('Total')
                    setHiddenRoutines(next)
                  } else {
                    const next = new Set(hiddenRoutines)
                    next.add('Total')
                    setHiddenRoutines(next)
                  }
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

            {/* Lifetime Performance Chart */}
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
                   formatter={(val: any) => [`${Number(val).toFixed(1)}%`, '']}
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
              {taskBreakdown.map((task: any, index) => (
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

            {/* Task List */}
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
                <div 
                  key={routine.id}
                  onClick={() => toggleCompletion(routine.id)}
                  className={`group flex items-center justify-between p-4 border transition-all duration-300 cursor-pointer ${
                    isCompleted 
                      ? 'bg-cyan-950/10 border-cyan-500/40 text-cyan-400 shadow-[inset_0_0_30px_rgba(6,182,212,0.05)]' 
                      : 'bg-gray-950 border-gray-800 hover:border-gray-600 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {isCompleted 
                      ? <CheckCircle2 size={20} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" /> 
                      : <Circle size={20} className="text-gray-800" />
                    }
                    {editingRoutineId === routine.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingRoutineTitle}
                        onChange={(e) => setEditingRoutineTitle(e.target.value)}
                        onBlur={() => updateRoutineTitle(routine.id)}
                        onKeyDown={(e) => e.key === 'Enter' && updateRoutineTitle(routine.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-black border-b border-cyan-500 text-sm tracking-tight text-white focus:outline-none font-mono"
                      />
                    ) : (
                      <span 
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingRoutineId(routine.id)
                          setEditingRoutineTitle(routine.title)
                        }}
                        className={`text-sm tracking-tight ${isCompleted ? 'line-through opacity-60' : ''}`}
                      >
                        {routine.title}
                      </span>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingRoutineId(routine.id)
                        setEditingRoutineTitle(routine.title)
                      }}
                      className="p-1 hover:text-cyan-400 transition-colors"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (window.confirm(`DELETE "${routine.title.toUpperCase()}" AND ALL HISTORY?`)) {
                          await supabase.from('routines').delete().eq('id', routine.id)
                          setRoutines(routines.filter(r => r.id !== routine.id))
                        }
                      }}
                      className="p-1 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>

      {/* Manual Modal Overlay */}
      {showManual && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-black border border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,1)]">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">OPERATIONAL_MANUAL.v1</h2>
              <button onClick={() => setShowManual(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm space-y-8 font-mono leading-relaxed text-gray-400">
              <section className="space-y-4">
                <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 bg-cyan-500" />
                  Performance_Logic
                </h3>
                <div className="grid gap-4">
                  <div className="bg-gray-950 p-4 border-l-2 border-orange-500">
                    <p className="text-orange-500 text-[10px] font-bold uppercase mb-1">Daily Streak (Flame 🔥)</p>
                    <p className="text-[11px] leading-relaxed">Counts consecutive days with ≥1 completion in the active section. If today is not yet done, the streak stays alive by checking if yesterday was completed.</p>
                  </div>
                  <div className="bg-gray-950 p-4 border-l-2 border-cyan-500">
                    <p className="text-cyan-500 text-[10px] font-bold uppercase mb-1">Weekly Streak (Trophy 🏆)</p>
                    <p className="text-[11px] leading-relaxed">A "Motivation Safety Net". A week (Sun-Sat) is successful if you are active on **at least 3 different days**. This preserves your progress even if you miss a day or two.</p>
                  </div>
                  <div className="bg-gray-950 p-4 border-l-2 border-gray-700">
                    <p className="text-gray-300 text-[10px] font-bold uppercase mb-1">Efficiency & Fairness</p>
                    <p className="text-[11px] leading-relaxed">Scores are calculated from the day a task was **first created**. New tasks start at 100% and are not penalized for the history that existed before they were added.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 bg-cyan-500" />
                  Interface_Commands
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[10px]">
                  <div className="space-y-2">
                    <p className="text-cyan-500 font-bold uppercase border-b border-gray-900 pb-1">Navigation</p>
                    <ul className="space-y-1">
                      <li className="flex justify-between"><span>DATE_ARROWS</span> <span className="text-gray-500">+/- 1 DAY</span></li>
                      <li className="flex justify-between"><span>DATE_STRIP</span> <span className="text-gray-500">QUICK JUMP</span></li>
                      <li className="flex justify-between"><span>TODAY_BTN</span> <span className="text-gray-500">INSTANT SYNC</span></li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-cyan-500 font-bold uppercase border-b border-gray-900 pb-1">Editing</p>
                    <ul className="space-y-1">
                      <li className="flex justify-between"><span>DOUBLE_CLICK</span> <span className="text-gray-500">RENAME MODE</span></li>
                      <li className="flex justify-between"><span>PENCIL_ICON</span> <span className="text-gray-500">EDIT TITLE</span></li>
                      <li className="flex justify-between"><span>TRASH_ICON</span> <span className="text-gray-500">WIPE HISTORY</span></li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 bg-cyan-500" />
                  Data_Analysis
                </h3>
                <ul className="space-y-3 text-[11px] list-none">
                  <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">CHART_ZOOM</span> <span>Use the scroll-brush at the bottom of graphs to focus on specific time periods.</span></li>
                  <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">FULLSCREEN</span> <span>Click the expansion icon (⤢) for high-resolution data inspection.</span></li>
                  <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">VISIBILITY</span> <span>Toggle individual task lines by clicking their names in the chart legend.</span></li>
                  <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">30_DAY_STATS</span> <span>Dynamic logic: stats update to show the 30-day window of your selected date.</span></li>
                </ul>
              </section>

              <div className="pt-4 text-center">
                <button 
                  onClick={() => setShowManual(false)}
                  className="px-8 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                  Terminate_Manual_Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Chart Modal */}
      {isChartFullscreen && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tighter uppercase">LIFETIME_DATA_ANALYSIS</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{activeCategory} Section • {lifetimeStats.totalDays} Days</p>
            </div>
            <button 
              onClick={() => setIsChartFullscreen(false)}
              className="p-3 bg-gray-900 border border-gray-800 text-white hover:bg-red-900/20 hover:text-red-500 transition-all rounded-full"
            >
              <Minimize2 size={24} />
            </button>
          </div>

          <div className="flex-1 bg-gray-950/50 border border-gray-900 p-6 md:p-10 relative">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={lifetimeChartData}>
               <defs>
                 <linearGradient id="colorTotalFS" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                   <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                 </linearGradient>
               </defs>
               <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false} />
               <XAxis
                 dataKey="name"
                 stroke="#4b5563"
                 fontSize={10}
                 tickLine={false}
                 axisLine={false}
                 minTickGap={60}
               />
               <YAxis
                 stroke="#4b5563"
                 fontSize={10}
                 tickLine={false}
                 axisLine={false}
                 domain={['auto', 'auto']}
                 tickFormatter={(val) => `${Math.round(val)}%`}
               />
               <Tooltip
                 contentStyle={{ backgroundColor: '#000', border: '1px solid #1f2937', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                 cursor={{ stroke: '#374151', strokeWidth: 2 }}
                 formatter={(val: any) => [`${Number(val).toFixed(1)}%`, '']}
               />
               {!hiddenRoutines.has('Total') && (
                 <Area
                   type="natural"
                   dataKey="Total"
                   stroke="#06b6d4"
                   strokeWidth={4}
                   fillOpacity={1}
                   fill="url(#colorTotalFS)"
                   dot={false}
                   activeDot={{ r: 6, fill: '#06b6d4', stroke: '#000', strokeWidth: 3 }}
                 />
               )}
               {filteredRoutines.map((r, i) => !hiddenRoutines.has(r.title) && (
                 <Line
                   key={r.id}
                   type="natural"
                   dataKey={r.title}
                   stroke={`hsl(${(i * 60) % 360}, 40%, 40%)`}
                   strokeWidth={2}
                   dot={false}
                   opacity={0.7}
                 />
               ))}                <Brush
                  dataKey="name"
                  height={40}
                  stroke="#374151"
                  fill="#000"
                  travellerWidth={20}
                >
                  <AreaChart data={lifetimeChartData}>
                    <Area type="natural" dataKey="Total" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} dot={false} />
                  </AreaChart>
                </Brush>
                </AreaChart>
                </ResponsiveContainer>
          </div>
          
          <div className="mt-8 flex flex-wrap justify-center gap-3">
             {/* Interactive toggles in fullscreen */}
             <button
                onClick={() => {
                  const next = new Set(hiddenRoutines)
                  if (next.has('Total')) next.delete('Total')
                  else next.add('Total')
                  setHiddenRoutines(next)
                }}
                className={`flex items-center gap-2 px-4 py-2 border transition-all text-[10px] font-bold uppercase tracking-widest ${!hiddenRoutines.has('Total') ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
              >
                <div className={`w-3 h-1 ${!hiddenRoutines.has('Total') ? 'bg-black' : 'bg-gray-700'}`} /> Total Average
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
                  className={`flex items-center gap-2 px-4 py-2 border transition-all text-[10px] font-bold uppercase tracking-widest ${!hiddenRoutines.has(r.title) ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-black border-gray-900 text-gray-700'}`}
                  style={{ borderLeftColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 40%, 40%)` : 'transparent', borderLeftWidth: '3px' }}
                >
                  <div className="w-3 h-1" style={{ backgroundColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 40%, 40%)` : '#374151' }} /> {r.title}
                </button>
             ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
