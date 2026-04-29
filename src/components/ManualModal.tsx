import { X } from 'lucide-react'
import { useTranslation } from '../lib/i18n'

interface ManualModalProps {
  onClose: () => void
}

export function ManualModal({ onClose }: ManualModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black border border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,1)]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">{t('manual.title')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-sm space-y-8 font-mono leading-relaxed text-gray-400">
          <section className="space-y-4">
            <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 bg-cyan-500" />
              {t('manual.perf_logic')}
            </h3>
            <div className="grid gap-4">
              <div className="bg-gray-950 p-4 border-l-2 border-orange-500">
                <p className="text-orange-500 text-[10px] font-bold uppercase mb-1">Daily Streak (Flame 🔥)</p>
                <p className="text-[11px] leading-relaxed">Counts consecutive days with ≥1 completion in the active section. If today is not yet done, the streak stays alive by checking if yesterday was completed.</p>
              </div>
              <div className="bg-gray-950 p-4 border-l-2 border-cyan-500">
                <p className="text-cyan-500 text-[10px] font-bold uppercase mb-1">Weekly Streak (Trophy 🏆)</p>
                <p className="text-[11px] leading-relaxed">A "Motivation Safety Net". A week (Sun-Sat) is successful if you are active on **at least 3 different days**. This preserves your progress even if you miss a day or two.</p>
              </div>
              <div className="bg-gray-950 p-4 border-l-2 border-gray-700">
                <p className="text-gray-300 text-[10px] font-bold uppercase mb-1">Efficiency & Fairness</p>
                <p className="text-[11px] leading-relaxed">Scores are calculated from the day a task was **first created**. New tasks start at 100% and are not penalized for the history that existed before they were added.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 bg-cyan-500" />
              Interface_Commands
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[10px]">
              <div className="space-y-2">
                <p className="text-cyan-500 font-bold uppercase border-b border-gray-900 pb-1">Navigation</p>
                <ul className="space-y-1">
                  <li className="flex justify-between"><span>DATE_ARROWS</span> <span className="text-gray-500">+/- 1 DAY</span></li>
                  <li className="flex justify-between"><span>DATE_STRIP</span> <span className="text-gray-500">QUICK JUMP</span></li>
                  <li className="flex justify-between"><span>TODAY_BTN</span> <span className="text-gray-500">INSTANT SYNC</span></li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-cyan-500 font-bold uppercase border-b border-gray-900 pb-1">Editing</p>
                <ul className="space-y-1">
                  <li className="flex justify-between"><span>DOUBLE_CLICK</span> <span className="text-gray-500">RENAME MODE</span></li>
                  <li className="flex justify-between"><span>PENCIL_ICON</span> <span className="text-gray-500">EDIT TITLE</span></li>
                  <li className="flex justify-between"><span>TRASH_ICON</span> <span className="text-gray-500">WIPE HISTORY</span></li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-white border-b border-gray-900 pb-2 text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 bg-cyan-500" />
              Data_Analysis
            </h3>
            <ul className="space-y-3 text-[11px] list-none">
              <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">CHART_ZOOM</span> <span>Use the scroll-brush at the bottom of graphs to focus on specific time periods.</span></li>
              <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">FULLSCREEN</span> <span>Click the expansion icon (⤢) for high-resolution data inspection.</span></li>
              <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">VISIBILITY</span> <span>Toggle individual task lines by clicking their names in the chart legend.</span></li>
              <li className="flex gap-4"><span className="text-cyan-500 min-w-[80px] shrink-0">30_DAY_STATS</span> <span>Dynamic logic: stats update to show the 30-day window of your selected date.</span></li>
            </ul>
          </section>

          <div className="pt-4 text-center">
            <button 
              onClick={onClose}
              className="px-8 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Terminate_Manual_Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
