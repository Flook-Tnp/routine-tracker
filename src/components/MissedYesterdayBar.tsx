import { Clock3, X } from 'lucide-react'

interface MissedYesterdayBarProps {
  title: string
  subtitle: string
  actionLabel: string
  dismissLabel: string
  onRecover: () => void
  onDismiss: () => void
}

export function MissedYesterdayBar({
  title,
  subtitle,
  actionLabel,
  dismissLabel,
  onRecover,
  onDismiss
}: MissedYesterdayBarProps) {
  return (
    <div className="flex flex-col gap-4 border-2 border-border bg-white p-4 font-mono shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)] md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border-2 border-border bg-sync-soft text-sync">
          <Clock3 size={18} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink">{title}</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-ink/45">{subtitle}</p>
        </div>
      </div>

      <div className="flex gap-2 md:flex-shrink-0">
        <button
          type="button"
          onClick={onRecover}
          className="flex-1 border-2 border-border bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-sync active:translate-x-[1px] active:translate-y-[1px] md:flex-none"
        >
          {actionLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="border-2 border-border bg-canvas px-3 py-2 text-[10px] font-black uppercase tracking-widest text-ink/45 transition-all hover:text-ink active:translate-x-[1px] active:translate-y-[1px]"
          aria-label={dismissLabel}
          title={dismissLabel}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
