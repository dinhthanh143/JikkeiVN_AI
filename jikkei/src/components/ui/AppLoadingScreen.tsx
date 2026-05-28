/**
 * AppLoadingScreen
 * Single, shared fullscreen loader for the whole app.
 *
 * Renders with `position: fixed; inset: 0` so it always covers the entire
 * viewport — regardless of which container it happens to be mounted inside
 * (a router Suspense boundary nested under the sidebar layout's scrollable
 * panel, a page-level data-loading gate, etc). That's important: a loader
 * that is NOT position:fixed and instead sits inside a padded flex
 * container (like `.panel-scroll`) gets boxed in by that container's
 * padding, which shows up as a band of blank background around the loader
 * card. Using one fixed-position component everywhere avoids that, and
 * means the user only ever sees ONE loader during a route transition
 * (the router's Suspense fallback) instead of a second, different-looking
 * loading screen flashing in right after it.
 */
interface AppLoadingScreenProps {
  kicker?: string
  copy?: string
}

export function AppLoadingScreen({
  kicker = 'LOADING',
  copy = 'Just a moment...',
}: AppLoadingScreenProps) {
  return (
    <div className="jk-app-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="jk-app-loading-grid" />
      <div className="jk-app-loading-orb jk-app-loading-orb-left" />
      <div className="jk-app-loading-orb jk-app-loading-orb-right" />
      <div className="jk-app-loading-card">
        <p className="jk-app-loading-kicker">{kicker}</p>
        <h1 className="jk-app-loading-title">JIKKEI</h1>
        <p className="jk-app-loading-copy">{copy}</p>
        <div className="jk-app-loading-progress" aria-hidden="true">
          <span className="jk-app-loading-progress-bar" />
        </div>
      </div>
      <style>{`
        .jk-app-loading-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 20% 15%, rgba(255,182,193,0.45), transparent 55%),
                      linear-gradient(145deg, #fff0f8 0%, #fde8f5 55%, #ffd6ec 100%);
          overflow: hidden;
          z-index: 1600;
          padding: 24px;
        }
        .jk-app-loading-grid {
          position: absolute;
          inset: -40% -20% 0 -20%;
          background-image:
            linear-gradient(rgba(244, 114, 182, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 114, 182, 0.15) 1px, transparent 1px);
          background-size: 44px 44px;
          transform: perspective(900px) rotateX(62deg) translateY(0);
          animation: jkAppLoadingGridMove 10s linear infinite;
          opacity: 0.5;
          mask-image: linear-gradient(to top, rgba(0,0,0,1), transparent 70%);
          -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1), transparent 70%);
        }
        .jk-app-loading-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          animation: jkAppLoadingOrbFloat 8s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .jk-app-loading-orb-left {
          width: 360px; height: 360px; left: -80px; top: -60px;
          background: rgba(255, 182, 193, 0.45);
        }
        .jk-app-loading-orb-right {
          width: 420px; height: 420px; right: -120px; bottom: -120px;
          background: rgba(255, 133, 179, 0.35);
          animation-delay: -3s;
        }
        .jk-app-loading-card {
          position: relative;
          width: min(420px, 100%);
          border: 2px solid rgba(255, 133, 179, 0.85);
          background: linear-gradient(135deg, rgba(255,211,225,0.96), rgba(255,182,193,0.96));
          box-shadow: 0 12px 40px rgba(233, 30, 140, 0.18), inset 0 1px 0 rgba(255,255,255,0.7);
          backdrop-filter: blur(8px);
          border-radius: 20px;
          padding: 26px 28px;
          z-index: 2;
          text-align: center;
        }
        .jk-app-loading-kicker {
          margin: 0 0 6px;
          font-family: 'Quicksand', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          color: #7a2a62;
          font-weight: 600;
        }
        .jk-app-loading-title {
          margin: 0;
          font-family: 'Comfortaa', 'Quicksand', sans-serif;
          font-size: clamp(2rem, 7vw, 2.8rem);
          line-height: 1;
          letter-spacing: 0.1em;
          color: #5a1a4a;
        }
        .jk-app-loading-copy {
          margin: 12px 0 14px;
          color: rgba(90, 26, 74, 0.65);
          font-family: 'Nunito', 'Quicksand', sans-serif;
          font-size: 0.88rem;
          line-height: 1.5;
        }
        .jk-app-loading-progress {
          position: relative;
          width: 100%;
          height: 6px;
          border: 1px solid rgba(255, 133, 179, 0.5);
          background: rgba(255, 182, 193, 0.2);
          border-radius: 99px;
          overflow: hidden;
        }
        .jk-app-loading-progress-bar {
          position: absolute;
          inset: 0 auto 0 0;
          width: 32%;
          background: linear-gradient(90deg, rgba(255,133,179,0.3), #f472b6, rgba(255,214,231,0.95));
          box-shadow: 0 0 18px rgba(244, 114, 182, 0.5);
          border-radius: 99px;
          animation: jkAppLoadingProgress 1.2s ease-in-out infinite;
        }
        @keyframes jkAppLoadingGridMove {
          0%   { transform: perspective(900px) rotateX(62deg) translateY(0); }
          100% { transform: perspective(900px) rotateX(62deg) translateY(44px); }
        }
        @keyframes jkAppLoadingOrbFloat {
          0%   { transform: translateY(0) scale(1); }
          100% { transform: translateY(24px) scale(1.08); }
        }
        @keyframes jkAppLoadingProgress {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }
      `}</style>
    </div>
  )
}
