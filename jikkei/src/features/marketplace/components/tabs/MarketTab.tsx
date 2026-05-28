import { useShopItems } from '../../hooks/useShopItems'
import SkeletonCard from '../SkeletonCard'
import PackCard from '../market/PackCard'
import ItemCard from '../market/ItemCard'
import MarketToolbar from '../market/MarketToolbar'
import type { ItemType } from '../../types'

// Hoisted to module scope so the reference is stable across renders — an
// inline array literal here would be a *new* array every render, and since
// useShopItems' internal useEffect depends on restrictTypes by reference,
// that was causing setLoading -> re-render -> new array -> effect fires ->
// setLoading -> ... forever (the infinite-render bug).
const PACK_TYPES: ItemType[] = ['bundle']
const ITEM_TYPES: ItemType[] = ['background_pack', 'dialogue_skin']

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="mkt-pagination">
      <button type="button" className="mkt-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="mkt-page-info">Page {page} of {totalPages}</span>
      <button type="button" className="mkt-page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  )
}

export default function MarketTab() {
  const packs = useShopItems({ restrictTypes: PACK_TYPES, pageSize: 4 })
  const items = useShopItems({ restrictTypes: ITEM_TYPES, pageSize: 8 })

  return (
    <div className="mkt-market-tab">
      <section>
        <h3 className="mkt-section-heading">// FEATURED_PACKS</h3>
        {packs.loading ? (
          <div className="mkt-pack-grid">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} variant="pack" />)}
          </div>
        ) : packs.items.length === 0 ? (
          <p className="mkt-empty-text">No packs available.</p>
        ) : (
          <>
            <div className="mkt-pack-grid">
              {packs.items.map((item) => <PackCard key={item.id} item={item} />)}
            </div>
            <Pager page={packs.page} totalPages={packs.totalPages} onChange={packs.setPage} />
          </>
        )}
      </section>

      <hr className="mkt-section-rule" />

      <section>
        <h3 className="mkt-section-heading">// ITEMS</h3>
        <MarketToolbar
          search={items.search} setSearch={items.setSearch}
          itemType={items.itemType} setItemType={items.setItemType}
          rarity={items.rarity} setRarity={items.setRarity}
          sort={items.sort} setSort={items.setSort}
        />
        {items.loading ? (
          <div className="mkt-item-grid">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} variant="item" />)}
          </div>
        ) : items.items.length === 0 ? (
          <p className="mkt-empty-text">No items match your filters.</p>
        ) : (
          <>
            <div className="mkt-item-grid">
              {items.items.map((item) => <ItemCard key={item.id} item={item} />)}
            </div>
            <Pager page={items.page} totalPages={items.totalPages} onChange={items.setPage} />
          </>
        )}
      </section>
    </div>
  )
}
