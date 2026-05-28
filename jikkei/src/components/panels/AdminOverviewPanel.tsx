interface Props {
  children?: never
}

const KPI_CARDS = [
  { label: 'Active Readers', value: '12,480', tone: 'aqua', trend: '+18.4%' },
  { label: 'Stories Live', value: '162', tone: 'pink', trend: '+6.2%' },
  { label: 'Avg Session', value: '22m', tone: 'amber', trend: '+2.1%' },
  { label: 'Retention D7', value: '71%', tone: 'violet', trend: '+4.7%' },
]

const TRAFFIC_BARS = [36, 52, 44, 68, 74, 63, 88]
const REGIONS = [
  { name: 'Tokyo', share: 34 },
  { name: 'Seoul', share: 26 },
  { name: 'Taipei', share: 18 },
  { name: 'Bangkok', share: 13 },
  { name: 'Other', share: 9 },
]

const AdminOverviewPanel = (props: Props) => {
  void props

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">OVERVIEW</h2>
      </div>

      <section className="admin-overview-grid">
        <article className="admin-overview-hero">
          <p className="settings-kicker">PLATFORM HEALTH</p>
          <h3 className="settings-heading">Live Operations Snapshot</h3>
          <p className="settings-subtext">
            Fixed-data dashboard mock for admin command center. Values refresh with backend metrics in the next phase.
          </p>

          <div className="admin-kpi-row">
            {KPI_CARDS.map((card) => (
              <div key={card.label} className={`admin-kpi-card admin-kpi-${card.tone}`}>
                <p className="admin-kpi-label">{card.label}</p>
                <p className="admin-kpi-value">{card.value}</p>
                <p className="admin-kpi-trend">{card.trend}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-chart-card">
          <p className="settings-kicker">TRAFFIC WAVE (7D)</p>
          <h3 className="settings-heading">Daily Session Volume</h3>
          <div className="admin-bar-chart" aria-hidden="true">
            {TRAFFIC_BARS.map((value, index) => (
              <div key={`${value}-${index}`} className="admin-bar-wrap">
                <span className="admin-bar" style={{ height: `${value}%` }} />
              </div>
            ))}
          </div>
        </article>

        <article className="admin-chart-card">
          <p className="settings-kicker">REGIONAL MIX</p>
          <h3 className="settings-heading">Reader Distribution</h3>
          <div className="admin-region-list">
            {REGIONS.map((region) => (
              <div key={region.name} className="admin-region-row">
                <div className="admin-region-meta">
                  <span>{region.name}</span>
                  <span className="settings-subtext">{region.share}%</span>
                </div>
                <div className="admin-region-track">
                  <span className="admin-region-fill" style={{ width: `${region.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-donut-card">
          <p className="settings-kicker">CONTENT STATUS</p>
          <h3 className="settings-heading">Scene Pipeline</h3>
          <div className="admin-donut" aria-hidden="true">
            <div className="admin-donut-core">
              <span>162</span>
              <small>LIVE</small>
            </div>
          </div>
          <div className="admin-donut-legend">
            <span><i className="legend-dot legend-live" /> Live 62%</span>
            <span><i className="legend-dot legend-draft" /> Draft 24%</span>
            <span><i className="legend-dot legend-review" /> Review 14%</span>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminOverviewPanel