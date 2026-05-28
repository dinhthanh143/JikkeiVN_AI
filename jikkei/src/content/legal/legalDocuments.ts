import termsMarkdown from './terms.md?raw'
import privacyMarkdown from './privacy.md?raw'

function extractVersion(markdown: string): string {
  const firstHeadingLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstHeadingLine) {
    return 'v0.0.0'
  }

  const headingMatch = firstHeadingLine.match(/^#\s+(.+)$/)
  if (!headingMatch) {
    return 'v0.0.0'
  }

  return headingMatch[1].trim().split(/\s+/)[0] ?? 'v0.0.0'
}

function stripVersionHeading(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let headingIndex = -1

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().length > 0) {
      headingIndex = index
      break
    }
  }

  if (headingIndex === -1) {
    return markdown.trim()
  }

  return lines.slice(headingIndex + 1).join('\n').trim()
}

export const TERMS_MARKDOWN = termsMarkdown
export const PRIVACY_MARKDOWN = privacyMarkdown

export const TERMS_VERSION = extractVersion(termsMarkdown)
export const PRIVACY_VERSION = extractVersion(privacyMarkdown)

export const TERMS_BODY_MARKDOWN = stripVersionHeading(termsMarkdown)
export const PRIVACY_BODY_MARKDOWN = stripVersionHeading(privacyMarkdown)

export const LEGAL_BUNDLE_VERSION = `terms:${TERMS_VERSION}|privacy:${PRIVACY_VERSION}`