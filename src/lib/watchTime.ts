import type { Show } from '../types/schema'

export interface WatchTimeMinutes {
  newMinutes: number
  rewatchMinutes: number
  totalMinutes: number
}

/**
 * new watch time = each watched episode counted once
 * rewatch time = each episode's rewatchCount counted on top of that
 */
export function showWatchTime(show: Show): WatchTimeMinutes {
  const duration = show.episodeDurationMin ?? 0
  let newMinutes = 0
  let rewatchMinutes = 0
  for (const ep of show.episodes) {
    if (ep.watched) newMinutes += duration
    rewatchMinutes += ep.rewatchCount * duration
  }
  return { newMinutes, rewatchMinutes, totalMinutes: newMinutes + rewatchMinutes }
}

export function totalWatchTime(shows: Show[]): WatchTimeMinutes {
  return shows.reduce<WatchTimeMinutes>(
    (acc, show) => {
      const t = showWatchTime(show)
      return {
        newMinutes: acc.newMinutes + t.newMinutes,
        rewatchMinutes: acc.rewatchMinutes + t.rewatchMinutes,
        totalMinutes: acc.totalMinutes + t.totalMinutes,
      }
    },
    { newMinutes: 0, rewatchMinutes: 0, totalMinutes: 0 },
  )
}

/**
 * Breaks total minutes into months/days/hours for the home page's "Total
 * Time" overview card — a fixed 30-day/24-hour approximation, not a
 * calendar-accurate breakdown.
 */
export function formatDurationParts(minutes: number): { months: number; days: number; hours: number } {
  const totalHours = Math.floor(minutes / 60)
  const totalDays = Math.floor(totalHours / 24)
  const months = Math.floor(totalDays / 30)
  const days = totalDays % 30
  const hours = totalHours % 24
  return { months, days, hours }
}

export function formatMinutes(minutes: number): string {
  const totalHours = Math.floor(minutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const mins = Math.round(minutes % 60)
  if (days > 0) return `${days}d ${hours}h`
  if (totalHours > 0) return `${totalHours}h ${mins}m`
  return `${mins}m`
}
