// TASK-12.3 — browse/filter/sort/paginate shop items. Uses MOCK_SHOP_ITEMS
// by default (client-side filtering); swap the `source` array for a fetched
// list from GET /api/shop/items once the real endpoint is wired to the UI —
// the filter/sort/paginate logic below is written to match that endpoint's
// query params 1:1 (search, item_type, rarity, sort) so the swap is a
// data-source change only, not a logic rewrite.
import { useEffect, useMemo, useState } from 'react'
import { MOCK_SHOP_ITEMS } from '../mockData'
import type { ItemType, Rarity, ShopItem } from '../types'

export type ShopSort = 'price_asc' | 'price_desc' | 'newest' | 'rarity'

interface UseShopItemsOptions {
  // Restrict to one bucket ('bundle' for the Packs section, or a list of the
  // other types for the Items section). Leave undefined for no restriction.
  restrictTypes?: ItemType[]
  pageSize?: number
}

const RARITY_ORDER: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
const price = (item: ShopItem) => item.price_coins ?? item.price_gems ?? 0

export function useShopItems({ restrictTypes, pageSize = 8 }: UseShopItemsOptions = {}) {
  const [search, setSearch] = useState('')
  const [itemType, setItemType] = useState<ItemType | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [sort, setSort] = useState<ShopSort>('price_asc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Mimics the async shape of a real fetch so swapping in useQuery later is a
  // drop-in change; mock data resolves on next tick.
  // restrictTypes intentionally excluded — it's fixed per call site (Packs
  // vs Items section), not something the user changes, so it shouldn't be a
  // dependency here. (An earlier version depended on it by reference, which
  // broke the moment a call site passed an inline array literal — new
  // reference every render → effect fires → setLoading → re-render → new
  // array → infinite loop. Root-caused and fixed in MarketTab.tsx by
  // hoisting the arrays to module scope, but dropping it here too so this
  // class of bug can't come back through a future call site.)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, itemType, rarity, sort])

  useEffect(() => { setPage(1) }, [search, itemType, rarity, sort])

  const filtered = useMemo(() => {
    let result = MOCK_SHOP_ITEMS.filter((i) => i.is_active)
    if (restrictTypes) result = result.filter((i) => restrictTypes.includes(i.item_type))
    if (itemType !== 'all') result = result.filter((i) => i.item_type === itemType)
    if (rarity !== 'all') result = result.filter((i) => i.rarity === rarity)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    result = [...result]
    if (sort === 'price_asc') result.sort((a, b) => price(a) - price(b))
    else if (sort === 'price_desc') result.sort((a, b) => price(b) - price(a))
    else if (sort === 'rarity') result.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
    // 'newest' — mock data has no created_at; keep insertion order.
    return result
  }, [itemType, rarity, search, sort]) // eslint-disable-line react-hooks/exhaustive-deps -- restrictTypes fixed per call site, see note above

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return {
    items: paged,
    loading,
    page, setPage, totalPages,
    search, setSearch,
    itemType, setItemType,
    rarity, setRarity,
    sort, setSort,
  }
}
