import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react'
import type { Routine } from '../types'

interface RoutineItemProps {
  routine: Routine
  isCompleted: boolean
  editingRoutineId: string | null
  editingRoutineTitle: string
  setEditingRoutineId: (id: string | null) => void
  setEditingRoutineTitle: (title: string) => void
  toggleCompletion: (id: string) => void
  updateRoutineTitle: (id: string) => void
  deleteRoutine: (id: string, title: string) => void
}

export function RoutineItem({
  routine,
  isCompleted,
  editingRoutineId,
  editingRoutineTitle,
  setEditingRoutineId,
  setEditingRoutineTitle,
  toggleCompletion,
  updateRoutineTitle,
  deleteRoutine
}: RoutineItemProps) {

  return (
    <div 
      onClick={() => toggleCompletion(routine.id)}
      className={`group flex items-center justify-between p-4 md:p-5 border-2 transition-all duration-300 cursor-pointer font-mono ${
        isCompleted 
          ? 'bg-accent-soft border-accent text-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
          : 'bg-white border-border hover:border-accent text-ink shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(124,58,237,1)]'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {isCompleted 
          ? <CheckCircle2 size={24} className="text-accent flex-shrink-0" /> 
          : <Circle size={24} className="text-border/10 flex-shrink-0" />
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
            className="bg-canvas border-b-2 border-accent text-base tracking-tight text-ink focus:outline-none font-black uppercase w-full px-2"
          />
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditingRoutineId(routine.id)
              setEditingRoutineTitle(routine.title)
            }}
            className={`text-sm md:text-base font-black uppercase tracking-tight ${isCompleted ? 'line-through opacity-50' : ''}`}
          >
            {routine.title}
          </span>
        )}
      </div>
      <div className="md:opacity-0 group-hover:opacity-100 transition-opacity flex gap-3 ml-4">
        <button 
          onClick={(e) => {
            e.stopPropagation()
            setEditingRoutineId(routine.id)
            setEditingRoutineTitle(routine.title)
          }}
          className="p-2 hover:text-accent transition-colors bg-canvas border border-border"
          title="Rename"
        >
          <Pencil size={16} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation()
            deleteRoutine(routine.id, routine.title)
          }}
          className="p-2 hover:text-red-600 transition-colors bg-canvas border border-border"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
