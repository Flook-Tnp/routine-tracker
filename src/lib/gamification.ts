export const GAMIFICATION_CONFIG = {
  BASE_XP: 10,
  STREAK_MULTIPLIERS: [
    { threshold: 3, multiplier: 1.1 },
    { threshold: 7, multiplier: 1.25 },
    { threshold: 30, multiplier: 1.5 },
    { threshold: 100, multiplier: 2.0 },
  ]
}

export function calculateXP(streak: number): number {
  let multiplier = 1.0
  for (const m of GAMIFICATION_CONFIG.STREAK_MULTIPLIERS) {
    if (streak >= m.threshold) {
      multiplier = m.multiplier
    } else {
      break
    }
  }
  return Math.round(GAMIFICATION_CONFIG.BASE_XP * multiplier)
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  threshold: number
  type: 'streak' | 'total'
}

export const BADGES: Badge[] = [
  { id: 'streak_7', name: 'Week Warrior', description: '7-day streak achieved', icon: '🔥', threshold: 7, type: 'streak' },
  { id: 'streak_30', name: 'Monthly Master', description: '30-day streak achieved', icon: '🏆', threshold: 30, type: 'streak' },
  { id: 'total_100', name: 'Centurion', description: '100 total tasks completed', icon: '💯', threshold: 100, type: 'total' },
]
