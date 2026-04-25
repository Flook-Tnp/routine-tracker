import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { useState } from 'react'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-black border border-gray-800 p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="mb-8 text-center space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
              {view === 'sign_in' ? 'Initialize Session' : 'Create Protocol'}
            </h2>
            <p className="text-[8px] text-gray-500 uppercase tracking-widest">
              {view === 'sign_in' ? 'Connect to neural network' : 'Register new neural identity'}
            </p>
          </div>

          <div className="flex border border-gray-900 p-1">
            <button 
              onClick={() => setView('sign_in')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'sign_in' ? 'bg-cyan-500 text-black' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setView('sign_up')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'sign_up' ? 'bg-cyan-500 text-black' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Register
            </button>
          </div>
        </div>

        <div className="auth-ui-wrapper">
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
                    inputBackground: '#000',
                    inputText: 'white',
                    inputPlaceholder: '#4b5563',
                    inputBorder: '#1f2937',
                    inputBorderFocus: '#06b6d4',
                    inputBorderHover: '#374151',
                  },
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
            font-size: 10px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.2em !important;
            font-weight: 900 !important;
            padding: 12px !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-input {
            border-radius: 0 !important;
            font-size: 12px !important;
            background: #000 !important;
            color: white !important;
            border: 1px solid #1f2937 !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-label {
            font-size: 8px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            color: #4b5563 !important;
            margin-bottom: 4px !important;
          }
          .auth-ui-wrapper .supabase-auth-ui_ui-message {
            color: #06b6d4 !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
            text-align: center !important;
            margin-top: 10px !important;
          }
        ` }} />
      </div>
    </div>
  )
}
