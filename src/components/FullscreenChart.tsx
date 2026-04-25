import { Minimize2, Maximize2 } from 'lucide-react'
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Line, Brush } from 'recharts'
import type { Routine } from '../types'

interface FullscreenChartProps {
  isChartFullscreen: boolean
  setIsChartFullscreen: (val: boolean) => void
  activeCategory: string
  lifetimeStats: { totalDays: number; percentage: number }
  lifetimeChartData: Record<string, string | number>[]
  hiddenRoutines: Set<string>
  setHiddenRoutines: (val: Set<string>) => void
  filteredRoutines: Routine[]
}

export function FullscreenChart({
  isChartFullscreen,
  setIsChartFullscreen,
  activeCategory,
  lifetimeStats,
  lifetimeChartData,
  hiddenRoutines,
  setHiddenRoutines,
  filteredRoutines
}: FullscreenChartProps) {
  if (!isChartFullscreen) {
    return (
      <button 
        onClick={() => setIsChartFullscreen(true)}
        className="p-2 bg-gray-950 border border-gray-800 text-gray-500 hover:text-cyan-400 transition-all shadow-lg"
        title="Fullscreen View"
      >
        <Maximize2 size={16} />
      </button>
    )
  }

  const toggleRoutine = (title: string) => {
    const next = new Set(hiddenRoutines)
    if (next.has(title)) next.delete(title)
    else next.add(title)
    setHiddenRoutines(next)
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tighter uppercase">LIFETIME_DATA_ANALYSIS</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{activeCategory} Section • {lifetimeStats.totalDays} Days</p>
        </div>
        <button 
          onClick={() => setIsChartFullscreen(false)}
          className="p-3 bg-gray-900 border border-gray-800 text-white hover:bg-red-900/20 hover:text-red-500 transition-all rounded-full"
        >
          <Minimize2 size={24} />
        </button>
      </div>

      <div className="flex-1 bg-gray-950/50 border border-gray-900 p-6 md:p-10 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={lifetimeChartData}>
            <defs>
              <linearGradient id="colorTotalFS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#4b5563"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
            />
            <YAxis
              stroke="#4b5563"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(val) => `${Math.round(val)}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#000', border: '1px solid #1f2937', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
              cursor={{ stroke: '#374151', strokeWidth: 2 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any) => [`${Number(val || 0).toFixed(1)}%`, '']}
            />
            {!hiddenRoutines.has('Total') && (
              <Area
                type="natural"
                dataKey="Total"
                stroke="#06b6d4"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorTotalFS)"
                dot={false}
                activeDot={{ r: 6, fill: '#06b6d4', stroke: '#000', strokeWidth: 3 }}
              />
            )}
            {filteredRoutines.map((r, i) => !hiddenRoutines.has(r.title) && (
              <Line
                key={r.id}
                type="natural"
                dataKey={r.title}
                stroke={`hsl(${(i * 60) % 360}, 40%, 40%)`}
                strokeWidth={2}
                dot={false}
                opacity={0.7}
              />
            ))}
            <Brush
              dataKey="name"
              height={40}
              stroke="#374151"
              fill="#000"
              travellerWidth={20}
            >
              <AreaChart data={lifetimeChartData}>
                <Area type="natural" dataKey="Total" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} dot={false} />
              </AreaChart>
            </Brush>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => toggleRoutine('Total')}
          className={`flex items-center gap-2 px-4 py-2 border transition-all text-[10px] font-bold uppercase tracking-widest ${!hiddenRoutines.has('Total') ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
        >
          <div className={`w-3 h-1 ${!hiddenRoutines.has('Total') ? 'bg-black' : 'bg-gray-700'}`} /> Total Average
        </button>

        {filteredRoutines.map((r, i) => (
          <button 
            key={r.id} 
            onClick={() => toggleRoutine(r.title)}
            className={`flex items-center gap-2 px-4 py-2 border transition-all text-[10px] font-bold uppercase tracking-widest ${!hiddenRoutines.has(r.title) ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-black border-gray-900 text-gray-700'}`}
            style={{ borderLeftColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 40%, 40%)` : 'transparent', borderLeftWidth: '3px' }}
          >
            <div className="w-3 h-1" style={{ backgroundColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 40%, 40%)` : '#374151' }} /> {r.title}
          </button>
        ))}
      </div>
    </div>
  )
}
