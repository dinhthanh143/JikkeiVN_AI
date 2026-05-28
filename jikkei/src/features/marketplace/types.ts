export type ItemType = 'background_pack' | 'dialogue_skin' | 'bundle'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type AcquiredVia = 'purchase' | 'gacha' | 'quest_reward' | 'night_market' | 'gift'

export interface ShopItemContains {
  item_type: ItemType
  name: string
  preview: string
}

export interface ShopItemMetadata {
  preview_url?: string
  backgrounds?: string[]
  theme_key?: string
  contains?: ShopItemContains[]
  tag?: string
  badge_color?: string
  coming_soon?: boolean
}

export interface ShopItem {
  id: string
  name: string
  description: string | null
  item_type: ItemType
  price_coins: number | null
  price_gems: number | null
  available_from: string | null
  available_until: string | null
  is_active: boolean
  is_night_market_eligible: boolean
  rarity: Rarity
  metadata: ShopItemMetadata
}

export interface NightMarketSlot {
  slot_index: number
  shop_item_id: string | null
  discount_pct: number
  is_night_market_only: boolean
  is_revealed: boolean
  is_purchased: boolean
  item: ShopItem | null
}

export interface NightMarketData {
  week_start: string
  next_reset: string
  slots: NightMarketSlot[]
}

export type MarketplaceTab = 'market' | 'night_market' | 'exchange'
