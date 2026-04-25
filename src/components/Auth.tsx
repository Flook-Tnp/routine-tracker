import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-black border border-gray-800 p-8 shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white tracking-tighter uppercase mb-2">Initialize Session</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Connect to neural network for persistent storage</p>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#06b6d4',
                  brandAccent: '#22d3ee',
                  inputBackground: '#111827',
                  inputText: 'white',
                  inputPlaceholder: '#4b5563',
                  inputBorder: '#1f2937',
                  inputBorderFocus: '#06b6d4',
                  inputBorderHover: '#374151',
                },
              },
            },
            className: {
              container: 'auth-container',
              button: 'auth-button',
              input: 'auth-input',
              label: 'auth-label',
            }
          }}
          theme="dark"
          providers={[]}
        />
        
        <style dangerouslySetInnerHTML={{ __html: `
          .auth-container { font-family: 'JetBrains Mono', monospace; }
          .auth-button { 
            border-radius: 0 !important;
            font-size: 10px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.2em !important;
            font-weight: 900 !important;
          }
          .auth-input {
            border-radius: 0 !important;
            font-size: 12px !important;
            background: #000 !important;
          }
          .auth-label {
            font-size: 8px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            color: #4b5563 !important;
          }
        ` }} />
      </div>
    </div>
  )
}
