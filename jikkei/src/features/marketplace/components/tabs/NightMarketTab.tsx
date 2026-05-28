import { useNightMarket } from '../../hooks/useNightMarket'
import NightMarketBox from '../night-market/NightMarketBox'
import NightMarketCountdown from '../night-market/NightMarketCountdown'
import SkeletonCard from '../SkeletonCard'

export default function NightMarketTab() {
  const { loading, slots, nextReset, reveal } = useNightMarket()

  return (
    <div className="mkt-night-market-tab">
      <NightMarketCountdown nextReset={nextReset} />
      {loading ? (
        <div className="nm-box-row">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} variant="night-box" />)}
        </div>
      ) : (
        <div className="nm-box-row">
          {slots.map((slot) => (
            <NightMarketBox key={slot.slot_index} slot={slot} onReveal={reveal} />
          ))}
        </div>
      )}
    </div>
  )
}
