// TASK-12.3 — night market slots + reveal. Uses MOCK_NIGHT_MARKET by
// default; swap for GET /api/shop/night-market + POST
// /api/shop/night-market/{slot}/reveal once wired — see NightMarketResponse
// / NightMarketSlot schemas in app/schemas/shop.py for the exact shape this
// mirrors.
import { useState } from 'react'
import { MOCK_NIGHT_MARKET } from '../mockData'
import type { NightMarketSlot } from '../types'

export function useNightMarket() {
  const [slots, setSlots] = useState<NightMarketSlot[]>(MOCK_NIGHT_MARKET.slots)
  const [loading] = useState(false)

  const reveal = (slotIndex: number) => {
    // Real mode: await revealNightMarketSlot(slotIndex) then merge the
    // returned slot into state. Mock mode: just flip the local flag.
    setSlots((prev) => prev.map((s) => (s.slot_index === slotIndex ? { ...s, is_revealed: true } : s)))
  }

  return {
    loading,
    slots,
    weekStart: MOCK_NIGHT_MARKET.week_start,
    nextReset: MOCK_NIGHT_MARKET.next_reset,
    reveal,
  }
}
