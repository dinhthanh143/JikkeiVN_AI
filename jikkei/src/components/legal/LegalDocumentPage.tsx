import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

const LEGAL_PAGE_CSS = `
  .legal-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background:
      radial-gradient(circle at top, rgba(233, 30, 140, 0.12), transparent 36%),
      linear-gradient(180deg, #0d0d12 0%, #060608 100%);
    color: #ffffff;
  }

  .legal-document-card {
    width: min(900px, 100%);
    border: 1px solid rgba(233, 30, 140, 0.42);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(18, 18, 26, 0.96), rgba(8, 8, 12, 0.98));
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7), 0 0 40px rgba(233, 30, 140, 0.12);
    padding: 32px;
  }

  .legal-document-eyebrow {
    margin: 0 0 10px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    color: var(--pink-soft);
    text-transform: uppercase;
  }

  .legal-document-title-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .legal-document-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.2rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .legal-document-version {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: rgba(255, 133, 179, 0.8);
    letter-spacing: 0.1em;
    border: 1px solid rgba(233, 30, 140, 0.28);
    background: rgba(233, 30, 140, 0.05);
    padding: 8px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .legal-document-body {
    margin-top: 20px;
    color: rgba(255, 255, 255, 0.84);
    font-family: var(--font-ui);
    line-height: 1.75;
  }

  .legal-markdown-heading {
    margin: 28px 0 10px;
    font-family: var(--font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
  }

  .legal-markdown-h2 {
    font-size: 1.7rem;
  }

  .legal-markdown-h3 {
    font-size: 1.25rem;
  }

  .legal-markdown-paragraph {
    margin: 0 0 14px;
    font-family: var(--font-mono);
    font-size: 0.92rem;
    color: rgba(255, 255, 255, 0.82);
  }

  .legal-markdown-list {
    margin: 0 0 16px 20px;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 0.92rem;
    color: rgba(255, 255, 255, 0.82);
  }

  .legal-markdown-list li + li {
    margin-top: 8px;
  }

  .legal-markdown-link {
    color: var(--pink-soft);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .legal-markdown-strong {
    color: #ffffff;
    font-weight: 600;
  }

  .legal-document-actions {
    display: flex;
    gap: 12px;
    margin-top: 28px;
    flex-wrap: wrap;
  }

  .legal-document-button {
    border: 1px solid rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.04);
    color: #ffffff;
    padding: 12px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .legal-document-button:hover {
    transform: translateY(-1px);
    border-color: rgba(233, 30, 140, 0.7);
    background: rgba(233, 30, 140, 0.08);
  }
`

function parseInline(markdown: string): ReactNode[] {
  const tokens: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0
  let match: RegExpExecArray | null
  let keyIndex = 0

  while ((match = pattern.exec(markdown)) !== null) {
    if (match.index > cursor) {
      tokens.push(markdown.slice(cursor, match.index))
    }

    const token = match[0]
    if (token.startsWith('**')) {
      tokens.push(
        <strong key={`strong-${keyIndex}`} className="legal-markdown-strong">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      tokens.push(<code key={`code-${keyIndex}`}>{token.slice(1, -1)}</code>)
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        tokens.push(
          <a
            key={`link-${keyIndex}`}
            href={linkMatch[2]}
            target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
            rel={linkMatch[2].startsWith('http') ? 'noreferrer noopener' : undefined}
            className="legal-markdown-link"
          >
            {linkMatch[1]}
          </a>
        )
      }
    }

    cursor = pattern.lastIndex
    keyIndex += 1
  }

  if (cursor < markdown.length) {
    tokens.push(markdown.slice(cursor))
  }

  return tokens
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let listItems: string[] | null = null
  let listOrdered = false

  const flushParagraph = () => {
    if (!paragraph.length) {
      return
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="legal-markdown-paragraph">
        {parseInline(paragraph.join(' '))}
      </p>
    )
    paragraph = []
  }

  const flushList = () => {
    if (!listItems) {
      return
    }

    const ListTag = listOrdered ? 'ol' : 'ul'
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className="legal-markdown-list">
        {listItems.map((item, index) => (
          <li key={`${ListTag}-${index}`}>{parseInline(item)}</li>
        ))}
      </ListTag>
    )
    listItems = null
    listOrdered = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/)
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/)
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)

    if (headingMatch) {
      flushParagraph()
      flushList()
      const headingLevel = headingMatch[1].length
      const HeadingTag = headingLevel === 2 ? 'h2' : 'h3'
      blocks.push(
        <HeadingTag
          key={`h-${blocks.length}`}
          className={`legal-markdown-heading legal-markdown-h${headingLevel}`}
        >
          {parseInline(headingMatch[2])}
        </HeadingTag>
      )
      continue
    }

    if (unorderedMatch) {
      flushParagraph()
      if (listItems && listOrdered) {
        flushList()
      }
      if (!listItems) {
        listItems = []
      }
      listItems.push(unorderedMatch[1])
      listOrdered = false
      continue
    }

    if (orderedMatch) {
      flushParagraph()
      if (listItems && !listOrdered) {
        flushList()
      }
      if (!listItems) {
        listItems = []
      }
      listItems.push(orderedMatch[1])
      listOrdered = true
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()

  return blocks
}

interface LegalDocumentPageProps {
  title: string
  eyebrow: string
  version: string
  markdown: string
  backLabel: string
  backPath: string
}

export default function LegalDocumentPage({
  title,
  eyebrow,
  version,
  markdown,
  backLabel,
  backPath,
}: LegalDocumentPageProps) {
  const navigate = useNavigate()
  const renderedBlocks = useMemo(() => renderMarkdown(markdown), [markdown])

  return (
    <div className="legal-page">
      <style>{LEGAL_PAGE_CSS}</style>
      <section className="legal-document-card">
        <p className="legal-document-eyebrow">{eyebrow}</p>
        <div className="legal-document-title-row">
          <h1 className="legal-document-title">{title}</h1>
          <span className="legal-document-version">Version {version}</span>
        </div>

        <div className="legal-document-body">{renderedBlocks}</div>

        <div className="legal-document-actions">
          <button type="button" className="legal-document-button" onClick={() => navigate(backPath)}>
            {backLabel}
          </button>
        </div>
      </section>
    </div>
  )
}