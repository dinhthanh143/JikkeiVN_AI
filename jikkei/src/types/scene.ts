export interface SceneConfig {
  backgroundImage: string
  lighting: LightingConfig
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
}

export interface LightingConfig {
  ambientIntensity: number
  directionalIntensity: number
  directionalAngle: number
}

export interface LayerState {
  characterId: string
  portraitUrl: string
  positionX: number
  scale: number
  opacity: number
}
