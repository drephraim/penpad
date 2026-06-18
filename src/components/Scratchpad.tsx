"use client"

import React, { useState, useEffect } from "react"
import { Plus, Save, Trash2 } from "lucide-react"

interface ScratchpadNote {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

export default function Scratchpad() {
  const [notes, setNotes] = useState<ScratchpadNote[]>([])
  const [currentNote, setCurrentNote] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('penpad_scratchpad')
      if (stored) setNotes(JSON.parse(stored))
    } catch { }
  }, [])

  useEffect(() => {
    localStorage.setItem('penpad_scratchpad', JSON.stringify(notes))
  }, [notes])

  const addNote = () => {
    if (!currentNote.trim()) return
    const note: ScratchpadNote = {
      id: Date.now().toString(),
      content: currentNote.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setNotes((prev) => [note, ...prev])
    setCurrentNote("")
  }

  const updateNote = (id: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content, updatedAt: Date.now() } : n))
    )
  }

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="sidebar-tab-content fade-in scratchpad-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim" style={{ marginBottom: '0.6rem' }}>
        Scratchpad
      </div>

      <div className="scratchpad-input" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <textarea
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          placeholder="Quick note or idea..."
          rows={2}
          style={{
            flex: 1, padding: '0.5rem', fontSize: '0.75rem', fontFamily: 'inherit',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical'
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addNote() } }}
        />
        <button
          onClick={addNote}
          disabled={!currentNote.trim()}
          className="btn-ai-sub btn-ai-primary"
          style={{ alignSelf: 'flex-end', padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="scratchpad-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {notes.length === 0 && (
          <div className="empty-state-text" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            No scratchpad notes yet. Jot down quick ideas above.
          </div>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="scratchpad-item"
            style={{
              background: 'var(--surface)', border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-sm)', padding: '0.5rem'
            }}
          >
            {editingId === note.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <textarea
                  value={note.content}
                  onChange={(e) => updateNote(note.id, e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '0.4rem', fontSize: '0.75rem', fontFamily: 'inherit',
                    background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button className="btn-ai-sub btn-sm" onClick={() => setEditingId(null)} style={{ fontSize: '0.65rem' }}>
                    <Save size={11} /> Done
                  </button>
                  <button className="btn-ai-sub btn-sm" onClick={() => deleteNote(note.id)} style={{ fontSize: '0.65rem', color: 'var(--error)' }}>
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingId(note.id)}
                style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {note.content}
              </div>
            )}
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
