import { X } from 'lucide-react'
import { useTranslation } from '../lib/i18n'

interface ManualModalProps {
  onClose: () => void
}

export function ManualModal({ onClose }: ManualModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-border w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] font-mono">
        <div className="p-4 border-b-2 border-border flex justify-between items-center bg-canvas">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-accent">{t('manual.title')}</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-accent transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-sm space-y-8 leading-relaxed text-ink/70">
          <section className="space-y-4">
            <h3 className="text-ink border-b-2 border-border/10 pb-2 text-xs uppercase font-black tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-accent" />
              {t('manual.perf_logic')}
            </h3>
            <div className="grid gap-4">
              <div className="bg-canvas p-4 border-l-4 border-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-accent text-[10px] font-black uppercase mb-1">Daily Streak (Flame 🔥)</p>
                <p className="text-[11px] leading-relaxed font-bold">Counts consecutive days with ≥1 completion in the active section. If today is not yet done, the streak stays alive by checking if yesterday was completed.</p>
              </div>
              <div className="bg-canvas p-4 border-l-4 border-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-accent text-[10px] font-black uppercase mb-1">Weekly Streak (Trophy 🏆)</p>
                <p className="text-[11px] leading-relaxed font-bold">A "Motivation Safety Net". A week (Sun-Sat) is successful if you are active on **at least 3 different days**. This preserves your progress even if you miss a day or two.</p>
              </div>
              <div className="bg-canvas p-4 border-l-4 border-border/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-ink/60 text-[10px] font-black uppercase mb-1">Efficiency & Fairness</p>
                <p className="text-[11px] leading-relaxed font-bold">Scores are calculated from the day a task was **first created**. New tasks start at 100% and are not penalized for the history that existed before they were added.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-ink border-b-2 border-border/10 pb-2 text-xs uppercase font-black tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-accent" />
              Interface_Commands
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[10px]">
              <div className="space-y-2">
                <p className="text-accent font-black uppercase border-b-2 border-border/10 pb-1">Navigation</p>
                <ul className="space-y-1 font-bold">
                  <li className="flex justify-between"><span>DATE_ARROWS</span> <span className="text-ink/40">+/- 1 DAY</span></li>
                  <li className="flex justify-between"><span>DATE_STRIP</span> <span className="text-ink/40">QUICK JUMP</span></li>
                  <li className="flex justify-between"><span>TODAY_BTN</span> <span className="text-ink/40">INSTANT SYNC</span></li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-accent font-black uppercase border-b-2 border-border/10 pb-1">Editing</p>
                <ul className="space-y-1 font-bold">
                  <li className="flex justify-between"><span>DOUBLE_CLICK</span> <span className="text-ink/40">RENAME MODE</span></li>
                  <li className="flex justify-between"><span>PENCIL_ICON</span> <span className="text-ink/40">EDIT TITLE</span></li>
                  <li className="flex justify-between"><span>TRASH_ICON</span> <span className="text-ink/40">WIPE HISTORY</span></li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-ink border-b-2 border-border/10 pb-2 text-xs uppercase font-black tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-accent" />
              Data_Analysis
            </h3>
            <ul className="space-y-3 text-[11px] list-none font-bold">
              <li className="flex gap-4"><span className="text-accent min-w-[80px] shrink-0 font-black">CHART_ZOOM</span> <span>Use the scroll-brush at the bottom of graphs to focus on specific time periods.</span></li>
              <li className="flex gap-4"><span className="text-accent min-w-[80px] shrink-0 font-black">FULLSCREEN</span> <span>Click the expansion icon (⤢) for high-resolution data inspection.</span></li>
              <li className="flex gap-4"><span className="text-accent min-w-[80px] shrink-0 font-black">VISIBILITY</span> <span>Toggle individual task lines by clicking their names in the chart legend.</span></li>
              <li className="flex gap-4"><span className="text-accent min-w-[80px] shrink-0 font-black">30_DAY_STATS</span> <span>Dynamic logic: stats update to show the 30-day window of your selected date.</span></li>
            </ul>
          </section>

          <div className="pt-4 text-center">
            <button 
              onClick={onClose}
              className="px-8 py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Terminate_Manual_Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
