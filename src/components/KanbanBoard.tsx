import { useMemo, useState } from 'react'
import { addDays, eachDayOfInterval, format, isSameDay, parseISO, startOfMonth, subDays, subMonths } from 'date-fns'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  PlayCircle,
  Plus,
  RotateCcw,
  Save,
  Target,
  Trash2,
  X
} from 'lucide-react'
import type { Task, TaskLog } from '../types'
import { useTranslation } from '../lib/i18n'
import { EmptyState } from './EmptyState'

type TaskRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom'

interface KanbanBoardProps {
  tasks: Task[]
  taskLogs: TaskLog[]
  newTaskTitle: string
  setNewTaskTitle: (title: string) => void
  addTask: (e: React.FormEvent) => void
  moveTask: (id: string, newStatus: 'todo' | 'in-progress' | 'done') => void
  deleteTask: (id: string) => void
  selectedDateStr: string
  finalizeTask: (id: string, dateStr: string) => void
  logTask: (id: string, dateStr: string, note: string) => void
}

const statusMeta = {
  todo: {
    icon: Circle,
    labelKey: 'board.col.todo',
    badge: 'bg-white text-ink border-border',
    dot: 'bg-ink/30'
  },
  'in-progress': {
    icon: PlayCircle,
    labelKey: 'board.col.in_progress',
    badge: 'bg-sync-soft text-sync border-sync/30',
    dot: 'bg-sync'
  },
  done: {
    icon: CheckCircle2,
    labelKey: 'board.col.done',
    badge: 'bg-accent-soft text-accent border-accent/30',
    dot: 'bg-accent'
  }
} as const

const rangeOptions: { id: TaskRange; key: string }[] = [
  { id: '7d', key: 'board.range_7d' },
  { id: '30d', key: 'board.range_30d' },
  { id: '90d', key: 'board.range_90d' },
  { id: 'this_month', key: 'board.range_this_month' },
  { id: 'last_month', key: 'board.range_last_month' },
  { id: 'custom', key: 'board.range_custom' }
]

function getRangeDates(range: TaskRange, customStart: string, customEnd: string) {
  const today = new Date()
  if (range === '7d') return { start: subDays(today, 6), end: today }
  if (range === '30d') return { start: subDays(today, 29), end: today }
  if (range === '90d') return { start: subDays(today, 89), end: today }
  if (range === 'this_month') return { start: startOfMonth(today), end: today }
  if (range === 'last_month') {
    const lastMonth = subMonths(today, 1)
    const start = startOfMonth(lastMonth)
    return { start, end: addDays(startOfMonth(today), -1) }
  }

  const start = customStart ? parseISO(customStart) : subDays(today, 29)
  const end = customEnd ? parseISO(customEnd) : today
  return start > end ? { start: end, end: start } : { start, end }
}

export function KanbanBoard({
  tasks,
  taskLogs,
  newTaskTitle,
  setNewTaskTitle,
  addTask,
  moveTask,
  deleteTask,
  selectedDateStr,
  finalizeTask,
  logTask
}: KanbanBoardProps) {
  const { t } = useTranslation()
  const [loggingTask, setLoggingTask] = useState<Task | null>(null)
  const [activityTask, setActivityTask] = useState<Task | null>(null)
  const [logNote, setLogNote] = useState('')
  const [range, setRange] = useState<TaskRange>('30d')
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))

  const activeTasks = tasks.filter(task => !task.completed_date)
  const closedTasks = tasks.filter(task => task.completed_date === selectedDateStr)
  const todayLogs = taskLogs.filter(log => log.logged_date === selectedDateStr)
  const todayLoggedTaskIds = new Set(todayLogs.map(log => log.task_id))
  const todoTasks = activeTasks.filter(task => task.status === 'todo')
  const doingTasks = activeTasks.filter(task => task.status === 'in-progress')
  const readyTasks = activeTasks.filter(task => task.status === 'done')
  const openTasks = [...doingTasks, ...todoTasks, ...readyTasks]
  const totalActive = activeTasks.length
  const completionRate = totalActive === 0 ? 0 : Math.round((todayLoggedTaskIds.size / totalActive) * 100)

  const activityLogs = useMemo(() => {
    if (!activityTask) return []
    const { start, end } = getRangeDates(range, customStart, customEnd)
    return taskLogs
      .filter(log => log.task_id === activityTask.id)
      .filter(log => {
        const date = parseISO(log.logged_date)
        return date >= start && date <= end
      })
      .sort((a, b) => b.logged_date.localeCompare(a.logged_date))
  }, [activityTask, customEnd, customStart, range, taskLogs])

  const activityDays = useMemo(() => {
    const { start, end } = getRangeDates(range, customStart, customEnd)
    return eachDayOfInterval({ start, end })
  }, [customEnd, customStart, range])

  const openLogModal = (task: Task) => {
    const existingLog = taskLogs.find(log => log.task_id === task.id && log.logged_date === selectedDateStr)
    setLoggingTask(task)
    setLogNote(existingLog?.note || '')
  }

  const handleSaveLog = () => {
    if (!loggingTask) return
    logTask(loggingTask.id, selectedDateStr, logNote)
    setLoggingTask(null)
    setLogNote('')
  }

  const moveBack = (task: Task) => {
    moveTask(task.id, task.status === 'done' ? 'in-progress' : 'todo')
  }

  const renderTaskRow = (task: Task, variant: 'focus' | 'closed') => {
    const meta = statusMeta[task.status]
    const StatusIcon = meta.icon
    const isLoggedToday = todayLoggedTaskIds.has(task.id)
    const logsForTask = taskLogs.filter(log => log.task_id === task.id)
    const isClosed = Boolean(task.completed_date)

    return (
      <article
        key={task.id}
        className={`group grid gap-4 border-2 border-border bg-white p-4 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] transition-all hover:border-accent hover:shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)] md:grid-cols-[1fr_auto] md:items-center ${variant === 'closed' ? 'opacity-85' : ''}`}
      >
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 border-border ${isLoggedToday ? 'bg-accent text-white' : 'bg-canvas text-ink/45'}`}>
              <StatusIcon size={16} />
            </div>
            <div className="min-w-0 space-y-2">
              <p className={`text-sm font-black uppercase leading-relaxed tracking-tight text-ink ${isClosed ? 'line-through decoration-accent/70 decoration-2' : ''}`}>
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${meta.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {t(meta.labelKey)}
                </span>
                {isLoggedToday && (
                  <span className="inline-flex items-center gap-1.5 border border-accent/20 bg-accent-soft px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-accent">
                    <Activity size={10} />
                    {t('board.logged_today')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 border border-border bg-canvas px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-ink/40">
                  <CalendarDays size={10} />
                  {logsForTask.length} {t('board.logs')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {!isClosed && (
            <button
              onClick={() => openLogModal(task)}
              className="inline-flex items-center gap-2 border-2 border-accent bg-accent-soft px-3 py-2 text-[9px] font-black uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-white active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Save size={13} />
              {isLoggedToday ? t('board.edit_log') : t('board.log_today')}
            </button>
          )}
          <button
            onClick={() => setActivityTask(task)}
            className="inline-flex items-center gap-2 border-2 border-border bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-ink/55 transition-all hover:text-sync active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Eye size={13} />
            {t('board.view_activity')}
          </button>
          {task.status === 'todo' && !isClosed && (
            <button onClick={() => moveTask(task.id, 'in-progress')} className="border-2 border-border bg-sync-soft p-2 text-sync transition-all hover:bg-sync hover:text-white">
              <PlayCircle size={15} />
            </button>
          )}
          {task.status !== 'todo' && !isClosed && (
            <button onClick={() => moveBack(task)} className="border-2 border-border bg-white p-2 text-ink/45 transition-all hover:text-accent">
              <RotateCcw size={15} />
            </button>
          )}
          {!isClosed && (
            <button
              onClick={() => finalizeTask(task.id, selectedDateStr)}
              className="inline-flex items-center gap-2 border-2 border-border bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-ink/45 transition-all hover:border-accent hover:text-accent"
            >
              <CheckCircle2 size={13} />
              {t('board.close_task')}
            </button>
          )}
          <button
            onClick={() => deleteTask(task.id)}
            className="ml-auto border-2 border-transparent p-2 text-ink/20 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 md:ml-0 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Delete Task"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="grid gap-4 font-mono md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2 px-1">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-ink/40">{t('board.title')}</h2>
          <p className="text-[8px] font-black uppercase tracking-widest text-ink/60">{t('board.subtitle')}</p>
        </div>

        <form onSubmit={addTask} className="flex gap-2 md:min-w-[360px]">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={t('board.new_task')}
            className="input-primary min-w-0 flex-1 text-sm"
          />
          <button type="submit" className="btn-primary px-6" aria-label="Add Task">
            <Plus size={20} />
          </button>
        </form>
      </section>

      <section className="grid gap-4 font-mono md:grid-cols-[1.3fr_0.7fr]">
        <div className="border-2 border-border bg-white p-5 shadow-[6px_6px_0px_0px_rgba(20,184,166,0.34)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-ink/40">{t('board.today_focus')}</p>
              <h3 className="text-3xl font-black tracking-tighter text-ink">{completionRate}%</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center border-2 border-border bg-accent-soft text-accent">
              <Target size={22} />
            </div>
          </div>
          <div className="mt-5 h-4 border-2 border-border bg-canvas p-[2px]">
            <div className="h-full bg-gradient-to-r from-sync to-accent transition-all duration-700" style={{ width: `${completionRate}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-ink/40">
            <span>{todayLoggedTaskIds.size} {t('board.logged_count')}</span>
            <span>{totalActive} {t('board.active_count')}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('board.col.todo'), value: todoTasks.length, color: 'text-ink', bg: 'bg-white' },
            { label: t('board.col.in_progress'), value: doingTasks.length, color: 'text-sync', bg: 'bg-sync-soft' },
            { label: t('board.logged_today'), value: todayLoggedTaskIds.size, color: 'text-accent', bg: 'bg-accent-soft' }
          ].map((item) => (
            <div key={item.label} className={`${item.bg} border-2 border-border p-4 text-center shadow-[3px_3px_0px_0px_rgba(20,184,166,0.28)]`}>
              <p className={`text-2xl font-black tracking-tighter ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-ink/40">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {tasks.length === 0 ? (
        <div className="py-10">
          <EmptyState icon={Target} title={t('board.empty')} subtitle={t('board.empty_subtitle')} />
        </div>
      ) : (
        <section className="grid gap-8 font-mono xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-border pb-3">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">{t('board.focus_queue')}</h3>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.focus_subtitle')}</p>
              </div>
              <span className="border border-border bg-canvas px-3 py-1 text-[9px] font-black uppercase tracking-widest text-ink/50">{openTasks.length}</span>
            </div>

            <div className="space-y-3">
              {openTasks.length > 0 ? openTasks.map(task => renderTaskRow(task, 'focus')) : (
                <div className="border-2 border-dashed border-border bg-white py-10 text-center">
                  <CheckCircle2 className="mx-auto mb-3 text-accent" size={28} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">{t('board.clear_queue')}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-border pb-3">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">{t('board.closed_today')}</h3>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.closed_subtitle')}</p>
              </div>
              <Clock3 size={18} className="text-accent" />
            </div>

            <div className="space-y-3">
              {closedTasks.length > 0 ? closedTasks.map(task => renderTaskRow(task, 'closed')) : (
                <div className="border-2 border-dashed border-border bg-white px-5 py-8 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">{t('board.no_closed')}</p>
                </div>
              )}
            </div>
          </aside>
        </section>
      )}

      {loggingTask && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/55 p-4 font-mono">
          <div className="w-full max-w-lg border-2 border-border bg-white p-6 shadow-[10px_10px_0px_0px_rgba(20,184,166,0.34)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-accent">{t('board.log_today')}</p>
                <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-ink">{loggingTask.title}</h3>
              </div>
              <button onClick={() => setLoggingTask(null)} className="p-2 text-ink/40 transition-colors hover:text-accent">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={logNote}
              onChange={(event) => setLogNote(event.target.value)}
              placeholder={t('board.log_note_placeholder')}
              className="min-h-32 w-full resize-none border-2 border-border bg-canvas p-4 text-sm font-bold text-ink outline-none transition-colors placeholder:text-ink/25 focus:border-accent"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setLoggingTask(null)} className="border-2 border-border bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-ink/50 hover:text-ink">
                {t('common.cancel')}
              </button>
              <button onClick={handleSaveLog} className="btn-primary inline-flex items-center gap-2 px-5 py-3">
                <Save size={14} />
                {t('board.save_log')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityTask && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/55 p-4 font-mono">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col border-2 border-border bg-white shadow-[12px_12px_0px_0px_rgba(20,184,166,0.34)]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-border bg-canvas p-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-sync">{t('board.activity_title')}</p>
                <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-ink">{activityTask.title}</h3>
              </div>
              <button onClick={() => setActivityTask(null)} className="p-2 text-ink/40 transition-colors hover:text-accent">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 custom-scrollbar">
              <div className="mb-5 flex flex-wrap gap-2">
                {rangeOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setRange(option.id)}
                    className={`border-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${range === option.id ? 'border-border bg-accent text-white shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]' : 'border-border bg-white text-ink/45 hover:text-accent'}`}
                  >
                    {t(option.key)}
                  </button>
                ))}
              </div>

              {range === 'custom' && (
                <div className="mb-5 grid gap-3 border-2 border-border bg-canvas p-4 md:grid-cols-2">
                  <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="input-primary text-xs" />
                  <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="input-primary text-xs" />
                </div>
              )}

              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="border-2 border-border bg-accent-soft p-4 text-center">
                  <p className="text-2xl font-black text-accent">{activityLogs.length}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.active_days')}</p>
                </div>
                <div className="border-2 border-border bg-sync-soft p-4 text-center">
                  <p className="text-2xl font-black text-sync">{activityDays.length}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.range_days')}</p>
                </div>
                <div className="border-2 border-border bg-white p-4 text-center">
                  <p className="text-2xl font-black text-ink">{activityDays.length === 0 ? 0 : Math.round((activityLogs.length / activityDays.length) * 100)}%</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.consistency')}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-7 gap-2">
                {activityDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const log = activityLogs.find(item => item.logged_date === dateStr)
                  return (
                    <div key={dateStr} className={`min-h-12 border-2 p-2 text-center ${log ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-canvas text-ink/25'}`}>
                      <p className="text-[8px] font-black uppercase">{format(day, 'MMM')}</p>
                      <p className="text-sm font-black">{format(day, 'd')}</p>
                      {isSameDay(day, new Date()) && <div className="mx-auto mt-1 h-1 w-4 bg-sync" />}
                    </div>
                  )
                })}
              </div>

              <div className="space-y-3">
                {activityLogs.length > 0 ? activityLogs.map(log => (
                  <div key={log.id} className="border-2 border-border bg-white p-4 shadow-[3px_3px_0px_0px_rgba(20,184,166,0.24)]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-accent">{format(parseISO(log.logged_date), 'MMM d, yyyy')}</p>
                    <p className="mt-2 text-sm font-bold leading-relaxed text-ink/75">{log.note || t('board.no_note')}</p>
                  </div>
                )) : (
                  <div className="border-2 border-dashed border-border bg-canvas py-10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">{t('board.no_activity')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
