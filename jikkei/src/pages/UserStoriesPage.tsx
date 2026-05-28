import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchUserProfile,
  fetchUserPublicStories,
  type SceneDetailRecord,
} from '@/services/backendApi'

type NsfwFilter = 'all' | 'nsfw' | 'sfw'
type TierFilter = 'all' | 'free' | 'premium'
type ModeFilter = 'all' | 'normal' | 'survival'
type SortBy = 'most_played' | 'newest' | 'oldest'

// ── Story preview card + modal — same read-only shape as ProfilePage's ─────

interface StoryModalProps {
  story: SceneDetailRecord
  onClose: () => void
  onPlay: (id: string) => void
}

function StoryModal({ story, onClose, onPlay }: StoryModalProps) {
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const backgroundNames = story.backgrounds.map((b) => b.name)
  const characterNames = story.characters.map((c) => c.name)
  const createdDate = new Date(story.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return createPortal(
    <div className="jk-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="story-modal-title" onClick={handleOverlayClick}>
      <div className="jk-modal-card story-modal-card">
        <button type="button" className="story-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="story-modal-body">
          <div className="story-modal-cover-wrap">
            {story.scene_cover ? (
              <img src={story.scene_cover} alt={story.title} className="story-modal-cover-img" />
            ) : (
              <div className="story-modal-cover-placeholder"><span>✦</span></div>
            )}
            {story.game_mode === 'survival' && <span className="story-modal-mode-badge">HARDCORE</span>}
          </div>
          <div className="story-modal-info">
            <h3 id="story-modal-title" className="story-modal-title">{story.title}</h3>
            <div className="story-modal-tier-row">
              <span className={`story-modal-tier-badge story-modal-tier-${story.tier}`}>
                {story.tier === 'premium' ? '★ PREMIUM' : '✦ FREE'}
              </span>
              {story.is_nsfw && <span className="story-modal-nsfw-badge">NSFW</span>}
            </div>
            <div className="story-modal-desc-wrap">
              <p className="story-modal-desc">{story.description}</p>
            </div>
            <div className="story-modal-meta">
              {characterNames.length > 0 && (
                <>
                  <div className="story-modal-meta-row">
                    <span className="story-modal-meta-label">Characters</span>
                    <span className="story-modal-meta-count">{characterNames.length}</span>
                  </div>
                  <div className="story-modal-char-list">
                    {characterNames.map((name, idx) => <span key={idx} className="story-modal-char-chip">{name}</span>)}
                  </div>
                </>
              )}
              {backgroundNames.length > 0 && (
                <>
                  <div className="story-modal-meta-row" style={{ marginTop: characterNames.length > 0 ? 10 : 0 }}>
                    <span className="story-modal-meta-label">Backgrounds</span>
                    <span className="story-modal-meta-count">{backgroundNames.length}</span>
                  </div>
                  <div className="story-modal-char-list">
                    {backgroundNames.map((name, idx) => <span key={idx} className="story-modal-char-chip">{name}</span>)}
                  </div>
                </>
              )}
              <div className="story-modal-meta-row" style={{ marginTop: 10 }}>
                <span className="story-modal-meta-label">Gamemode</span>
                <span className="story-modal-meta-value">{story.game_mode === 'survival' ? 'HARDCORE' : 'NORMAL'}</span>
              </div>
              <div className="story-modal-meta-row" style={{ marginTop: 10 }}>
                <span className="story-modal-meta-label">Created At</span>
                <span className="story-modal-meta-value">{createdDate}</span>
              </div>
            </div>
            <div className="story-modal-actions">
              <button type="button" className="jk-modal-btn jk-modal-btn-confirm story-play-btn" onClick={() => onPlay(story.id)}>▶ PLAY NOW</button>
              <button type="button" className="jk-modal-btn" onClick={onClose}>CLOSE</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface StoryCardProps {
  story: SceneDetailRecord
  onClick: (story: SceneDetailRecord) => void
}

function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <button type="button" className="story-card" onClick={() => onClick(story)} title={story.title}>
      <div className="story-card-cover">
        {story.scene_cover ? (
          <img src={story.scene_cover} alt={story.title} className="story-card-img" />
        ) : (
          <div className="story-card-cover-placeholder"><span>✦</span></div>
        )}
        {story.game_mode === 'survival' && <span className="story-card-badge">HARDCORE</span>}
        <div className="story-card-hover-overlay"><span className="story-card-play-icon">▶</span></div>
        <div className="story-card-bottom-overlay">
          <p className="story-card-title">{story.title}</p>
        </div>
      </div>
    </button>
  )
}

const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE_PUBLIC_STORIES) || 24

export default function UserStoriesPage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const [selectedStory, setSelectedStory] = useState<SceneDetailRecord | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterNsfw, setFilterNsfw] = useState<NsfwFilter>('all')
  const [filterTier, setFilterTier] = useState<TierFilter>('all')
  const [filterMode, setFilterMode] = useState<ModeFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('most_played')
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, filterNsfw, filterTier, filterMode, sortBy])

  // Slim profile header — React Query caches this under the same key
  // ProfilePage uses, so if the user came from there it's already warm.
  const { data: profile } = useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => fetchUserProfile(username!),
    enabled: !!username,
  })

  const queryParams = {
    search: search.trim() || undefined,
    nsfw: filterNsfw !== 'all' ? filterNsfw : undefined,
    tier: filterTier !== 'all' ? filterTier : undefined,
    game_mode: filterMode !== 'all' ? filterMode : undefined,
    sort: sortBy,
    page,
    page_size: PAGE_SIZE,
  }

  const {
    data: stories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['userStories', username, queryParams],
    queryFn: () => fetchUserPublicStories(username!, queryParams),
    enabled: !!username,
  })

  useEffect(() => {
    setHasNextPage(stories.length === PAGE_SIZE)
  }, [stories])

  const filtersActive = !!search.trim() || filterNsfw !== 'all' || filterTier !== 'all' || filterMode !== 'all'

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setFilterNsfw('all')
    setFilterTier('all')
    setFilterMode('all')
  }

  const handlePlay = (id: string) => navigate(`/story/${id}`)

  const displayName = profile?.display_name || profile?.username || username || ''
  const initials = (profile?.username ?? '?').charAt(0).toUpperCase()

  return (
    <>
      <div className="panel-content play-panel-content">
        <div className="us-header">
          <span className="panel-eyebrow">// USER_STORIES</span>
          <div className="us-header-row">
            {profile && (
              <Link to={`/profile/${profile.username}`} className="us-profile-chip">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="us-profile-avatar" />
                ) : (
                  <span className="us-profile-avatar us-profile-avatar-initials">{initials}</span>
                )}
                <span className="us-profile-name">{displayName}</span>
                {profile.username && <span className="us-profile-handle">@{profile.username}</span>}
                <span className={`user-tier user-tier-${profile.tier}`}>
                  {profile.tier === 'premium' ? 'Premium' : 'Free'}
                </span>
              </Link>
            )}
            <Link to={username ? `/profile/${username}` : '/'} className="us-back-link">← Back to profile</Link>
          </div>
        </div>

        <div className="play-toolbar">
          <div className="play-search-wrap">
            <span className="play-search-icon">⌕</span>
            <input
              className="play-search-input"
              placeholder="Search by title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" className="play-search-clear" onClick={() => setSearchInput('')}>✕</button>
            )}
          </div>

          <div className="play-filter-row">
            <select className="play-filter-select" value={filterNsfw} onChange={(e) => setFilterNsfw(e.target.value as NsfwFilter)}>
              <option value="all">All ratings</option>
              <option value="sfw">SFW only</option>
              <option value="nsfw">NSFW only</option>
            </select>

            <select className="play-filter-select" value={filterTier} onChange={(e) => setFilterTier(e.target.value as TierFilter)}>
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>

            <select className="play-filter-select" value={filterMode} onChange={(e) => setFilterMode(e.target.value as ModeFilter)}>
              <option value="all">All modes</option>
              <option value="normal">Normal</option>
              <option value="survival">Hardcore</option>
            </select>

            <select className="play-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="most_played">Most played</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <section className="play-section">
          {isLoading ? (
            <div className="play-empty-state">
              <span className="play-empty-icon">⧗</span>
              <p className="play-empty-text">Loading stories...</p>
            </div>
          ) : error ? (
            <div className="play-empty-state">
              <span className="play-empty-icon">✗</span>
              <p className="play-empty-text">Failed to load stories</p>
            </div>
          ) : stories.length === 0 ? (
            filtersActive ? (
              <div className="play-empty-state">
                <span className="play-empty-icon">⌕</span>
                <p className="play-empty-text">No stories match your filters.</p>
                <button type="button" className="play-retry-btn" onClick={resetFilters}>Clear filters</button>
              </div>
            ) : (
              <div className="play-empty-state">
                <span className="play-empty-icon">⬡</span>
                <p className="play-empty-text">No public stories yet.</p>
              </div>
            )
          ) : (
            <>
              <div className="story-grid">
                {stories.map((story) => (
                  <StoryCard key={story.id} story={story} onClick={setSelectedStory} />
                ))}
              </div>
              <div className="play-pagination">
                <button type="button" className="play-page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span className="play-page-info">Page {page}</span>
                <button type="button" className="play-page-btn" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            </>
          )}
        </section>
      </div>

      {selectedStory && (
        <StoryModal story={selectedStory} onClose={() => setSelectedStory(null)} onPlay={handlePlay} />
      )}

      <style>{`
        .play-panel-content { display: flex; flex-direction: column; gap: 24px; padding-bottom: 32px; }
        .us-header { display: flex; flex-direction: column; gap: 10px; }
        .us-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .us-profile-chip { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 4px 10px 4px 4px; border-radius: 999px; background: rgba(255,211,225,0.4); border: 1px solid rgba(255,133,179,0.3); transition: background 160ms ease; }
        .us-profile-chip:hover { background: rgba(255,211,225,0.7); }
        .us-profile-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: linear-gradient(135deg,#ffd3e1,#ffb6c1); }
        .us-profile-avatar-initials { display: flex; align-items: center; justify-content: center; font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 1rem; font-weight: 700; color: #5a1a4a; }
        .us-profile-name { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 0.9rem; font-weight: 700; color: #5a1a4a; }
        .us-profile-handle { font-family: var(--font-mono, monospace); font-size: 0.68rem; color: rgba(90,26,74,0.5); }
        .us-back-link { font-family: var(--font-mono, monospace); font-size: 0.72rem; font-weight: 700; color: #f472b6; letter-spacing: 0.06em; text-decoration: none; }
        .us-back-link:hover { color: #e879a8; text-decoration: underline; }
        .play-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
        .play-search-wrap { position: relative; display: flex; align-items: center; }
        .play-search-icon { position: absolute; left: 12px; color: rgba(90,26,74,0.45); font-size: 1rem; pointer-events: none; }
        .play-search-input { width: 100%; padding: 9px 36px 9px 34px; border: 1.5px solid rgba(255,133,179,0.5); border-radius: 999px; background: rgba(255,236,246,0.7); color: #5a1a4a; font-family: var(--font-ui, sans-serif); font-size: 0.85rem; outline: none; transition: border-color 180ms ease; }
        .play-search-input:focus { border-color: #f472b6; }
        .play-search-clear { position: absolute; right: 12px; background: none; border: none; color: rgba(90,26,74,0.45); cursor: pointer; font-size: 0.75rem; padding: 2px; }
        .play-filter-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .play-filter-select { padding: 6px 12px; border: 1.5px solid rgba(255,133,179,0.5); border-radius: 999px; background: rgba(255,236,246,0.7); color: #5a1a4a; font-family: var(--font-ui, sans-serif); font-size: 0.78rem; font-weight: 600; cursor: pointer; outline: none; transition: border-color 180ms ease; }
        .play-filter-select:focus { border-color: #f472b6; }
        .play-pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 12px; }
        .play-page-btn { padding: 6px 16px; border: 1.5px solid rgba(255,133,179,0.6); border-radius: 999px; background: rgba(255,236,246,0.8); color: #5a1a4a; font-family: var(--font-ui, sans-serif); font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 160ms ease; }
        .play-page-btn:hover:not(:disabled) { border-color: #f472b6; background: rgba(255,204,226,1); }
        .play-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .play-page-info { font-family: var(--font-mono, monospace); font-size: 0.72rem; color: #7a2a62; letter-spacing: 0.06em; }
        .play-section { display: flex; flex-direction: column; gap: 18px; }
        .play-retry-btn { margin-top: 4px; padding: 7px 20px; border: 1.5px solid rgba(255, 133, 179, 0.7); background: rgba(255, 223, 236, 0.7); color: #5a1a4a; font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; border-radius: 999px; cursor: pointer; transition: all 180ms ease; }
        .play-retry-btn:hover { background: rgba(255, 204, 226, 1); border-color: #f472b6; transform: translateY(-1px); }
        .story-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; }
        .story-card { position: relative; display: flex; flex-direction: column; background: none; border: none; padding: 0; cursor: pointer; text-align: left; border-radius: 14px; overflow: hidden; transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1); }
        .story-card:hover { transform: translateY(-5px); }
        .story-card:hover .story-card-hover-overlay { opacity: 1; }
        .story-card:hover .story-card-img { transform: scale(1.05); }
        .story-card:hover .story-card-cover { box-shadow: 0 12px 32px rgba(244, 114, 182, 0.35); border-color: #f472b6; }
        .story-card-cover { position: relative; aspect-ratio: 2 / 3; width: 100%; overflow: hidden; border-radius: 14px; border: 2px solid rgba(255, 133, 179, 0.45); background: linear-gradient(135deg, rgba(255, 211, 225, 0.7), rgba(255, 182, 193, 0.7)); box-shadow: 0 4px 14px rgba(244, 114, 182, 0.12); transition: border-color 220ms ease, box-shadow 220ms ease; display: flex; flex-direction: column; justify-content: flex-end; }
        .story-card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 340ms cubic-bezier(0.4, 0, 0.2, 1); }
        .story-card-cover-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(244, 114, 182, 0.06) 10px, rgba(244, 114, 182, 0.06) 11px); font-size: 2rem; color: rgba(244, 114, 182, 0.3); }
        .story-card-hover-overlay { position: absolute; inset: 0; background: rgba(255, 182, 193, 0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 200ms ease; backdrop-filter: blur(1px); }
        .story-card-play-icon { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, rgba(255, 223, 236, 0.97), rgba(255, 194, 218, 0.97)); border: 2px solid rgba(255, 133, 179, 0.85); box-shadow: 0 6px 20px rgba(244, 114, 182, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1rem; color: #5a1a4a; }
        .story-card-badge { position: absolute; top: 8px; left: 8px; font-family: var(--font-mono, monospace); font-size: 0.52rem; letter-spacing: 0.1em; font-weight: 700; background: #5a1a4a; color: #fde8f5; padding: 3px 8px; border-radius: 999px; z-index: 2; }
        .story-card-bottom-overlay { position: relative; z-index: 3; padding: 28px 8px 8px; background: linear-gradient(to top, rgba(90, 26, 74, 0.82) 0%, transparent 100%); }
        .story-card-title { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 0.75rem; font-weight: 700; color: #fff; letter-spacing: 0.02em; line-height: 1.3; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .play-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 36px 20px; border: 2px dashed rgba(255, 133, 179, 0.4); border-radius: 18px; background: rgba(255, 211, 225, 0.15); text-align: center; }
        .play-empty-icon { font-size: 1.8rem; color: rgba(244, 114, 182, 0.4); }
        .play-empty-text { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 0.95rem; font-weight: 700; color: #7a2a62; margin: 0; }
        .jk-modal-overlay { position: fixed; inset: 0; background: rgba(90, 26, 74, 0.35); backdrop-filter: blur(6px); z-index: 1600; display: flex; align-items: center; justify-content: center; padding: 24px; animation: jkModalOverlayIn 240ms ease-out; }
        @keyframes jkModalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .jk-modal-card { width: min(460px, 88vw); border: 2px solid rgba(255, 133, 179, 0.88); background: linear-gradient(160deg, rgba(255, 236, 246, 0.98), rgba(255, 204, 226, 0.98)); box-shadow: 0 22px 58px rgba(10, 10, 15, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.75); padding: 22px 22px 20px; border-radius: 22px; animation: jkModalCardIn 280ms cubic-bezier(0.22, 1, 0.36, 1); position: relative; }
        @keyframes jkModalCardIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .story-modal-card { width: min(720px, 92vw); padding: 0; overflow: hidden; }
        .story-modal-close { position: absolute; top: 14px; right: 16px; z-index: 10; background: rgba(255, 211, 225, 0.7); border: 1px solid rgba(255, 133, 179, 0.5); color: #5a1a4a; width: 30px; height: 30px; border-radius: 50%; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 180ms ease; }
        .story-modal-close:hover { background: rgba(255, 133, 179, 0.3); border-color: #f472b6; transform: scale(1.1); }
        .story-modal-body { display: flex; min-height: 380px; }
        .story-modal-cover-wrap { position: relative; width: 240px; flex-shrink: 0; overflow: hidden; border-radius: 20px 0 0 20px; }
        .story-modal-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .story-modal-cover-placeholder { width: 100%; height: 100%; min-height: 380px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255, 211, 225, 0.8), rgba(255, 182, 193, 0.8)); font-size: 3rem; color: rgba(244, 114, 182, 0.4); }
        .story-modal-mode-badge { position: absolute; bottom: 12px; left: 12px; font-family: var(--font-mono, monospace); font-size: 0.55rem; letter-spacing: 0.12em; font-weight: 700; background: #e53e3e; color: #fff; padding: 4px 10px; border-radius: 999px; }
        .story-modal-info { flex: 1; padding: 24px 22px 20px; display: flex; flex-direction: column; gap: 0; overflow: hidden; }
        .story-modal-title { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 1.4rem; font-weight: 700; color: #5a1a4a; letter-spacing: 0.04em; line-height: 1.25; margin: 0 0 6px; word-break: break-word; }
        .story-modal-tier-row { margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .story-modal-tier-badge { font-family: var(--font-mono, monospace); font-size: 0.6rem; letter-spacing: 0.1em; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
        .story-modal-tier-free { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.5); color: #16a34a; }
        .story-modal-tier-premium { background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.5); color: #b45309; }
        .story-modal-nsfw-badge { font-family: var(--font-mono, monospace); font-size: 0.6rem; letter-spacing: 0.1em; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.6); color: #dc2626; }
        .story-modal-desc-wrap { flex-shrink: 0; max-height: 96px; overflow-y: auto; margin-bottom: 16px; padding-right: 4px; scrollbar-width: thin; scrollbar-color: rgba(244, 114, 182, 0.3) transparent; }
        .story-modal-desc-wrap::-webkit-scrollbar { width: 3px; }
        .story-modal-desc-wrap::-webkit-scrollbar-thumb { background: rgba(244, 114, 182, 0.35); border-radius: 99px; }
        .story-modal-desc { font-size: 0.82rem; color: rgba(90, 26, 74, 0.75); line-height: 1.65; margin: 0; }
        .story-modal-meta { border-top: 1px solid rgba(255, 133, 179, 0.25); padding-top: 14px; margin-bottom: 16px; }
        .story-modal-meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .story-modal-meta-label { font-family: var(--font-mono, monospace); font-size: 0.64rem; letter-spacing: 0.1em; font-weight: 700; color: #7a2a62; }
        .story-modal-meta-count { font-family: var(--font-mono, monospace); font-size: 0.62rem; background: rgba(255, 182, 193, 0.4); border: 1px solid rgba(255, 133, 179, 0.45); color: #5a1a4a; padding: 1px 8px; border-radius: 999px; font-weight: 700; }
        .story-modal-meta-value { font-family: var(--font-ui, sans-serif); font-size: 0.72rem; color: #5a1a4a; font-weight: 600; }
        .story-modal-char-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
        .story-modal-char-chip { font-family: var(--font-ui, sans-serif); font-size: 0.7rem; background: rgba(255, 211, 225, 0.6); border: 1px solid rgba(255, 133, 179, 0.4); color: #5a1a4a; padding: 3px 10px; border-radius: 999px; font-weight: 600; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
        .story-modal-actions { display: flex; gap: 10px; margin-top: auto; padding-top: 4px; }
        .jk-modal-btn { border: 1px solid rgba(255, 133, 179, 0.85); background: rgba(255, 255, 255, 0.65); color: #5a1a4a; font-family: var(--font-ui, sans-serif); font-weight: 700; font-size: 0.88rem; letter-spacing: 0.06em; padding: 9px 18px; border-radius: 999px; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease; }
        .jk-modal-btn:hover { border-color: rgba(255, 133, 179, 0.95); background: rgba(255, 245, 250, 1); transform: translateY(-1px); }
        .jk-modal-btn-confirm { border-color: rgba(255, 133, 179, 0.95); background: linear-gradient(180deg, rgba(255, 204, 226, 1), rgba(255, 155, 195, 1)); color: #5a1a4a; box-shadow: 0 8px 16px rgba(233, 30, 140, 0.18); }
        .jk-modal-btn-confirm:hover { background: linear-gradient(180deg, rgba(255, 220, 235, 1), rgba(255, 170, 205, 1)); }
        .story-play-btn { font-family: var(--font-display, 'Comfortaa', sans-serif); letter-spacing: 0.08em; }
        @media (max-width: 640px) { .story-modal-card { width: 96vw; } .story-modal-body { flex-direction: column; } .story-modal-cover-wrap { width: 100%; height: 200px; border-radius: 20px 20px 0 0; } .story-modal-cover-placeholder { min-height: 200px; } .story-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } }
      `}</style>
    </>
  )
}
