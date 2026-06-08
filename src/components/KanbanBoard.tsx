import {
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  PlayCircle,
  Plus,
  RotateCcw,
  Target,
  Trash2
} from 'lucide-react'
import type { Task } from '../types'
import { useTranslation } from '../lib/i18n'
import { EmptyState } from './EmptyState'

interface KanbanBoardProps {
  tasks: Task[]
  newTaskTitle: string
  setNewTaskTitle: (title: string) => void
  addTask: (e: React.FormEvent) => void
  moveTask: (id: string, newStatus: 'todo' | 'in-progress' | 'done') => void
  deleteTask: (id: string) => void
  selectedDateStr: string
  finalizeTask: (id: string, dateStr: string) => void
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

export function KanbanBoard({
  tasks,
  newTaskTitle,
  setNewTaskTitle,
  addTask,
  moveTask,
  deleteTask,
  selectedDateStr,
  finalizeTask
}: KanbanBoardProps) {
  const { t } = useTranslation()

  const visibleTasks = tasks.filter(task =>
    task.completed_date === null || task.completed_date === selectedDateStr
  )

  const todoTasks = visibleTasks.filter(task => task.status === 'todo')
  const doingTasks = visibleTasks.filter(task => task.status === 'in-progress')
  const doneTasks = visibleTasks.filter(task => task.status === 'done')
  const finalizedTasks = doneTasks.filter(task => task.completed_date)
  const openTasks = [...doingTasks, ...todoTasks]
  const totalTasks = visibleTasks.length
  const completionRate = totalTasks === 0 ? 0 : Math.round((finalizedTasks.length / totalTasks) * 100)

  const moveBack = (task: Task) => {
    moveTask(task.id, task.status === 'done' ? 'in-progress' : 'todo')
  }

  const renderTaskRow = (task: Task, variant: 'focus' | 'done') => {
    const meta = statusMeta[task.status]
    const StatusIcon = meta.icon
    const isDone = task.status === 'done'
    const isFinalized = Boolean(task.completed_date)

    return (
      <article
        key={task.id}
        className={`group grid gap-4 border-2 border-border bg-white p-4 shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] transition-all hover:border-accent hover:shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)] md:grid-cols-[1fr_auto] md:items-center ${variant === 'done' ? 'opacity-85' : ''}`}
      >
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 border-border ${isDone ? 'bg-accent text-white' : 'bg-canvas text-ink/45'}`}>
              <StatusIcon size={16} />
            </div>
            <div className="min-w-0 space-y-2">
              <p className={`text-sm font-black uppercase leading-relaxed tracking-tight text-ink ${isFinalized ? 'line-through decoration-accent/70 decoration-2' : ''}`}>
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${meta.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {t(meta.labelKey)}
                </span>
                {isFinalized && (
                  <span className="inline-flex items-center gap-1.5 border border-accent/20 bg-accent-soft px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-accent">
                    <Check size={10} />
                    {t('board.finalized')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {task.status === 'todo' && (
            <button
              onClick={() => moveTask(task.id, 'in-progress')}
              className="inline-flex items-center gap-2 border-2 border-border bg-sync-soft px-3 py-2 text-[9px] font-black uppercase tracking-widest text-sync transition-all hover:bg-sync hover:text-white active:translate-x-[1px] active:translate-y-[1px]"
            >
              <PlayCircle size={13} />
              {t('board.start')}
            </button>
          )}
          {task.status === 'in-progress' && (
            <button
              onClick={() => moveTask(task.id, 'done')}
              className="inline-flex items-center gap-2 border-2 border-border bg-accent px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-all hover:bg-sync active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Check size={13} />
              {t('board.mark_done')}
            </button>
          )}
          {isDone && !isFinalized && (
            <button
              onClick={() => finalizeTask(task.id, selectedDateStr)}
              className="inline-flex items-center gap-2 border-2 border-accent bg-accent-soft px-3 py-2 text-[9px] font-black uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-white active:translate-x-[1px] active:translate-y-[1px]"
            >
              <CheckCircle2 size={13} />
              {t('board.finalize')}
            </button>
          )}
          {task.status !== 'todo' && !isFinalized && (
            <button
              onClick={() => moveBack(task)}
              className="inline-flex items-center gap-2 border-2 border-border bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-ink/50 transition-all hover:text-accent active:translate-x-[1px] active:translate-y-[1px]"
            >
              <RotateCcw size={13} />
              {t('board.move_back')}
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
            <div
              className="h-full bg-gradient-to-r from-sync to-accent transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-ink/40">
            <span>{finalizedTasks.length} {t('board.done_count')}</span>
            <span>{totalTasks} {t('board.total_count')}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('board.col.todo'), value: todoTasks.length, color: 'text-ink', bg: 'bg-white' },
            { label: t('board.col.in_progress'), value: doingTasks.length, color: 'text-sync', bg: 'bg-sync-soft' },
            { label: t('board.col.done'), value: doneTasks.length, color: 'text-accent', bg: 'bg-accent-soft' }
          ].map((item) => (
            <div key={item.label} className={`${item.bg} border-2 border-border p-4 text-center shadow-[3px_3px_0px_0px_rgba(20,184,166,0.28)]`}>
              <p className={`text-2xl font-black tracking-tighter ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-ink/40">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {totalTasks === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={Target}
            title={t('board.empty')}
            subtitle={t('board.empty_subtitle')}
          />
        </div>
      ) : (
        <section className="grid gap-8 font-mono xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-border pb-3">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">{t('board.focus_queue')}</h3>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.focus_subtitle')}</p>
              </div>
              <span className="border border-border bg-canvas px-3 py-1 text-[9px] font-black uppercase tracking-widest text-ink/50">
                {openTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {openTasks.length > 0 ? (
                openTasks.map(task => renderTaskRow(task, 'focus'))
              ) : (
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
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">{t('board.completed_today')}</h3>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-ink/40">{t('board.completed_subtitle')}</p>
              </div>
              <Clock3 size={18} className="text-accent" />
            </div>

            <div className="space-y-3">
              {doneTasks.length > 0 ? (
                doneTasks.map(task => renderTaskRow(task, 'done'))
              ) : (
                <div className="border-2 border-dashed border-border bg-white px-5 py-8 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">{t('board.no_done')}</p>
                </div>
              )}
            </div>
          </aside>
        </section>
      )}
    </div>
  )
}
