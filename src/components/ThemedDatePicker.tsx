import { useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface ThemedDatePickerProps {
  selectedDate: Date
  onChange: (date: Date) => void
  onClose: () => void
}

export function ThemedDatePicker({ selectedDate, onChange, onClose }: ThemedDatePickerProps) {
  const [viewDate, setViewDate] = useState(startOfMonth(selectedDate))

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const nextMonth = () => setViewDate(addMonths(viewDate, 1))
  const prevMonth = () => setViewDate(subMonths(viewDate, 1))

  return (
    <div className="absolute top-full left-0 right-0 md:right-auto mt-2 z-[100] bg-black border border-gray-800 shadow-2xl min-w-[300px] animate-in fade-in zoom-in-95 duration-200">
      <div className="p-4 border-b border-gray-900 bg-gray-950 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 hover:text-cyan-400 transition-colors text-gray-600">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[10px] uppercase font-black text-white tracking-[0.2em] min-w-[120px] text-center">
            {format(viewDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-1 hover:text-cyan-400 transition-colors text-gray-600">
            <ChevronRight size={18} />
          </button>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-[8px] font-black text-gray-700 uppercase tracking-widest py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-900 border border-gray-900">
          {calendarDays.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate)
            const isCurrentMonth = isSameMonth(day, monthStart)
            const isToday = isSameDay(day, new Date())

            return (
              <button
                key={idx}
                onClick={() => {
                  onChange(day)
                  onClose()
                }}
                className={`
                  h-10 text-[10px] font-mono transition-all relative flex items-center justify-center
                  ${isSelected ? 'bg-cyan-500 text-black font-black z-10' : 'bg-black text-gray-400 hover:bg-gray-900'}
                  ${!isCurrentMonth && !isSelected ? 'opacity-20' : ''}
                `}
              >
                {format(day, 'd')}
                {isToday && !isSelected && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button 
            onClick={() => {
              onChange(new Date())
              onClose()
            }}
            className="flex-1 py-2 bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            Go_to_Today
          </button>
        </div>
      </div>
    </div>
  )
}
