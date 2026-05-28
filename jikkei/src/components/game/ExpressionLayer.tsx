interface ExpressionLayerProps {
  characterName?: string
  expression?: string
  portraitUrl?: string
}

export default function ExpressionLayer({
  characterName = 'Character',
  expression = 'neutral',
  portraitUrl,
}: ExpressionLayerProps) {
  return (
    <div className="relative w-full h-96 bg-jikkei-black-800 rounded-lg border border-jikkei-accent flex items-center justify-center overflow-hidden">
      {portraitUrl ? (
        <img src={portraitUrl} alt={characterName} className="h-full object-cover" />
      ) : (
        <div className="text-center">
          <p className="text-jikkei-pink-300 text-lg font-semibold">{characterName}</p>
          <p className="text-jikkei-accent text-sm">[{expression}]</p>
        </div>
      )}
    </div>
  )
}
