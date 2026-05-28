import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const NotFoundPage = () => {
  const navigate = useNavigate()
  const [glitching, setGlitching] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 180)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="nf-root">
      <style>{`
        .nf-root {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at 20% 15%, rgba(255,182,193,0.45), transparent 55%),
                      linear-gradient(145deg, #fff0f8 0%, #fde8f5 55%, #ffd6ec 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-ui, 'Nunito', sans-serif);
          overflow: hidden;
          z-index: 9999;
        }

        /* Perspective grid */
        .nf-grid {
          position: absolute;
          inset: -40% -20% 0 -20%;
          background-image:
            linear-gradient(rgba(244, 114, 182, 0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 114, 182, 0.18) 1px, transparent 1px);
          background-size: 44px 44px;
          transform: perspective(900px) rotateX(62deg) translateY(0);
          animation: nfGridMove 10s linear infinite;
          opacity: 0.5;
          mask-image: linear-gradient(to top, rgba(0,0,0,1), transparent 70%);
          -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1), transparent 70%);
          pointer-events: none;
        }

        @keyframes nfGridMove {
          0%   { transform: perspective(900px) rotateX(62deg) translateY(0); }
          100% { transform: perspective(900px) rotateX(62deg) translateY(44px); }
        }

        /* Ambient orbs */
        .nf-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          animation: nfOrbFloat 8s ease-in-out infinite alternate;
        }
        .nf-orb-a { width: 380px; height: 380px; left: -80px; top: -60px; background: rgba(255,182,193,0.5); }
        .nf-orb-b { width: 440px; height: 440px; right: -120px; bottom: -120px; background: rgba(255,133,179,0.35); animation-delay: -3s; }

        @keyframes nfOrbFloat {
          0%   { transform: translateY(0) scale(1); }
          100% { transform: translateY(24px) scale(1.08); }
        }

        /* Card */
        .nf-card {
          position: relative;
          z-index: 2;
          width: min(520px, 90vw);
          border: 2px solid rgba(255, 133, 179, 0.85);
          background: linear-gradient(135deg, rgba(255,211,225,0.96), rgba(255,182,193,0.96));
          box-shadow: 0 12px 40px rgba(233,30,140,0.18), inset 0 1px 0 rgba(255,255,255,0.7);
          border-radius: 24px;
          padding: 36px 36px 32px;
          text-align: center;
          animation: nfCardIn 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes nfCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* 404 number */
        .nf-code {
          font-family: var(--font-display, 'Comfortaa', sans-serif);
          font-size: clamp(6rem, 18vw, 9rem);
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--plum, #5a1a4a);
          position: relative;
          display: inline-block;
          padding-top: 6px;
          margin-bottom: 4px;
        }

        .nf-code::after {
          content: '404';
          position: absolute;
          inset: 0;
          padding-top: 6px;
          background: linear-gradient(180deg, #ff2d78, #f472b6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(244,114,182,0.5));
          transform: translate(-2px, -2px);
        }

        .nf-glitch .nf-code::after {
          animation: nfGlitch 0.18s cubic-bezier(.25,.46,.45,.94) both infinite;
        }

        @keyframes nfGlitch {
          0%   { transform: translate(0); }
          20%  { transform: translate(-4px, 2px); }
          40%  { transform: translate(-4px, -2px); }
          60%  { transform: translate(4px, 2px); }
          80%  { transform: translate(4px, -2px); }
          100% { transform: translate(0); }
        }

        /* Divider */
        .nf-divider {
          width: 218px;
          height: 4px;
          background: linear-gradient(90deg, transparent, var(--pink, #f472b6), transparent);
          margin: 18px auto;
          border-radius: 99px;
        }

        /* Heading & desc */
        .nf-heading {
          font-family: var(--font-display, 'Comfortaa', sans-serif);
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--plum, #5a1a4a);
          margin: 0 0 10px;
        }

        .nf-desc {
          font-size: 0.88rem;
          color: rgba(90, 26, 74, 0.65);
          line-height: 1.7;
          margin: 0 auto 26px;
          max-width: 360px;
        }

        /* Actions */
        .nf-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .nf-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 24px;
          font-family: var(--font-display, 'Comfortaa', sans-serif);
          font-size: 0.88rem;
          font-weight: 700;
          letter-spacing: 0.07em;
          border-radius: 999px;
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid rgba(255, 133, 179, 0.85);
          background: linear-gradient(180deg, rgba(255,223,236,0.98), rgba(255,194,218,0.98));
          color: var(--plum, #5a1a4a);
          box-shadow: 0 6px 16px rgba(233,30,140,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }

        .nf-btn:hover {
          background: rgba(255,236,245,1);
          border-color: #ff2d78;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(233,30,140,0.28);
        }

        .nf-btn-ghost {
          background: rgba(255,211,225,0.35);
          color: var(--plum-soft, #7a2a62);
          border-color: rgba(255,133,179,0.45);
          box-shadow: none;
        }

        .nf-btn-ghost:hover {
          border-color: var(--pink, #f472b6);
          color: var(--plum, #5a1a4a);
          background: rgba(255,182,193,0.35);
          box-shadow: none;
        }

        /* Status chip at bottom */
        .nf-status {
          margin-top: 22px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono, 'Quicksand', monospace);
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          font-weight: 700;
          color: var(--plum-soft, #7a2a62);
          background: rgba(255,211,225,0.5);
          border: 1px solid rgba(255,133,179,0.4);
          border-radius: 999px;
          padding: 4px 12px;
        }

        .nf-status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--pink, #f472b6);
          box-shadow: 0 0 6px rgba(244,114,182,0.7);
          animation: nfPulse 2s ease-in-out infinite;
        }

        @keyframes nfPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div className="nf-grid" />
      <div className="nf-orb nf-orb-a" />
      <div className="nf-orb nf-orb-b" />

      <div className={`nf-card ${glitching ? 'nf-glitch' : ''}`}>
        <div className="nf-code">404</div>
        <div className="nf-divider" />
        <h1 className="nf-heading">Page not found</h1>
        <p className="nf-desc">
          This page doesn't exist or was moved. Head back home to pick up where you left off.
        </p>
        <div className="nf-actions">
          <button type="button" className="nf-btn" onClick={() => navigate('/')}>
            ✦ Go Home
          </button>
          <button type="button" className="nf-btn nf-btn-ghost" onClick={() => navigate(-1)}>
            ← Go Back
          </button>
        </div>
        <div className="nf-status">
          <span className="nf-status-dot" />
          ROUTE_NOT_RESOLVED
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
