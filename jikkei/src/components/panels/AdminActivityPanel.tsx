import { useEffect, useState } from 'react'
import { fetchAdminStats, fetchInactiveUsers, updateUserStatus, type AdminStats, type AdminUserRecord } from '@/services/backendApi'

const INACTIVITY_BUCKETS = [7, 14, 30, 60, 90]
const PAGE_SIZE = 20

export default function AdminActivityPanel() {
  const [inactiveDays, setInactiveDays] = useState(30)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [inactiveUsers, setInactiveUsers] = useState<AdminUserRecord[]>([])
  const [inactiveTotal, setInactiveTotal] = useState(0)
  const [inactivePage, setInactivePage] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setStatsLoading(true)
    fetchAdminStats(inactiveDays)
      .then((s) => { if (isMounted) setStats(s) })
      .finally(() => { if (isMounted) setStatsLoading(false) })
    return () => { isMounted = false }
  }, [inactiveDays])

  useEffect(() => {
    let isMounted = true
    setListLoading(true)
    setListError(null)
    fetchInactiveUsers(inactiveDays, PAGE_SIZE, (inactivePage - 1) * PAGE_SIZE)
      .then((r) => {
        if (!isMounted) return
        setInactiveUsers(r.items)
        setInactiveTotal(r.total)
      })
      .catch((error) => {
        if (!isMounted) return
        const message = error instanceof Error ? error.message : 'Failed to load inactive users.'
        setListError(message)
        setInactiveUsers([])
        setInactiveTotal(0)
      })
      .finally(() => { if (isMounted) setListLoading(false) })
    return () => { isMounted = false }
  }, [inactiveDays, inactivePage])

  // Reset to page 1 whenever the threshold changes — otherwise a stale
  // offset from a longer list can point past the end of a shorter one.
  useEffect(() => { setInactivePage(1) }, [inactiveDays])

  const handleSuspend = async (row: AdminUserRecord) => {
    if (!window.confirm(`Suspend @${row.username}? Their session will be terminated and they will not be able to log in.`)) return
    try {
      const updated = await updateUserStatus(row.id, false)
      setInactiveUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to suspend user.'
      setListError(message)
    }
  }

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">ACTIVITY</h2>
      </div>

      {/* KPI row — real data from /admin/stats */}
      <div className="admin-kpi-row" style={{ marginBottom: 24 }}>
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-kpi-card">
              <div className="settings-skeleton-block" style={{ height: 40 }} />
            </div>
          ))
        ) : stats ? (
          <>
            <div className="admin-kpi-card admin-kpi-pink">
              <p className="admin-kpi-label">TOTAL USERS</p>
              <p className="admin-kpi-value">{stats.total_users.toLocaleString()}</p>
            </div>
            <div className="admin-kpi-card admin-kpi-aqua">
              <p className="admin-kpi-label">ACTIVE</p>
              <p className="admin-kpi-value">{stats.active_users.toLocaleString()}</p>
            </div>
            <div className="admin-kpi-card admin-kpi-amber">
              <p className="admin-kpi-label">SUSPENDED</p>
              <p className="admin-kpi-value">{stats.suspended_users.toLocaleString()}</p>
            </div>
            <div className="admin-kpi-card admin-kpi-violet">
              <p className="admin-kpi-label">PUBLIC STORIES</p>
              <p className="admin-kpi-value">{stats.public_scenes.toLocaleString()}</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Inactive threshold selector + histogram */}
      <section className="settings-card settings-account-main" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="settings-kicker">INACTIVITY MONITOR</p>
            <h3 className="settings-heading">Users not seen in</h3>
          </div>
          <select
            className="admin-users-select"
            style={{ width: 'auto' }}
            value={inactiveDays}
            onChange={(e) => setInactiveDays(Number(e.target.value))}
          >
            {INACTIVITY_BUCKETS.map((days) => (
              <option key={days} value={days}>{days} days</option>
            ))}
          </select>
        </div>

        {stats && (
          <div className="admin-region-list">
            {INACTIVITY_BUCKETS.map((days) => {
              const count = stats.inactive_buckets[`inactive_${days}d`] ?? 0
              const pct = stats.active_users > 0 ? Math.round((count / stats.active_users) * 100) : 0
              return (
                <div key={days} className="admin-region-row">
                  <div className="admin-region-meta">
                    <span>Not seen in {days}d</span>
                    <span>{count.toLocaleString()} users ({pct}%)</span>
                  </div>
                  <div className="admin-region-track">
                    <span className="admin-region-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Inactive users list */}
      <section className="settings-card settings-account-main">
        <p className="settings-kicker">INACTIVE USER LIST</p>
        <h3 className="settings-heading">
          {inactiveTotal} user{inactiveTotal !== 1 ? 's' : ''} not seen in {inactiveDays}+ days
        </h3>

        <div className="admin-users-table-wrap" style={{ marginTop: 12 }}>
          <div className="admin-activity-table-head">
            <span>USERNAME</span>
            <span>EMAIL</span>
            <span>LAST SEEN</span>
            <span>LAST LOGIN</span>
            <span>STATUS</span>
            <span>ACTIONS</span>
          </div>

          {listLoading ? <p className="settings-subtext">Loading...</p> : null}
          {listError ? <p className="admin-users-error">{listError}</p> : null}

          {!listLoading && !listError && inactiveUsers.length === 0 ? (
            <p className="settings-subtext" style={{ padding: '16px 8px' }}>
              No inactive users found for this threshold.
            </p>
          ) : null}

          {!listLoading && !listError
            ? inactiveUsers.map((row) => (
                <div key={row.id} className="admin-activity-row">
                  <span className="admin-users-username">{row.username}</span>
                  <span className="admin-users-email">{row.email}</span>
                  <span className="admin-users-date">{row.last_seen_at ? new Date(row.last_seen_at).toLocaleDateString() : 'Never'}</span>
                  <span className="admin-users-date">{row.last_login_at ? new Date(row.last_login_at).toLocaleDateString() : 'Never'}</span>
                  <span className={`admin-users-chip ${row.is_active ? 'is-active' : 'is-inactive'}`}>
                    {row.is_active ? 'ACTIVE' : 'SUSPENDED'}
                  </span>
                  <div className="admin-users-actions">
                    {row.is_active && (
                      <button
                        type="button"
                        className="admin-users-action-btn admin-users-action-btn--suspend"
                        onClick={() => handleSuspend(row)}
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))
            : null}
        </div>

        {inactiveTotal > PAGE_SIZE && (
          <div className="admin-users-pagination" style={{ marginTop: 12 }}>
            <span className="settings-subtext">
              {(inactivePage - 1) * PAGE_SIZE + 1}–{Math.min(inactivePage * PAGE_SIZE, inactiveTotal)} of {inactiveTotal}
            </span>
            <div className="admin-users-page-btns">
              <button
                type="button"
                className="admin-users-page-btn"
                disabled={inactivePage === 1}
                onClick={() => setInactivePage((p) => p - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="admin-users-page-btn"
                disabled={inactivePage * PAGE_SIZE >= inactiveTotal}
                onClick={() => setInactivePage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
