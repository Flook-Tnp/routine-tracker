import { Plus, ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react'
import type { Task } from '../types'

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
  // Filter tasks by whether they are active or completed on the selected date
  const filteredTasks = tasks.filter(t => 
    t.completed_date === null || t.completed_date === selectedDateStr
  )

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">GLOBAL_TASK_BOARD</h2>
            <p className="text-[8px] text-gray-600 uppercase tracking-widest">Protocol: Direct Management</p>
          </div>
        </div>

        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="NEW_GLOBAL_ENTRY..."
            className="flex-1 input-primary text-sm font-mono"
          />
          <button type="submit" className="btn-primary">
            <Plus size={20} />
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { id: 'todo' as const, label: 'BACKLOG', color: 'text-gray-500' },
          { id: 'in-progress' as const, label: 'ACTIVE', color: 'text-orange-500' },
          { id: 'done' as const, label: 'COMPLETE', color: 'text-cyan-400' }
        ].map((col) => {
          const colTasks = filteredTasks.filter(t => t.status === col.id)
          
          return (
            <div key={col.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-900 pb-3 mb-2 sticky top-[180px] md:top-0 bg-black/95 backdrop-blur-md z-10 py-3">
                <div className={`w-1.5 h-4 ${col.id === 'todo' ? 'bg-gray-800' : col.id === 'in-progress' ? 'bg-orange-500' : 'bg-cyan-500'}`} />
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${col.color}`}>{col.label}</h3>
                <span className="ml-auto text-[9px] text-gray-700 font-mono">
                  [{colTasks.length}]
                </span>
              </div>

              <div className="space-y-4">
                {colTasks.map(task => (
                  <div key={task.id} className="bg-gray-950 border border-gray-900 p-4 group hover:border-gray-700 transition-all shadow-sm">
                    <p className="text-sm text-gray-400 mb-4 font-mono leading-relaxed">{task.title}</p>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-900/50">
                      <div className="flex gap-2">
                        {col.id !== 'todo' && (
                          <button 
                            onClick={() => moveTask(task.id, col.id === 'done' ? 'in-progress' : 'todo')}
                            className="p-2 text-gray-700 hover:text-cyan-500 transition-colors bg-gray-900/50 border border-gray-900"
                            aria-label="Move Left"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        )}
                        {col.id !== 'done' && (
                          <button 
                            onClick={() => moveTask(task.id, col.id === 'todo' ? 'in-progress' : 'done')}
                            className="p-2 text-gray-700 hover:text-cyan-500 transition-colors bg-gray-900/50 border border-gray-900"
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
                            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all text-[9px] font-bold uppercase tracking-widest"
                          >
                            <Check size={12} />
                            Complete
                          </button>
                        )}
                        {task.completed_date && (
                          <span className="text-[9px] text-cyan-600 font-bold uppercase tracking-widest bg-cyan-950/20 px-2 py-1 border border-cyan-900/30">
                            Finalized
                          </span>
                        )}
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-2 text-gray-800 hover:text-red-900 transition-colors md:opacity-0 group-hover:opacity-100"
                          aria-label="Delete Task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {colTasks.length === 0 && (
                  <div className="py-8 text-center border border-dashed border-gray-900 rounded">
                    <span className="text-[8px] text-gray-800 uppercase tracking-widest">EMPTY</span>
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
