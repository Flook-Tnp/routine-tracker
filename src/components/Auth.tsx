import { supabase } from '../lib/supabase'
import { X, Mail, Lock, UserPlus, LogIn, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from '../lib/i18n'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { t } = useTranslation();

  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [email, setEmail] = useState(() => localStorage.getItem('disby_remember_email') || '')
  const [password, setPassword] = useState(() => localStorage.getItem('disby_remember_password') || '')
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('disby_remember_me') !== 'false')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Save credentials in real-time if Remember Me is checked
  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem('disby_remember_email', email)
      localStorage.setItem('disby_remember_password', password)
      localStorage.setItem('disby_remember_me', 'true')
    } else {
      localStorage.removeItem('disby_remember_email')
      localStorage.removeItem('disby_remember_password')
      localStorage.setItem('disby_remember_me', 'false')
    }
  }, [email, password, rememberMe])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (view === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error

        onClose()
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage(t('auth.success'))
      }
    } catch (err: any) {
      setError(err.message || t('auth.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-white border-2 border-border p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-ink/40 hover:text-accent transition-colors p-2 z-[110]"
        >
          <X size={24} />
        </button>
        
        <div className="mb-8 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-ink tracking-tighter uppercase">
              {view === 'sign_in' ? t('auth.login.title') : t('auth.signup.title')}
            </h2>
            <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">
              {view === 'sign_in' ? t('auth.login.subtitle') : t('auth.signup.subtitle')}
            </p>
          </div>

          <div className="flex bg-canvas border-2 border-border p-1 rounded-none">
            <button 
              onClick={() => setView('sign_in')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${view === 'sign_in' ? 'bg-accent text-white' : 'text-ink/40 hover:text-ink'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setView('sign_up')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${view === 'sign_up' ? 'bg-accent text-white' : 'text-ink/40 hover:text-ink'}`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" method="POST">
          <div className="space-y-1">
            <label htmlFor="email" className="text-[9px] uppercase font-bold text-ink/40 tracking-widest ml-1">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={16} />
              <input
                required
                id="email"
                name="username"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="identity@neural.link"
                className="w-full bg-canvas border-2 border-border pl-10 pr-4 py-3 text-xs font-mono text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-ink/20"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[9px] uppercase font-bold text-ink/40 tracking-widest ml-1">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={16} />
              <input
                required
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-canvas border-2 border-border pl-10 pr-4 py-3 text-xs font-mono text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-ink/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {view === 'sign_in' && (
              <div className="flex items-center gap-3 py-1 ml-1 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-accent border-accent' : 'bg-white border-border group-hover:border-accent'}`}>
                  {rememberMe && <ShieldCheck size={12} className="text-white" />}
                </div>
                <span className="text-[10px] uppercase font-black tracking-widest text-ink/40 group-hover:text-ink transition-colors">{t('auth.remember')}</span>
              </div>
            )}
            
            <p className="text-[8px] text-ink/20 uppercase font-black tracking-widest ml-1">
              Hint: Add to Home Screen for maximum session stability.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-500 text-red-600 text-[10px] uppercase font-black text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-accent-soft border-2 border-accent text-accent text-[10px] uppercase font-black text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-black text-white py-4 text-xs font-black uppercase tracking-[0.3em] hover:bg-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            {loading ? t('auth.processing') : view === 'sign_in' ? (
              <><LogIn size={16} /> {t('auth.btn.login')}</>
            ) : (
              <><UserPlus size={16} /> {t('auth.btn.signup')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
