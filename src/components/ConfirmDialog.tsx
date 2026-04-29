import { X } from 'lucide-react'
import { useTranslation } from '../lib/i18n'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-border w-full max-w-sm p-6 space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center border-b border-border/10 pb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-red-600">{title}</h3>
          <button onClick={onCancel} className="text-ink/40 hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs font-mono text-ink/60 leading-relaxed uppercase">
          {message}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white border-2 border-border py-3 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            {t('common.confirm')}
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 bg-white text-ink border-2 border-border py-3 text-[10px] font-black uppercase tracking-widest hover:bg-canvas transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
