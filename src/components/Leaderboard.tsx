import { useEffect, useState } from 'react'
import { StorageService } from '../lib/storage'
import { Trophy, Medal } from 'lucide-react'
import type { Profile } from '../types'

interface LeaderboardProps {
  onSelectUser?: (userId: string) => void
  currentUserId?: string
}

export function Leaderboard({ onSelectUser, currentUserId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<Partial<Profile>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    StorageService.fetchLeaderboard()
      .then(setLeaderboard)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-500">Retrieving_Global_Standings...</div>

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-4 text-center">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Global_Leaderboard</h2>
        <p className="text-[8px] text-gray-600 uppercase tracking-widest">Quarterly Reset: Q2 2026</p>
      </section>

      <div className="bg-gray-950/50 border border-gray-900 overflow-hidden">
        {/* Header - Hidden on mobile */}
        <div className="hidden md:grid grid-cols-[80px_1fr_120px] border-b border-gray-900 text-[9px] uppercase tracking-widest text-gray-500 font-bold bg-gray-900/20">
          <div className="px-6 py-4">Rank</div>
          <div className="px-6 py-4">Protocol_Id</div>
          <div className="px-6 py-4 text-right">Accumulated_XP</div>
        </div>

        <div className="divide-y divide-gray-900/50">
          {leaderboard.map((user, index) => {
            const isMe = user.id === currentUserId
            return (
              <div 
                key={user.id} 
                onClick={() => !isMe && user.id && onSelectUser?.(user.id)}
                className={`flex md:grid md:grid-cols-[80px_1fr_120px] items-center p-4 md:p-0 border-b border-gray-900/50 hover:bg-gray-900/30 transition-colors group ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {/* Rank */}
                <div className="md:px-6 md:py-4 flex-shrink-0 mr-4 md:mr-0">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Trophy size={16} className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />}
                    {index === 1 && <Medal size={16} className="text-gray-400" />}
                    {index === 2 && <Medal size={16} className="text-amber-600" />}
                    <span className={`text-xs md:text-sm font-black ${index < 3 ? 'text-white' : 'text-gray-600'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* User Info */}
                <div className="md:px-6 md:py-4 flex-1">
                  <div 
                    className={`flex items-center gap-3 ${!isMe ? 'hud-link-active' : ''}`}
                    onClick={() => !isMe && onSelectUser?.(user.id)}
                  >
                    <div className={`w-8 h-8 md:w-6 md:h-6 bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] font-bold text-cyan-500 uppercase overflow-hidden transition-colors ${!isMe && 'group-hover:border-cyan-500/50'}`}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        user.username?.[0]
                      )}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                      <span className="text-sm md:text-xs text-gray-300 font-bold uppercase transition-colors">{user.username}</span>
                      <div className="flex gap-1">
                        {user.badges?.map((badge) => (
                          <span key={badge.id} title={badge.name} className="text-xs md:text-[10px] cursor-help">{badge.icon}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* XP - Shown below username on mobile */}
                <div className="md:px-6 md:py-4 text-right flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-sm md:text-xs font-black text-cyan-400 tracking-tight">{user.total_xp?.toLocaleString()}</span>
                    <span className="md:hidden text-[8px] text-gray-700 uppercase font-bold">Total XP</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
