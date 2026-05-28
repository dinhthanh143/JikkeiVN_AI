// TASK-12.3 — Marketplace shell: tab bar (reuses HomePage.css's global
// .settings-tab-btn button styling, but defines local .mkt-tab-bar/
// .mkt-tab-content wrappers rather than HubLayout's .hub-tab-bar/
// .hub-tab-content, since those only exist once HubPage.css has loaded —
// Marketplace can be a direct nav target without ever visiting the Hub)
// + always-visible BalanceBar + active tab content.
import { useState } from 'react'
import BalanceBar from './BalanceBar'
import MarketTab from './tabs/MarketTab'
import NightMarketTab from './tabs/NightMarketTab'
import ExchangeTab from './tabs/ExchangeTab'
import { playClick, playHover } from '@/audio/sfx'
import type { MarketplaceTab } from '../types'

const TABS: { id: MarketplaceTab; label: string }[] = [
  { id: 'market', label: 'MARKET' },
  { id: 'night_market', label: 'NIGHT MARKET' },
  { id: 'exchange', label: 'EXCHANGE' },
]

export default function MarketplaceLayout() {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('market')

  return (
    <div className="panel-content mkt-root">
      <div className="panel-header">
        <span className="panel-eyebrow">// MARKETPLACE</span>
        <h2 className="panel-title">MARKETPLACE</h2>
      </div>

      <div className="mkt-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab-btn ${activeTab === tab.id ? 'settings-tab-btn-active' : ''}`}
            onMouseEnter={playHover}
            onClick={() => { playClick(); setActiveTab(tab.id) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <BalanceBar />

      <div className="mkt-tab-content">
        {activeTab === 'market' && <MarketTab />}
        {activeTab === 'night_market' && <NightMarketTab />}
        {activeTab === 'exchange' && <ExchangeTab />}
      </div>
    </div>
  )
}
