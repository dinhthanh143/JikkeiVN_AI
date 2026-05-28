interface Props {
  children?: never
}

const STATUS_ROWS = [
  { key: 'API', value: 'healthy' },
  { key: 'Database', value: 'connected' },
  { key: 'Queue', value: 'idle' },
  { key: 'Storage', value: 'normal' },
]

const AdminSystemPanel = (props: Props) => {
  void props

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">SYSTEM</h2>
      </div>

      <section className="settings-grid">
        <article className="settings-card">
          <p className="settings-kicker">PLATFORM STATUS</p>
          <h3 className="settings-heading">Runtime checks (UI placeholder)</h3>
          <div className="settings-placeholder-list">
            {STATUS_ROWS.map((row) => (
              <div key={row.key} className="settings-placeholder-row">
                <span>{row.key}</span>
                <span className="settings-subtext">{row.value.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <p className="settings-kicker">QUICK ACTIONS</p>
          <h3 className="settings-heading">Ops controls (UI placeholder)</h3>
          <div className="featured-actions">
            <button className="btn-primary" type="button">RUN HEALTH CHECK</button>
            <button className="btn-ghost" type="button">VIEW LOG STREAM</button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminSystemPanel
