import { Plus, ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react'
import type { Task } from '../types'
import { useTranslation } from '../lib/i18n'

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
  const { t } = useTranslation();

  // Filter tasks by whether they are active or completed on the selected date
  const filteredTasks = tasks.filter(t => 
    t.completed_date === null || t.completed_date === selectedDateStr
  )

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-4 font-mono">
        <div className="flex justify-between items-end px-1">
          <div className="space-y-1">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 font-black">{t('board.title')}</h2>
            <p className="text-[8px] text-ink/60 uppercase font-black tracking-widest">{t('board.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={t('board.new_task')}
            className="flex-1 input-primary text-sm"
          />
          <button type="submit" className="btn-primary px-6">
            <Plus size={20} />
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 font-mono">
        {[
          { id: 'todo' as const, label: t('board.col.todo'), color: 'text-ink/40' },
          { id: 'in-progress' as const, label: t('board.col.in_progress'), color: 'text-accent' },
          { id: 'done' as const, label: t('board.col.done'), color: 'text-accent' }
        ].map((col) => {
          const colTasks = filteredTasks.filter(t => t.status === col.id)
          
          return (
            <div key={col.id} className="space-y-6">
              <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-2 sticky top-[180px] md:top-0 bg-canvas/95 backdrop-blur-md z-10 py-3">
                <div className={`w-2 h-5 ${col.id === 'todo' ? 'bg-ink/20' : 'bg-accent'}`} />
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${col.color}`}>{col.label}</h3>
                <span className="ml-auto text-[9px] text-ink/40 font-black">
                  [{colTasks.length}]
                </span>
              </div>

              <div className="space-y-4">
                {colTasks.map(task => (
                  <div key={task.id} className="bg-white border-2 border-border p-5 group hover:border-accent transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(124,58,237,1)]">
                    <p className="text-sm text-ink mb-6 font-black leading-relaxed uppercase tracking-tight">{task.title}</p>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-border/10">
                      <div className="flex gap-2">
                        {col.id !== 'todo' && (
                          <button 
                            onClick={() => moveTask(task.id, col.id === 'done' ? 'in-progress' : 'todo')}
                            className="p-2 text-ink/40 hover:text-accent transition-colors bg-canvas border border-border active:translate-x-[1px] active:translate-y-[1px]"
                            aria-label="Move Left"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        )}
                        {col.id !== 'done' && (
                          <button 
                            onClick={() => moveTask(task.id, col.id === 'todo' ? 'in-progress' : 'done')}
                            className="p-2 text-ink/40 hover:text-accent transition-colors bg-canvas border border-border active:translate-x-[1px] active:translate-y-[1px]"
                            aria-label="Move Right"
                          >
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {col.id === 'done' && !task.completed_date && (
                          <button 
                            onClick={() => finalizeTask(task.id, selectedDateStr)}
                            className="flex items-center gap-2 px-4 py-2 bg-accent-soft text-accent border border-accent/30 hover:bg-accent hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                          >
                            <Check size={12} />
                            Complete
                          </button>
                        )}
                        {task.completed_date && (
                          <span className="text-[9px] text-accent font-black uppercase tracking-widest bg-accent-soft px-3 py-1.5 border border-accent/20">
                            Finalized
                          </span>
                        )}
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-2 text-ink/20 hover:text-red-600 transition-colors md:opacity-0 group-hover:opacity-100"
                          aria-label="Delete Task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {colTasks.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-border/20">
                    <span className="text-[9px] text-ink/20 font-black uppercase tracking-widest">{t('board.empty')}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
