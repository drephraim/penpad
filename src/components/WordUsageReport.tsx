"use client"

import React, { useState, useMemo } from "react"
import { BarChart3 } from "lucide-react"

interface WordUsageReportProps {
  chapters: { id: string; title: string; content: string }[]
}

const OVERUSED_WORDS = [
  'just', 'very', 'really', 'quite', 'literally', 'actually', 'basically',
  'suddenly', 'immediately', 'somehow', 'somewhat', 'slightly', 'barely',
  'almost', 'nearly', 'simply', 'merely', 'quite', 'rather'
]

const ADVERB_ENDINGS = ['ly', 'ingly', 'edly']

export default function WordUsageReport({ chapters }: WordUsageReportProps) {
  const [tab, setTab] = useState<'overused' | 'adverbs' | 'readability' | 'vocabulary'>('overused')

  const report = useMemo(() => {
    const allText = chapters.map((c) => c.content).join(' ')
    const words = allText.toLowerCase().match(/\b[a-z]+(?:'[a-z]+)?\b/g) || []
    const uniqueWords = new Set(words)
    const totalWords = words.length

    const wordFrequency: Record<string, number> = {}
    words.forEach((w) => {
      wordFrequency[w] = (wordFrequency[w] || 0) + 1
    })

    const overused = OVERUSED_WORDS.map((w) => ({
      word: w,
      count: wordFrequency[w] || 0,
      frequency: totalWords > 0 ? ((wordFrequency[w] || 0) / totalWords * 100).toFixed(2) : '0'
    })).filter((w) => w.count > 0).sort((a, b) => b.count - a.count)

    const adverbCounts: { word: string; count: number }[] = []
    words.forEach((w) => {
      if (ADVERB_ENDINGS.some((end) => w.endsWith(end))) {
        const existing = adverbCounts.find((a) => a.word === w)
        if (existing) existing.count++
        else adverbCounts.push({ word: w, count: 1 })
      }
    })
    adverbCounts.sort((a, b) => b.count - a.count)

    const totalAdverbs = adverbCounts.reduce((sum, a) => sum + a.count, 0)
    const adverbDensity = totalWords > 0 ? ((totalAdverbs / totalWords) * 100).toFixed(2) : '0'

    const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const avgSentenceLength = sentences.length > 0 ? Math.round(totalWords / sentences.length) : 0
    const avgWordLength = words.length > 0 ? (allText.replace(/\s/g, '').length / words.length).toFixed(1) : '0'

    const topWords = Object.entries(wordFrequency)
      .filter(([w]) => w.length > 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30)

    return {
      totalWords,
      uniqueWords: uniqueWords.size,
      overused,
      adverbCounts,
      totalAdverbs,
      adverbDensity,
      avgSentenceLength,
      avgWordLength,
      topWords,
      sentences: sentences.length
    }
  }, [chapters])

  if (chapters.length === 0) {
    return (
      <div className="sidebar-tab-content fade-in">
        <div className="empty-state-text" style={{ textAlign: 'center', padding: '2rem 0' }}>
          <BarChart3 size={24} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <div>Write some chapters to see word usage reports.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-tab-content fade-in wordreport-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Word Usage Report</div>

      <div className="wordreport-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', margin: '0.6rem 0' }}>
        <div style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{report.totalWords.toLocaleString()}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Total Words</div>
        </div>
        <div style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>{report.uniqueWords.toLocaleString()}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Unique Words</div>
        </div>
        <div style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>{report.avgSentenceLength}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Avg Sentence</div>
        </div>
        <div style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: report.totalAdverbs > 100 ? 'var(--error)' : 'var(--success)' }}>{report.adverbDensity}%</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Adverb Density</div>
        </div>
      </div>

      <div className="wordreport-tabs" style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
        {(['overused', 'adverbs', 'readability', 'vocabulary'] as const).map((t) => (
          <button
            key={t}
            className={`filter-chip ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ flex: 1, fontSize: '0.6rem', padding: '0.25rem 0' }}
          >
            {t === 'overused' ? 'Overused' : t === 'adverbs' ? 'Adverbs' : t === 'readability' ? 'Readability' : 'Top Words'}
          </button>
        ))}
      </div>

      {tab === 'overused' && (
        <div className="wordreport-list">
          {report.overused.length === 0 && <div className="empty-state-text">No overused words detected!</div>}
          {report.overused.map((item) => (
            <div key={item.word} className="wordreport-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--surface-border)', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{'\u201C'}{item.word}{'\u201D'}</span>
              <span style={{ color: 'var(--text-dim)' }}>{item.count}x ({item.frequency}%)</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'adverbs' && (
        <div className="wordreport-list">
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.3rem', padding: '0.3rem 0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
            {report.totalAdverbs} adverbs found ({report.adverbDensity}% of all words)
            {report.totalAdverbs > 100 && <span style={{ color: 'var(--error)', display: 'block', marginTop: '0.2rem' }}>Your writing may be adverb-heavy. Consider replacing some with stronger verbs.</span>}
          </div>
          {report.adverbCounts.slice(0, 40).map((item) => (
            <div key={item.word} className="wordreport-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--surface-border)', fontSize: '0.7rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{item.word}</span>
              <span style={{ color: 'var(--text-dim)' }}>{item.count}x</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'readability' && (
        <div className="wordreport-readability" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Avg Sentence Length</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: report.avgSentenceLength > 25 ? 'var(--warning)' : report.avgSentenceLength > 15 ? 'var(--success)' : 'var(--text-primary)' }}>{report.avgSentenceLength} words</span>
            </div>
            <div style={{ height: '4px', background: 'var(--surface-border)', borderRadius: '2px', marginTop: '0.3rem' }}>
              <div style={{ width: `${Math.min(100, (report.avgSentenceLength / 30) * 100)}%`, height: '100%', background: report.avgSentenceLength > 25 ? 'var(--warning)' : 'var(--success)', borderRadius: '2px' }} />
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {report.avgSentenceLength > 25 ? 'Sentences are long — consider breaking some up' : 'Sentences are a good length'}
            </div>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Avg Word Length</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{report.avgWordLength} chars</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {Number(report.avgWordLength) > 5 ? 'Vocabulary skews complex — good for literary fiction' : 'Vocabulary is accessible and clear'}
            </div>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Lexical Diversity</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{report.totalWords > 0 ? ((report.uniqueWords / report.totalWords) * 100).toFixed(1) : '0'}%</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {report.uniqueWords} unique words out of {report.totalWords} total
            </div>
          </div>
        </div>
      )}

      {tab === 'vocabulary' && (
        <div className="wordreport-list">
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Most used words (4+ letters)</div>
          {report.topWords.map(([word, count], idx) => (
            <div key={word} className="wordreport-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--surface-border)', fontSize: '0.7rem' }}>
              <span style={{ color: 'var(--text-muted)', width: '1.5rem' }}>{idx + 1}.</span>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{word}</span>
              <span style={{ color: 'var(--text-dim)' }}>{count}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
