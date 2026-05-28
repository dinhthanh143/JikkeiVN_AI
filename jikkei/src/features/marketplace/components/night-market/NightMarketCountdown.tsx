import { useEffect, useState } from 'react'

function format(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

export default function NightMarketCountdown({ nextReset }: { nextReset: string }) {
  const target = new Date(nextReset).getTime()
  const [display, setDisplay] = useState(() => format(target - Date.now()))

  useEffect(() => {
    const id = setInterval(() => setDisplay(format(target - Date.now())), 1000)
    return () => clearInterval(id)
  }, [target])

  return (
    <div className="nm-countdown">
      <span className="nm-countdown-label">// NEXT_RESTOCK</span>
      <span className="nm-countdown-value">{display}</span>
    </div>
  )
}
