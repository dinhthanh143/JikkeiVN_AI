const GEM_PACKAGES = [
  { gems: 50, price: '$0.99' },
  { gems: 150, price: '$2.99' },
  { gems: 300, price: '$4.99' },
  { gems: 500, price: '$7.99' },
  { gems: 1000, price: '$14.99' },
  { gems: 2500, price: '$34.99' },
]

export default function BuyGemsSection() {
  return (
    <div className="mkt-buy-gems-section">
      <h4 className="mkt-exchange-title">Buy Gems</h4>
      <div className="mkt-gem-grid">
        {GEM_PACKAGES.map((pkg) => (
          <div key={pkg.gems} className="mkt-gem-card">
            <span className="mkt-gem-amount">💎 {pkg.gems.toLocaleString()}</span>
            <span className="mkt-gem-price">{pkg.price}</span>
            <button type="button" className="mkt-gem-buy-btn" disabled title="Coming soon">
              🔒 Buy
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
