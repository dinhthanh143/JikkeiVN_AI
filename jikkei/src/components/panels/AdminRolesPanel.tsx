interface Props {
  children?: never
}

const ROLE_ROWS = [
  { role: 'admin', members: 2, permissions: 'full access' },
  { role: 'editor', members: 8, permissions: 'content + scene edits' },
  { role: 'moderator', members: 5, permissions: 'reports + flags' },
]

const AdminRolesPanel = (props: Props) => {
  void props

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">ROLES</h2>
      </div>

      <section className="settings-grid">
        <article className="settings-card">
          <p className="settings-kicker">ACCESS CONTROL</p>
          <h3 className="settings-heading">Role matrix (UI placeholder)</h3>
          <div className="settings-placeholder-list">
            {ROLE_ROWS.map((row) => (
              <div key={row.role} className="settings-placeholder-row">
                <span>{row.role.toUpperCase()} · {row.members} members</span>
                <span className="settings-subtext">{row.permissions.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <p className="settings-kicker">QUICK ACTIONS</p>
          <h3 className="settings-heading">Permission tools (UI placeholder)</h3>
          <div className="featured-actions">
            <button className="btn-primary" type="button">CREATE ROLE</button>
            <button className="btn-ghost" type="button">EDIT PERMISSIONS</button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminRolesPanel
