import { useState, useMemo } from 'react'
import { Minimize2 } from 'lucide-react'
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Line, Brush } from 'recharts'
import type { Routine } from '../types'
import { useTranslation } from '../lib/i18n'

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
  const { t } = useTranslation()
  const [isAutoZoom, setIsAutoZoom] = useState(false)

  if (!isChartFullscreen) return null

  // Calculate dynamic Y-axis domain if auto-zoom is on
  const yDomain = useMemo(() => {
    if (!isAutoZoom || lifetimeChartData.length === 0) return [0, 100]
    
    let min = 100
    let max = 0
    const visibleKeys = [
      ...(!hiddenRoutines.has('Total') ? ['Total'] : []),
      ...filteredRoutines.filter(r => !hiddenRoutines.has(r.title)).map(r => r.title)
    ]

    lifetimeChartData.forEach(entry => {
      visibleKeys.forEach(key => {
        const val = Number(entry[key])
        if (!isNaN(val)) {
          if (val < min) min = val
          if (val > max) max = val
        }
      })
    })

    // Add some padding
    const padding = (max - min) * 0.1 || 5
    return [Math.max(0, Math.floor(min - padding)), Math.min(100, Math.ceil(max + padding))]
  }, [isAutoZoom, lifetimeChartData, hiddenRoutines, filteredRoutines])

  const toggleRoutine = (title: string) => {
    const next = new Set(hiddenRoutines)
    if (next.has(title)) next.delete(title)
    else next.add(title)
    setHiddenRoutines(next)
  }

  return (
    <div className="fixed inset-0 z-[110] bg-canvas flex flex-col p-4 md:p-8 font-mono">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-ink tracking-tighter uppercase">{t('chart.lifetime_analysis')}</h2>
          <p className="text-[10px] text-ink/40 uppercase tracking-widest">{activeCategory} Section • {lifetimeStats.totalDays} Days</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAutoZoom(!isAutoZoom)}
            className={`px-4 py-2 border-2 text-[10px] font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${isAutoZoom ? 'bg-ink text-white border-black' : 'bg-white border-border text-ink'}`}
          >
            {isAutoZoom ? 'FIXED_SCALE' : 'AUTO_ZOOM_Y'}
          </button>
          <button 
            onClick={() => setIsChartFullscreen(false)}
            className="p-3 bg-white border-2 border-border text-ink hover:bg-red-50 hover:text-red-600 transition-all rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <Minimize2 size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border-2 border-border p-6 md:p-10 relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={lifetimeChartData}>
            <defs>
              <linearGradient id="colorTotalFS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#000000"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
            />
            <YAxis
              stroke="#000000"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              tickFormatter={(val) => `${Math.round(val)}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFF', border: '2px solid #000', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
              cursor={{ stroke: '#7C3AED', strokeWidth: 2 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any) => [`${Number(val || 0).toFixed(1)}%`, '']}
            />
            {!hiddenRoutines.has('Total') && (
              <Area
                type="monotone"
                dataKey="Total"
                stroke="#7C3AED"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorTotalFS)"
                dot={false}
                activeDot={{ r: 6, fill: '#7C3AED', stroke: '#000', strokeWidth: 2 }}
              />
            )}
            {filteredRoutines.map((r, i) => !hiddenRoutines.has(r.title) && (
              <Line
                key={r.id}
                type="monotone"
                dataKey={r.title}
                stroke={`hsl(${(i * 60) % 360}, 60%, 45%)`}
                strokeWidth={2}
                dot={false}
                opacity={0.7}
              />
            ))}
            <Brush
              dataKey="name"
              height={40}
              stroke="#000000"
              fill="#FAFAFA"
              travellerWidth={20}
            >
              <AreaChart data={lifetimeChartData}>
                <Area type="monotone" dataKey="Total" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.1} dot={false} />
              </AreaChart>
            </Brush>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => toggleRoutine('Total')}
          className={`flex items-center gap-2 px-4 py-2 border-2 transition-all text-[10px] font-black uppercase tracking-widest ${!hiddenRoutines.has('Total') ? 'bg-accent border-border text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white border-border text-ink/20 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
        >
          <div className={`w-3 h-1 ${!hiddenRoutines.has('Total') ? 'bg-white' : 'bg-ink/10'}`} /> Total Average
        </button>

        {filteredRoutines.map((r, i) => (
          <button 
            key={r.id} 
            onClick={() => toggleRoutine(r.title)}
            className={`flex items-center gap-2 px-4 py-2 border-2 transition-all text-[10px] font-black uppercase tracking-widest ${!hiddenRoutines.has(r.title) ? 'bg-white border-border text-ink shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white border-border text-ink/20 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
            style={{ borderLeftColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 60%, 45%)` : '#E5E7EB', borderLeftWidth: '4px' }}
          >
            <div className="w-3 h-1" style={{ backgroundColor: !hiddenRoutines.has(r.title) ? `hsl(${(i * 60) % 360}, 60%, 45%)` : '#E5E7EB' }} /> {r.title}
          </button>
        ))}
      </div>
    </div>
  )
}
