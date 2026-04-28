import { supabase } from '../lib/supabase'
import { X, Mail, Lock, UserPlus, LogIn, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
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
        setMessage('PROTOCOL_INITIALIZED: Verify email to finalize.')
      }
    } catch (err: any) {
      setError(err.message || 'AUTHENTICATION_FAILURE')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-black border border-cyan-500/50 p-8 shadow-[0_0_100px_rgba(6,182,212,0.2)]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2 z-[110]"
        >
          <X size={24} />
        </button>
        
        <div className="mb-8 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
              {view === 'sign_in' ? 'Initialize Session' : 'Create Protocol'}
            </h2>
            <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.2em]">
              {view === 'sign_in' ? 'Accessing neural network...' : 'Registering new neural identity...'}
            </p>
          </div>

          <div className="flex bg-gray-950 border border-gray-800 p-1 rounded-sm">
            <button 
              onClick={() => setView('sign_in')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${view === 'sign_in' ? 'bg-cyan-500 text-black' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setView('sign_up')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${view === 'sign_up' ? 'bg-cyan-500 text-black' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" method="POST">
          <div className="space-y-1">
            <label htmlFor="email" className="text-[9px] uppercase font-bold text-gray-500 tracking-widest ml-1">Email_Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input
                required
                id="email"
                name="username"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="identity@neural.link"
                className="w-full bg-gray-950 border border-gray-800 pl-10 pr-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[9px] uppercase font-bold text-gray-500 tracking-widest ml-1">Secure_Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input
                required
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-950 border border-gray-800 pl-10 pr-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {view === 'sign_in' && (
              <div className="flex items-center gap-3 py-1 ml-1 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`w-4 h-4 border flex items-center justify-center transition-all ${rememberMe ? 'bg-cyan-500 border-cyan-500' : 'bg-gray-950 border-gray-800 group-hover:border-gray-600'}`}>
                  {rememberMe && <ShieldCheck size={12} className="text-black" />}
                </div>
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Persistent_Identity_Link</span>
              </div>
            )}
            
            <p className="text-[8px] text-gray-700 uppercase font-black tracking-widest ml-1">
              Hint: Add to Home Screen for maximum session stability.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] uppercase font-bold text-center">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 text-[10px] uppercase font-bold text-center">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-white text-black py-4 text-xs font-black uppercase tracking-[0.3em] hover:bg-cyan-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? 'PROCESSING...' : view === 'sign_in' ? (
              <><LogIn size={16} /> TRANSMIT_AUTH</>
            ) : (
              <><UserPlus size={16} /> INITIALIZE_NEW_ID</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
