"use client"

import React, { useState } from "react"
import { Sparkles, RefreshCw, ThumbsUp, Copy, Check } from "lucide-react"

type PromptType = 'scene' | 'dialogue' | 'character' | 'plot' | 'description'

const PROMPT_TEMPLATES: Record<PromptType, string[]> = {
  scene: [
    "A character returns to a place they swore they'd never visit again. What changed?",
    "Write a scene where two characters are having very different conversations — neither realizes they're not talking about the same thing.",
    "A character discovers something hidden in a book they've read a hundred times.",
    "The protagonist must make an important decision with incomplete information.",
    "A conversation that starts casual but reveals a devastating secret by the end."
  ],
  dialogue: [
    "Write a dialogue where one character is trying to say goodbye but keeps getting interrupted.",
    "Two old friends meet after years apart. Neither wants to admit how much they've changed.",
    "A argument where both characters have valid points but completely different values.",
    "A character tries to explain something impossible to someone who trusts them completely.",
    "Write a dialogue using only questions."
  ],
  character: [
    "A character who has a reputation they didn't earn but can't escape.",
    "Someone whose greatest strength becomes their fatal flaw in a new situation.",
    "A character who is kind not because they're good, but because they're afraid of conflict.",
    "Write a character who is defined by what they refuse to say.",
    "A side character who thinks they're the protagonist of their own story."
  ],
  plot: [
    "The MacGuffin everyone is searching for has already been destroyed. Nobody knows this yet.",
    "The prophesied chosen one refuses to participate.",
    "A plan that has been in motion for years succeeds on page one. Now what?",
    "The mentor reveals they were never on the hero's side — but their reasons are sympathetic.",
    "Two characters with opposing goals realize they need each other to succeed."
  ],
  description: [
    "Describe a storm approaching through the senses of someone who's never experienced rain.",
    "A place that feels safe but should be terrifying — or vice versa.",
    "Describe a character entirely through the objects in their pockets or room.",
    "A feast in a culture where food is sacred — describe the ritual and the meal.",
    "A landscape that reflects the emotional state of the POV character without explicitly stating it."
  ]
}

const STYLE_TONES = [
  "Whimsical", "Grimdark", "Romantic", "Mysterious", "Heroic",
  "Tragic", "Comedic", "Suspenseful", "Philosophical", "Sensual"
]

export default function WritingPrompts() {
  const [promptType, setPromptType] = useState<PromptType>('scene')
  const [currentPrompt, setCurrentPrompt] = useState("")
  const [toneFilter, setToneFilter] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('penpad_prompt_favorites') || '[]') } catch { return [] }
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")

  const generatePrompt = () => {
    setIsGenerating(true)
    const templates = PROMPT_TEMPLATES[promptType]
    let prompt = templates[Math.floor(Math.random() * templates.length)]

    if (toneFilter) {
      const toneAdditions: Record<string, string> = {
        Grimdark: ' — but frame it with a sense of inevitable doom.',
        Romantic: ' — and infuse the scene with yearning or tenderness.',
        Mysterious: ' — but leave the reader unsure of what is real.',
        Whimsical: ' — approach it with playful, almost magical logic.',
        Heroic: ' — frame this as a moment of profound courage.',
        Tragic: ' — ensure the reader knows this will end in sorrow.',
        Comedic: ' — play it for dark humor or irony.',
        Suspenseful: ' — build an undercurrent of dread throughout.',
        Philosophical: ' — use this to explore a deeper question about existence.',
        Sensual: ' — engage all five senses in vivid detail.'
      }
      if (toneAdditions[toneFilter]) {
        prompt += toneAdditions[toneFilter]
      }
    }

    setCurrentPrompt(prompt)
    setIsGenerating(false)
  }

  const toggleFavorite = (prompt: string) => {
    const next = favorites.includes(prompt)
      ? favorites.filter((f) => f !== prompt)
      : [...favorites, prompt]
    setFavorites(next)
    localStorage.setItem('penpad_prompt_favorites', JSON.stringify(next))
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="sidebar-tab-content fade-in prompts-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Writing Prompts</div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', margin: '0.3rem 0 0.6rem' }}>
        Get inspired with story prompts and ideas
      </p>

      <div className="prompts-type-tabs" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(Object.keys(PROMPT_TEMPLATES) as PromptType[]).map((t) => (
          <button
            key={t}
            className={`filter-chip ${promptType === t ? 'active' : ''}`}
            onClick={() => setPromptType(t)}
            style={{ fontSize: '0.6rem', textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="prompts-tone-picker" style={{ marginBottom: '0.5rem' }}>
        <select
          value={toneFilter}
          onChange={(e) => setToneFilter(e.target.value)}
          style={{
            width: '100%', padding: '0.35rem', fontSize: '0.7rem',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer'
          }}
        >
          <option value="">Any tone</option>
          {STYLE_TONES.map((tone) => (
            <option key={tone} value={tone}>{tone}</option>
          ))}
        </select>
      </div>

      <button
        className="btn-ai-sub btn-ai-primary"
        onClick={generatePrompt}
        disabled={isGenerating}
        style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', marginBottom: '0.6rem' }}
      >
        {isGenerating ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
        {isGenerating ? 'Thinking...' : currentPrompt ? 'Another Prompt' : 'Generate Prompt'}
      </button>

      {currentPrompt && (
        <div className="prompt-card" style={{
          padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--surface-border)', marginBottom: '0.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.6', margin: 0 }}>
            {currentPrompt}
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn-ai-sub btn-sm" onClick={() => copyPrompt(currentPrompt)} title="Copy">
              {copiedId === currentPrompt ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
            </button>
            <button className="btn-ai-sub btn-sm" onClick={() => toggleFavorite(currentPrompt)} title="Save">
              <ThumbsUp size={12} style={{ color: favorites.includes(currentPrompt) ? 'var(--primary)' : undefined }} />
            </button>
          </div>
        </div>
      )}

      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        placeholder="Or describe the kind of prompt you want..."
        rows={2}
        style={{
          width: '100%', padding: '0.4rem', fontSize: '0.7rem', fontFamily: 'inherit',
          background: 'var(--surface)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical', marginTop: '0.4rem'
        }}
      />

      {favorites.length > 0 && (
        <div style={{ marginTop: '0.8rem' }}>
          <div className="section-title text-xs font-bold uppercase tracking-wider text-dim" style={{ fontSize: '0.6rem', marginBottom: '0.3rem' }}>
            Saved Prompts ({favorites.length})
          </div>
          {favorites.map((prompt, idx) => (
            <div key={idx} className="prompt-card" style={{
              padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--surface-border)', marginBottom: '0.3rem', fontSize: '0.7rem',
              color: 'var(--text-secondary)', cursor: 'pointer'
            }}
              onClick={() => setCurrentPrompt(prompt)}
            >
              {prompt.length > 120 ? prompt.slice(0, 120) + '...' : prompt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
