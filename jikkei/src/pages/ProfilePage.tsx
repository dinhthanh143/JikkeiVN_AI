import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  deleteScene,
  deleteSession,
  fetchUserProfile,
  fetchUserPublicStories,
  getSessionByScene,
  type SceneDetailRecord,
} from '@/services/backendApi'
import { StoryModal } from '@/components/panels/PlayPanel'
import { useAuth } from '@/hooks/useAuth'

// ── Story preview card + modal (read-only — no owner actions, mirrors
// PublicStoriesPanel's StoryModal/StoryCard shape) ─────────────────────────

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

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [selectedStory, setSelectedStory] = useState<SceneDetailRecord | null>(null)
  const [bioExpanded, setBioExpanded] = useState(false)

  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => fetchUserProfile(username!),
    enabled: !!username,
    retry: false,
  })

  const { data: previewStories = [], refetch: refetchPreviewStories } = useQuery({
    queryKey: ['userPreviewStories', username],
    queryFn: () => fetchUserPublicStories(username!, { sort: 'most_played', page: 1, page_size: 6 }),
    enabled: !!username && !!profile,
  })

  const handlePlay = (id: string) => navigate(`/story/${id}`)
  const handleModalClose = () => setSelectedStory(null)
  const refreshProfileStories = () => {
    void refetchProfile()
    void refetchPreviewStories()
  }
  const handleEdit = (id: string) => {
    handleModalClose()
    navigate(`/story/${id}/edit`)
  }
  const handleDelete = async (id: string) => {
    try {
      await deleteScene(id)
    } finally {
      handleModalClose()
      refreshProfileStories()
    }
  }
  const handleRemove = async (id: string) => {
    try {
      const session = await getSessionByScene(id)
      if (session) await deleteSession(session.id)
    } finally {
      handleModalClose()
      refreshProfileStories()
    }
  }

  const isNotFound = !!profileError
  const initials = (profile?.username ?? '?').charAt(0).toUpperCase()
  const displayName = profile?.display_name || profile?.username || ''

  return (
    <>
      <div className="panel-content profile-page-content">
        {profileLoading ? (
          <div className="play-empty-state">
            <span className="play-empty-icon">⧗</span>
            <p className="play-empty-text">Loading profile...</p>
          </div>
        ) : isNotFound ? (
          <div className="profile-notfound">
            <span className="profile-notfound-kicker">// NOT_FOUND</span>
            <h2 className="profile-notfound-heading">User not found</h2>
            <p className="profile-notfound-desc">This profile doesn't exist or isn't available.</p>
            <button type="button" className="play-retry-btn" onClick={() => navigate(-1)}>← Go Back</button>
          </div>
        ) : profile ? (
          <>
            {profile.profile_banner ? (
              <img src={profile.profile_banner} alt="" className="profile-banner" />
            ) : (
              <div className="profile-banner-placeholder" />
            )}

            <div className="profile-identity">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="profile-avatar" />
              ) : (
                <div className="profile-avatar profile-avatar-initials">{initials}</div>
              )}
              <div className="profile-identity-text">
                <p className="profile-name">{displayName}</p>
                <p className="profile-handle">@{profile.username}</p>
              </div>
              <span className={`user-tier user-tier-${profile.tier}`}>
                {profile.tier === 'premium' ? 'Premium' : 'Free'}
              </span>
            </div>

            <div className="profile-stats-row">
              <span className="profile-stat-chip">{profile.public_story_count} {profile.public_story_count === 1 ? 'Story' : 'Stories'}</span>
              <span className="profile-stat-chip">{profile.total_plays} Plays</span>
              <span className="profile-stat-chip">Since {profile.joined_year}</span>
              {profile.age != null && <span className="profile-stat-chip">Age {profile.age}</span>}
            </div>

            {profile.bio && (
              <div className="profile-bio">
                <p className={bioExpanded ? '' : 'profile-bio-clamped'}>{profile.bio}</p>
                {profile.bio.length > 160 && (
                  <button type="button" className="profile-bio-toggle" onClick={() => setBioExpanded((v) => !v)}>
                    {bioExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            <div className="profile-stories-section">
              {profile.public_story_count > 0 ? (
                <>
                  <div className="profile-stories-header">
                    <span className="profile-stories-title">Stories</span>
                    <Link to={`/profile/${profile.username}/stories`} className="profile-see-all">See all →</Link>
                  </div>
                  <div className="profile-stories-scroll">
                    {previewStories.map((story) => (
                      <StoryCard key={story.id} story={story} onClick={setSelectedStory} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="profile-empty-text">No public stories yet.</p>
              )}
            </div>
          </>
        ) : null}
      </div>

      {selectedStory && (
        <StoryModal
          story={selectedStory}
          isOwner={selectedStory.user_id === userId}
          onClose={handleModalClose}
          onPlay={handlePlay}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRemove={handleRemove}
          onAuthorClick={(author) => {
            handleModalClose()
            navigate(`/profile/${author}`)
          }}
        />
      )}

      <style>{`
        .profile-page-content { padding-bottom: 32px; }
        .profile-banner { width: 100%; height: 220px; object-fit: cover; display: block; border-radius: 18px; }
        .profile-banner-placeholder { width: 100%; height: 220px; background: linear-gradient(135deg, #ffd3e1, #ffb6c1, #ffc2d4); border-radius: 18px; }
        .profile-identity { display: flex; align-items: flex-end; gap: 14px; padding: 0 24px; margin-top: -40px; margin-bottom: 16px; }
        .profile-avatar { width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,133,179,0.8); object-fit: cover; background: linear-gradient(135deg,#ffd3e1,#ffb6c1); flex-shrink: 0; }
        .profile-avatar-initials { display: flex; align-items: center; justify-content: center; font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 2rem; font-weight: 700; color: #5a1a4a; }
        .profile-identity-text { display: flex; flex-direction: column; gap: 2px; padding-bottom: 6px; flex: 1; min-width: 0; }
        .profile-name { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 1.4rem; font-weight: 700; color: #5a1a4a; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-handle { font-family: var(--font-mono, monospace); font-size: 0.72rem; color: rgba(90,26,74,0.55); letter-spacing: 0.06em; margin: 0; }
        .profile-stats-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px; margin-bottom: 16px; }
        .profile-stat-chip { font-family: var(--font-mono, monospace); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; color: #7a2a62; background: rgba(255,211,225,0.5); border: 1px solid rgba(255,133,179,0.4); padding: 4px 12px; border-radius: 999px; }
        .profile-bio { padding: 0 24px; margin-bottom: 24px; font-size: 0.85rem; color: rgba(90,26,74,0.75); line-height: 1.65; max-width: 560px; }
        .profile-bio p { margin: 0; }
        .profile-bio-clamped { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
        .profile-bio-toggle { margin-top: 6px; background: none; border: none; padding: 0; color: #f472b6; font-family: var(--font-mono, monospace); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; }
        .profile-bio-toggle:hover { color: #e879a8; }
        .profile-stories-section { padding: 0 24px 32px; }
        .profile-stories-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .profile-stories-title { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 1.1rem; font-weight: 700; color: #5a1a4a; }
        .profile-see-all { font-family: var(--font-mono, monospace); font-size: 0.72rem; font-weight: 700; color: #f472b6; letter-spacing: 0.08em; text-decoration: none; transition: color 160ms ease; }
        .profile-see-all:hover { color: #e879a8; }
        .profile-stories-scroll { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
        .profile-stories-scroll::-webkit-scrollbar { display: none; }
        .profile-stories-scroll .story-card { flex: 0 0 140px; }
        .profile-empty-text { font-family: var(--font-ui, sans-serif); font-size: 0.85rem; color: rgba(90,26,74,0.55); }
        .profile-notfound { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 64px 20px; border: 2px dashed rgba(255, 133, 179, 0.4); border-radius: 18px; background: rgba(255, 211, 225, 0.15); text-align: center; }
        .profile-notfound-kicker { font-family: var(--font-mono, monospace); font-size: 0.7rem; letter-spacing: 0.1em; color: #f472b6; font-weight: 700; }
        .profile-notfound-heading { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 1.5rem; font-weight: 700; color: #5a1a4a; margin: 0; }
        .profile-notfound-desc { font-size: 0.85rem; color: rgba(90,26,74,0.6); margin: 0 0 8px; }
        .play-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 36px 20px; border: 2px dashed rgba(255, 133, 179, 0.4); border-radius: 18px; background: rgba(255, 211, 225, 0.15); text-align: center; }
        .play-empty-icon { font-size: 1.8rem; color: rgba(244, 114, 182, 0.4); }
        .play-empty-text { font-family: var(--font-display, 'Comfortaa', sans-serif); font-size: 0.95rem; font-weight: 700; color: #7a2a62; margin: 0; }
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
        .story-modal-author { font-size: 0.78rem; color: rgba(90, 26, 74, 0.65); margin: 0 0 14px; }
        .story-modal-author-name { color: #f472b6; font-weight: 700; }
        .story-modal-author-link { background: none; border: none; padding: 0; font: inherit; cursor: pointer; }
        .story-modal-author-link:hover { text-decoration: underline; }
        .story-modal-author-link:disabled { cursor: default; text-decoration: none; }
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
        .story-modal-share-btn { margin-left: auto; width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgb(19, 128, 214); border-radius: 50%; background: rgb(19, 128, 214); color: #fff; cursor: pointer; transition: all 180ms ease; }
        .story-modal-share-btn:hover { border-color: rgb(13, 96, 168); background: rgb(13, 96, 168); transform: translateY(-1px); }
        .story-modal-share-btn:focus-visible { outline: 3px solid rgba(244, 114, 182, 0.35); outline-offset: 2px; }
        .story-link-copy-toast { position: fixed; left: 50%; bottom: 28px; z-index: 1701; transform: translateX(-50%); padding: 10px 16px; border-radius: 999px; background: rgba(90, 26, 74, 0.96); color: #fff; font-family: var(--font-mono, monospace); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; box-shadow: 0 12px 28px rgba(10, 10, 15, 0.25); animation: storyLinkCopyIn 180ms ease-out; }
        @keyframes storyLinkCopyIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .jk-modal-btn { border: 1px solid rgba(255, 133, 179, 0.85); background: rgba(255, 255, 255, 0.65); color: #5a1a4a; font-family: var(--font-ui, sans-serif); font-weight: 700; font-size: 0.88rem; letter-spacing: 0.06em; padding: 9px 18px; border-radius: 999px; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease; }
        .jk-modal-btn:hover { border-color: rgba(255, 133, 179, 0.95); background: rgba(255, 245, 250, 1); transform: translateY(-1px); }
        .jk-modal-btn-confirm { border-color: rgba(255, 133, 179, 0.95); background: linear-gradient(180deg, rgba(255, 204, 226, 1), rgba(255, 155, 195, 1)); color: #5a1a4a; box-shadow: 0 8px 16px rgba(233, 30, 140, 0.18); }
        .jk-modal-btn-confirm:hover { background: linear-gradient(180deg, rgba(255, 220, 235, 1), rgba(255, 170, 205, 1)); }
        .jk-modal-btn-edit { border-color: rgba(34,197,94,0.75); background: linear-gradient(180deg,rgba(220,252,231,1),rgba(167,243,208,1)); color: #14532d; }
        .jk-modal-btn-edit:hover { background: linear-gradient(180deg,rgba(240,253,244,1),rgba(187,247,208,1)); border-color: rgba(34,197,94,0.95); }
        .jk-modal-btn-delete { border-color: rgba(220,38,38,0.75); background: linear-gradient(180deg,rgba(239,68,68,1),rgba(185,28,28,1)); color: #ffffff; }
        .jk-modal-btn-delete:hover { background: linear-gradient(180deg,rgba(248,113,113,1),rgba(220,38,38,1)); border-color: rgba(220,38,38,0.95); }
        .jk-modal-btn-delete:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .story-play-btn { font-family: var(--font-display, 'Comfortaa', sans-serif); letter-spacing: 0.08em; }
        @media (max-width: 640px) { .story-modal-card { width: 96vw; } .story-modal-body { flex-direction: column; } .story-modal-cover-wrap { width: 100%; height: 200px; border-radius: 20px 20px 0 0; } .story-modal-cover-placeholder { min-height: 200px; } .story-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } .profile-identity { flex-wrap: wrap; } }
      `}</style>
    </>
  )
}
