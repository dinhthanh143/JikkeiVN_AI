const AUTO_ADVANCE_MIN_MS = 1_500
const AUTO_ADVANCE_MAX_MS = 5_000
const AUTO_ADVANCE_MS_PER_CHARACTER = 20
const AUTO_ADVANCE_BASE_MS = 1_200

export function getAutoAdvanceDelay(text: string): number {
  return Math.max(
    AUTO_ADVANCE_MIN_MS,
    Math.min(AUTO_ADVANCE_MAX_MS, AUTO_ADVANCE_BASE_MS + text.trim().length * AUTO_ADVANCE_MS_PER_CHARACTER),
  )
}
