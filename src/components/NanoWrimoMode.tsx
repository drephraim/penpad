"use client"

import React, { useState, useMemo } from "react"
import { Target, Trophy, Sparkles, Award, AlertTriangle } from "lucide-react"

interface NaNoWriMoModeProps {
  projectId: string
  allChapters: { content: string }[]
}

interface NaNoWriMoData {
  year: number
  targetWords: number
  wordCounts: Record<string, number>
  dailyGoal: number
  active: boolean
}

const NANOWRIMO_TARGET = 50000
const NANOWRIMO_MONTH = 10

export default function NaNoWriMoMode({ projectId, allChapters }: NaNoWriMoModeProps) {
  const [data, setData] = useState<NaNoWriMoData>(() => {
    try {
      const stored = localStorage.getItem(`penpad_nanowrimo_${projectId}`)
      if (stored) return JSON.parse(stored)
    } catch { }
    return {
      year: new Date().getFullYear(),
      targetWords: NANOWRIMO_TARGET,
      wordCounts: {},
      dailyGoal: Math.ceil(NANOWRIMO_TARGET / 30),
      active: false
    }
  })

  const totalWords = useMemo(() => {
    return allChapters.reduce((sum, ch) => sum + (ch.content?.split(/\s+/).filter(Boolean).length || 0), 0)
  }, [allChapters])

  const now = new Date()
  const isNovember = now.getMonth() === NANOWRIMO_MONTH
  const dayOfMonth = now.getDate()
  const daysRemaining = Math.max(0, 30 - dayOfMonth + 1)

  const todayStr = now.toISOString().split('T')[0]
  const todayStart = data.wordCounts[Object.keys(data.wordCounts).filter((d) => d < todayStr).sort().pop() || ''] || 0
  const todayWritten = totalWords - todayStart

  const progressPercent = Math.min(100, (totalWords / data.targetWords) * 100)

  const expectedProgress = isNovember ? Math.min(100, (dayOfMonth / 30) * 100) : 100
  const isOnTrack = progressPercent >= expectedProgress

  const wordsRemaining = Math.max(0, data.targetWords - totalWords)
  const neededDaily = daysRemaining > 0 ? Math.ceil(wordsRemaining / daysRemaining) : data.targetWords

  const projectedDate = new Date(now)
  if (todayWritten > 0) {
    const daysNeeded = wordsRemaining / todayWritten
    projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysNeeded))
  }

  const toggleActive = () => {
    setData((prev) => {
      const next = { ...prev, active: !prev.active }
      if (next.active) {
        const counts = { ...next.wordCounts }
        if (!counts[todayStr]) counts[todayStr] = totalWords
        next.wordCounts = counts
      }
      return next
    })
  }

  const resetForNewYear = () => {
    setData({
      year: now.getFullYear(),
      targetWords: NANOWRIMO_TARGET,
      wordCounts: {},
      dailyGoal: Math.ceil(NANOWRIMO_TARGET / 30),
      active: false
    })
  }

  const badges = useMemo(() => {
    const list: { name: string; earned: boolean; icon: string }[] = [
      { name: 'First Words', earned: totalWords >= 1000, icon: '🌱' },
      { name: 'First Week', earned: Object.keys(data.wordCounts).length >= 7, icon: '📅' },
      { name: 'Halfway', earned: totalWords >= data.targetWords / 2, icon: '⚡' },
      { name: 'On Track', earned: isOnTrack, icon: '🎯' },
      { name: 'Winner!', earned: totalWords >= data.targetWords, icon: '🏆' },
      { name: 'Overachiever', earned: totalWords >= data.targetWords * 1.1, icon: '💫' },
    ]
    return list
  }, [totalWords, data.targetWords, data.wordCounts, isOnTrack])

  return (
    <div className="sidebar-tab-content fade-in nanowrimo-panel">
      <div className="nanowrimo-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <Trophy size={18} style={{ color: 'var(--warning)' }} />
        <div>
          <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">
            NaNoWriMo {data.year}
          </div>
          {isNovember && <span style={{ fontSize: '0.6rem', color: 'var(--success)' }}>It&apos;s November! 🎉</span>}
        </div>
      </div>

      {!data.active ? (
        <div className="nanowrimo-cta" style={{
          padding: '1rem', background: 'linear-gradient(135deg, var(--primary-light), var(--accent-light))',
          borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--surface-border)'
        }}>
          <Sparkles size={24} style={{ color: 'var(--primary)', marginBottom: '0.4rem' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.6rem', lineHeight: '1.5' }}>
            Write 50,000 words in 30 days. Track your progress with daily goals, badges, and statistics.
          </p>
          <button className="btn-ai-sub btn-ai-primary" onClick={toggleActive} style={{ fontSize: '0.75rem', padding: '0.5rem 1.5rem' }}>
            <Target size={14} /> Start NaNoWriMo Mode
          </button>
        </div>
      ) : (
        <>
          <div className="nanowrimo-progress" style={{ marginBottom: '0.6rem' }}>
            <div className="nanowrimo-progress-bar" style={{
              height: '8px', background: 'var(--surface-border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.3rem'
            }}>
              <div style={{
                width: `${progressPercent}%`, height: '100%',
                background: isOnTrack ? 'linear-gradient(90deg, var(--primary), var(--success))' : 'linear-gradient(90deg, var(--warning), var(--error))',
                borderRadius: '4px', transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              <span>{totalWords.toLocaleString()} / {data.targetWords.toLocaleString()} words</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
          </div>

          <div className="nanowrimo-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <div className="stat-card" style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)' }}>{todayWritten.toLocaleString()}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Today</div>
            </div>
            <div className="stat-card" style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isOnTrack ? 'var(--success)' : 'var(--error)' }}>{neededDaily.toLocaleString()}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Needed / Day</div>
            </div>
            <div className="stat-card" style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent)' }}>{wordsRemaining.toLocaleString()}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Remaining</div>
            </div>
            <div className="stat-card" style={{ padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--warning)' }}>{daysRemaining}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Days Left</div>
            </div>
          </div>

          {!isOnTrack && (
            <div className="nanowrimo-warning" style={{
              padding: '0.4rem 0.6rem', background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)',
              fontSize: '0.65rem', color: 'var(--warning)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}>
              <AlertTriangle size={12} />
              You&apos;re behind schedule. Write at least {neededDaily.toLocaleString()} words/day to finish on time.
            </div>
          )}

          <div className="nanowrimo-badges" style={{ marginBottom: '0.5rem' }}>
            <div className="section-title text-xs font-bold uppercase tracking-wider text-dim" style={{ fontSize: '0.6rem', marginBottom: '0.3rem' }}>Badges</div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {badges.map((badge) => (
                <div
                  key={badge.name}
                  className="nanowrimo-badge"
                  style={{
                    padding: '0.25rem 0.4rem', borderRadius: 'var(--radius-sm)',
                    background: badge.earned ? 'var(--primary-light)' : 'var(--surface)',
                    border: `1px solid ${badge.earned ? 'var(--primary)' : 'var(--surface-border)'}`,
                    fontSize: '0.6rem', color: badge.earned ? 'var(--primary)' : 'var(--text-muted)',
                    opacity: badge.earned ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '0.2rem'
                  }}
                >
                  {badge.earned && <Award size={10} />}
                  {badge.icon} {badge.name}
                </div>
              ))}
            </div>
          </div>

          <div className="nanowrimo-projection" style={{
            padding: '0.4rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--surface-border)', fontSize: '0.65rem', color: 'var(--text-dim)',
            marginBottom: '0.5rem'
          }}>
            {todayWritten > 0 ? (
              <span>At today&apos;s pace, you&apos;ll finish on <strong style={{ color: 'var(--text-primary)' }}>{projectedDate.toLocaleDateString()}</strong></span>
            ) : (
              <span>Write something today to see your projected finish date.</span>
            )}
          </div>

          <div className="nanowrimo-actions" style={{ display: 'flex', gap: '0.3rem' }}>
            <button className="btn-ai-sub btn-sm" onClick={toggleActive} style={{ flex: 1, fontSize: '0.65rem' }}>
              {data.active ? 'Pause Mode' : 'Resume'}
            </button>
            <button className="btn-ai-sub btn-sm" onClick={resetForNewYear} style={{ fontSize: '0.65rem', color: 'var(--error)' }}>
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}
