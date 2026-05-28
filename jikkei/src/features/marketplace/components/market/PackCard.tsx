import type { ShopItem } from '../../types'

const RARITY_LABEL: Record<string, string> = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY' }

export default function PackCard({ item }: { item: ShopItem }) {
  const contains = item.metadata.contains ?? []
  const priceLabel = item.price_gems != null
    ? `💎 ${item.price_gems.toLocaleString()}`
    : item.price_coins != null
      ? `◈ ${item.price_coins.toLocaleString()}`
      : '—'

  return (
    <div className={`mkt-pack-card mkt-rarity-${item.rarity}`}>
      <div className="mkt-pack-preview" style={{ backgroundImage: `url(${item.metadata.preview_url})` }}>
        {item.metadata.tag && (
          <span className="mkt-pack-tag" style={{ background: item.metadata.badge_color ?? undefined }}>
            {item.metadata.tag}
          </span>
        )}
      </div>
      <div className="mkt-pack-body">
        <div className="mkt-pack-header">
          <h3 className="mkt-pack-name">{item.name}</h3>
          <span className={`mkt-rarity-badge mkt-rarity-badge-${item.rarity}`}>{RARITY_LABEL[item.rarity]}</span>
        </div>
        <p className="mkt-pack-desc">{item.description}</p>
        <div className="mkt-pack-contains">
          {contains.map((c, i) => (
            <span key={i} className="mkt-contains-chip">
              {c.item_type === 'dialogue_skin' ? 'SKIN' : 'BG'} · {c.name}
            </span>
          ))}
        </div>
        <div className="mkt-pack-footer">
          <span className="mkt-pack-price">{priceLabel}</span>
          <button type="button" className="mkt-buy-btn" onClick={() => console.log('[mock buy]', item.id)}>
            Buy Pack
          </button>
        </div>
      </div>
    </div>
  )
}
