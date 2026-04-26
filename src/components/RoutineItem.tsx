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
      className={`group flex items-center justify-between p-4 md:p-5 border transition-all duration-300 cursor-pointer ${
        isCompleted 
          ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-400 shadow-[inset_0_0_30px_rgba(6,182,212,0.1)]' 
          : 'bg-gray-950 border-gray-900 hover:border-gray-700 text-gray-400'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {isCompleted 
          ? <CheckCircle2 size={24} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] flex-shrink-0" /> 
          : <Circle size={24} className="text-gray-800 flex-shrink-0" />
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
            className="bg-black border-b border-cyan-500 text-base tracking-tight text-white focus:outline-none font-mono w-full"
          />
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditingRoutineId(routine.id)
              setEditingRoutineTitle(routine.title)
            }}
            className={`text-sm md:text-base font-medium tracking-tight ${isCompleted ? 'line-through opacity-50' : ''}`}
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
          className="p-2 hover:text-cyan-400 transition-colors bg-gray-900/50 rounded-sm border border-gray-800 md:border-transparent"
          title="Rename"
        >
          <Pencil size={16} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation()
            deleteRoutine(routine.id, routine.title)
          }}
          className="p-2 hover:text-red-500 transition-colors bg-gray-900/50 rounded-sm border border-gray-800 md:border-transparent"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
