interface Props {
  children?: never
}

const SCENE_ROWS = [
  { id: 'SCN-301', title: 'Neon District: Prelude', status: 'published' },
  { id: 'SCN-302', title: 'Signal at Zero', status: 'draft' },
  { id: 'SCN-303', title: 'Archive of Echoes', status: 'scheduled' },
]

const AdminScenesPanel = (props: Props) => {
  void props

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">SCENES</h2>
      </div>

      <section className="settings-grid">
        <article className="settings-card">
          <p className="settings-kicker">VISUAL NOVELS</p>
          <h3 className="settings-heading">Scene registry (UI placeholder)</h3>
          <div className="settings-placeholder-list">
            {SCENE_ROWS.map((row) => (
              <div key={row.id} className="settings-placeholder-row">
                <span>{row.title}</span>
                <span className="settings-subtext">{row.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <p className="settings-kicker">QUICK ACTIONS</p>
          <h3 className="settings-heading">Content controls (UI placeholder)</h3>
          <div className="featured-actions">
            <button className="btn-primary" type="button">NEW SCENE</button>
            <button className="btn-ghost" type="button">BULK PUBLISH</button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminScenesPanel
