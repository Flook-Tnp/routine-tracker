import { useEffect, useState } from 'react'
import { X, Info, AlertTriangle, CheckCircle2, Zap } from 'lucide-react'

export type ToastType = 'info' | 'error' | 'success' | 'warning' | 'milestone'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

let toastTimeout: ReturnType<typeof setTimeout>

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const showToast = (message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type, duration }])
    
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return { toasts, showToast, removeToast }
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[], onClose: (id: string) => void }) {
  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 left-4 md:left-auto md:right-8 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-4 p-4 border animate-in slide-in-from-right-full duration-300 max-w-md bg-black shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${
            toast.type === 'error' ? 'border-red-900 text-red-400' :
            toast.type === 'success' ? 'border-cyan-500/50 text-cyan-400' :
            toast.type === 'milestone' ? 'border-orange-500/50 text-orange-500' :
            toast.type === 'warning' ? 'border-yellow-900 text-yellow-500' :
            'border-gray-800 text-gray-400'
          }`}
        >
          <div className="flex-shrink-0">
            {toast.type === 'error' && <AlertTriangle size={18} />}
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'milestone' && <Zap size={18} />}
            {(toast.type === 'info' || toast.type === 'warning') && <Info size={18} />}
          </div>
          
          <div className="flex-1">
            <p className="text-[10px] uppercase font-black tracking-widest leading-tight">
              {toast.type === 'error' ? '[System_Failure]' : 
               toast.type === 'milestone' ? '[Milestone_Reached]' :
               '[Neural_Transmission]'}
            </p>
            <p className="text-[11px] font-mono mt-1 opacity-90">{toast.message}</p>
          </div>

          <button 
            onClick={() => onClose(toast.id)}
            className="p-1 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>

          {/* Progress bar for auto-close */}
          <div className="absolute bottom-0 left-0 h-[1px] bg-current opacity-20" 
               style={{ 
                 width: '100%', 
                 animation: `toast-progress ${toast.duration || 4000}ms linear forwards` 
               }} 
          />
        </div>
      ))}
    </div>
  )
}
