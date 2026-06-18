"use client"

import React, { useState, useCallback } from "react"
import { VolumeX, Pause, Play, User, BookOpen } from "lucide-react"

interface CharacterVoiceReaderProps {
  content: string
  chapterTitle?: string
  characters?: string[]
}

export default function CharacterVoiceReader({ content, chapterTitle, characters = [] }: CharacterVoiceReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [voiceType, setVoiceType] = useState<'narration' | 'character'>('narration')
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null)
  const [rate, setRate] = useState(1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [supported, setSupported] = useState(true)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false)
      return
    }
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      if (available.length > 0) setVoices(available)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  const getVoiceForType = useCallback((type: 'narration' | 'character'): SpeechSynthesisVoice | null => {
    const englishVoices = voices.filter((v) => v.lang.startsWith('en'))
    if (englishVoices.length === 0) return voices[0] || null

    if (type === 'character') {
      const characterVoice = englishVoices.find((v) => v.name.includes('Female'))
      return characterVoice || englishVoices[1] || englishVoices[0]
    }
    return englishVoices.find((v) => v.name.includes('Male')) || englishVoices[0] || null
  }, [voices])

  const detectCharacterLines = useCallback((text: string): { narrator: string; dialog: string[] } => {
    const lines = text.split('\n')
    const dialog: string[] = []
    const narrator: string[] = []

    const dialogRegex = /[""'']([^"""'']+)[""'']/

    for (const line of lines) {
      const trimmed = line.trim()
      if (dialogRegex.test(trimmed) || trimmed.startsWith('"') || trimmed.startsWith('"')) {
        dialog.push(trimmed)
      } else {
        narrator.push(trimmed)
      }
    }

    return {
      narrator: narrator.join('. '),
      dialog
    }
  }, [])

  const speak = useCallback(() => {
    if (!supported || !content) return

    window.speechSynthesis.cancel()

    const { narrator, dialog } = voiceType === 'character' && selectedCharacter
      ? detectCharacterLines(content)
      : { narrator: content, dialog: [] }

    const textToRead = voiceType === 'character' && selectedCharacter
      ? dialog.join('. ')
      : narrator

    if (!textToRead.trim()) return

    const u = new SpeechSynthesisUtterance(textToRead)
    const v = getVoiceForType(voiceType)
    if (v) u.voice = v
    u.rate = rate
    u.pitch = voiceType === 'character' ? 1.2 : 1
    u.onend = () => setIsPlaying(false)
    u.onerror = () => setIsPlaying(false)

    window.speechSynthesis.speak(u)
    setIsPlaying(true)
  }, [content, voiceType, selectedCharacter, rate, supported, getVoiceForType, detectCharacterLines])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
      } else {
        window.speechSynthesis.resume()
      }
      setIsPlaying(!isPlaying)
    } else {
      speak()
    }
  }, [isPlaying, speak])

  if (!supported) {
    return (
      <div className="sidebar-tab-content fade-in">
        <div className="empty-state-text" style={{ textAlign: 'center', padding: '2rem 0' }}>
          Text-to-speech is not supported in your browser.
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-tab-content fade-in voice-reader-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Voice Reader</div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', margin: '0.3rem 0 0.6rem' }}>
        Listen to your chapter with AI character voice detection
      </p>

      {chapterTitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem', textAlign: 'center' }}>
          <BookOpen size={12} style={{ marginRight: '0.3rem' }} />
          {chapterTitle}
        </div>
      )}

      <div className="voice-mode-tabs" style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
        <button
          className={`filter-chip ${voiceType === 'narration' ? 'active' : ''}`}
          onClick={() => setVoiceType('narration')}
          style={{ flex: 1, fontSize: '0.65rem' }}
        >
          <BookOpen size={12} /> Narration
        </button>
        <button
          className={`filter-chip ${voiceType === 'character' ? 'active' : ''}`}
          onClick={() => setVoiceType('character')}
          style={{ flex: 1, fontSize: '0.65rem' }}
          disabled={characters.length === 0}
        >
          <User size={12} /> Dialog
        </button>
      </div>

      {voiceType === 'character' && (
        <select
          value={selectedCharacter || ''}
          onChange={(e) => setSelectedCharacter(e.target.value || null)}
          style={{
            width: '100%', padding: '0.35rem', fontSize: '0.7rem', marginBottom: '0.5rem',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer'
          }}
        >
          <option value="">Select a character...</option>
          {characters.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      )}

      <div className="voice-rate-control" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Speed:</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', minWidth: '2rem', textAlign: 'right' }}>{rate}x</span>
      </div>

      <div className="voice-controls" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
        <button
          className="voice-btn"
          onClick={togglePlayback}
          style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: isPlaying ? 'var(--warning)' : 'var(--primary)',
            color: 'white', border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'var(--transition)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button
          className="btn-icon"
          onClick={stop}
          title="Stop"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)'
          }}
        >
          <VolumeX size={16} />
        </button>
      </div>

      {isPlaying && (
        <div className="voice-visualizer" style={{
          marginTop: '0.6rem', height: '3px', background: 'var(--surface-border)',
          borderRadius: '2px', overflow: 'hidden'
        }}>
          <div className="voice-progress" style={{
            height: '100%', width: '100%', background: 'var(--primary)',
            animation: 'voiceWave 1.5s ease-in-out infinite'
          }} />
        </div>
      )}

      <div className="voice-voices-info" style={{ marginTop: '0.6rem', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {voices.length > 0 ? `${voices.length} voices available` : 'Loading voices...'}
      </div>
    </div>
  )
}
