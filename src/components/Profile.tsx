import type { Routine, Profile as ProfileType } from '../types'
import { Award, Zap, Target } from 'lucide-react'

interface ProfileProps {
  profile: ProfileType | null
  routines: Routine[]
  dailyStreak: number
  weeklyStreak: number
}

export function Profile({ profile, routines, dailyStreak, weeklyStreak }: ProfileProps) {
  if (!profile) return (
    <div className="text-center py-20 space-y-6">
      <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Synchronizing_Neural_Identity...</p>
        <p className="text-[8px] text-gray-700 font-mono">Status: Establishing secure connection to profile sector</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-gray-900 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-800 hover:text-white hover:border-gray-700 transition-all"
      >
        Re-Initialize_System
      </button>
    </div>
  )

  const categories = Array.from(new Set(routines.map(r => r.category || 'General')))
  
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="text-center space-y-4">
        <div className="inline-block p-1 border border-cyan-500/30 rounded-full mb-4">
          <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center text-3xl">
            {profile.username?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">{profile.username}</h2>
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center gap-2">
            {profile.badges?.map((badge) => (
              <div key={badge.id} className="px-2 py-1 bg-gray-900 border border-gray-800 text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1">
                <span>{badge.icon}</span>
                {badge.name}
              </div>
            ))}
            {(!profile.badges || profile.badges.length === 0) && (
              <p className="text-[8px] text-gray-600 uppercase tracking-widest">No badges earned yet</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-950 border border-gray-900 p-6 space-y-2 text-center">
          <Zap size={20} className="text-orange-500 mx-auto mb-2" />
          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Lifetime_XP</p>
          <p className="text-3xl font-black text-white">{(profile.lifetime_xp || profile.total_xp).toLocaleString()}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-6 space-y-2 text-center">
          <Award size={20} className="text-cyan-400 mx-auto mb-2" />
          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Daily_Streak</p>
          <p className="text-3xl font-black text-white">{dailyStreak}</p>
        </div>
        <div className="bg-gray-950 border border-gray-900 p-6 space-y-2 text-center">
          <Target size={20} className="text-purple-500 mx-auto mb-2" />
          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Weekly_Goal</p>
          <p className="text-3xl font-black text-white">{weeklyStreak}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold border-b border-gray-900 pb-2">Active_Sectors</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <span key={cat} className="px-3 py-1 bg-gray-950 border border-gray-800 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
              {cat}
            </span>
          ))}
          {categories.length === 0 && (
            <p className="text-[8px] text-gray-600 uppercase tracking-widest">No active sectors established</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold border-b border-gray-900 pb-2">Achievement_Protocol</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Streak_7', 'Streak_30', 'Streak_100', 'XP_1000'].map(id => {
            const hasBadge = profile.badges?.some((b) => b.id.toLowerCase() === id.toLowerCase())
            return (
              <div key={id} className={`p-4 border text-center space-y-2 ${hasBadge ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-gray-950/30 border-gray-900 grayscale opacity-40'}`}>
                <div className="text-2xl mb-1">
                  {id.includes('Streak') ? '🔥' : '💎'}
                </div>
                <p className="text-[8px] uppercase font-bold tracking-tighter text-gray-400">{id.replace('_', ' ')}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
