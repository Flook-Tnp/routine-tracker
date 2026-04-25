import { X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black border border-gray-800 w-full max-w-sm p-6 space-y-6 shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-900 pb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-red-500">{title}</h3>
          <button onClick={onCancel} className="text-gray-600 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs font-mono text-gray-400 leading-relaxed uppercase">
          {message}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onConfirm}
            className="flex-1 bg-red-900/20 text-red-500 border border-red-900/50 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
          >
            Confirm
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 bg-gray-900 text-gray-400 border border-gray-800 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 hover:text-white transition-all"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  )
}
