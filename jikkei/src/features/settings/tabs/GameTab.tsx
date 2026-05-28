import { AudioSection } from '../sections/AudioSection'
import { DialogueSection } from '../sections/DialogueSection'
import { GameplaySection } from '../sections/GameplaySection'
import type { SettingsState } from '../useSettingsState'

type Props = Pick<
  SettingsState,
  | 'bgmVolume' | 'setBgmVolume' | 'bgmEnabled' | 'setBgmEnabled'
  | 'sfxVolume' | 'setSfxVolume' | 'sfxEnabled' | 'setSfxEnabled'
  | 'textSfxEnabled' | 'setTextSfxEnabled'
  | 'textSfxVolume' | 'setTextSfxVolume'
  | 'textSfxType' | 'handleTextTypeChange'
  | 'autoPlay' | 'setAutoPlay'
  | 'language' | 'setLanguage'
>

export function GameTab({
  bgmVolume, setBgmVolume, bgmEnabled, setBgmEnabled,
  sfxVolume, setSfxVolume, sfxEnabled, setSfxEnabled,
  textSfxEnabled, setTextSfxEnabled, textSfxVolume, setTextSfxVolume,
  textSfxType, handleTextTypeChange,
  autoPlay, setAutoPlay,
  language, setLanguage,
}: Props) {
  return (
    <section className="settings-grid st-game-grid">
      <AudioSection
        bgmVolume={bgmVolume} bgmEnabled={bgmEnabled}
        sfxVolume={sfxVolume} sfxEnabled={sfxEnabled}
        setBgmVolume={setBgmVolume} setBgmEnabled={setBgmEnabled}
        setSfxVolume={setSfxVolume} setSfxEnabled={setSfxEnabled}
      />

      <DialogueSection
        textSfxEnabled={textSfxEnabled} textSfxVolume={textSfxVolume} textSfxType={textSfxType}
        setTextSfxEnabled={setTextSfxEnabled} setTextSfxVolume={setTextSfxVolume}
        onTypeChange={handleTextTypeChange}
      />

      <GameplaySection
        autoPlay={autoPlay} language={language}
        setAutoPlay={setAutoPlay} setLanguage={setLanguage}
      />
    </section>
  )
}
