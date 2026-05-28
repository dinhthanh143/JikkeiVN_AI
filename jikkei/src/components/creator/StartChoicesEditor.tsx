import { useEffect, useRef, useState } from 'react'
import {
  listStartChoices, createStartChoice, updateStartChoice, deleteStartChoice,
  type SceneStartChoiceRecord,
} from '@/services/backendApi'

interface StartChoicesEditorProps {
  sceneId: string
}

const MAX_CHOICES = 5

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid rgba(255,133,179,0.45)',
  background: 'rgba(255,255,255,0.85)',
  color: '#3a0a2e',
  fontSize: 13,
  fontFamily: 'var(--font-ui,sans-serif)',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui,sans-serif)',
  border: variant === 'primary'
    ? '2px solid rgba(255,133,179,0.9)'
    : variant === 'danger'
    ? '1px solid rgba(220,60,60,0.4)'
    : '1px solid rgba(255,133,179,0.3)',
  background: variant === 'primary'
    ? 'linear-gradient(180deg,rgba(255,185,215,0.95),rgba(233,30,140,0.85))'
    : variant === 'danger'
    ? 'rgba(220,60,60,0.08)'
    : 'rgba(255,255,255,0.5)',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#8b1a1a' : '#5a1a4a',
})

export default function StartChoicesEditor({ sceneId }: StartChoicesEditorProps) {
  const [choices, setChoices] = useState<SceneStartChoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  // Track which choice is being edited inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  // Drag state
  const dragIdx = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listStartChoices(sceneId)
        if (!cancelled) setChoices(data.sort((a, b) => a.display_order - b.display_order))
      } catch {
        if (!cancelled) setError('Failed to load start choices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [sceneId])

  const handleAdd = async () => {
    if (!newText.trim() || adding || choices.length >= MAX_CHOICES) return
    setAdding(true)
    setError(null)
    try {
      const created = await createStartChoice(sceneId, {
        choice_text: newText.trim(),
        display_order: choices.length,
      })
      setChoices((prev) => [...prev, created])
      setNewText('')
    } catch {
      setError('Failed to add choice')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStartChoice(sceneId, id)
      const updated = choices
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, display_order: i }))
      setChoices(updated)
      // Re-save display_order for remaining
      await Promise.all(updated.map((c) => updateStartChoice(sceneId, c.id, { choice_text: c.choice_text, display_order: c.display_order })))
    } catch {
      setError('Failed to delete choice')
    }
  }

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return
    try {
      const choice = choices.find((c) => c.id === id)!
      const updated = await updateStartChoice(sceneId, id, { choice_text: editText.trim(), display_order: choice.display_order })
      setChoices((prev) => prev.map((c) => c.id === id ? updated : c))
      setEditingId(null)
    } catch {
      setError('Failed to save choice')
    }
  }

  // Drag-to-reorder
  const handleDragStart = (idx: number) => { dragIdx.current = idx }

  const handleDrop = async (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return
    const reordered = [...choices]
    const [moved] = reordered.splice(dragIdx.current, 1)
    reordered.splice(targetIdx, 0, moved)
    const withOrder = reordered.map((c, i) => ({ ...c, display_order: i }))
    setChoices(withOrder)
    dragIdx.current = null
    try {
      await Promise.all(withOrder.map((c) => updateStartChoice(sceneId, c.id, { choice_text: c.choice_text, display_order: c.display_order })))
    } catch {
      setError('Failed to save order')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontFamily: 'var(--font-display,sans-serif)', fontSize: 14, color: '#5a1a4a', letterSpacing: '0.06em' }}>
          Start Choices
        </h4>
        <span style={{ fontSize: 11, color: 'rgba(90,26,74,0.5)' }}>
          {choices.length}/{MAX_CHOICES}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'rgba(90,26,74,0.55)', lineHeight: 1.5 }}>
        These choices appear in the ChoicePanel when a player starts this scene for the first time.
        Drag to reorder.
      </p>

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#cc2200', padding: '6px 10px', background: 'rgba(220,60,60,0.08)', borderRadius: 6 }}>{error}</p>
      )}

      {/* Choice list */}
      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(90,26,74,0.5)', fontStyle: 'italic' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {choices.map((choice, idx) => (
            <div
              key={choice.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,133,179,0.3)',
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <span style={{ fontSize: 14, color: 'rgba(90,26,74,0.3)', cursor: 'grab', userSelect: 'none', flexShrink: 0 }}>⠿</span>

              {/* Order badge */}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(90,26,74,0.4)', flexShrink: 0, width: 18, textAlign: 'center' }}>
                {idx + 1}
              </span>

              {/* Text / edit field */}
              {editingId === choice.id ? (
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(choice.id); if (e.key === 'Escape') setEditingId(null) }}
                  autoFocus
                  style={{ ...inputStyle, fontSize: 13 }}
                />
              ) : (
                <span
                  style={{ flex: 1, fontSize: 13, color: '#3a0a2e', cursor: 'text' }}
                  onDoubleClick={() => { setEditingId(choice.id); setEditText(choice.choice_text) }}
                  title="Double-click to edit"
                >
                  {choice.choice_text}
                </span>
              )}

              {/* Action buttons */}
              {editingId === choice.id ? (
                <>
                  <button onClick={() => handleSaveEdit(choice.id)} style={btnStyle('primary')}>Save</button>
                  <button onClick={() => setEditingId(null)} style={btnStyle('ghost')}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(choice.id); setEditText(choice.choice_text) }} style={btnStyle('ghost')}>✎</button>
                  <button onClick={() => handleDelete(choice.id)} style={btnStyle('danger')}>✕</button>
                </>
              )}
            </div>
          ))}

          {choices.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(90,26,74,0.4)', fontStyle: 'italic' }}>
              No start choices yet. Add one below.
            </p>
          )}
        </div>
      )}

      {/* Add new */}
      {choices.length < MAX_CHOICES && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newText}
            onChange={(e) => setNewText(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="New choice text..."
            style={inputStyle}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newText.trim()}
            style={{ ...btnStyle('primary'), opacity: adding || !newText.trim() ? 0.5 : 1, cursor: adding || !newText.trim() ? 'not-allowed' : 'pointer' }}
          >
            {adding ? '…' : '+ Add'}
          </button>
        </div>
      )}

      {/* Preview */}
      {choices.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'rgba(90,26,74,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Preview
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(10,10,15,0.75)', borderRadius: 10, border: '1px solid rgba(255,133,179,0.2)' }}>
            {choices.map((choice, idx) => (
              <div key={choice.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(20,10,30,0.88)', border: '2px solid rgba(255,133,179,0.4)', borderLeft: '4px solid rgba(255,133,179,0.8)', borderRadius: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,133,179,0.6)', fontWeight: 700 }}>›</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{choice.choice_text}</span>
                <span style={{ marginLeft: 'auto', fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.05)', fontFamily: 'var(--font-display,sans-serif)' }}>0{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
