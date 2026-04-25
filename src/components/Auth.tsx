import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')

  useEffect(() => {
    console.log('AuthModal mounted, view:', view)
  }, [view])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/95 backdrop-blur-xl">
      <div className="relative w-full max-w-md bg-black border border-cyan-500/50 p-8 shadow-[0_0_100px_rgba(6,182,212,0.2)]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2 z-[110]"
          aria-label="Close"
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

        <div className="auth-ui-wrapper min-h-[200px]">
          <Auth
            supabaseClient={supabase}
            view={view}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#06b6d4',
                    brandAccent: '#22d3ee',
                    inputBackground: '#0a0a0a',
                    inputText: '#ffffff',
                    inputPlaceholder: '#4b5563',
                    inputBorder: '#1f2937',
                    inputBorderFocus: '#06b6d4',
                    inputBorderHover: '#374151',
                  },
                  fontSizes: {
                    baseBodySize: '13px',
                    baseInputSize: '13px',
                    baseLabelSize: '10px',
                    baseButtonSize: '11px',
                  }
                },
              },
            }}
            theme="dark"
            providers={[]}
            showLinks={false}
          />
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          .auth-ui-wrapper * {
            font-family: 'JetBrains Mono', monospace !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-button { 
            border-radius: 0 !important;
            font-size: 11px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.2em !important;
            font-weight: 900 !important;
            padding: 14px !important;
            border: none !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-input {
            border-radius: 0 !important;
            background: #0a0a0a !important;
            color: white !important;
            border: 1px solid #1f2937 !important;
            padding: 12px !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-label {
            font-size: 9px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            color: #6b7280 !important;
            margin-bottom: 6px !important;
            font-weight: bold !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-message {
            color: #22d3ee !important;
            font-size: 10px !important;
            text-transform: uppercase !important;
            text-align: center !important;
            margin-top: 15px !important;
            font-weight: bold !important;
          }
        ` }} />
      </div>
    </div>
  )
}

