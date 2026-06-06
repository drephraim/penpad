"use client"

import { useAuth } from "@/components/Providers"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { 
  Plus, Search, Type,
  Eye, Edit3, Maximize2, Minimize2,
  ArrowLeft, Loader2, FileText,
  Feather, X, Check, AlertCircle, Trash2,
  Download, Save, BookOpen,
  Play, Pause, RotateCcw,
  Sparkles, Wand2, Copy,
  Book, Volume2, VolumeX, Headphones,
  Bold, Italic, Strikethrough, Heading1, Heading2, Quote, Code, List, ChevronLeft, ChevronRight
} from "lucide-react"
import { saveDirectoryHandleForProject, getDirectoryHandleForProject } from '@/lib/db'
import { 
  syncChaptersWithCloud, 
  saveChapterToCloud, 
  deleteChapterFromCloud,
  syncBibleWithCloud,
  saveBibleEntryToCloud,
  deleteBibleEntryFromCloud,
  BibleEntry
} from '@/lib/sync'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
  wordGoal?: number
}

type ViewMode = 'edit' | 'preview'
type SidebarTab = 'manuscript' | 'bible' | 'sounds'

// Synthesizer class using native Web Audio API
class AudioFocusSynthesizer {
  ctx: AudioContext | null = null
  sources: { [key: string]: AudioBufferSourceNode | null } = {}
  gainNodes: { [key: string]: GainNode | null } = {}
  activeType: string = 'none'
  volume: number = 0.5
  cafeInterval: NodeJS.Timeout | null = null

  init() {
    if (!this.ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  stopAll() {
    this.activeType = 'none'
    if (this.cafeInterval) {
      clearInterval(this.cafeInterval)
      this.cafeInterval = null
    }
    for (const key of Object.keys(this.sources)) {
      if (this.sources[key]) {
        try { this.sources[key]!.stop() } catch {}
        this.sources[key] = null
      }
      if (this.gainNodes[key]) {
        try { this.gainNodes[key]!.disconnect() } catch {}
        this.gainNodes[key] = null
      }
    }
  }

  setVolume(vol: number) {
    this.volume = vol
    for (const key of Object.keys(this.gainNodes)) {
      if (this.gainNodes[key] && this.ctx) {
        this.gainNodes[key]!.gain.setValueAtTime(vol, this.ctx.currentTime)
      }
    }
  }

  play(type: string) {
    this.init()
    this.stopAll()
    if (type === 'none') return
    this.activeType = type

    const ctx = this.ctx!
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(this.volume, ctx.currentTime)
    gainNode.connect(ctx.destination)
    this.gainNodes[type] = gainNode

    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (type === 'brown' || type === 'rain' || type === 'cafe') {
      let lastOut = 0.0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        data[i] = (lastOut + (0.02 * white)) / 1.02
        lastOut = data[i]
        data[i] *= 3.5
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    if (type === 'rain') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(900, ctx.currentTime)

      const peak = ctx.createBiquadFilter()
      peak.type = 'peaking'
      peak.frequency.setValueAtTime(1600, ctx.currentTime)
      peak.Q.setValueAtTime(1.5, ctx.currentTime)
      peak.gain.setValueAtTime(-10, ctx.currentTime)

      source.connect(lp)
      lp.connect(peak)
      peak.connect(gainNode)
    } else if (type === 'cafe') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(600, ctx.currentTime)

      source.connect(lp)
      lp.connect(gainNode)
      this.startCafeClinks(gainNode)
    } else {
      source.connect(gainNode)
    }

    source.start()
    this.sources[type] = source
  }

  startCafeClinks(destination: AudioNode) {
    const triggerClink = () => {
      if (this.activeType !== 'cafe' || !this.ctx) return
      const ctx = this.ctx
      try {
        const osc = ctx.createOscillator()
        const clickGain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1900 + Math.random() * 700, ctx.currentTime)

        clickGain.gain.setValueAtTime(0.0, ctx.currentTime)
        clickGain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, ctx.currentTime + 0.004)
        clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)

        osc.connect(clickGain)
        clickGain.connect(destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } catch {}

      const nextDelay = 1500 + Math.random() * 4500
      this.cafeInterval = setTimeout(triggerClink, nextDelay)
    }
    this.cafeInterval = setTimeout(triggerClink, 2000)
  }
}

function EditorContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id')

  const [projectName, setProjectName] = useState("Loading...")
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionTime, setSessionTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  const activeNote = notes.find(n => n && n.id === activeNoteId)

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false)

  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [isFocusMode, setIsFocusMode] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dirHandle, setDirHandle] = useState<any>(null)

  // Redesign States
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('manuscript')
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isZenMode, setIsZenMode] = useState(false)

  // World Bible States
  const [bibleEntries, setBibleEntries] = useState<BibleEntry[]>([])
  const [activeBibleEntryId, setActiveBibleEntryId] = useState<string | null>(null)
  const [isBibleDrawerOpen, setIsBibleDrawerOpen] = useState(false)
  const [bibleSearchQuery, setBibleSearchQuery] = useState('')
  const [bibleCategoryFilter, setBibleCategoryFilter] = useState<'all' | 'character' | 'world'>('all')

  const activeBibleEntry = bibleEntries.find(e => e.id === activeBibleEntryId)

  // Ambient Sound States
  const [activeSound, setActiveSound] = useState<string>('none')
  const [soundVolume, setSoundVolume] = useState<number>(0.5)
  const synthRef = useRef<AudioFocusSynthesizer | null>(null)

  // Slash Menu Commands States
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuQuery, setSlashMenuQuery] = useState("")
  const [slashMenuIndex, setSlashMenuIndex] = useState(0)

  const saveFolderHandleToProject = useCallback(async (handle: FileSystemDirectoryHandle) => {
    if (!projectId) return
    try {
      await saveDirectoryHandleForProject(projectId, handle)
    } catch (e) {
      console.error("Failed to save folder handle:", e)
    }
  }, [projectId])

  const verifyPermission = useCallback(async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      const opts = { mode: 'readwrite' as const }
      if ((await handle.queryPermission(opts)) === 'granted') {
        return true
      }
      if ((await handle.requestPermission(opts)) === 'granted') {
        return true
      }
    } catch (e) {
      console.error("Permission check failed:", e)
    }
    return false
  }, [])

  const disconnectFolder = async () => {
    setDirHandle(null)
    if (projectId) {
      try {
        await saveDirectoryHandleForProject(projectId, null)
      } catch (e) {
        console.error("Failed to clear directory handle:", e)
      }
    }
  }

  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState(22)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; noteId: string; noteTitle: string }>({ show: false, noteId: '', noteTitle: '' })
  const [savedChapters, setSavedChapters] = useState<Set<string>>(new Set())
  const [exportModal, setExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isTypewriterMode, setIsTypewriterMode] = useState(false)
  const [theme, setTheme] = useState('midnight')

  // AI Assistant state variables
  const [showAISidebar, setShowAISidebar] = useState(false)
  const [aiTab, setAiTab] = useState<'continue' | 'rewrite' | 'outline'>('continue')
  const [aiSelectionText, setAiSelectionText] = useState("")
  const [aiSelectionStart, setAiSelectionStart] = useState(0)
  const [aiSelectionEnd, setAiSelectionEnd] = useState(0)
  const [aiTone, setAiTone] = useState("descriptive")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOutlinePrompt, setAiOutlinePrompt] = useState("")
  const [aiError, setAiError] = useState("")
  const [aiCopied, setAiCopied] = useState(false)

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('penpad_theme', newTheme)
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('penpad_theme')
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])
  const [showChapterDrawer, setShowChapterDrawer] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveBibleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedFilenamesRef = useRef<Map<string, string>>(new Map())

  // Sound Engine Setup
  useEffect(() => {
    synthRef.current = new AudioFocusSynthesizer()
    return () => {
      if (synthRef.current) {
        synthRef.current.stopAll()
      }
    }
  }, [])

  const handleAmbientPlay = (type: string) => {
    setActiveSound(type)
    if (synthRef.current) {
      synthRef.current.play(type)
    }
  }

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol)
    if (synthRef.current) {
      synthRef.current.setVolume(vol)
    }
  }

  useEffect(() => {
    if (!projectId) return
    
    getDirectoryHandleForProject(projectId).then(handle => {
      if (handle) {
        setDirHandle(handle)
      }
    })
  }, [projectId])

  const centerActiveLine = useCallback(() => {
    if (!isTypewriterMode) return
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const textBeforeCursor = textarea.value.substring(0, start)
    const lines = textBeforeCursor.split('\n').length - 1
    
    const computedStyle = window.getComputedStyle(textarea)
    const lineHeight = parseInt(computedStyle.lineHeight) || 28
    const paddingTop = parseInt(computedStyle.paddingTop) || 0
    
    const activeLineTop = lines * lineHeight + paddingTop
    const textareaHeight = textarea.clientHeight
    const targetScrollTop = activeLineTop - (textareaHeight / 2) + (lineHeight / 2)
    
    textarea.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    })
  }, [isTypewriterMode])

  useEffect(() => {
    if (isTypewriterMode) {
      const timer = setTimeout(centerActiveLine, 50)
      return () => clearTimeout(timer)
    }
  }, [isTypewriterMode, centerActiveLine, activeNoteId])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isTimerRunning && activeNoteId) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning, activeNoteId])

  const formatSessionTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':')
  }

  const changeWordGoal = () => {
    if (!activeNote) return
    const currentGoal = activeNote.wordGoal || 1200
    const input = prompt("Set word count goal for this chapter:", currentGoal.toString())
    if (input === null) return
    const newGoal = parseInt(input, 10)
    if (!isNaN(newGoal) && newGoal > 0) {
      updateActiveNote({ wordGoal: newGoal })
    } else {
      alert("Please enter a valid positive number.")
    }
  }

  const fetchProjectName = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      if (stored) {
        const projects = JSON.parse(stored)
        const project = projects.find((p: { id: string, name: string }) => p.id === projectId)
        if (project) {
          setProjectName(project.name)
          return
        }
      }
      setProjectName("Untitled")
    } catch (e) {
      console.error("Failed to fetch project name:", e)
      setProjectName("Untitled")
    }
  }, [user, projectId])

  const fetchNotes = useCallback(async () => {
    if (!user || !projectId) return
    setIsLoadingNotes(true)
    try {
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      noteList.sort((a: Note, b: Note) => b.updatedAt - a.updatedAt)
      setNotes(noteList)
      if (noteList.length > 0 && !activeNoteId) {
        setActiveNoteId(noteList[0].id)
      }
      
      const syncedNotes = await syncChaptersWithCloud(user.uid, projectId, noteList)
      setNotes(syncedNotes)
      if (syncedNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(syncedNotes[0].id)
      }
    } catch (e) {
      console.error("Fetch/Sync notes failed:", e)
      setNotes([])
    } finally {
      setIsLoadingNotes(false)
    }
  }, [user, projectId, activeNoteId])

  // World Bible Logic
  const fetchBible = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_bible_${projectId}`)
      const entryList: BibleEntry[] = stored ? JSON.parse(stored) : []
      setBibleEntries(entryList)

      const synced = await syncBibleWithCloud(user.uid, projectId, entryList)
      setBibleEntries(synced)
    } catch {
      console.error("Fetch/Sync bible entries failed")
    }
  }, [user, projectId])

  const saveBibleEntry = useCallback(async (entry: BibleEntry) => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_bible_${projectId}`)
      const entryList: BibleEntry[] = stored ? JSON.parse(stored) : []
      const existingIdx = entryList.findIndex(e => e.id === entry.id)
      const now = Date.now()
      const updatedEntry = { ...entry, updatedAt: now }

      if (existingIdx >= 0) {
        entryList[existingIdx] = updatedEntry
      } else {
        entryList.push(updatedEntry)
      }

      localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(entryList))
      setBibleEntries(entryList)

      await saveBibleEntryToCloud(user.uid, projectId, updatedEntry)
    } catch (e) {
      console.error("Save bible entry failed:", e)
    }
  }, [user, projectId])

  const createNewBibleEntry = async () => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newEntry: BibleEntry = {
        id: crypto.randomUUID(),
        name: "New Entry",
        category: "character",
        content: "",
        createdAt: now,
        updatedAt: now
      }
      const updated = [newEntry, ...bibleEntries]
      setBibleEntries(updated)
      localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(updated))
      setActiveBibleEntryId(newEntry.id)
      setIsBibleDrawerOpen(true)
      
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
    } catch (e) {
      console.error("Failed to create bible entry:", e)
    }
  }

  const deleteBibleEntry = async (entryId: string) => {
    if (!projectId || !user) return
    try {
      const filtered = bibleEntries.filter(e => e.id !== entryId)
      setBibleEntries(filtered)
      localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(filtered))

      await deleteBibleEntryFromCloud(user.uid, projectId, entryId)

      if (activeBibleEntryId === entryId) {
        setActiveBibleEntryId(null)
        setIsBibleDrawerOpen(false)
      }
    } catch (e) {
      console.error("Failed to delete bible entry:", e)
    }
  }

  const updateActiveBibleEntry = (updates: Partial<BibleEntry>) => {
    if (!activeBibleEntryId) return
    const updated = bibleEntries.map(e => 
      e.id === activeBibleEntryId ? { ...e, ...updates, updatedAt: Date.now() } : e
    )
    setBibleEntries(updated)
  }

  const saveNote = useCallback(async (note: Note) => {
    if (!user || !projectId) return
    setSyncStatus('saving')
    try {
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      let noteList: Note[] = []
      if (stored) {
        noteList = JSON.parse(stored)
      }
      
      const existingIdx = noteList.findIndex(n => n.id === note.id)
      const now = Date.now()
      const updatedNote = { ...note, updatedAt: now }
      
      if (existingIdx >= 0) {
        noteList[existingIdx] = updatedNote
      } else {
        noteList.push(updatedNote)
      }
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(noteList))
      
      const storedProjects = localStorage.getItem(`penpad_projects_${user.uid}`)
      if (storedProjects) {
        const projects = JSON.parse(storedProjects)
        const projIdx = projects.findIndex((p: { id: string }) => p.id === projectId)
        if (projIdx >= 0) {
          projects[projIdx].lastUpdated = now
          localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(projects))
        }
      }

      await saveChapterToCloud(user.uid, projectId, updatedNote)
      setSyncStatus('saved')
    } catch (e) {
      console.error("Save note failed:", e)
      setSyncStatus('error')
    }
  }, [user, projectId])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    } else if (!loading && user && !projectId) {
      router.push("/dashboard")
    }
  }, [user, loading, projectId, router])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectName()
      fetchNotes()
      fetchBible()
    }
  }, [user, projectId, fetchProjectName, fetchNotes, fetchBible])

  useEffect(() => {
    if (activeNote && syncStatus !== 'saving') {
      const timer = setTimeout(() => {
        saveNote(activeNote)
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content, activeNote?.title])

  // World Bible AutoSave
  useEffect(() => {
    if (activeBibleEntry) {
      if (autoSaveBibleTimerRef.current) {
        clearTimeout(autoSaveBibleTimerRef.current)
      }
      autoSaveBibleTimerRef.current = setTimeout(() => {
        saveBibleEntry(activeBibleEntry)
      }, 1500)
      return () => clearTimeout(autoSaveBibleTimerRef.current!)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBibleEntry?.name, activeBibleEntry?.content, activeBibleEntry?.category])

  const sanitizeFilename = (name: string): string => {
    return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'
  }

  const saveSingleChapterToFolder = useCallback(async (note: Note, targetDir: FileSystemDirectoryHandle) => {
    try {
      const safeTitle = sanitizeFilename(note.title)
      const newFilename = `${safeTitle}.txt`
      
      const oldFilename = savedFilenamesRef.current.get(note.id)
      if (oldFilename && oldFilename !== newFilename) {
        try {
          await targetDir.removeEntry(oldFilename)
        } catch {
          // File may not exist, ignore
        }
      }
      
      const fileHandle = await targetDir.getFileHandle(newFilename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(note.content || "")
      await writable.close()
      savedFilenamesRef.current.set(note.id, newFilename)
      setSavedChapters(prev => new Set(prev).add(note.id))
    } catch (e) {
      console.error("Failed to save chapter:", e)
    }
  }, [])

  const saveCurrentChapterToFolder = useCallback(async () => {
    if (!activeNote) return
    
    if (!window.showDirectoryPicker) {
      alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.")
      return
    }
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      try {
        targetDir = await getDirectoryHandleForProject(projectId)
        if (targetDir) {
          setDirHandle(targetDir)
        }
      } catch (e) {
        console.error("Failed to restore directory handle:", e)
      }
    }
    
    if (targetDir) {
      const hasPermission = await verifyPermission(targetDir)
      if (!hasPermission) {
        try {
          targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
          setDirHandle(targetDir)
          await saveFolderHandleToProject(targetDir)
        } catch {
          return
        }
      }
    } else {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("Directory picker error:", e)
        return
      }
    }
    
    if (targetDir) {
      await saveSingleChapterToFolder(activeNote, targetDir)
    }
  }, [activeNote, dirHandle, saveSingleChapterToFolder, saveFolderHandleToProject, projectId, verifyPermission])

  const exportManuscriptToFolder = async () => {
    if (notes.length === 0) {
      alert("No chapters to export")
      return
    }
    
    if (!window.showDirectoryPicker) {
      alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.")
      return
    }
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      try {
        targetDir = await getDirectoryHandleForProject(projectId)
        if (targetDir) {
          setDirHandle(targetDir)
        }
      } catch (e) {
        console.error("Failed to restore directory handle:", e)
      }
    }
    
    if (targetDir) {
      const hasPermission = await verifyPermission(targetDir)
      if (!hasPermission) {
        try {
          targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
          setDirHandle(targetDir)
          await saveFolderHandleToProject(targetDir)
        } catch {
          return
        }
      }
    } else {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("Directory picker error:", e)
        return
      }
    }
    
    if (!targetDir) {
      alert("No folder selected")
      return
    }
    
    try {
      setIsExporting(true)
      setExportProgress(0)
      
      const sortedNotes = [...notes].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
      
      for (let i = 0; i < sortedNotes.length; i++) {
        await saveSingleChapterToFolder(sortedNotes[i], targetDir)
        setExportProgress(Math.round(((i + 1) / sortedNotes.length) * 100))
      }
      
      setIsExporting(false)
      setExportModal(false)
    } catch (e) {
      console.error("Export failed:", e)
      setIsExporting(false)
      alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Formatting helper
  const applyFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selection = text.substring(start, end)
    const formatted = prefix + selection + suffix

    const newContent = text.substring(0, start) + formatted + text.substring(end)
    updateActiveNote({ content: newContent })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selection.length)
    }, 50)
  }

  // Slash commands list
  const slashCommands = [
    { name: "Heading 1", cmd: "/h1", desc: "Insert Large Heading", action: () => applyFormatting("# ") },
    { name: "Heading 2", cmd: "/h2", desc: "Insert Medium Heading", action: () => applyFormatting("## ") },
    { name: "Heading 3", cmd: "/h3", desc: "Insert Small Heading", action: () => applyFormatting("### ") },
    { name: "Blockquote", cmd: "/quote", desc: "Insert Quote Block", action: () => applyFormatting("> ") },
    { name: "Bullet List", cmd: "/list", desc: "Insert Bullet Point", action: () => applyFormatting("- ") },
    { name: "Code Block", cmd: "/code", desc: "Insert Code block", action: () => applyFormatting("```\n", "\n```") },
    { name: "Focus AI assistant", cmd: "/ai", desc: "Toggle Right AI Assistant Sidebar", action: () => setShowAISidebar(prev => !prev) },
    { name: "Toggle Zen Mode", cmd: "/zen", desc: "Fullscreen Zen mode", action: () => setIsZenMode(prev => !prev) },
    { name: "Open World Bible", cmd: "/bible", desc: "Toggle World Bible Panel", action: () => { setActiveSidebarTab('bible'); setIsLeftSidebarOpen(true) } },
    { name: "Ambient Sounds", cmd: "/sound", desc: "Toggle Ambient Audio Settings", action: () => { setActiveSidebarTab('sounds'); setIsLeftSidebarOpen(true) } }
  ]

  const filteredCommands = slashCommands.filter(c => 
    c.name.toLowerCase().includes(slashMenuQuery.toLowerCase()) ||
    c.cmd.toLowerCase().includes(slashMenuQuery.toLowerCase())
  )

  const handleSlashSelect = (action: () => void) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const cursor = textarea.selectionStart
    const text = textarea.value
    
    // Find the position of the slash command trigger
    const beforeSlash = text.substring(0, cursor)
    const slashIndex = beforeSlash.lastIndexOf("/")
    if (slashIndex >= 0) {
      const cleanContent = text.substring(0, slashIndex) + text.substring(cursor)
      updateActiveNote({ content: cleanContent })
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(slashIndex, slashIndex)
        action()
      }, 50)
    } else {
      action()
    }
    setShowSlashMenu(false)
    setSlashMenuQuery("")
    setSlashMenuIndex(0)
  }

  // Handle textarea keyboard listener
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashMenuIndex(prev => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashMenuIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[slashMenuIndex]) {
          handleSlashSelect(filteredCommands[slashMenuIndex].action)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        setSlashMenuQuery("")
      }
    }
  }

  // Listen to typing slash
  const handleEditorInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget
    const cursor = target.selectionStart
    const text = target.value
    
    const textBeforeCursor = text.substring(0, cursor)
    const lastWordIdx = textBeforeCursor.lastIndexOf(" ")
    const lastWord = textBeforeCursor.substring(lastWordIdx + 1)

    if (lastWord.startsWith("/")) {
      setShowSlashMenu(true)
      setSlashMenuQuery(lastWord.substring(1))
      setSlashMenuIndex(0)
    } else {
      if (showSlashMenu) {
        setShowSlashMenu(false)
        setSlashMenuQuery("")
      }
    }
  }

  const handleContinueWriting = async () => {
    if (!activeNote) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const textarea = textareaRef.current
      let contextText = ""
      if (textarea) {
        const cursorPosition = textarea.selectionStart
        const textBefore = textarea.value.substring(0, cursorPosition)
        contextText = textBefore.substring(Math.max(0, textBefore.length - 4000))
      } else {
        contextText = activeNote.content.substring(Math.max(0, activeNote.content.length - 4000))
      }

      if (!contextText.trim()) {
        setAiError("Please write something first so the AI has context to continue from.")
        setAiLoading(false)
        return
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", content: contextText })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const handleRewrite = async () => {
    if (!aiSelectionText) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rewrite", content: aiSelectionText, style: aiTone })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateOutline = async () => {
    if (!aiOutlinePrompt.trim()) return
    setAiLoading(true)
    setAiError("")
    setAiResponse("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "outline", prompt: aiOutlinePrompt })
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResponse(data.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAiLoading(false)
    }
  }

  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const content = textarea.value
    
    const newContent = content.substring(0, start) + textToInsert + content.substring(end)
    updateActiveNote({ content: newContent })
    
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + textToInsert.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }

  const replaceSelection = (newText: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return

    const start = aiSelectionStart
    const end = aiSelectionEnd
    const content = textarea.value

    const newContent = content.substring(0, start) + newText + content.substring(end)
    updateActiveNote({ content: newContent })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start, start + newText.length)
      setAiSelectionText(newText)
      setAiSelectionStart(start)
      setAiSelectionEnd(start + newText.length)
    }, 50)
  }

  const createNewNoteWithContent = async (title: string, initialContent: string) => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: title,
        content: initialContent,
        createdAt: now,
        updatedAt: now,
      }
      
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      noteList.unshift(newNote)
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(noteList))
      setNotes(prev => Array.isArray(prev) ? [newNote, ...prev] : [newNote])
      setActiveNoteId(newNote.id)
      setViewMode('edit')

      saveChapterToCloud(user.uid, projectId, newNote)
    } catch (e) {
      console.error("Failed to create note with content:", e)
    }
  }

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 2000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveCurrentChapterToFolder()
      }
      if (e.key === 'Escape') {
        setIsFocusMode(false)
        setIsZenMode(false)
        setShowSlashMenu(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveCurrentChapterToFolder])

  useEffect(() => {
    if (!activeNote || !dirHandle) return
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      if (activeNote && dirHandle && activeNote.content) {
        await saveSingleChapterToFolder(activeNote, dirHandle)
      }
    }, 2000)
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content, dirHandle, saveSingleChapterToFolder])

  const generateChapterTitle = (existingNotes: Note[]): string => {
    const chapterPattern = /^chapter\s*(\d+)/i
    let maxNumber = 0
    
    for (const note of existingNotes) {
      const match = note.title.match(chapterPattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    
    const nextNumber = maxNumber + 1
    return `Chapter ${nextNumber.toString().padStart(2, '0')}`
  }

  const createNewNote = async () => {
    if (!user || !projectId) return
    try {
      const now = Date.now()
      const newTitle = generateChapterTitle(notes)
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: newTitle,
        content: "",
        createdAt: now,
        updatedAt: now,
      }
      
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      noteList.unshift(newNote)
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(noteList))
      setNotes(prev => Array.isArray(prev) ? [newNote, ...prev] : [newNote])
      setActiveNoteId(newNote.id)
      setViewMode('edit')

      saveChapterToCloud(user.uid, projectId, newNote)
    } catch (e) {
      console.error("Failed to create note:", e)
    }
  }

  const deleteNote = async () => {
    if (!projectId || !deleteModal.noteId) return
    try {
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      const filtered = noteList.filter((n: Note) => n && n.id !== deleteModal.noteId)
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(filtered))
      setNotes(filtered)
      
      if (user) {
        deleteChapterFromCloud(user.uid, projectId, deleteModal.noteId)
      }

      if (activeNoteId === deleteModal.noteId) {
        setActiveNoteId(filtered.length > 0 ? filtered[0].id : null)
      }
      setDeleteModal({ show: false, noteId: '', noteTitle: '' })
    } catch (e) {
      console.error("Failed to delete note:", e)
    }
  }

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const allFilteredIds = filteredNotes.map(n => n.id)
    const allSelected = allFilteredIds.every(id => selectedNoteIds.has(id))
    
    if (allSelected) {
      setSelectedNoteIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedNoteIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedNoteIds(new Set())
      }
      return !prev
    })
  }

  const deleteSelectedNotes = async () => {
    if (!projectId || selectedNoteIds.size === 0) return
    try {
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      const filtered = noteList.filter((n: Note) => n && !selectedNoteIds.has(n.id))
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(filtered))
      setNotes(filtered)
      
      if (user) {
        selectedNoteIds.forEach(noteId => {
          deleteChapterFromCloud(user.uid, projectId, noteId)
        })
      }

      if (activeNoteId && selectedNoteIds.has(activeNoteId)) {
        setActiveNoteId(filtered.length > 0 ? filtered[0].id : null)
      }
      
      setSelectedNoteIds(new Set())
      setIsSelectionMode(false)
      setShowMultiDeleteModal(false)
    } catch (e) {
      console.error("Failed to delete selected notes:", e)
    }
  }

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNoteId) return
    const updatedNotes = notes.map((n: Note) => 
      n && n.id === activeNoteId ? { ...n, ...updates, updatedAt: Date.now() } : n
    )
    setNotes(updatedNotes)
  }

  const filteredNotes = notes.filter((n: Note) => n &&
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredBibleEntries = bibleEntries.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(bibleSearchQuery.toLowerCase()) ||
                          e.content.toLowerCase().includes(bibleSearchQuery.toLowerCase())
    const matchesFilter = bibleCategoryFilter === 'all' || e.category === bibleCategoryFilter
    return matchesSearch && matchesFilter
  })

  const wordCount = activeNote?.content ? activeNote.content.split(/\s+/).filter(Boolean).length : 0
  const wordGoal = activeNote?.wordGoal || 1200
  const progressPercent = Math.min(100, Math.round((wordCount / wordGoal) * 100))

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <Feather size={24} />
        </div>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <style jsx>{`
        .loading-screen {
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .loading-logo {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
      `}</style>
    </div>
  )

  return (
    <div className={`editor-container theme-${theme} ${isFocusMode || isZenMode ? 'focus-mode' : ''} ${isZenMode ? 'zen-mode' : ''}`}>
      <div className="bg-gradient-radial"></div>

      {/* Slash commands palette */}
      {showSlashMenu && (
        <div className="command-palette-overlay" onClick={() => { setShowSlashMenu(false); setSlashMenuQuery("") }}>
          <div className="command-palette glass" onClick={e => e.stopPropagation()}>
            <div className="palette-header">
              <Sparkles size={14} className="glow-icon" />
              <input 
                type="text" 
                placeholder="Type command name..." 
                value={slashMenuQuery} 
                onChange={(e) => setSlashMenuQuery(e.target.value)}
                autoFocus
              />
              <span className="esc-hint">ESC</span>
            </div>
            <div className="palette-results">
              {filteredCommands.map((command, idx) => (
                <div 
                  key={command.name} 
                  className={`palette-item ${idx === slashMenuIndex ? 'selected' : ''}`}
                  onClick={() => handleSlashSelect(command.action)}
                >
                  <div className="palette-left">
                    <span className="palette-cmd">{command.cmd}</span>
                    <span className="palette-name">{command.name}</span>
                  </div>
                  <span className="palette-desc">{command.desc}</span>
                </div>
              ))}
              {filteredCommands.length === 0 && (
                <div className="empty-palette">No matching commands found</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Redesigned Header: Fades out in Zen Mode */}
      <header className="editor-header glass">
        <div className="header-left">
          <button className="btn-icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div className="project-info">
            <span className="project-label">Manuscript</span>
            <span className="project-name">{projectName}</span>
          </div>
        </div>

        <div className="header-center">
          <div className="view-toggle glass-light">
            <button 
              className={`view-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              <Edit3 size={14} />
              Edit
            </button>
            <button 
              className={`view-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
          
          <div className="font-selector glass-light">
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="var(--font-inter)">Inter</option>
              <option value="var(--font-outfit)">Outfit</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Palatino, Palatino Linotype, Book Antiqua, serif">Palatino</option>
              <option value="Bookman, Book Antiqua, serif">Bookman</option>
              <option value="Garamond, serif">Garamond</option>
              <option value="Merriweather, Georgia, serif">Merriweather</option>
              <option value="Lora, Georgia, serif">Lora</option>
              <option value="Roboto Mono, monospace">Roboto Mono</option>
              <option value="Courier New, monospace">Courier</option>
              <option value="monospace">System Mono</option>
            </select>
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
              <option value={20}>20px</option>
              <option value={22}>22px</option>
              <option value={24}>24px</option>
              <option value={26}>26px</option>
              <option value={28}>28px</option>
              <option value={32}>32px</option>
              <option value={36}>36px</option>
              <option value={40}>40px</option>
            </select>
          </div>
          
          <div className="theme-selector glass-light">
            <select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
              <option value="midnight">Midnight Slate</option>
              <option value="sepia">Sepia Book</option>
              <option value="forest">Forest Moss</option>
              <option value="obsidian">Obsidian Dark</option>
              <option value="nordic">Nordic Frost</option>
              <option value="lavender">Plum Lavender</option>
              <option value="solarized-light">Solarized Light</option>
            </select>
          </div>
        </div>

        <div className="header-right">
          <div className={`sync-badge glass-light ${syncStatus}`}>
            {syncStatus === 'saving' ? (
              <Loader2 size={12} className="spin" />
            ) : syncStatus === 'saved' ? (
              <Check size={12} />
            ) : (
              <AlertCircle size={12} />
            )}
            <span>{syncStatus === 'saving' ? 'Saving' : 'Saved'}</span>
          </div>
          <button 
            className={`btn-icon ${showAISidebar ? 'active' : ''}`}
            onClick={() => setShowAISidebar(!showAISidebar)}
            title={showAISidebar ? "Close AI Assistant" : "Open AI Assistant"}
          >
            <Sparkles size={18} />
          </button>

          <button 
            className={`btn-icon ${isTypewriterMode ? 'active' : ''}`}
            onClick={() => setIsTypewriterMode(!isTypewriterMode)}
            title={isTypewriterMode ? "Exit typewriter mode" : "Enter typewriter mode"}
          >
            <Type size={18} />
          </button>
          
          <button 
            className="btn-icon" 
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? "Exit Zen mode" : "Enter Zen mode"}
          >
            {isZenMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Floating Zen mode exit button */}
      {isZenMode && (
        <button className="exit-zen-btn glass" onClick={() => setIsZenMode(false)}>
          <Minimize2 size={14} />
          <span>Exit Zen Mode</span>
        </button>
      )}

      <div className="editor-body">
        
        {/* Activity Bar: Left narrow bar */}
        {!isFocusMode && !isZenMode && (
          <nav className="editor-activity-bar glass">
            <div className="activity-top">
              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'manuscript' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'manuscript' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('manuscript')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Manuscript Chapters"
              >
                <FileText size={20} />
              </button>
              
              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'bible' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'bible' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('bible')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="World Bible"
              >
                <Book size={20} />
              </button>

              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'sounds' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'sounds' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('sounds')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Ambient Focus Sounds"
              >
                <Headphones size={20} />
              </button>
            </div>
            
            <div className="activity-bottom">
              <button 
                className="activity-btn toggle-sidebar"
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                title={isLeftSidebarOpen ? "Collapse Side Panel" : "Expand Side Panel"}
              >
                {isLeftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
          </nav>
        )}

        <div className="mobile-fab">
          <button className="fab-btn fab-new" onClick={createNewNote} title="New Chapter">
            <Plus size={24} />
          </button>
          <button className="fab-btn fab-list" onClick={() => setShowChapterDrawer(true)} title="Chapters">
            <BookOpen size={24} />
          </button>
        </div>

        {showChapterDrawer && (
          <div className="chapter-drawer-overlay" onClick={() => setShowChapterDrawer(false)}>
            <div className="chapter-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-header">
                <h3>Chapters</h3>
                <button onClick={() => setShowChapterDrawer(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-search">
                <Search size={14} />
                <input 
                  type="text" 
                  placeholder="Find chapter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="drawer-chapters">
                {filteredNotes.map(note => (
                  <div 
                    key={note.id}
                    className={`chapter-item ${note.id === activeNoteId ? 'active' : ''}`}
                    onClick={() => {
                      setActiveNoteId(note.id)
                      setShowChapterDrawer(false)
                    }}
                  >
                    <FileText size={14} />
                    <span className="chapter-title">{note.title || 'Untitled'}</span>
                  </div>
                ))}
                {filteredNotes.length === 0 && (
                  <div className="empty-chapters">No chapters yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Left Sidebar Panel */}
        {!isFocusMode && !isZenMode && (
          <aside className={`editor-sidebar glass ${isLeftSidebarOpen ? 'open' : 'collapsed'}`}>
            
            {/* TAB 1: MANUSCRIPT CHAPTERS */}
            {activeSidebarTab === 'manuscript' && (
              <div className="sidebar-tab-content fade-in">
                <div className="sidebar-section">
                  <button className="btn-new" onClick={createNewNote}>
                    <Plus size={16} />
                    New Chapter
                  </button>
                  <button className="btn-export" onClick={() => setExportModal(true)}>
                    <Download size={16} />
                    Export Manuscript
                  </button>
                  {dirHandle && (
                    <div className="linked-folder-info">
                      <span className="folder-name" title={dirHandle.name}>📁 {dirHandle.name}</span>
                      <button className="btn-disconnect-folder" onClick={disconnectFolder} title="Unlink folder">
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="sidebar-search">
                  <Search size={14} />
                  <input 
                    type="text" 
                    placeholder="Find chapter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isLoadingNotes && <Loader2 size={12} className="spin" />}
                </div>

                <div className={`sidebar-chapters-header ${isSelectionMode ? 'selection-active' : ''}`}>
                  {isSelectionMode ? (
                    <>
                      <span className="selection-count">{selectedNoteIds.size} selected</span>
                      <div className="selection-actions">
                        <button className="btn-text-action" onClick={toggleSelectAll}>
                          {selectedNoteIds.size === filteredNotes.length ? 'None' : 'All'}
                        </button>
                        <button 
                          className="btn-text-action danger" 
                          disabled={selectedNoteIds.size === 0}
                          onClick={() => setShowMultiDeleteModal(true)}
                        >
                          Delete
                        </button>
                        <button className="btn-text-action" onClick={toggleSelectionMode}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="section-title">Chapters ({filteredNotes.length})</span>
                      <button className="btn-select-mode" onClick={toggleSelectionMode}>
                        Select
                      </button>
                    </>
                  )}
                </div>

                <div className="chapter-list">
                  {filteredNotes.map(note => {
                    const isSelected = selectedNoteIds.has(note.id);
                    return (
                      <div 
                        key={note.id} 
                        className={`chapter-item ${activeNoteId === note.id ? 'active' : ''} ${isSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isSelectionMode) {
                            toggleNoteSelection(note.id);
                          } else {
                            setActiveNoteId(note.id);
                          }
                        }}
                      >
                        {isSelectionMode ? (
                          <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        ) : (
                          <FileText size={16} />
                        )}
                        <span className="chapter-title">{note.title || 'Untitled'}</span>
                        
                        {!isSelectionMode && (
                          <div className="chapter-actions">
                            <button 
                              className={`btn-save-chapter ${savedChapters.has(note.id) ? 'saved' : ''}`}
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                let targetDir = dirHandle
                                
                                if (!targetDir && projectId) {
                                  targetDir = await getDirectoryHandleForProject(projectId)
                                  if (targetDir) {
                                    setDirHandle(targetDir)
                                  }
                                }
                                
                                if (targetDir) {
                                  const hasPermission = await verifyPermission(targetDir)
                                  if (hasPermission) {
                                    await saveSingleChapterToFolder(note, targetDir)
                                  } else {
                                    try {
                                      const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
                                      setDirHandle(dir)
                                      await saveFolderHandleToProject(dir)
                                      await saveSingleChapterToFolder(note, dir)
                                    } catch (err) { console.error(err) }
                                  }
                                } else {
                                  try {
                                    const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
                                    setDirHandle(dir)
                                    await saveFolderHandleToProject(dir)
                                    await saveSingleChapterToFolder(note, dir)
                                  } catch (err) { console.error(err) }
                                }
                              }}
                              title="Save chapter"
                            >
                              <Save size={12} />
                            </button>
                            <button 
                              className="btn-delete-chapter"
                              onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, noteId: note.id, noteTitle: note.title }) }}
                              title="Delete chapter"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: CHARACTER & WORLD BIBLE */}
            {activeSidebarTab === 'bible' && (
              <div className="sidebar-tab-content fade-in flex flex-col h-full">
                <div className="sidebar-section">
                  <button className="btn-new" onClick={createNewBibleEntry}>
                    <Plus size={16} />
                    New Lore Entry
                  </button>
                </div>
                
                <div className="sidebar-search">
                  <Search size={14} />
                  <input 
                    type="text" 
                    placeholder="Find character or lore..."
                    value={bibleSearchQuery}
                    onChange={(e) => setBibleSearchQuery(e.target.value)}
                  />
                </div>

                <div className="bible-filters">
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'character' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('character')}
                  >
                    Characters
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'world' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('world')}
                  >
                    World
                  </button>
                </div>

                <div className="chapter-list bible-list">
                  {filteredBibleEntries.map(entry => (
                    <div 
                      key={entry.id} 
                      className={`chapter-item ${activeBibleEntryId === entry.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveBibleEntryId(entry.id)
                        setIsBibleDrawerOpen(true)
                      }}
                    >
                      <BookOpen size={16} className={entry.category === 'character' ? 'text-primary' : 'text-accent'} />
                      <span className="chapter-title">{entry.name || 'Untitled'}</span>
                      <button 
                        className="btn-delete-chapter"
                        onClick={(e) => { e.stopPropagation(); deleteBibleEntry(entry.id) }}
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {filteredBibleEntries.length === 0 && (
                    <div className="empty-state-text">No lore entries found</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: AMBIENT FOCUS AUDIO */}
            {activeSidebarTab === 'sounds' && (
              <div className="sidebar-tab-content sound-panel fade-in">
                <span className="section-title">Focus Soundscape</span>
                <p className="ai-instructions">Play dynamic noise synthesis offline to block distractions.</p>
                
                <div className="sound-options">
                  <button 
                    className={`sound-card ${activeSound === 'none' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('none')}
                  >
                    <VolumeX size={20} />
                    <div className="sound-info">
                      <span className="sound-title">Silence</span>
                      <span className="sound-desc">Muted</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'brown' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('brown')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Brown Noise</span>
                      <span className="sound-desc">Deep focused rumble</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'rain' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('rain')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Rain shower</span>
                      <span className="sound-desc">Gentle raindrops</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'white' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('white')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">White Noise</span>
                      <span className="sound-desc">Steady high frequency mask</span>
                    </div>
                  </button>

                  <button 
                    className={`sound-card ${activeSound === 'cafe' ? 'active' : ''}`}
                    onClick={() => handleAmbientPlay('cafe')}
                  >
                    <Volume2 size={20} className="glow-icon" />
                    <div className="sound-info">
                      <span className="sound-title">Cozy Cafe</span>
                      <span className="sound-desc">Soft clinks & murmurs</span>
                    </div>
                  </button>
                </div>

                <div className="volume-control">
                  <div className="volume-label">
                    <span>Volume</span>
                    <span>{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="volume-slider"
                  />
                </div>

                <div className="zen-section">
                  <span className="section-title">Zen Mode</span>
                  <button className="btn-new" onClick={() => setIsZenMode(true)}>
                    <Maximize2 size={16} />
                    Enter Zen Mode
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Central Writing Workspace */}
        <main className="editor-main">
          {activeNote ? (
            <div className="editor-workspace fade-in">
              
              {/* Markdown Formatting Toolbar: Hide in Zen Mode */}
              {viewMode === 'edit' && !isZenMode && (
                <div className="formatting-toolbar glass-light">
                  <button className="fmt-btn" onClick={() => applyFormatting("**", "**")} title="Bold (Ctrl+B)">
                    <Bold size={15} />
                  </button>
                  <button className="fmt-btn" onClick={() => applyFormatting("*", "*")} title="Italic (Ctrl+I)">
                    <Italic size={15} />
                  </button>
                  <button className="fmt-btn" onClick={() => applyFormatting("~~", "~~")} title="Strikethrough">
                    <Strikethrough size={15} />
                  </button>
                  <div className="fmt-divider"></div>
                  <button className="fmt-btn" onClick={() => applyFormatting("# ")} title="Heading 1">
                    <Heading1 size={15} />
                  </button>
                  <button className="fmt-btn" onClick={() => applyFormatting("## ")} title="Heading 2">
                    <Heading2 size={15} />
                  </button>
                  <div className="fmt-divider"></div>
                  <button className="fmt-btn" onClick={() => applyFormatting("> ")} title="Blockquote">
                    <Quote size={15} />
                  </button>
                  <button className="fmt-btn" onClick={() => applyFormatting("```\n", "\n```")} title="Code Block">
                    <Code size={15} />
                  </button>
                  <button className="fmt-btn" onClick={() => applyFormatting("- ")} title="Bullet List">
                    <List size={15} />
                  </button>
                  <div className="fmt-divider"></div>
                  <button className="fmt-btn font-mono" onClick={() => setShowSlashMenu(true)} title="Slash Commands">
                    <span>/</span>
                  </button>
                </div>
              )}

              <div className="editor-title-row">
                <input 
                  className="editor-title-input"
                  value={activeNote.title}
                  onChange={(e) => updateActiveNote({ title: e.target.value })}
                  placeholder="Chapter Title..."
                  disabled={isZenMode}
                />
              </div>
              
              <div className="editor-content-area">
                {viewMode === 'edit' ? (
                  <div className={`textarea-wrapper ${isTypewriterMode ? 'typewriter' : ''}`}>
                    <textarea 
                      ref={textareaRef}
                      className="editor-textarea"
                      value={activeNote.content}
                      onChange={(e) => {
                        updateActiveNote({ content: e.target.value })
                        if (isTypewriterMode) centerActiveLine()
                      }}
                      onKeyUp={() => isTypewriterMode && centerActiveLine()}
                      onMouseUp={() => isTypewriterMode && centerActiveLine()}
                      onFocus={() => isTypewriterMode && centerActiveLine()}
                      onKeyDown={handleEditorKeyDown}
                      onInput={handleEditorInput}
                      onSelect={(e) => {
                        const target = e.currentTarget
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        if (start !== end) {
                          setAiSelectionText(target.value.substring(start, end))
                          setAiSelectionStart(start)
                          setAiSelectionEnd(end)
                        } else {
                          setAiSelectionText("")
                          setAiSelectionStart(0)
                          setAiSelectionEnd(0)
                        }
                      }}
                      placeholder="Begin writing (type '/' to insert elements)..."
                      spellCheck={false}
                      style={{ fontFamily, fontSize: `${fontSize}px` }}
                    />
                  </div>
                ) : (
                  <div className="markdown-preview" style={{ fontFamily, fontSize: `${fontSize}px` }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeNote.content || "_Start writing to see preview..."}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              {/* Status Bar: Hide in Zen Mode */}
              {!isZenMode && (
                <div className="editor-status-bar">
                  <div className="status-left">
                    <span className="word-count">
                      <FileText size={14} />
                      {wordCount}/{wordGoal} words
                    </span>
                    <div className="word-progress">
                      <div className="word-progress-bar">
                        <div 
                          className="word-progress-fill" 
                          style={{ width: `${progressPercent}%`, backgroundColor: progressPercent >= 100 ? 'var(--success)' : 'var(--primary)' }}
                        ></div>
                      </div>
                      <span className="word-progress-text">{progressPercent}%</span>
                    </div>
                  </div>

                  <div className="status-right">
                    <button className="status-goal-btn" onClick={changeWordGoal} title="Change Word Goal">
                      🎯 Goal: {wordGoal} words
                    </button>
                    <div className="status-timer-container">
                      <span className="timer-display">⏱️ {formatSessionTime(sessionTime)}</span>
                      <div className="timer-controls">
                        <button 
                          className="timer-btn" 
                          onClick={() => setIsTimerRunning(!isTimerRunning)} 
                          title={isTimerRunning ? "Pause Timer" : "Start Timer"}
                        >
                          {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button 
                          className="timer-btn" 
                          onClick={() => setSessionTime(0)} 
                          title="Reset Timer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-editor-state">
              <div className="empty-icon">
                <Feather size={48} />
              </div>
              <p>Select or create a chapter to start writing</p>
            </div>
          )}
        </main>

        {/* Right Collapsible AI Assistant Sidebar */}
        {showAISidebar && !isFocusMode && !isZenMode && (
          <aside className="editor-ai-sidebar">
            <div className="ai-sidebar-header">
              <div className="ai-header-title">
                <Sparkles size={16} className="sparkles-icon" />
                <span>AI Assistant</span>
              </div>
              <button className="btn-close-ai" onClick={() => setShowAISidebar(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="ai-tabs">
              <button 
                className={`ai-tab-btn ${aiTab === 'continue' ? 'active' : ''}`}
                onClick={() => { setAiTab('continue'); setAiResponse(""); setAiError(""); }}
              >
                Continue
              </button>
              <button 
                className={`ai-tab-btn ${aiTab === 'rewrite' ? 'active' : ''}`}
                onClick={() => { setAiTab('rewrite'); setAiResponse(""); setAiError(""); }}
              >
                Rewrite
              </button>
              <button 
                className={`ai-tab-btn ${aiTab === 'outline' ? 'active' : ''}`}
                onClick={() => { setAiTab('outline'); setAiResponse(""); setAiError(""); }}
              >
                Outline
              </button>
            </div>

            <div className="ai-sidebar-content">
              {aiTab === 'continue' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Generate a seamless continuation of your story matching your tone and voice.
                  </p>
                  <button 
                    className="btn-ai-action" 
                    onClick={handleContinueWriting}
                    disabled={aiLoading || !activeNote}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Continue Writing
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiTab === 'rewrite' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Highlight a passage in the editor, select a tone/style, and rewrite.
                  </p>
                  
                  {aiSelectionText ? (
                    <div className="ai-selection-preview">
                      <span className="preview-label">Selected Text:</span>
                      <div className="selection-quote-box">
                        &ldquo;{aiSelectionText.length > 150 ? aiSelectionText.substring(0, 150) + '...' : aiSelectionText}&rdquo;
                      </div>
                    </div>
                  ) : (
                    <div className="ai-no-selection">
                      <AlertCircle size={16} />
                      <span>No text selected. Highlight a passage in the editor to use this tool.</span>
                    </div>
                  )}

                  <div className="ai-form-field">
                    <label>Prose Style / Tone</label>
                    <select 
                      value={aiTone} 
                      onChange={(e) => setAiTone(e.target.value)}
                      className="ai-select"
                      disabled={!aiSelectionText}
                    >
                      <option value="descriptive">✨ Descriptive (Show, Don&apos;t Tell)</option>
                      <option value="dramatic">🎭 Dramatic (Emotional Stakes)</option>
                      <option value="suspenseful">⏳ Suspenseful (Build Tension)</option>
                      <option value="poetic">🌿 Poetic (Lyrical Flow)</option>
                      <option value="professional">💼 Professional (Elegant & Clear)</option>
                      <option value="shorten">✂️ Shorten (Punchy & Concise)</option>
                      <option value="expand">🔍 Expand (Elaborate Details)</option>
                    </select>
                  </div>

                  <button 
                    className="btn-ai-action" 
                    onClick={handleRewrite}
                    disabled={aiLoading || !aiSelectionText}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Rewriting...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Rewrite Selection
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiTab === 'outline' && (
                <div className="ai-tab-pane">
                  <p className="ai-instructions">
                    Brainstorm a structured outline for your next scene or chapter.
                  </p>
                  
                  <div className="ai-form-field">
                    <label>Concept or story beat</label>
                    <textarea
                      value={aiOutlinePrompt}
                      onChange={(e) => setAiOutlinePrompt(e.target.value)}
                      placeholder="Describe the scene... e.g. Clara confronts Arthur in the rain about the missing necklace."
                      className="ai-textarea"
                      disabled={aiLoading}
                    />
                  </div>

                  <button 
                    className="btn-ai-action" 
                    onClick={handleGenerateOutline}
                    disabled={aiLoading || !aiOutlinePrompt.trim()}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Planning...
                      </>
                    ) : (
                      <>
                        <BookOpen size={16} />
                        Generate Outline
                      </>
                    )}
                  </button>
                </div>
              )}

              {aiError && (
                <div className="ai-error-box fade-in">
                  <AlertCircle size={16} />
                  <span>{aiError}</span>
                </div>
              )}

              {aiResponse && (
                <div className="ai-response-box fade-in">
                  <div className="response-header">
                    <span>AI Suggestion:</span>
                    {aiCopied && <span className="copied-label">Copied!</span>}
                  </div>
                  <div className="response-content">
                    {aiTab === 'outline' ? (
                      <div className="markdown-preview-ai">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiResponse}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{aiResponse}</p>
                    )}
                  </div>
                  <div className="response-actions">
                    {aiTab === 'continue' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => insertAtCursor(aiResponse)}>
                        Insert
                      </button>
                    )}
                    {aiTab === 'rewrite' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => replaceSelection(aiResponse)}>
                        Replace
                      </button>
                    )}
                    {aiTab === 'outline' && (
                      <button className="btn-ai-sub btn-ai-primary" onClick={() => createNewNoteWithContent("AI Outline", aiResponse)}>
                        Insert Chapter
                      </button>
                    )}
                    <button className="btn-ai-sub btn-ai-secondary" onClick={() => handleCopyToClipboard(aiResponse)}>
                      <Copy size={12} />
                      Copy
                    </button>
                    <button 
                      className="btn-ai-sub btn-ai-secondary" 
                      onClick={
                        aiTab === 'continue' 
                          ? handleContinueWriting 
                          : aiTab === 'rewrite' 
                            ? handleRewrite 
                            : handleGenerateOutline
                      }
                    >
                      Regen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Character & World Bible Slide-out Drawer Panel */}
        {isBibleDrawerOpen && activeBibleEntry && (
          <aside className="editor-ai-sidebar bible-drawer fade-in">
            <div className="ai-sidebar-header">
              <div className="ai-header-title">
                <BookOpen size={16} className="glow-icon text-primary" />
                <span>Edit Lore Entry</span>
              </div>
              <button className="btn-close-ai" onClick={() => setIsBibleDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="ai-sidebar-content">
              <div className="ai-form-field">
                <label>Entry Name</label>
                <input 
                  type="text" 
                  value={activeBibleEntry.name}
                  onChange={(e) => updateActiveBibleEntry({ name: e.target.value })}
                  placeholder="e.g. Clara, Excalibur, London"
                  className="ai-select px-3"
                />
              </div>

              <div className="ai-form-field">
                <label>Category</label>
                <select 
                  value={activeBibleEntry.category}
                  onChange={(e) => updateActiveBibleEntry({ category: e.target.value as 'character' | 'world' })}
                  className="ai-select"
                >
                  <option value="character">👤 Character (Cast, Protagonist, NPC)</option>
                  <option value="world">🗺️ World Item (Location, Magic, Artifact, Lore)</option>
                </select>
              </div>

              <div className="ai-form-field flex-1 flex flex-col min-h-[300px]">
                <label>Notes & Descriptions</label>
                <textarea 
                  value={activeBibleEntry.content}
                  onChange={(e) => updateActiveBibleEntry({ content: e.target.value })}
                  placeholder="Write biography, characteristics, locations details, and lore notes..."
                  className="ai-textarea flex-1 min-h-[280px]"
                />
              </div>

              <div className="drawer-save-badge flex items-center justify-end text-xs text-dim gap-1">
                <Check size={12} className="text-success" />
                <span>Auto-saved in real-time</span>
              </div>
            </div>
          </aside>
        )}

        {deleteModal.show && (
          <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, noteId: '', noteTitle: '' })}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Chapter</h2>
                <p className="modal-description">Are you sure you want to delete &ldquo;{deleteModal.noteTitle || 'Untitled'}&rdquo;? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, noteId: '', noteTitle: '' })}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteNote}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {showMultiDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowMultiDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Multiple Chapters</h2>
                <p className="modal-description">Are you sure you want to delete the {selectedNoteIds.size} selected chapters? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowMultiDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteSelectedNotes}>Delete All</button>
              </div>
            </div>
          </div>
        )}

        {exportModal && (
          <div className="modal-overlay" onClick={() => !isExporting && setExportModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Export Manuscript</h2>
                <p className="modal-description">
                  {isExporting 
                    ? `Exporting chapters... ${exportProgress}%` 
                    : `This will export all ${notes.length} chapters as text files to a folder on your computer.`}
                </p>
              </div>
              {isExporting && (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${exportProgress}%` }}></div>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setExportModal(false)} disabled={isExporting}>Cancel</button>
                <button className="btn btn-primary" onClick={exportManuscriptToFolder} disabled={isExporting}>
                  {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .editor-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--background);
          color: var(--text-primary);
          position: relative;
          transition: background 0.5s ease;
        }

        .loading-screen {
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .loading-logo {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .editor-header {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1rem;
          border-bottom: 1px solid var(--surface-border);
          position: relative;
          z-index: 50;
          flex-shrink: 0;
          background: rgba(10, 10, 15, 0.85);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        /* Zen mode transitions */
        .zen-mode .editor-header {
          opacity: 0;
          pointer-events: none;
          transform: translateY(-100%);
        }

        .exit-zen-btn {
          position: fixed;
          top: 1.5rem;
          right: 2rem;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          background: rgba(10, 10, 15, 0.6);
          cursor: pointer;
          transition: var(--transition);
        }
        .exit-zen-btn:hover {
          color: var(--text-primary);
          border-color: var(--primary);
        }

        .editor-activity-bar {
          width: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 0;
          border-right: 1px solid var(--surface-border);
          background: rgba(8, 8, 12, 0.95);
          flex-shrink: 0;
          z-index: 40;
        }

        .activity-top, .activity-bottom {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: center;
          width: 100%;
        }

        .activity-btn {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition);
        }

        .activity-btn:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .activity-btn.active {
          color: var(--primary-hover);
          background: var(--primary-light);
          box-shadow: 0 0 10px -2px var(--primary-glow);
        }

        .activity-btn.toggle-sidebar {
          color: var(--text-muted);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .project-info {
          display: flex;
          flex-direction: column;
        }

        .project-label {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
        }

        .project-name {
          font-family: var(--font-outfit);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .header-center {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .view-toggle {
          display: flex;
          padding: 3px;
          border-radius: var(--radius-sm);
        }

        .view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }

        .view-btn:hover {
          color: var(--text-primary);
        }

        .view-btn.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .font-selector,
        .theme-selector {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: var(--radius-md);
        }

        .font-selector select,
        .theme-selector select {
          padding: 0.4rem 0.6rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
        }

        .font-selector select option,
        .theme-selector select option {
          background: var(--background);
          color: var(--text-primary);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .sync-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-dim);
        }

        .sync-badge.saved {
          color: var(--success);
        }

        .sync-badge.saving {
          color: var(--primary);
        }

        .sync-badge.error {
          color: var(--error);
        }

        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .mobile-fab {
          display: none;
        }

        .editor-sidebar {
          width: 280px;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          border-right: 1px solid var(--surface-border);
          background: var(--surface-raised);
          flex-shrink: 0;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
        }

        .editor-sidebar.collapsed {
          width: 0px;
          padding: 0px;
          border-right: none;
          opacity: 0;
          pointer-events: none;
        }

        .sidebar-tab-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 254px; /* Maintain layout during collapse */
        }

        .sidebar-section {
          margin-bottom: 1rem;
        }

        .btn-new {
          width: 100%;
          padding: 0.75rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: 0 4px 10px -2px var(--primary-glow);
        }

        .btn-new:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.6rem 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-dim);
          margin-bottom: 1rem;
        }

        .sidebar-search input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
        }

        .sidebar-search input::placeholder {
          color: var(--text-dim);
        }

        .chapter-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-chapters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.5rem;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-dim);
        }

        .btn-select-mode {
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .btn-select-mode:hover {
          background: var(--primary-light);
        }

        .selection-count {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .selection-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn-text-action {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .btn-text-action:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .btn-text-action.danger {
          color: var(--error);
        }

        .btn-text-action.danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-hover);
        }

        .btn-text-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .checkbox-custom {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: 1.5px solid var(--text-dim);
          border-radius: 4px;
          transition: var(--transition);
          flex-shrink: 0;
        }

        .checkbox-custom.checked {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .chapter-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
        }

        .chapter-item.selection-mode {
          border-left: 3px solid transparent;
        }

        .chapter-item.selection-mode.selected {
          background: var(--surface-hover);
          border-left-color: var(--primary);
        }

        .chapter-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .chapter-item.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .chapter-title {
          flex: 1;
          font-size: 0.9rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-delete-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          opacity: 0;
          transition: var(--transition);
        }

        .chapter-item:hover .btn-delete-chapter,
        .chapter-item:hover .btn-save-chapter {
          opacity: 1;
        }

        .chapter-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: var(--transition);
        }

        .chapter-item:hover .chapter-actions {
          opacity: 1;
        }

        .btn-save-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-save-chapter:hover {
          background: var(--success-light);
          color: var(--success);
        }

        .btn-save-chapter.saved {
          color: var(--success);
        }

        .btn-export {
          width: 100%;
          padding: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
          margin-top: 0.5rem;
        }

        .btn-export:hover {
          border-color: var(--primary);
          color: var(--primary-hover);
        }

        .linked-folder-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.4rem 0.6rem;
          background: var(--surface-hover);
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-sm);
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          gap: 6px;
        }

        .folder-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .btn-disconnect-folder {
          background: transparent;
          border: none;
          color: var(--error);
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 4px;
          border-radius: var(--radius-sm);
          transition: var(--transition);
        }

        .btn-disconnect-folder:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-hover);
        }

        /* World Bible Styles */
        .bible-filters {
          display: flex;
          gap: 4px;
          padding: 0 0.5rem 0.75rem 0.5rem;
          border-bottom: 1px solid var(--surface-border);
          margin-bottom: 0.75rem;
        }

        .filter-chip {
          padding: 3px 8px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--surface-border);
          background: transparent;
          color: var(--text-dim);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: var(--transition);
        }

        .filter-chip:hover {
          color: var(--text-primary);
          border-color: var(--text-dim);
        }

        .filter-chip.active {
          background: var(--primary-light);
          color: var(--primary-hover);
          border-color: var(--primary);
        }

        .empty-state-text {
          font-size: 0.8rem;
          color: var(--text-dim);
          text-align: center;
          margin-top: 2rem;
        }

        .bible-drawer {
          border-left: 1px solid var(--surface-border);
          background: rgba(12, 12, 18, 0.95) !important;
          z-index: 60 !important;
        }

        .drawer-save-badge {
          padding-top: 1rem;
          border-top: 1px solid var(--surface-border);
        }

        /* Ambient Sound Panel */
        .sound-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 1rem 0;
        }

        .sound-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0.75rem 1rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          text-align: left;
          transition: var(--transition);
          width: 100%;
        }

        .sound-card:hover {
          background: var(--surface-hover);
          border-color: var(--text-dim);
        }

        .sound-card.active {
          background: var(--primary-light);
          border-color: var(--primary);
          color: var(--primary-hover);
        }

        .sound-card.active .glow-icon {
          animation: pulse 2.5s infinite;
        }

        .sound-info {
          display: flex;
          flex-direction: column;
        }

        .sound-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .sound-card.active .sound-title {
          color: var(--primary-hover);
        }

        .sound-desc {
          font-size: 0.7rem;
          color: var(--text-dim);
        }

        .volume-control {
          margin: 1.5rem 0;
          padding: 1rem;
          background: rgba(0,0,0,0.15);
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
        }

        .volume-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .volume-slider {
          width: 100%;
          background: var(--surface-border);
          outline: none;
          height: 4px;
          border-radius: var(--radius-full);
          -webkit-appearance: none;
          cursor: pointer;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--primary);
          box-shadow: 0 0 5px var(--primary-glow);
          transition: transform 0.15s ease;
        }

        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .zen-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--surface-border);
        }

        /* Formatting Toolbar */
        .formatting-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          margin-bottom: 1.25rem;
          width: fit-content;
          border: 1px solid var(--surface-border);
          z-index: 10;
        }

        .fmt-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .fmt-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .fmt-divider {
          width: 1px;
          height: 16px;
          background: var(--surface-border);
          margin: 0 4px;
        }

        /* Command Palette Slash Menu styles */
        .command-palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 4, 6, 0.4);
          z-index: 300;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
          backdrop-filter: blur(4px);
        }

        .command-palette {
          width: 500px;
          max-width: 90%;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          background: rgba(15, 17, 23, 0.95);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px -10px var(--primary-glow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideDownPalette 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideDownPalette {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .palette-header {
          display: flex;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
          gap: 0.75rem;
        }

        .glow-icon {
          color: var(--primary-hover);
          filter: drop-shadow(0 0 4px var(--primary-glow));
        }

        .palette-header input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
        }

        .esc-hint {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius-xs);
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          color: var(--text-dim);
        }

        .palette-results {
          max-height: 300px;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .palette-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
        }

        .palette-item.selected {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .palette-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .palette-cmd {
          font-family: var(--font-mono), monospace;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--accent);
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(167, 139, 250, 0.1);
        }

        .palette-item.selected .palette-cmd {
          background: rgba(167, 139, 250, 0.2);
        }

        .palette-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .palette-desc {
          font-size: 0.75rem;
          color: var(--text-dim);
        }

        .empty-palette {
          padding: 2rem;
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-dim);
        }

        /* AI Assistant Sidebar CSS */
        .editor-ai-sidebar {
          width: 340px;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--surface-border);
          background: var(--surface-raised);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          flex-shrink: 0;
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .ai-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.25rem 0.75rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
        }

        .ai-header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-outfit);
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .ai-header-title .sparkles-icon {
          color: var(--accent);
          animation: pulse 2s infinite;
        }

        .btn-close-ai {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-close-ai:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .ai-tabs {
          display: flex;
          padding: 0.25rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.1);
        }

        .ai-tab-btn {
          flex: 1;
          padding: 0.6rem 0.25rem;
          border: none;
          background: transparent;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: var(--transition);
          text-align: center;
        }

        .ai-tab-btn:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .ai-tab-btn.active {
          color: var(--primary-hover);
          background: var(--primary-light);
        }

        .ai-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .ai-tab-pane {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ai-instructions {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .btn-ai-action {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          border: none;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow-glow);
        }

        .btn-ai-action:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px -3px var(--primary-glow);
        }

        .btn-ai-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-selection-preview {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .selection-quote-box {
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.15);
          border-left: 3px solid var(--accent);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-style: italic;
          color: var(--text-secondary);
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
        }

        .ai-no-selection {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--primary-light);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .ai-form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ai-form-field label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ai-select {
          width: 100%;
          height: 38px;
          padding: 0 0.5rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }

        .ai-select option {
          background: var(--background);
          color: var(--text-primary);
        }

        .ai-textarea {
          width: 100%;
          height: 100px;
          padding: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          resize: none;
          line-height: 1.5;
        }

        .ai-textarea:focus {
          border-color: var(--primary);
        }

        .ai-error-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--error-light);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          color: #fca5a5;
        }

        .ai-response-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 1rem;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
        }

        .copied-label {
          color: var(--success);
          font-weight: 700;
          font-size: 0.7rem;
        }

        .response-content {
          font-size: 0.85rem;
          color: var(--text-primary);
          line-height: 1.6;
          max-height: 250px;
          overflow-y: auto;
          white-space: pre-wrap;
          padding: 0.25rem 0;
        }

        .markdown-preview-ai {
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .markdown-preview-ai h1, .markdown-preview-ai h2, .markdown-preview-ai h3 {
          font-family: var(--font-outfit);
          color: var(--text-primary);
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .markdown-preview-ai h1 { font-size: 1.1rem; }
        .markdown-preview-ai h2 { font-size: 0.95rem; }
        .markdown-preview-ai h3 { font-size: 0.85rem; }
        
        .markdown-preview-ai ul, .markdown-preview-ai ol {
          padding-left: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .response-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.25rem;
          border-top: 1px solid var(--surface-border);
          padding-top: 0.75rem;
        }

        .btn-ai-sub {
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          transition: var(--transition);
        }

        .btn-ai-primary {
          background: var(--primary);
          color: white;
        }

        .btn-ai-primary:hover {
          background: var(--primary-hover);
        }

        .btn-ai-secondary {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
        }

        .btn-ai-secondary:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        @media (max-width: 1024px) {
          .editor-ai-sidebar {
            width: 100%;
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            z-index: 100;
          }
        }

        .export-progress {
          margin: 1.5rem 0;
        }

        .progress-bar {
          height: 8px;
          background: var(--surface);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--accent));
          transition: width 0.3s ease;
        }

        .btn-delete-chapter:hover {
          background: var(--error-light);
          color: var(--error);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .modal {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: 2rem;
          max-width: 400px;
          width: 90%;
        }

        .modal-header {
          margin-bottom: 1.5rem;
        }

        .modal-title {
          font-family: var(--font-outfit);
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .modal-description {
          color: var(--text-dim);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-danger {
          background: var(--error);
          color: white;
          border: none;
        }

        .btn-danger:hover {
          background: var(--error-hover);
        }

        .editor-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--background);
        }

        .editor-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1rem 2rem 1.5rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
          overflow: hidden;
          transition: max-width 0.5s ease, padding 0.5s ease;
        }

        /* Zen mode overrides */
        .zen-mode .editor-workspace {
          max-width: 800px;
          padding: 3rem 1rem;
        }

        .editor-title-input {
          width: 100%;
          background: transparent;
          border: none;
          font-family: var(--font-outfit);
          font-size: 2.25rem;
          font-weight: 800;
          color: var(--text-primary);
          outline: none;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
          padding: 0;
          transition: font-size 0.5s ease;
        }

        .zen-mode .editor-title-input {
          font-size: 2rem;
          text-align: center;
          margin-bottom: 2rem;
        }

        .editor-title-input::placeholder {
          color: var(--text-dim);
        }

        .editor-title-input.readonly {
          cursor: default;
        }

        .editor-title-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .badge-info {
          background: linear-gradient(135deg, var(--primary-light), var(--accent-light));
          color: var(--primary);
        }

        .editor-content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        .textarea-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .editor-textarea {
          flex: 1;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          line-height: 1.8;
          resize: none;
          outline: none;
          font-family: Georgia, serif;
          min-height: 0;
          position: relative;
          z-index: 1;
        }

        .zen-mode .editor-textarea {
          max-width: 700px;
          margin: 0 auto;
        }

        .editor-textarea::placeholder {
          color: var(--text-dim);
        }

        .markdown-preview {
          flex: 1;
          padding: 2rem;
          background: rgba(0,0,0,0.15);
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          line-height: 1.8;
          color: var(--text-secondary);
          overflow-y: auto;
        }

        .editor-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0;
          flex-shrink: 0;
          border-top: 1px solid var(--surface-border);
          gap: 0.5rem;
          background: var(--background);
        }

        .status-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .word-count {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-dim);
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .word-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .word-progress-bar {
          width: 80px;
          height: 4px;
          background: var(--surface);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .word-progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .word-progress-text {
          font-size: 0.75rem;
          color: var(--text-dim);
          min-width: 35px;
        }

        .status-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-goal-btn {
          background: transparent;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.75rem;
          padding: 3px 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .status-goal-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--surface-hover);
        }

        .status-timer-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .timer-display {
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        .timer-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          border-left: 1px solid var(--surface-border);
          padding-left: 8px;
        }

        .timer-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .timer-btn:hover {
          color: var(--primary);
          background: var(--surface-hover);
        }

        .btn-icon.active {
          background: var(--primary-light);
          color: var(--primary);
          border-color: var(--primary);
        }

        .textarea-wrapper.typewriter {
          position: relative;
        }

        .textarea-wrapper.typewriter::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 38%;
          background: linear-gradient(to bottom, var(--background) 25%, var(--background-transparent) 100%);
          pointer-events: none;
          z-index: 10;
        }

        .textarea-wrapper.typewriter .editor-textarea {
          scroll-padding-top: 50%;
          scroll-padding-bottom: 0px;
        }

        .focus-mode .editor-sidebar {
          display: none;
        }

        .focus-mode .editor-workspace {
          max-width: 900px;
          padding: 2rem 1.5rem;
        }

        @media (max-width: 768px) {
          .editor-container {
            height: 100dvh;
            display: flex;
            flex-direction: column;
          }
          .editor-body {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
          }
          .editor-sidebar {
            display: none;
          }
          .editor-activity-bar {
            display: none;
          }
          .editor-workspace {
            padding: 1.5rem;
            overflow: visible;
            flex: none;
          }
          .header-center {
            display: none;
          }
          .editor-title-input {
            font-size: 1.5rem;
          }
          .editor-textarea {
            min-height: calc(100dvh - 200px);
          }
          .mobile-fab {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 100;
          }
          .fab-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--primary);
            border: none;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-lg), var(--shadow-glow);
            cursor: pointer;
            transition: var(--transition);
          }
          .fab-btn:hover {
            background: var(--primary-hover);
            transform: scale(1.05);
          }
          .fab-btn:active {
            transform: scale(0.95);
          }
          .fab-list {
            background: var(--surface-raised);
          }
          .chapter-drawer-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 200;
            display: flex;
            align-items: flex-end;
          }
          .chapter-drawer {
            background: var(--surface);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            width: 100%;
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.3s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--surface-border);
          }
          .drawer-header h3 {
            font-size: 1.1rem;
            font-weight: 700;
          }
          .drawer-header button {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.5rem;
          }
          .drawer-search {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.5rem;
            border-bottom: 1px solid var(--surface-border);
            color: var(--text-dim);
          }
          .drawer-search input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 0.95rem;
            outline: none;
          }
          .drawer-search input::placeholder {
            color: var(--text-dim);
          }
          .drawer-chapters {
            flex: 1;
            overflow-y: auto;
            padding: 1rem 1.5rem;
          }
          .drawer-chapters .chapter-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: var(--transition);
            color: var(--text-secondary);
          }
          .drawer-chapters .chapter-item:hover {
            background: var(--surface-hover);
          }
          .drawer-chapters .chapter-item.active {
            background: var(--primary-light);
            color: var(--primary);
          }
          .drawer-chapters .chapter-title {
            font-size: 0.95rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .empty-chapters {
            text-align: center;
            padding: 2rem;
            color: var(--text-dim);
          }
        }
      `}</style>
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <Feather size={24} />
          </div>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <style jsx>{`
          .loading-screen {
            height: 100vh;
            background: var(--background);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
          }
          .loading-logo {
            width: 56px;
            height: 56px;
            border-radius: var(--radius-lg);
            background: linear-gradient(135deg, var(--primary), var(--accent));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
        `}</style>
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}
