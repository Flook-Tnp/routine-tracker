import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed border-border/20 text-center space-y-6 bg-canvas/30 animate-in fade-in duration-700">
      <div className="w-16 h-16 bg-white border-2 border-border flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-float">
        <Icon size={32} className="text-accent" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-ink">{title}</h3>
        <p className="text-[10px] text-ink/40 font-bold uppercase leading-relaxed tracking-widest">{subtitle}</p>
      </div>
      {action && (
        <button 
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
