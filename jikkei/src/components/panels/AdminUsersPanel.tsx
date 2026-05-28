import { useEffect, useMemo, useState } from 'react'

import { fetchAdminUsers, updateUserStatus, type AdminUserRecord } from '@/services/backendApi'

interface Props {
  children?: never
}

type RoleFilter = 'all' | 'user' | 'admin'
type StatusFilter = 'all' | 'active' | 'inactive'

// Always show first, last, and a window around current — collapses the
// rest into an ellipsis so the pager stays a fixed width regardless of
// total page count.
function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

const AdminUsersPanel = (props: Props) => {
  void props

  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)

  const [rows, setRows] = useState<AdminUserRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim())
      setOffset(0)
    }, 280)

    return () => window.clearTimeout(timer)
  }, [queryInput])

  useEffect(() => {
    let isMounted = true

    const loadUsers = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetchAdminUsers({
          q: query || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
          is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
          limit,
          offset,
        })

        if (!isMounted) {
          return
        }

        setRows(response.items)
        setTotal(response.total)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load users.'
        setErrorMessage(message)
        setRows([])
        setTotal(0)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      isMounted = false
    }
  }, [limit, offset, query, roleFilter, statusFilter])

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = total === 0 ? 0 : Math.min(offset + rows.length, total)

  const headerMeta = useMemo(() => {
    if (total === 0) {
      return '0 users'
    }
    return `${pageStart}-${pageEnd} of ${total}`
  }, [pageEnd, pageStart, total])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1

  const handleToggleStatus = async (row: AdminUserRecord) => {
    if (togglingId) return
    const action = row.is_active ? 'Suspend' : 'Reinstate'
    const confirmed = window.confirm(
      `${action} @${row.username}? ${row.is_active
        ? 'Their session will be terminated and they will not be able to log in.'
        : 'They will be able to log in again.'}`
    )
    if (!confirmed) return
    setTogglingId(row.id)
    try {
      const updated = await updateUserStatus(row.id, !row.is_active)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action.toLowerCase()} user.`
      setErrorMessage(message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// WEB_MANAGEMENT</span>
        <h2 className="panel-title">USERS</h2>
      </div>

      <section className="settings-grid">
        <article className="settings-card settings-account-main">
          <p className="settings-kicker">USER DIRECTORY</p>
          <h3 className="settings-heading">Live user accounts</h3>

          <div className="admin-users-toolbar">
            <label className="admin-users-field">
              <span>SEARCH</span>
              <input
                type="text"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="username or email"
                className="admin-users-input"
              />
            </label>

            <label className="admin-users-field">
              <span>ROLE</span>
              <select
                className="admin-users-select"
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as RoleFilter)
                  setOffset(0)
                }}
              >
                <option value="all">All</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </label>

            <label className="admin-users-field">
              <span>STATUS</span>
              <select
                className="admin-users-select"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter)
                  setOffset(0)
                }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
            </label>

            <label className="admin-users-field">
              <span>PAGE SIZE</span>
              <select
                className="admin-users-select"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value))
                  setOffset(0)
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>

          <div className="admin-users-table-wrap">
            <div className="admin-users-table-head">
              <span>USERNAME</span>
              <span>EMAIL</span>
              <span>ROLE</span>
              <span>STATUS</span>
              <span>LAST SEEN</span>
              <span>ACTIONS</span>
            </div>

            {isLoading ? <p className="settings-subtext">Loading users...</p> : null}
            {errorMessage ? <p className="admin-users-error">{errorMessage}</p> : null}

            {!isLoading && !errorMessage && rows.length === 0 ? <p className="settings-subtext">No users found.</p> : null}

            {!isLoading && !errorMessage
              ? rows.map((row) => (
                  <div key={row.id} className="admin-users-row">
                    <span className="admin-users-username">{row.username}</span>
                    <span className="admin-users-email">{row.email}</span>
                    <span className="admin-users-chip">{row.role.toUpperCase()}</span>
                    <span className={`admin-users-chip ${row.is_active ? 'is-active' : 'is-inactive'}`}>
                      {row.is_active ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                    <span className="admin-users-date">
                      {row.last_seen_at
                        ? new Date(row.last_seen_at).toLocaleDateString()
                        : row.last_login_at
                          ? new Date(row.last_login_at).toLocaleDateString()
                          : '—'}
                    </span>
                    <div className="admin-users-actions">
                      <button
                        type="button"
                        className={`admin-users-action-btn ${row.is_active ? 'admin-users-action-btn--suspend' : 'admin-users-action-btn--reinstate'}`}
                        onClick={() => handleToggleStatus(row)}
                        disabled={togglingId === row.id}
                      >
                        {togglingId === row.id ? '...' : row.is_active ? 'Suspend' : 'Reinstate'}
                      </button>
                    </div>
                  </div>
                ))
              : null}
          </div>

          <div className="admin-users-pagination">
            <span className="settings-subtext">{headerMeta}</span>
            <div className="admin-users-page-btns">
              <button
                type="button"
                className="admin-users-page-btn"
                disabled={currentPage === 1 || isLoading}
                onClick={() => setOffset(0)}
              >
                «
              </button>
              {getPageNumbers(currentPage, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="admin-users-page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`admin-users-page-btn ${p === currentPage ? 'admin-users-page-btn--active' : ''}`}
                    disabled={isLoading}
                    onClick={() => setOffset((p - 1) * limit)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-users-page-btn"
                disabled={currentPage === totalPages || isLoading}
                onClick={() => setOffset((totalPages - 1) * limit)}
              >
                »
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}

export default AdminUsersPanel
