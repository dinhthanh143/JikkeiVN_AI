import { useEffect, useRef, useState } from 'react'

/**
 * useTypewriter
 *
 * Animates a text string character-by-character.
 * When `text` changes the animation resets and re-runs from scratch.
 *
 * @param text  - The full string to type out.
 * @param speed - Milliseconds between each character (default 22 ms ≈ ~45 chars/sec).
 * @returns     - { displayedText, isDone } where isDone becomes true once all chars are shown.
 */
export function useTypewriter(text: string, speed = 22): { displayedText: string; isDone: boolean } {
  const [displayedText, setDisplayedText] = useState('')
  const [isDone, setIsDone] = useState(false)
  const rafRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const lastTickRef = useRef<number>(0)

  useEffect(() => {
    // Reset on every new text value.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    indexRef.current = 0
    lastTickRef.current = 0
    setDisplayedText('')
    setIsDone(false)

    if (!text) {
      setIsDone(true)
      return
    }

    const tick = (timestamp: number) => {
      if (timestamp - lastTickRef.current >= speed) {
        lastTickRef.current = timestamp
        indexRef.current += 1
        setDisplayedText(text.slice(0, indexRef.current))

        if (indexRef.current >= text.length) {
          setIsDone(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [text, speed])

  return { displayedText, isDone }
}
