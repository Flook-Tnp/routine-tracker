import React from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface BrutalistDatePickerProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

export function BrutalistDatePicker({ selectedDate, onSelect, onClose }: BrutalistDatePickerProps) {
  const [viewDate, setViewDate] = React.useState(selectedDate)
  
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className="absolute top-full left-0 right-0 md:right-auto mt-2 z-[100] bg-white border-2 border-border p-4 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] min-w-[300px] font-mono animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-6 bg-canvas p-2 border-b-2 border-border">
        <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:text-accent transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-xs font-black uppercase tracking-widest">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:text-accent transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4 text-[8px] font-black text-ink/20 uppercase tracking-tighter text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate)
          const isCurrent = isToday(day)
          return (
            <button
              key={day.toString()}
              onClick={() => { onSelect(day); onClose(); }}
              className={`h-10 text-[10px] font-black transition-all border-2 ${
                isSelected 
                  ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(124,58,237,1)]' 
                  : isCurrent
                    ? 'border-accent text-accent bg-accent-soft'
                    : 'border-transparent hover:border-border text-ink'
              }`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <button 
          onClick={() => { onSelect(new Date()); onClose(); }}
          className="flex-1 py-3 text-[9px] bg-canvas border-2 border-border text-ink font-black uppercase tracking-widest hover:bg-white transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          TODAY_SYNC
        </button>
        <button 
          onClick={onClose}
          className="px-4 py-3 bg-white border-2 border-border text-ink/40 font-black uppercase transition-all hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
