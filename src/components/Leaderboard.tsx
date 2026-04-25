import { useEffect, useState } from 'react'
import { StorageService } from '../lib/storage'
import { Trophy, Medal } from 'lucide-react'
import { Profile } from '../types'

export function Leaderboard() {
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

      <div className="bg-gray-950 border border-gray-900 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-900 text-[8px] uppercase tracking-widest text-gray-500">
              <th className="px-6 py-4 font-bold">Rank</th>
              <th className="px-6 py-4 font-bold">Protocol_Id</th>
              <th className="px-6 py-4 font-bold text-right">Accumulated_XP</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => (
              <tr key={user.id} className="border-b border-gray-900/50 hover:bg-gray-900/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Trophy size={14} className="text-yellow-500" />}
                    {index === 1 && <Medal size={14} className="text-gray-400" />}
                    {index === 2 && <Medal size={14} className="text-amber-600" />}
                    <span className={`text-xs font-black ${index < 3 ? 'text-white' : 'text-gray-600'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 font-bold uppercase">{user.username}</span>
                    <div className="flex gap-1">
                      {user.badges?.map((badge) => (
                        <span key={badge.id} title={badge.name} className="text-[10px] cursor-help">{badge.icon}</span>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-black text-cyan-400">{user.total_xp?.toLocaleString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
