"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, RotateCcw, Target } from "lucide-react"

interface PomodoroTimerProps {
  projectId: string
}

type TimerMode = 'focus' | 'break' | 'longbreak'

const FOCUS_MINUTES = 25
const BREAK_MINUTES = 5
const LONG_BREAK_MINUTES = 15
const SESSIONS_BEFORE_LONG_BREAK = 4

export default function PomodoroTimer({ projectId }: PomodoroTimerProps) {
  const [mode, setMode] = useState<TimerMode>('focus')
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [dailySessions, setDailySessions] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [sessionNotes, setSessionNotes] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem(`penpad_pomodoro_${projectId}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setDailySessions(parsed.dailySessions || 0)
        setSessionsCompleted(parsed.sessionsCompleted || 0)
      } catch { }
    }
  }, [projectId])

  useEffect(() => {
    const today = new Date().toDateString()
    const stored = localStorage.getItem(`penpad_pomodoro_${projectId}`)
    const data = stored ? JSON.parse(stored) : {}
    if (data.date !== today) {
      data.date = today
      data.dailySessions = 0
    }
    data.sessionsCompleted = sessionsCompleted
    data.dailySessions = dailySessions
    localStorage.setItem(`penpad_pomodoro_${projectId}`, JSON.stringify(data))
  }, [sessionsCompleted, dailySessions, projectId])

  const handleTimerComplete = useCallback(() => {
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAf39/f39/gH+AgH9/f39/gH+AgH9/f39/gH+AgH+AgH9/f3+Af4CAf39/f3+Af4B/f39/f3+Af4CAf39/f4B/gIB/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4CAf4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4CAgH9/f39/gH+AgH9/f39/gH+AgH9/f39/gH+AgH9/f39/gH+AgH9/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gIB/f39/gH+AgH9/f3+Af4CAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gICAf39/f4B/gICAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gICAf39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gICAf39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gICAf39/f4B/gIB/f39/gH+AgH9/f3+Af4B/f39/f4B/gICAf39/f4B/gICAf39/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gICAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/gH+AgH9/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAgH9/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAgH9/f3+Af4B/f39/f4B/gICAf39/f3+Af4B/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4B/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/gH+AgH9/f39/gH+AgH9/f3+Af4B/f39/f4B/gICAf39/f3+Af4CAf39/f3+Af4B/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gIB/f39/f4B/gICAf39/f3+Af4B/f39/gH+AgH9/f3+Af4CAf39/f3+Af4B/f39/g")
    audio.volume = 0.3
    audio.play().catch(() => {})

    const newSessions = sessionsCompleted + 1
    setSessionsCompleted(newSessions)
    setDailySessions((prev) => prev + 1)

    if (mode === 'focus') {
      const nextMode: TimerMode = newSessions % SESSIONS_BEFORE_LONG_BREAK === 0 ? 'longbreak' : 'break'
      setMode(nextMode)
      setSecondsLeft(nextMode === 'longbreak' ? LONG_BREAK_MINUTES * 60 : BREAK_MINUTES * 60)
    } else {
      setMode('focus')
      setSecondsLeft(FOCUS_MINUTES * 60)
    }
  }, [sessionsCompleted, mode])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, handleTimerComplete])

  const toggleTimer = () => setIsRunning(!isRunning)

  const resetTimer = () => {
    setIsRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    switch (mode) {
      case 'focus': setSecondsLeft(FOCUS_MINUTES * 60); break
      case 'break': setSecondsLeft(BREAK_MINUTES * 60); break
      case 'longbreak': setSecondsLeft(LONG_BREAK_MINUTES * 60); break
    }
  }

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false)
    setMode(newMode)
    switch (newMode) {
      case 'focus': setSecondsLeft(FOCUS_MINUTES * 60); break
      case 'break': setSecondsLeft(BREAK_MINUTES * 60); break
      case 'longbreak': setSecondsLeft(LONG_BREAK_MINUTES * 60); break
    }
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const progress = mode === 'focus'
    ? 1 - secondsLeft / (FOCUS_MINUTES * 60)
    : mode === 'break'
      ? 1 - secondsLeft / (BREAK_MINUTES * 60)
      : 1 - secondsLeft / (LONG_BREAK_MINUTES * 60)

  return (
    <div className="sidebar-tab-content fade-in pomodoro-panel">
      <div className="section-title text-xs font-bold uppercase tracking-wider text-dim">Pomodoro Timer</div>

      <div className="pomodoro-mode-tabs" style={{ display: 'flex', gap: '0.3rem', margin: '0.6rem 0' }}>
        {(['focus', 'break', 'longbreak'] as TimerMode[]).map((m) => (
          <button
            key={m}
            className={`pomodoro-mode-btn ${mode === m ? 'active' : ''}`}
            onClick={() => switchMode(m)}
            style={{
              flex: 1, padding: '0.3rem 0', fontSize: '0.65rem', fontWeight: 600,
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)',
              background: mode === m ? 'var(--primary)' : 'transparent',
              color: mode === m ? 'white' : 'var(--text-dim)', cursor: 'pointer'
            }}
          >
            {m === 'focus' ? 'Focus' : m === 'break' ? 'Break' : 'Long Break'}
          </button>
        ))}
      </div>

      <div className="pomodoro-circle" style={{
        position: 'relative', width: '160px', height: '160px', margin: '0.8rem auto'
      }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--surface-border)" strokeWidth="6" />
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--primary)" strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 70}`}
            strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress)}`}
            strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 0.5s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {mode === 'focus' ? 'Writing' : 'Resting'}
          </span>
        </div>
      </div>

      <div className="pomodoro-controls" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '0.6rem 0' }}>
        <button className="btn-icon" onClick={toggleTimer} title={isRunning ? 'Pause' : 'Start'} style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary)', color: 'white', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="btn-icon" onClick={resetTimer} title="Reset" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-hover)', color: 'var(--text-dim)', border: '1px solid var(--surface-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="pomodoro-stats" style={{
        display: 'flex', gap: '0.8rem', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-dim)',
        padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sessionsCompleted}</div>
          <div>Total Sessions</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dailySessions}</div>
          <div>Today</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.floor(sessionsCompleted * FOCUS_MINUTES)}</div>
          <div>Min Written</div>
        </div>
      </div>

      <button
        className="btn-ai-sub"
        onClick={() => setShowNotes(!showNotes)}
        style={{ marginTop: '0.6rem', width: '100%', justifyContent: 'center', fontSize: '0.7rem' }}
      >
        <Target size={12} />
        {showNotes ? 'Hide Session Notes' : 'Session Notes'}
      </button>

      {showNotes && (
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="What are you working on this session?"
          rows={3}
          style={{
            width: '100%', marginTop: '0.4rem', padding: '0.5rem', fontSize: '0.75rem',
            background: 'var(--surface)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit'
          }}
        />
      )}
    </div>
  )
}
