import { useEffect, useState } from 'react'
import '../../styles/HomePanel.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const SITE_STAT_USERS = import.meta.env.VITE_SITE_STAT_USERS ?? 'Early Access'
const SITE_STAT_STORIES = import.meta.env.VITE_SITE_STAT_STORIES ?? 'Early Access'
const SITE_STAT_CHARACTERS = import.meta.env.VITE_SITE_STAT_CHARACTERS ?? 'Early Access'

const SITE_ABOUT_COPY =
  import.meta.env.VITE_SITE_ABOUT_COPY ??
  "Jikkei is an AI-powered visual novel platform where you create characters, write branching stories, and let AI bring the dialogue to life."
const SITE_FOUNDED = import.meta.env.VITE_SITE_FOUNDED ?? '2025'
const SITE_TEAM_SIZE = import.meta.env.VITE_SITE_TEAM_SIZE ?? 'Small team'

const SITE_CONTACT_EMAIL = import.meta.env.VITE_SITE_CONTACT_EMAIL ?? 'hello@jikkei.app'
const SITE_DISCORD_URL = import.meta.env.VITE_SITE_DISCORD_URL ?? ''
const SITE_GITHUB_URL = import.meta.env.VITE_SITE_GITHUB_URL ?? ''
const SITE_DOCS_URL = import.meta.env.VITE_SITE_DOCS_URL ?? ''

const FEATURES = [
  {
    emoji: String.fromCodePoint(0x1F3A8),
    title: 'Create a Character',
    desc: 'Give them a personality, a backstory, and a face. AI plays them true to who you made them.',
    path: '/create',
    accent: 'pink',
  },
  {
    emoji: String.fromCodePoint(0x1F4D6),
    title: 'Write a Story',
    desc: 'Build branching scenes with real choices. AI fills in the dialogue as your story unfolds.',
    path: '/create',
    accent: 'gold',
  },
  {
    emoji: String.fromCodePoint(0x2728),
    title: 'Bring Your Cards',
    desc: 'Already have characters from SillyTavern? Import V2 cards and start playing right away.',
    path: '/create',
    accent: 'lavender',
  },
]

const CONTACT_LINKS = [
  { label: 'Email', val: SITE_CONTACT_EMAIL, href: `mailto:${SITE_CONTACT_EMAIL}` },
  { label: 'Discord', val: SITE_DISCORD_URL || 'Coming soon', href: SITE_DISCORD_URL },
  { label: 'GitHub', val: SITE_GITHUB_URL || 'Coming soon', href: SITE_GITHUB_URL },
  { label: 'Docs', val: SITE_DOCS_URL || 'Coming soon', href: SITE_DOCS_URL },
]

const PREVIEW_SCENES = [
  {
    speaker: 'Wren',
    role: 'Stormkeeper of the Northern Hold',
    line: 'You came back. I told everyone you would not, you know. I am glad to be wrong, for once.',
  },
  {
    speaker: 'Iris',
    role: 'Wandering Alchemist',
    line: 'Careful with that bottle. The last person who shook it lost their eyebrows for a week.',
  },
  {
    speaker: 'Theo',
    role: 'Your Childhood Rival',
    line: 'Still slow as ever, I see. Catch up, or I am claiming the last seat at the table.',
  },
]

const PREVIEW_INTERVAL_MS = 4200

export function HomePanel() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [activeScene, setActiveScene] = useState(0)
  const [affinity, setAffinity] = useState(64)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % PREVIEW_SCENES.length)
    }, PREVIEW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const scene = PREVIEW_SCENES[activeScene]

  return (
    <div className="hp-page">
      <div className="hp-sky" aria-hidden="true">
        <span className="hp-orb hp-orb-a" />
        <span className="hp-orb hp-orb-b" />
        <span className="hp-orb hp-orb-c" />
        <span className="hp-orb hp-orb-d" />
        {Array.from({ length: 11 }).map((_, i) => (
          <span key={i} className={`hp-sparkle hp-sparkle-${i + 1}`}>
            {String.fromCodePoint(i % 2 === 0 ? 0x2726 : 0x2727)}
          </span>
        ))}
      </div>

      <section className="hp-hero">
        <span className="hp-kicker">Welcome to Jikkei</span>
        <h1 className="hp-title">
          Your story,<br />
          <span className="hp-title-accent">your characters.</span>
        </h1>
        <p className="hp-subtitle">
          Create characters, write branching visual novels, and watch AI bring your world to life.
        </p>
        <div className="hp-hero-actions">
          <button className="hp-btn hp-btn-primary" onClick={() => navigate(isAuthenticated ? '/play' : '/auth')}>
            {isAuthenticated ? 'Continue Playing' : 'Get Started'}
          </button>
          <button className="hp-btn hp-btn-ghost" onClick={() => navigate('/public_stories')}>
            Browse Stories
          </button>
        </div>
      </section>

      <section className="hp-stats">
        <div className="hp-stat hp-card-layered">
          <span className="hp-card-outline-3" />
          <span className="hp-card-outline-2" />
          <span className="hp-card-outline-1" />
          <span className="hp-card-body">
            <span className="hp-stat-value">{SITE_STAT_USERS}</span>
            <span className="hp-stat-label">Community</span>
          </span>
        </div>
        <div className="hp-stat hp-stat-center hp-card-layered">
          <span className="hp-card-outline-3" />
          <span className="hp-card-outline-2" />
          <span className="hp-card-outline-1" />
          <span className="hp-card-body">
            <span className="hp-stat-value">{SITE_STAT_STORIES}</span>
            <span className="hp-stat-label">Stories Created</span>
          </span>
        </div>
        <div className="hp-stat hp-card-layered">
          <span className="hp-card-outline-3" />
          <span className="hp-card-outline-2" />
          <span className="hp-card-outline-1" />
          <span className="hp-card-body">
            <span className="hp-stat-value">{SITE_STAT_CHARACTERS}</span>
            <span className="hp-stat-label">Characters Made</span>
          </span>
        </div>
      </section>

      <section className="hp-preview">
        <h2 className="hp-section-title">A Peek Inside a Story</h2>
        <div className="hp-preview-box">
          <div className="hp-preview-avatar" aria-hidden="true">
            {scene.speaker.charAt(0)}
          </div>
          <div className="hp-preview-body">
            <div className="hp-preview-name-row">
              <span className="hp-preview-name">{scene.speaker}</span>
              <span className="hp-preview-role">{scene.role}</span>
            </div>
            <p className="hp-preview-line">{scene.line}</p>
            <div className="hp-preview-affinity">
              <span className="hp-preview-affinity-label">Affinity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={affinity}
                onChange={(e) => setAffinity(Number(e.target.value))}
                className="hp-slider"
                style={{ '--pct': `${affinity}%` } as React.CSSProperties}
                aria-label="Preview affinity level, drag to see the bar move"
              />
              <span className="hp-preview-affinity-value">{affinity}%</span>
            </div>
          </div>
          <div className="hp-preview-dots">
            {PREVIEW_SCENES.map((s, i) => (
              <button
                key={s.speaker}
                className={`hp-preview-dot ${i === activeScene ? 'hp-preview-dot-active' : ''}`}
                onClick={() => setActiveScene(i)}
                aria-label={`Show ${s.speaker}'s line`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="hp-features">
        <h2 className="hp-section-title">What You Can Do</h2>
        <div className="hp-features-grid">
          {FEATURES.map((f) => (
            <button
              key={f.title}
              className={`hp-feature-card hp-card-layered hp-accent-${f.accent}`}
              onClick={() => navigate(f.path)}
            >
              <span className="hp-card-outline-3" />
              <span className="hp-card-outline-2" />
              <span className="hp-card-outline-1" />
              <span className="hp-card-body hp-feature-body">
                <span className="hp-feature-emoji">{f.emoji}</span>
                <span className="hp-feature-title">{f.title}</span>
                <span className="hp-feature-desc">{f.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="hp-community hp-card-layered">
        <span className="hp-card-outline-3" />
        <span className="hp-card-outline-2" />
        <span className="hp-card-outline-1" />
        <span className="hp-card-body hp-community-body">
          <div className="hp-community-text">
            <h2 className="hp-section-title">Join the Community</h2>
            <p className="hp-community-copy">
              Share your characters and stories, see what others are creating, and get inspired.
            </p>
          </div>
          <button className="hp-btn hp-btn-primary" onClick={() => navigate('/auth')}>
            Sign Up Now
          </button>
        </span>
      </section>

      <section className="hp-footer-grid">
        <div className="hp-footer-card hp-footer-card--about hp-card-layered">
          <span className="hp-card-outline-3" />
          <span className="hp-card-outline-2" />
          <span className="hp-card-outline-1" />
          <span className="hp-card-body hp-footer-body">
            <span className="hp-footer-accent-bar" />
            <div className="hp-footer-head">
              <span className="hp-footer-icon" aria-hidden="true">{String.fromCodePoint(0x1F4D6)}</span>
              <span className="hp-footer-kicker">About Jikkei</span>
            </div>
            <p className="hp-footer-copy">{SITE_ABOUT_COPY}</p>
            <div className="hp-footer-meta">
              <span>Founded {SITE_FOUNDED}</span>
              <span>{String.fromCodePoint(0xB7)}</span>
              <span>{SITE_TEAM_SIZE}</span>
            </div>
          </span>
        </div>
        <div className="hp-footer-card hp-footer-card--contact hp-card-layered">
          <span className="hp-card-outline-3" />
          <span className="hp-card-outline-2" />
          <span className="hp-card-outline-1" />
          <span className="hp-card-body hp-footer-body">
            <span className="hp-footer-accent-bar" />
            <div className="hp-footer-head">
              <span className="hp-footer-icon" aria-hidden="true">{String.fromCodePoint(0x1F4AC)}</span>
              <span className="hp-footer-kicker">Get in Touch</span>
            </div>
            <div className="hp-footer-links">
              {CONTACT_LINKS.map((c) => (
                <a
                  key={c.label}
                  href={c.href || undefined}
                  target={c.href.startsWith('http') ? '_blank' : undefined}
                  rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="hp-footer-link"
                >
                  <span>{c.label}</span>
                  <span className="hp-footer-link-val">{c.val}</span>
                </a>
              ))}
            </div>
          </span>
        </div>
      </section>
    </div>
  )
}
