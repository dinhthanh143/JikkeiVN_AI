import { useParams } from 'react-router-dom'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'
import { StoryHud } from '@/features/story/StoryHud'
import { StoryOverlays } from '@/features/story/StoryOverlays'
import { StoryStage } from '@/features/story/StoryStage'
import { useStoryController } from '@/features/story/useStoryController'

export default function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const controller = useStoryController(storyId)

  if (controller.initState === 'loading') {
    return <AppLoadingScreen kicker="JIKKEI" copy="Loading Story..." />
  }

  if (controller.initState === 'error' || !controller.scene || !storyId) {
    return (
      <main style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'linear-gradient(145deg,#fff0f8 0%,#fde8f5 55%,#ffd6ec 100%)' }}>
        <p role="alert" style={{ fontFamily: 'var(--font-display,sans-serif)', color: '#e0185f', fontWeight: 700 }}>{controller.errorMsg}</p>
        <button type="button" onClick={() => controller.navigate('/play')} style={{ padding: '10px 24px', borderRadius: 999, border: '2px solid rgba(255,133,179,0.7)', background: 'rgba(255,255,255,0.6)', color: '#5a1a4a', fontWeight: 700, cursor: 'pointer' }}>← Go Back</button>
      </main>
    )
  }

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000', fontFamily: 'var(--font-ui,sans-serif)' }}>
      <StoryStage
        scene={controller.scene}
        backgroundUrl={controller.currentBgUrl}
        characters={controller.activeChars}
        activeSpeakerId={controller.activeSpeakerId}
        visibleExpressions={controller.visibleExpressions}
        isBackgroundTransitioning={controller.isBgTransitioning}
      />
      <StoryHud controller={controller} storyId={storyId} />
      <StoryOverlays controller={controller} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalPop { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        .story-credits-badge { font-family: var(--font-mono,monospace); font-size: 0.75rem; font-weight: 700; color: #5a1a4a; letter-spacing: 0.04em; }
      `}</style>
    </main>
  )
}
