import { useEffect, useState } from 'react'
import {
  listSceneLore, createSceneLore, deleteSceneLore,
  listCharacterLore, createCharacterLore, deleteCharacterLore,
  type LoreChunkRecord, type LoreChunkCreatePayload,
} from '@/services/backendApi'

type ChunkType = 'world' | 'rule' | 'character' | 'event'

interface LoreEditorProps {
  sceneId: string
  /** If set, this editor manages character-scoped lore instead of scene-scoped */
  characterId?: string
  /** Display label for the section header */
  label?: string
}

const CHUNK_TYPE_OPTIONS: { value: ChunkType; label: string; hint: string }[] = [
  { value: 'world',     label: 'World',     hint: 'Setting facts, geography, lore' },
  { value: 'rule',      label: 'Rule',      hint: 'Plot rules, always-true constraints' },
  { value: 'character', label: 'Character', hint: 'Personality, backstory, secrets' },
  { value: 'event',     label: 'Event',     hint: 'Historical events, past incidents' },
]

const PRIORITY_OPTIONS = [
  { value: 4, label: '4 — Always inject', hint: 'Injected every turn regardless of query' },
  { value: 3, label: '3 — High',          hint: 'Almost always injected' },
  { value: 2, label: '2 — Medium',        hint: 'Injected when semantically relevant' },
  { value: 1, label: '1 — Low',           hint: 'Only on strong semantic match' },
]

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,133,179,0.3)',
  borderRadius: 10,
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(90,26,74,0.6)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1.5px solid rgba(255,133,179,0.45)',
  background: 'rgba(255,255,255,0.85)',
  color: '#3a0a2e',
  fontSize: 13,
  fontFamily: 'var(--font-ui,sans-serif)',
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical' as const,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  resize: undefined,
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: '2px solid rgba(255,133,179,0.9)',
  background: 'linear-gradient(180deg,rgba(255,185,215,0.95),rgba(233,30,140,0.85))',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-display,sans-serif)',
  letterSpacing: '0.04em',
}

const btnDelete: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid rgba(220,60,60,0.4)',
  background: 'rgba(220,60,60,0.08)',
  color: '#8b1a1a',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui,sans-serif)',
}

export default function LoreEditor({ sceneId, characterId, label }: LoreEditorProps) {
  const [chunks, setChunks] = useState<LoreChunkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [content, setContent] = useState('')
  const [chunkType, setChunkType] = useState<ChunkType>('world')
  const [priority, setPriority] = useState(2)

  const isCharMode = Boolean(characterId)
  const sectionLabel = label ?? (isCharMode ? 'Character Lore' : 'World Lore')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = isCharMode
          ? await listCharacterLore(sceneId, characterId!)
          : await listSceneLore(sceneId)
        if (!cancelled) setChunks(data)
      } catch {
        if (!cancelled) setError('Failed to load lore chunks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [sceneId, characterId, isCharMode])

  const handleAdd = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    setError(null)
    const payload: LoreChunkCreatePayload = {
      content: content.trim(),
      chunk_type: chunkType,
      priority,
    }
    try {
      const created = isCharMode
        ? await createCharacterLore(sceneId, characterId!, payload)
        : await createSceneLore(sceneId, payload)
      setChunks((prev) => [created, ...prev])
      setContent('')
    } catch {
      setError('Failed to save lore chunk')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      if (isCharMode) await deleteCharacterLore(sceneId, characterId!, id)
      else await deleteSceneLore(sceneId, id)
      setChunks((prev) => prev.filter((c) => c.id !== id))
    } catch {
      setError('Failed to delete lore chunk')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontFamily: 'var(--font-display,sans-serif)', fontSize: 14, color: '#5a1a4a', letterSpacing: '0.06em' }}>
          {sectionLabel}
        </h4>
        <span style={{ fontSize: 11, color: 'rgba(90,26,74,0.5)' }}>{chunks.length} chunk{chunks.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add form */}
      <div style={{ ...cardStyle, background: 'rgba(255,230,242,0.65)', border: '1.5px dashed rgba(255,133,179,0.5)' }}>
        <span style={labelStyle}>Add chunk</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          placeholder="Enter lore text..."
          rows={3}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Type</span>
            <select value={chunkType} onChange={(e) => setChunkType(e.currentTarget.value as ChunkType)} style={selectStyle}>
              {CHUNK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Priority</span>
            <select value={priority} onChange={(e) => setPriority(Number(e.currentTarget.value))} style={selectStyle}>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              style={{ ...btnPrimary, opacity: saving || !content.trim() ? 0.5 : 1, cursor: saving || !content.trim() ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#cc2200', padding: '6px 10px', background: 'rgba(220,60,60,0.08)', borderRadius: 6 }}>{error}</p>
      )}

      {/* Chunk list */}
      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(90,26,74,0.5)', fontStyle: 'italic' }}>Loading…</p>
      ) : chunks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(90,26,74,0.4)', fontStyle: 'italic' }}>No lore chunks yet. Add one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chunks.map((chunk) => (
            <div key={chunk.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#3a0a2e', lineHeight: 1.5, flex: 1 }}>{chunk.content}</p>
                <button onClick={() => handleDelete(chunk.id)} style={btnDelete}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,133,179,0.15)', color: '#8b1a6a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {chunk.chunk_type}
                </span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(90,26,74,0.08)', color: 'rgba(90,26,74,0.6)', fontWeight: 600 }}>
                  priority {chunk.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
