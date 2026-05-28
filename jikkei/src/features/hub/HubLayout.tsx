// TASK-011 — The Hub: gamification home (daily claim + quests today; gacha/
// inventory/leaderboard land here later as new tabs). Kept as one file —
// each tab is a handful of lines, splitting further is premature.
import { useState } from 'react'
import DailyBanner from './DailyBanner'
import { playClick, playHover } from '@/audio/sfx'

type HubTab = 'general' | 'quests'

const TABS: { id: HubTab; label: string }[] = [
  { id: 'general', label: 'GENERAL' },
  { id: 'quests', label: 'QUESTS' },
]

interface Quest {
  id: string
  title: string
  description: string
  rewardAmount: number
  rewardType: 'coins' | 'gems'
}

// Mock — real quest completion (ad-watch SDK, backend tracking) isn't
// wired up yet. Swap for a fetched list when that lands.
const MOCK_QUESTS: Quest[] = [
  { id: 'q_watch_ad_1', title: 'Watch an Ad', description: 'Support Jikkei by watching a short ad.', rewardAmount: 5, rewardType: 'coins' },
  { id: 'q_watch_ad_2', title: 'Watch 3 Ads', description: 'Watch 3 ads today for a bonus reward.', rewardAmount: 15, rewardType: 'coins' },
  { id: 'q_watch_ad_premium', title: 'Premium Ad Watch', description: 'Watch a premium ad for a gem reward.', rewardAmount: 1, rewardType: 'gems' },
]

function GeneralTab() {
  return (
    <div className="hub-general-tab">
      <DailyBanner />
    </div>
  )
}

function QuestsTab() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  return (
    <div className="hub-quests-tab">
      <p className="hub-quests-sub">Watch ads to earn coins and gems. More quest types coming soon.</p>
      <div className="hub-quests-list">
        {MOCK_QUESTS.map((quest) => {
          const isDone = completed.has(quest.id)
          return (
            <div key={quest.id} className={`hub-quest-card ${isDone ? 'hub-quest-card-done' : ''}`}>
              <div className="hub-quest-info">
                <p className="hub-quest-title">{quest.title}</p>
                <p className="hub-quest-desc">{quest.description}</p>
              </div>
              <div className="hub-quest-right">
                <span className="hub-quest-reward">
                  {quest.rewardType === 'gems' ? '♦' : '◈'} +{quest.rewardAmount}
                </span>
                <button
                  type="button"
                  className={`hub-quest-btn ${isDone ? 'hub-quest-btn-done' : ''}`}
                  disabled={isDone}
                  onMouseEnter={playHover}
                  onClick={() => { if (isDone) return; playClick(); setCompleted((prev) => new Set(prev).add(quest.id)) }}
                >
                  {isDone ? 'Done' : 'Watch Ad'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HubLayout() {
  const [activeTab, setActiveTab] = useState<HubTab>('general')

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// THE_HUB</span>
        <h2 className="panel-title">THE HUB</h2>
      </div>

      <div className="hub-tab-bar">
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

      <div className="hub-tab-content">
        {activeTab === 'general' ? <GeneralTab /> : <QuestsTab />}
      </div>
    </div>
  )
}
