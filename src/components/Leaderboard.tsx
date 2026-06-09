import { useEffect, useMemo, useState } from 'react'
import { StorageService } from '../lib/storage'
import { Crown, Medal, Target, Trophy } from 'lucide-react'
import type { LeaderboardEntry, LeaderboardPeriod } from '../types'
import { useTranslation } from '../lib/i18n'
import { EmptyState } from './EmptyState'

interface LeaderboardProps {
  onSelectUser?: (userId: string) => void
  currentUserId?: string
}

function getSeasonMeta() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  const end = new Date(now.getFullYear(), quarter * 3, 0)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))

  return {
    label: `Q${quarter} ${now.getFullYear()}`,
    resetsIn: daysLeft
  }
}

function scoreLabel(period: LeaderboardPeriod) {
  return period === 'season' ? 'Season XP' : 'Lifetime XP'
}

function displayScore(user: LeaderboardEntry) {
  return user.score.toLocaleString()
}

function Avatar({ user, size = 'md' }: { user: LeaderboardEntry; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'

  return (
    <div className={`${sizeClass} bg-canvas border-2 border-border flex-shrink-0 flex items-center justify-center font-black text-accent uppercase overflow-hidden`}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.username || 'User'} className="w-full h-full object-cover" />
      ) : (
        user.username?.[0] || '?'
      )}
    </div>
  )
}

export function Leaderboard({ onSelectUser, currentUserId }: LeaderboardProps) {
  const { t } = useTranslation()

  const [period, setPeriod] = useState<LeaderboardPeriod>('season')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const season = useMemo(() => getSeasonMeta(), [])

  useEffect(() => {
    let cancelled = false

    StorageService.fetchLeaderboard(period)
      .then((data) => {
        if (!cancelled) {
          setLeaderboard(data)
          setError(null)
        }
      })
      .catch((err) => {
        console.error('Leaderboard fetch failed:', err)
        if (!cancelled) setError(t('leaderboard.error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period, t])

  const handlePeriodChange = (nextPeriod: LeaderboardPeriod) => {
    setPeriod(nextPeriod)
    setLoading(true)
    setError(null)
  }

  const rankedPlayers = leaderboard.filter(user => user.score > 0 || user.id === currentUserId)
  const topThree = rankedPlayers.slice(0, 3)
  const tableRows = rankedPlayers.slice(3, 20)
  const currentUser = leaderboard.find(user => user.id === currentUserId)
  const nextTarget = currentUser && currentUser.rank > 1 ? leaderboard[currentUser.rank - 2] : null
  const gapToNext = currentUser && nextTarget ? Math.max(0, nextTarget.score - currentUser.score + 1) : 0

  if (loading) {
    return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-ink/40 font-mono">{t('leaderboard.loading')}</div>
  }

  if (error) {
    return (
      <EmptyState
        icon={Trophy}
        title={t('leaderboard.error')}
        subtitle={t('leaderboard.error_subtitle')}
      />
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-mono">
      <section className="bg-white border-2 border-border shadow-[6px_6px_0px_0px_rgba(20,184,166,0.34)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 md:p-8 space-y-6 border-b-2 lg:border-b-0 lg:border-r-2 border-border">
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">{t('leaderboard.season_label')}</p>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-ink">{season.label}</h2>
              <p className="text-xs text-ink/55 uppercase tracking-widest font-bold">{t('leaderboard.resets_in', { days: String(season.resetsIn) })}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'season', label: t('leaderboard.season') },
                { id: 'all_time', label: t('leaderboard.all_time') }
              ] as { id: LeaderboardPeriod; label: string }[]).map(option => (
                <button
                  key={option.id}
                  onClick={() => handlePeriodChange(option.id)}
                  className={`border-2 border-border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${period === option.id ? 'bg-accent text-white shadow-[3px_3px_0px_0px_rgba(236,72,153,0.4)]' : 'bg-canvas text-ink/45 hover:text-accent'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="text-sm text-ink/65 leading-relaxed">
              {period === 'season' ? t('leaderboard.season_pitch') : t('leaderboard.all_time_pitch')}
            </p>
          </div>

          <div className="p-6 md:p-8 bg-accent-soft space-y-4">
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black">{t('leaderboard.my_rank')}</p>
            {currentUser ? (
              <div className="bg-white border-2 border-border p-5 space-y-4 shadow-[3px_3px_0px_0px_rgba(236,72,153,0.28)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={currentUser} />
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight truncate">{currentUser.username}</p>
                      <p className="text-[9px] uppercase tracking-widest text-ink/45 font-black">{scoreLabel(period)}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-accent">#{currentUser.rank}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-canvas border-2 border-border p-3">
                    <p className="text-xl font-black">{displayScore(currentUser)}</p>
                    <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">XP</p>
                  </div>
                  <div className="bg-canvas border-2 border-border p-3">
                    <p className="text-xl font-black">{gapToNext.toLocaleString()}</p>
                    <p className="text-[8px] uppercase tracking-widest text-ink/45 font-black">{t('leaderboard.to_next')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-border p-5 space-y-3">
                <Target size={24} className="text-accent" />
                <p className="text-sm font-black uppercase tracking-tight">{t('leaderboard.login_prompt')}</p>
                <p className="text-xs text-ink/55 leading-relaxed">{t('leaderboard.login_subtitle')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {topThree.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {topThree.map((user) => {
            const isFirst = user.rank === 1
            const isMe = user.id === currentUserId
            return (
              <button
                key={user.id}
                onClick={() => !isMe && onSelectUser?.(user.id)}
                className={`bg-white border-2 text-left border-border p-5 space-y-4 transition-all hover:border-accent active:scale-[0.99] ${isFirst ? 'md:min-h-[220px] shadow-[6px_6px_0px_0px_rgba(236,72,153,0.42)]' : 'md:min-h-[190px] shadow-[4px_4px_0px_0px_rgba(20,184,166,0.34)]'} ${isMe ? 'ring-2 ring-accent ring-offset-2' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar user={user} size={isFirst ? 'lg' : 'md'} />
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight truncate">{user.username}</p>
                      <p className="text-[9px] text-ink/45 uppercase tracking-widest font-black">{displayScore(user)} XP</p>
                    </div>
                  </div>
                  {isFirst ? <Crown size={24} className="text-yellow-600" /> : <Medal size={22} className="text-accent" />}
                </div>
                <div>
                  <p className="text-5xl font-black tracking-tighter text-accent">#{user.rank}</p>
                  <p className="text-[9px] uppercase tracking-widest text-ink/45 font-black">{isMe ? t('leaderboard.you') : scoreLabel(period)}</p>
                </div>
              </button>
            )
          })}
        </section>
      ) : (
        <EmptyState
          icon={Trophy}
          title={t('leaderboard.empty')}
          subtitle={t('leaderboard.empty_subtitle')}
        />
      )}

      {tableRows.length > 0 && (
        <div className="bg-white border-2 border-border overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,184,166,0.34)]">
          <div className="grid grid-cols-[58px_1fr_96px] md:grid-cols-[80px_1fr_140px] border-b-2 border-border text-[8px] md:text-[9px] uppercase tracking-widest text-ink/40 font-black bg-canvas">
            <div className="px-4 md:px-6 py-4">{t('leaderboard.rank')}</div>
            <div className="px-4 md:px-6 py-4">{t('leaderboard.user')}</div>
            <div className="px-4 md:px-6 py-4 text-right">{scoreLabel(period)}</div>
          </div>

          <div className="divide-y divide-border/10">
            {tableRows.map((user) => {
              const isMe = user.id === currentUserId
              return (
                <div
                  key={user.id}
                  onClick={() => !isMe && onSelectUser?.(user.id)}
                  className={`grid grid-cols-[58px_1fr_96px] md:grid-cols-[80px_1fr_140px] items-center hover:bg-accent-soft transition-colors group ${isMe ? 'bg-accent-soft cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="px-4 md:px-6 py-4">
                    <span className="text-[10px] md:text-sm font-black text-ink/50">{String(user.rank).padStart(2, '0')}</span>
                  </div>

                  <div className="px-4 md:px-6 py-4 overflow-hidden">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Avatar user={user} size="sm" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] md:text-xs text-ink font-black uppercase truncate">{user.username}</span>
                        {isMe && <span className="text-[8px] uppercase tracking-widest text-accent font-black">{t('leaderboard.you')}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 md:px-6 py-4 text-right">
                    <span className="text-[10px] md:text-xs font-black text-accent tracking-tight">{displayScore(user)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
