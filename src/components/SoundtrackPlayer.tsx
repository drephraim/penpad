"use client"

import React, { useState, useEffect } from "react"
import { Play, Plus, X, Trash2 } from "lucide-react"

interface Soundtrack {
  id: string
  title: string
  url: string
  type: 'youtube' | 'spotify'
}

export default function SoundtrackPlayer({ projectId }: { projectId: string }) {
  const [tracks, setTracks] = useState<Soundtrack[]>([])
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newTitle, setNewTitle] = useState("")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`penpad_soundtrack_${projectId}`)
      if (stored) setTracks(JSON.parse(stored))
    } catch { }
  }, [projectId])

  useEffect(() => {
    localStorage.setItem(`penpad_soundtrack_${projectId}`, JSON.stringify(tracks))
  }, [tracks, projectId])

  const addTrack = () => {
    if (!newUrl.trim() || !newTitle.trim()) return
    const type: Soundtrack['type'] = newUrl.includes('youtube.com') || newUrl.includes('youtu.be') ? 'youtube' : 'spotify'
    const track: Soundtrack = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: newUrl.trim(),
      type
    }
    setTracks((prev) => [...prev, track])
    setNewUrl("")
    setNewTitle("")
    setShowAdd(false)
  }

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id))
    if (activeTrackId === id) setActiveTrackId(null)
  }

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&loop=1&playlist=${match[1]}` : null
  }

  const activeTrack = tracks.find((t) => t.id === activeTrackId)

  return (
    <div className="sidebar-tab-content fade-in soundtrack-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Soundtrack</div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', margin: '0.3rem 0 0.6rem' }}>
        Background music for your writing session
      </p>

      {activeTrack && activeTrack.type === 'youtube' && (
        <div className="soundtrack-player" style={{ marginBottom: '0.6rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {(() => {
            const embedUrl = getYouTubeEmbedUrl(activeTrack.url)
            return embedUrl ? (
              <iframe
                src={embedUrl}
                title={activeTrack.title}
                width="100%"
                height="120"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            ) : (
              <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <a href={activeTrack.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                  Open {activeTrack.title} ↗
                </a>
              </div>
            )
          })()}
          <div className="soundtrack-active-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Now Playing: {activeTrack.title}</span>
            <button className="btn-icon" onClick={() => setActiveTrackId(null)} title="Stop" style={{ background: 'none', border: 0, color: 'var(--error)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="soundtrack-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`soundtrack-item ${activeTrackId === track.id ? 'active' : ''}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.5rem',
              background: activeTrackId === track.id ? 'var(--primary-light)' : 'var(--surface)',
              border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
            }}
            onClick={() => setActiveTrackId(track.id)}
          >
            <Play size={14} style={{ color: track.type === 'youtube' ? '#ff0000' : '#1db954', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.title}
            </span>
            {activeTrackId === track.id && <Play size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
            <button
              className="btn-icon"
              onClick={(e) => { e.stopPropagation(); removeTrack(track.id) }}
              title="Remove"
              style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, padding: '2px' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {tracks.length === 0 && !showAdd && (
        <div className="empty-state-text" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          No tracks added. Add YouTube or Spotify links.
        </div>
      )}

      {showAdd ? (
        <div className="soundtrack-add-form" style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Track name"
            style={{ padding: '0.4rem', fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="YouTube or Spotify URL"
            style={{ padding: '0.4rem', fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
          />
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button className="btn-ai-sub btn-ai-primary btn-sm" onClick={addTrack} disabled={!newUrl.trim() || !newTitle.trim()}>
              <Plus size={12} /> Add
            </button>
            <button className="btn-ai-sub btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ai-sub" onClick={() => setShowAdd(true)} style={{ marginTop: '0.6rem', width: '100%', justifyContent: 'center', fontSize: '0.7rem' }}>
          <Plus size={12} /> Add Soundtrack
        </button>
      )}
    </div>
  )
}
