import { useMarketBalance } from '../hooks/useMarketBalance'
import SkeletonCard from './SkeletonCard'

export default function BalanceBar() {
  const { coins, gems, loading } = useMarketBalance()

  if (loading) {
    return (
      <div className="mkt-balance-bar">
        <SkeletonCard variant="balance-chip" />
        <SkeletonCard variant="balance-chip" />
      </div>
    )
  }

  return (
    <div className="mkt-balance-bar">
      <span className="mkt-balance-chip mkt-balance-chip-coins">◈ {coins.toLocaleString()} COINS</span>
      <span className="mkt-balance-chip mkt-balance-chip-gems">💎 {gems.toLocaleString()} GEMS</span>
    </div>
  )
}
