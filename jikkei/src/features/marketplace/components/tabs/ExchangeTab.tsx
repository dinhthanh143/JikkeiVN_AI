import ExchangeSection from '../exchange/ExchangeSection'
import BuyGemsSection from '../exchange/BuyGemsSection'

export default function ExchangeTab() {
  return (
    <div className="mkt-exchange-tab">
      <ExchangeSection
        title="Coins → Credits"
        fromLabel="Coins to spend"
        toLabel="Credits received"
        rateLabel="Rate: 100 coins = 1 credit"
        toCredits={(coins) => Math.floor(coins / 100)}
      />
      <hr className="mkt-section-rule" />
      <ExchangeSection
        title="Gems → Credits"
        fromLabel="Gems to spend"
        toLabel="Credits received"
        rateLabel="Rate: 1 gem = 5 credits"
        toCredits={(gems) => gems * 5}
      />
      <hr className="mkt-section-rule" />
      <BuyGemsSection />
    </div>
  )
}
