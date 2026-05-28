import { motion } from 'framer-motion'
import type { SceneDetailRecord, SessionCharacterRecord } from '@/services/backendApi'
import { getCharacterStageStyle, resolveStorySprite } from './storyPresentation'

interface StoryStageProps {
  scene: SceneDetailRecord
  backgroundUrl: string | null
  characters: SessionCharacterRecord[]
  activeSpeakerId: string | null
  visibleExpressions: Record<string, string | null>
  isBackgroundTransitioning: boolean
}

export function StoryStage({
  scene,
  backgroundUrl,
  characters,
  activeSpeakerId,
  visibleExpressions,
  isBackgroundTransitioning,
}: StoryStageProps) {
  return (
    <>
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: isBackgroundTransitioning ? 0.15 : 1, transition: 'opacity 450ms ease-in-out' }}
      >
        {backgroundUrl ? (
          <img src={backgroundUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a0a2e,#0d0d1a)' }} />
        )}
      </div>

      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.5) 100%)', pointerEvents: 'none' }}
      />

      {characters.map((character, index) => {
        const sprite = resolveStorySprite(character, scene, visibleExpressions[character.id] ?? character.current_expression_key)
        if (!sprite) return null
        const isSpeaking = activeSpeakerId === character.id
        const isDimmed = activeSpeakerId !== null && !isSpeaking

        return (
          <motion.div
            key={character.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: isSpeaking ? 1.045 : 1,
              filter: isDimmed
                ? 'brightness(0.55) saturate(0.7)'
                : isSpeaking
                  ? 'brightness(1.08) saturate(1.05)'
                  : 'brightness(1) saturate(1)',
            }}
            transition={{
              opacity: { duration: 0.45, ease: 'easeOut' },
              y: { duration: 0.45, ease: 'easeOut' },
              scale: { duration: 0.28, ease: [0.34, 1.2, 0.64, 1] },
              filter: { duration: 0.28, ease: 'easeOut' },
            }}
            style={{
              position: 'absolute', bottom: 0, zIndex: isSpeaking ? 10 : 9,
              pointerEvents: 'none', height: '88%', display: 'flex',
              alignItems: 'flex-end', justifyContent: 'center',
              transformOrigin: 'bottom center', x: '-50%',
              ...getCharacterStageStyle(index, characters.length),
            }}
          >
            <img
              src={sprite}
              alt={character.name}
              style={{ height: '100%', maxWidth: '34vw', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 32px rgba(233,30,140,0.35))' }}
            />
          </motion.div>
        )
      })}

      <div
        aria-hidden="true"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40%', background: 'linear-gradient(to top,rgba(10,10,15,0.85) 0%,transparent 100%)', zIndex: 11, pointerEvents: 'none' }}
      />
    </>
  )
}
