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
      className={`group flex items-center justify-between gap-4 p-4 md:p-5 border-2 transition-all duration-300 cursor-pointer font-mono ${
        isCompleted
          ? 'bg-accent-soft border-accent text-accent shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]'
          : 'bg-white border-border hover:border-accent text-ink shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] hover:shadow-[4px_4px_0px_0px_rgba(236,72,153,0.48)]'
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleCompletion(routine.id)
          }}
          className={`w-11 h-11 flex-shrink-0 border-2 border-border flex items-center justify-center transition-all active:scale-95 ${
            isCompleted ? 'bg-accent text-white shadow-[2px_2px_0px_0px_rgba(20,184,166,0.34)]' : 'bg-canvas text-ink/20 group-hover:text-accent'
          }`}
          aria-label={isCompleted ? `Mark ${routine.title} incomplete` : `Mark ${routine.title} complete`}
        >
          {isCompleted
            ? <CheckCircle2 size={24} className="animate-success-pop" />
            : <Circle size={24} />
          }
        </button>
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
          <div className="min-w-0 space-y-1">
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingRoutineId(routine.id)
                setEditingRoutineTitle(routine.title)
              }}
              className={`block text-sm md:text-base font-black uppercase tracking-tight truncate ${isCompleted ? 'line-through opacity-50' : ''}`}
            >
              {routine.title}
            </span>
            <span className={`inline-flex text-[8px] uppercase tracking-[0.2em] font-black ${isCompleted ? 'text-accent' : 'text-ink/35'}`}>
              {isCompleted ? 'Done' : 'Pending'}
            </span>
          </div>
        )}
      </div>
      <div className="md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-2 md:gap-3 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditingRoutineId(routine.id)
            setEditingRoutineTitle(routine.title)
          }}
          className="p-2 hover:text-accent transition-colors bg-canvas border-2 border-border active:scale-95"
          title="Rename"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteRoutine(routine.id, routine.title)
          }}
          className="p-2 hover:text-red-600 transition-colors bg-canvas border-2 border-border active:scale-95"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
