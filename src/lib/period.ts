/** Start-of-day boundaries used by the sales and dashboard summaries. */

export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysAgo(days: number): Date {
  const start = startOfToday()
  start.setDate(start.getDate() - days)
  return start
}

export function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
