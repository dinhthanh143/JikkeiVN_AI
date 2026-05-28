import type { NightMarketSlot } from '../../types'

export default function NightMarketBox({ slot, onReveal }: { slot: NightMarketSlot; onReveal: (idx: number) => void }) {
  const empty = !slot.item
  const item = slot.item

  const discountedPrice = item
    ? item.price_gems != null
      ? Math.round(item.price_gems * (1 - slot.discount_pct / 100))
      : item.price_coins != null
        ? Math.round(item.price_coins * (1 - slot.discount_pct / 100))
        : null
    : null
  const originalPrice = item ? (item.price_gems ?? item.price_coins) : null
  const currencyIcon = item?.price_gems != null ? '💎' : '◈'

  return (
    <div
      className={`nm-box ${slot.is_revealed ? 'revealed' : ''} ${empty ? 'nm-box-empty' : ''}`}
      onClick={() => { if (!empty && !slot.is_revealed) onReveal(slot.slot_index) }}
    >
      <div className="nm-box-inner">
        <div className="nm-box-front">
          <span className="nm-box-symbol">{empty ? '—' : '✦'}</span>
        </div>
        <div className="nm-box-back" style={item ? { backgroundImage: `url(${item.metadata.preview_url})` } : undefined}>
          {item && (
            <div className="nm-box-back-info">
              {slot.is_night_market_only && <span className="nm-only-badge">NIGHT MARKET ONLY</span>}
              <p className="nm-box-item-name">{item.name}</p>
              <div className="nm-box-price-row">
                <span className="nm-box-price-discounted">{currencyIcon} {discountedPrice?.toLocaleString()}</span>
                {originalPrice != null && <span className="nm-box-price-original">{currencyIcon} {originalPrice.toLocaleString()}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
