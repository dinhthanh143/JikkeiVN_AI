import type { ItemType, Rarity } from '../../types'
import type { ShopSort } from '../../hooks/useShopItems'

interface MarketToolbarProps {
  search: string; setSearch: (v: string) => void
  itemType: ItemType | 'all'; setItemType: (v: ItemType | 'all') => void
  rarity: Rarity | 'all'; setRarity: (v: Rarity | 'all') => void
  sort: ShopSort; setSort: (v: ShopSort) => void
}

export default function MarketToolbar({ search, setSearch, itemType, setItemType, rarity, setRarity, sort, setSort }: MarketToolbarProps) {
  return (
    <div className="mkt-toolbar">
      <input
        className="mkt-search-input"
        placeholder="Search items..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select className="mkt-filter-select" value={itemType} onChange={(e) => setItemType(e.target.value as ItemType | 'all')}>
        <option value="all">All types</option>
        <option value="background_pack">Backgrounds</option>
        <option value="dialogue_skin">Dialogue Skins</option>
        <option value="bundle">Bundles</option>
      </select>
      <select className="mkt-filter-select" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | 'all')}>
        <option value="all">All rarities</option>
        <option value="common">Common</option>
        <option value="rare">Rare</option>
        <option value="epic">Epic</option>
        <option value="legendary">Legendary</option>
      </select>
      <select className="mkt-filter-select" value={sort} onChange={(e) => setSort(e.target.value as ShopSort)}>
        <option value="price_asc">Price ↑</option>
        <option value="price_desc">Price ↓</option>
        <option value="newest">Newest</option>
        <option value="rarity">Rarity</option>
      </select>
    </div>
  )
}
