interface Props {
  children?: never
}

const REPORT_ROWS = [
  { id: 'RPT-12', type: 'content', target: 'Neon District: Prelude', state: 'open' },
  { id: 'RPT-13', type: 'user', target: 'scene_creator_17', state: 'investigating' },
  { id: 'RPT-14', type: 'comment', target: 'chapter_5_thread', state: 'resolved' },
]

const AdminReportsPanel = (props: Props) => {
  void props

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">REPORTS</h2>
      </div>

      <section className="settings-grid">
        <article className="settings-card">
          <p className="settings-kicker">MODERATION QUEUE</p>
          <h3 className="settings-heading">Incoming reports (UI placeholder)</h3>
          <div className="settings-placeholder-list">
            {REPORT_ROWS.map((row) => (
              <div key={row.id} className="settings-placeholder-row">
                <span>{row.type.toUpperCase()} · {row.target}</span>
                <span className="settings-subtext">{row.state.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <p className="settings-kicker">QUICK ACTIONS</p>
          <h3 className="settings-heading">Moderation tools (UI placeholder)</h3>
          <div className="featured-actions">
            <button className="btn-primary" type="button">REVIEW NEXT</button>
            <button className="btn-ghost" type="button">EXPORT LOG</button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminReportsPanel
