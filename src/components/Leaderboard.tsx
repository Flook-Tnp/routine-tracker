import { useEffect, useState } from 'react'
import { StorageService } from '../lib/storage'
import { Trophy } from 'lucide-react'
import type { Profile } from '../types'
import { useTranslation } from '../lib/i18n'

interface LeaderboardProps {
  onSelectUser?: (userId: string) => void
  currentUserId?: string
}

export function Leaderboard({ onSelectUser, currentUserId }: LeaderboardProps) {
  const { t } = useTranslation();

  const [leaderboard, setLeaderboard] = useState<Partial<Profile>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    StorageService.fetchLeaderboard()
      .then(setLeaderboard)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-ink/40 font-mono">{t('leaderboard.loading')}</div>

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-mono">
      <section className="space-y-4 text-center">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 font-black">{t('leaderboard.title')}</h2>
        <p className="text-[8px] text-ink/60 uppercase font-black tracking-widest">{t('leaderboard.subtitle')}</p>
      </section>

      <div className="bg-white border-2 border-border overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header - Now visible on mobile with adjusted columns */}
        <div className="grid grid-cols-[50px_1fr_80px] md:grid-cols-[80px_1fr_120px] border-b-2 border-border text-[8px] md:text-[9px] uppercase tracking-widest text-ink/40 font-black bg-canvas">
          <div className="px-4 md:px-6 py-4">{t('leaderboard.rank')}</div>
          <div className="px-4 md:px-6 py-4">{t('leaderboard.user')}</div>
          <div className="px-4 md:px-6 py-4 text-right">{t('leaderboard.xp')}</div>
        </div>

        <div className="divide-y divide-border/10">
          {leaderboard.map((user, index) => {
            const isMe = user.id === currentUserId
            return (
              <div 
                key={user.id} 
                onClick={() => !isMe && user.id && onSelectUser?.(user.id)}
                className={`grid grid-cols-[50px_1fr_80px] md:grid-cols-[80px_1fr_120px] items-center hover:bg-accent-soft transition-colors group ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {/* Rank */}
                <div className="px-4 md:px-6 py-4">
                  <div className="flex items-center gap-1 md:gap-2">
                    {index === 0 && <Trophy size={14} className="text-yellow-600 md:size-4" />}
                    <span className={`text-[10px] md:text-sm font-black ${index < 3 ? 'text-ink' : 'text-ink/40'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* User Info */}
                <div className="px-4 md:px-6 py-4 overflow-hidden">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-canvas border-2 border-border flex-shrink-0 flex items-center justify-center text-[10px] font-black text-accent uppercase overflow-hidden transition-colors">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        user.username?.[0]
                      )}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3 overflow-hidden">
                      <span className="text-[10px] md:text-xs text-ink font-black uppercase truncate">{user.username}</span>
                      <div className="flex gap-1">
                        {user.badges?.slice(0, 3).map((badge) => (
                          <span key={badge.id} title={badge.name} className="text-[10px] cursor-help">{badge.icon}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* XP */}
                <div className="px-4 md:px-6 py-4 text-right">
                  <span className="text-[10px] md:text-xs font-black text-accent tracking-tight">{user.total_xp?.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
