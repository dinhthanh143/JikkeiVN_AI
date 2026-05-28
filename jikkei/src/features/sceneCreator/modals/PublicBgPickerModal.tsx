import type { PublicBackgroundRecord } from '../../../services/backendApi'

interface Props {
  isLoading: boolean
  error: string | null
  backgrounds: PublicBackgroundRecord[]
  pageItems: PublicBackgroundRecord[]
  page: number
  totalPages: number
  pickedImageUrls: Set<string>
  onPageChange: (page: number) => void
  onPick: (bg: PublicBackgroundRecord) => void
  onClose: () => void
}

export function PublicBgPickerModal({
  isLoading,
  error,
  backgrounds,
  pageItems,
  page,
  totalPages,
  pickedImageUrls,
  onPageChange,
  onPick,
  onClose,
}: Props) {
  return (
    <div className="sc-modal-overlay" onClick={onClose}>
      <div className="sc-modal sc-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Choose a public background</h3>

        {isLoading ? (
          <p className="sc-section-hint">Loading...</p>
        ) : error ? (
          <p className="sc-error">{error}</p>
        ) : backgrounds.length === 0 ? (
          <p className="sc-section-hint">No public backgrounds available yet.</p>
        ) : (
          <>
            <div className="sc-public-bg-pager">
              <button
                type="button"
                className="sc-pager-arrow"
                disabled={page === 0}
                onClick={() => onPageChange(Math.max(0, page - 1))}
              >‹</button>
              <span className="sc-pager-label">Page {page + 1} / {totalPages}</span>
              <button
                type="button"
                className="sc-pager-arrow"
                disabled={page >= totalPages - 1}
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
              >›</button>
            </div>
            <div className="sc-public-bg-grid">
              {pageItems.map((pub) => {
                const alreadyPicked = pickedImageUrls.has(pub.image_url)
                return (
                  <button
                    key={pub.id}
                    type="button"
                    className={`sc-public-bg-item ${alreadyPicked ? 'sc-public-bg-item-picked' : ''}`}
                    onClick={() => { if (!alreadyPicked) onPick(pub) }}
                    disabled={alreadyPicked}
                    aria-disabled={alreadyPicked}
                    title={alreadyPicked ? 'Already added to this story' : undefined}
                  >
                    <img src={pub.image_url} alt={pub.name} />
                    <span>{pub.name}</span>
                    {alreadyPicked && <span className="sc-public-bg-picked-badge">Added</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="sc-modal-actions">
          <button type="button" className="sc-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
