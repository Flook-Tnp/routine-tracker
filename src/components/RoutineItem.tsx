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
          onClick={(e) => {
            e.stopPropagation()
            deleteRoutine(routine.id, routine.title)
          }}
          className="p-1 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
