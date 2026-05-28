// TASK-011 — formats a resets_at ISO timestamp the way Claude phrases its
// own usage-limit reset time: a plain clock time ("3:45 PM"), never a
// countdown. Callers should only reach for this once credits_remaining hits
// 0 — while credits remain, just show the raw count instead.
export function formatResetTime(resetsAtIso: string): string {
  const date = new Date(resetsAtIso)
  if (Number.isNaN(date.getTime())) return 'later'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
