import type { ShopItem } from '../../types'

const TYPE_LABEL: Record<string, string> = { background_pack: 'BG', dialogue_skin: 'SKIN', bundle: 'BUNDLE' }

export default function ItemCard({ item }: { item: ShopItem }) {
  const priceLabel = item.price_gems != null
    ? `💎 ${item.price_gems.toLocaleString()}`
    : item.price_coins != null
      ? `◈ ${item.price_coins.toLocaleString()}`
      : '—'
  const comingSoon = !!item.metadata.coming_soon

  return (
    <div className={`mkt-item-card mkt-rarity-${item.rarity}`}>
      <div className="mkt-item-preview" style={{ backgroundImage: `url(${item.metadata.preview_url})` }}>
        {comingSoon && (
          <div className="mkt-coming-soon-overlay">
            <span>COMING SOON</span>
          </div>
        )}
      </div>
      <div className="mkt-item-body">
        <div className="mkt-item-header">
          <h4 className="mkt-item-name">{item.name}</h4>
          <span className={`mkt-rarity-badge mkt-rarity-badge-${item.rarity}`}>{item.rarity.slice(0, 4).toUpperCase()}</span>
        </div>
        <span className="mkt-item-type-chip">{TYPE_LABEL[item.item_type]}</span>
        <div className="mkt-item-footer">
          <span className="mkt-item-price">{priceLabel}</span>
          {!comingSoon && (
            <button type="button" className="mkt-buy-btn mkt-buy-btn-sm" onClick={() => console.log('[mock buy]', item.id)}>
              Buy
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
