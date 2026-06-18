"use client"

import React, { useState, useCallback } from "react"
import { Plus } from "lucide-react"

interface SceneCard {
  id: string
  title: string
  description: string
  chapterId?: string
  characters: string[]
  status: 'outline' | 'draft' | 'revised' | 'done'
  order: number
}

interface SceneColumn {
  id: string
  title: string
  scenes: SceneCard[]
}

interface StoryboardProps {
  projectId: string
}

const DEFAULT_COLUMNS: SceneColumn[] = [
  { id: 'outline', title: 'To Write', scenes: [] },
  { id: 'draft', title: 'Drafting', scenes: [] },
  { id: 'revised', title: 'Revising', scenes: [] },
  { id: 'done', title: 'Completed', scenes: [] },
]

export default function Storyboard({ projectId }: StoryboardProps) {
  const [columns, setColumns] = useState<SceneColumn[]>(() => {
    try {
      const stored = localStorage.getItem(`penpad_storyboard_${projectId}`)
      if (stored) return JSON.parse(stored)
    } catch { }
    return DEFAULT_COLUMNS.map((c) => ({ ...c, scenes: [] }))
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragColId, setDragColId] = useState<string | null>(null)
  const [showNewScene, setShowNewScene] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newColId, setNewColId] = useState('outline')
  const [editingId, setEditingId] = useState<string | null>(null)

  const persist = useCallback((cols: SceneColumn[]) => {
    setColumns(cols)
    localStorage.setItem(`penpad_storyboard_${projectId}`, JSON.stringify(cols))
  }, [projectId])

  const addScene = () => {
    if (!newTitle.trim()) return
    const scene: SceneCard = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      characters: [],
      status: 'outline',
      order: columns.find((c) => c.id === newColId)?.scenes.length || 0
    }
    const next = columns.map((col) =>
      col.id === newColId ? { ...col, scenes: [...col.scenes, scene] } : col
    )
    persist(next)
    setNewTitle("")
    setNewDesc("")
    setShowNewScene(false)
  }

  const deleteScene = (colId: string, sceneId: string) => {
    const next = columns.map((col) =>
      col.id === colId ? { ...col, scenes: col.scenes.filter((s) => s.id !== sceneId) } : col
    )
    persist(next)
  }

  const updateScene = (colId: string, sceneId: string, updates: Partial<SceneCard>) => {
    const next = columns.map((col) =>
      col.id === colId
        ? { ...col, scenes: col.scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)) }
        : col
    )
    persist(next)
  }

  const handleDragStart = (colId: string, sceneId: string) => {
    setDraggingId(sceneId)
    setDragColId(colId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetColId: string, targetIdx?: number) => {
    if (!draggingId || !dragColId) return

    let sourceScene: SceneCard | undefined
    const next = columns.map((col) => {
      if (col.id === dragColId) {
        const found = col.scenes.find((s) => s.id === draggingId)
        if (found) sourceScene = found
        return { ...col, scenes: col.scenes.filter((s) => s.id !== draggingId) }
      }
      return col
    })

    if (sourceScene) {
      const updated: SceneCard = {
        id: sourceScene.id,
        title: sourceScene.title,
        description: sourceScene.description,
        chapterId: sourceScene.chapterId,
        characters: sourceScene.characters,
        status: (targetColId === 'outline' ? 'outline' : targetColId === 'draft' ? 'draft' : targetColId === 'revised' ? 'revised' : 'done') as SceneCard['status'],
        order: sourceScene.order
      }
      persist(next.map((col) => {
        if (col.id === targetColId) {
          const scenes = [...col.scenes]
          if (targetIdx !== undefined) {
            scenes.splice(targetIdx, 0, updated)
          } else {
            scenes.push(updated)
          }
          return { ...col, scenes }
        }
        return col
      }))
    }

    setDraggingId(null)
    setDragColId(null)
  }

  const totalScenes = columns.reduce((sum, col) => sum + col.scenes.length, 0)

  return (
    <div className="sidebar-tab-content fade-in storyboard-panel">
      <div className="storyboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div>
          <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Storyboard</div>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{totalScenes} scenes</span>
        </div>
        <button className="btn-ai-sub btn-ai-primary btn-sm" onClick={() => setShowNewScene(!showNewScene)}>
          <Plus size={12} /> Scene
        </button>
      </div>

      {showNewScene && (
        <div className="storyboard-new-scene" style={{
          padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--surface-border)', marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
        }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Scene title"
            style={{ padding: '0.35rem', fontSize: '0.7rem', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Brief description"
            rows={2}
            style={{ padding: '0.35rem', fontSize: '0.7rem', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <select
            value={newColId}
            onChange={(e) => setNewColId(e.target.value)}
            style={{ padding: '0.35rem', fontSize: '0.65rem', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button className="btn-ai-sub btn-ai-primary btn-sm" onClick={addScene} disabled={!newTitle.trim()}>Add</button>
            <button className="btn-ai-sub btn-sm" onClick={() => setShowNewScene(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="storyboard-columns" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {columns.map((col) => (
          <div
            key={col.id}
            className="storyboard-column"
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => { e.preventDefault(); handleDrop(col.id) }}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${draggingId && dragColId !== col.id ? 'var(--primary)' : 'var(--surface-border)'}`,
              transition: 'border-color 0.2s'
            }}
          >
            <div className="storyboard-col-header" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--surface-border)',
              fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)'
            }}>
              <span>{col.title}</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{col.scenes.length}</span>
            </div>

            <div className="storyboard-scenes" style={{ padding: '0.25rem', minHeight: '40px' }}>
              {col.scenes.length === 0 && (
                <div className="empty-state-text" style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.6rem' }}>
                  Drop scenes here
                </div>
              )}
              {col.scenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  className="storyboard-scene-card"
                  draggable
                  onDragStart={() => handleDragStart(col.id, scene.id)}
                  onDragEnd={() => { setDraggingId(null); setDragColId(null) }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(col.id, idx) }}
                  style={{
                    padding: '0.4rem', marginBottom: '0.25rem',
                    background: draggingId === scene.id ? 'var(--primary-light)' : 'var(--surface-raised)',
                    border: `1px solid ${draggingId === scene.id ? 'var(--primary)' : 'var(--surface-border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'grab', opacity: draggingId === scene.id ? 0.5 : 1
                  }}
                >
                  {editingId === scene.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <input
                        type="text"
                        value={scene.title}
                        onChange={(e) => updateScene(col.id, scene.id, { title: e.target.value })}
                        style={{ padding: '0.2rem', fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '0.2rem' }}>
                        <button className="btn-ai-sub btn-sm" onClick={() => setEditingId(null)} style={{ fontSize: '0.55rem' }}>Done</button>
                        <button className="btn-ai-sub btn-sm" onClick={() => { deleteScene(col.id, scene.id); setEditingId(null) }} style={{ fontSize: '0.55rem', color: 'var(--error)' }}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setEditingId(scene.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>{scene.title}</div>
                      {scene.description && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '0.15rem', lineHeight: '1.4' }}>
                          {scene.description.length > 80 ? scene.description.slice(0, 80) + '...' : scene.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
