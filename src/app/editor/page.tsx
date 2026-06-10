"use client"

import { useAuth } from "@/components/Providers"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { 
  Plus, Search, Type,
  Eye, Edit3, Maximize2, Minimize2,
  ArrowLeft, Loader2, FileText,
  Feather, X, Check, AlertCircle, Trash2,
  Download, Save, BookOpen,
  Play, Pause, RotateCcw,
  Sparkles, Wand2, Copy,
  Book, Volume2, VolumeX, Headphones,
  Bold, Italic, Strikethrough, Heading1, Heading2, Quote, Code, List, ChevronLeft, ChevronRight, ChevronDown,
  User, PawPrint, MapPin, Globe, Package, BrainCircuit, Link2, MessageSquare, Star, History, FileDown, Layers
} from "lucide-react"
import { saveDirectoryHandleForProject, getDirectoryHandleForProject } from '@/lib/db'
import { 
  syncChaptersWithCloud, 
  saveChapterToCloud, 
  deleteChapterFromCloud,
  syncBibleWithCloud,
  saveBibleEntryToCloud,
  deleteBibleEntryFromCloud,
  syncBrainWithCloud,
  saveBrainEntryToCloud,
  deleteBrainEntryFromCloud,
  BibleEntry,
  BrainEntry
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
  volumeId?: string | null
  sortOrder?: number
}

type ViewMode = 'edit' | 'preview'
type SidebarTab = 'manuscript' | 'insights' | 'appearance' | 'bible' | 'sounds' | 'brain'
type BrainEntityType = NonNullable<BrainEntry['entityType']>
type BrainImportance = NonNullable<BrainEntry['importance']>
type BrainTypeFilter = 'all' | BrainEntityType
type ExportFormat = 'folder' | 'txt' | 'md' | 'html' | 'doc' | 'pdf'
type SearchSource = 'chapter' | 'brain' | 'lore'
type AppearanceFormKey = 'beastForm' | 'demiHumanForm' | 'humanForm'

interface GlobalSearchResult {
  id: string
  source: SearchSource
  title: string
  subtitle: string
  preview: string
  chapterId?: string
}

interface ChapterVersion {
  id: string
  title: string
  content: string
  savedAt: number
  wordCount: number
}

interface ManuscriptVolume {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  sortOrder: number
}

interface ExportHistoryRecord {
  filename: string
  fingerprint: string
  exportedAt: number
}

interface AppearancePromptResult {
  characterName?: string
  overview?: string
  prompts?: Partial<Record<AppearanceFormKey, string>>
  consistencyNotes?: string[]
  negativePrompt?: string
}

const MIN_LEFT_SIDEBAR_WIDTH = 280
const MAX_LEFT_SIDEBAR_WIDTH = 560
const DEFAULT_LEFT_SIDEBAR_WIDTH = 336
const UNASSIGNED_VOLUME_ID = "unassigned"

const clampLeftSidebarWidth = (width: number) => {
  return Math.min(MAX_LEFT_SIDEBAR_WIDTH, Math.max(MIN_LEFT_SIDEBAR_WIDTH, width))
}

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
  const [volumes, setVolumes] = useState<ManuscriptVolume[]>([])
  const [collapsedVolumeIds, setCollapsedVolumeIds] = useState<Set<string>>(new Set())
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null)
  const [chapterMoveMenu, setChapterMoveMenu] = useState<{ noteId: string; x: number; y: number } | null>(null)
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
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState("")
  const [showTimelinePanel, setShowTimelinePanel] = useState(true)
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [chapterVersions, setChapterVersions] = useState<ChapterVersion[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dirHandle, setDirHandle] = useState<any>(null)

  // Redesign States
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('manuscript')
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_LEFT_SIDEBAR_WIDTH
    const stored = Number(window.localStorage.getItem('penpad_left_sidebar_width'))
    return Number.isFinite(stored) && stored > 0
      ? clampLeftSidebarWidth(stored)
      : DEFAULT_LEFT_SIDEBAR_WIDTH
  })
  const [isZenMode, setIsZenMode] = useState(false)

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

  // World Bible States
  const [bibleEntries, setBibleEntries] = useState<BibleEntry[]>([])
  const [activeBibleEntryId, setActiveBibleEntryId] = useState<string | null>(null)
  const [isBibleDrawerOpen, setIsBibleDrawerOpen] = useState(false)
  const [bibleSearchQuery, setBibleSearchQuery] = useState('')
  const [bibleCategoryFilter, setBibleCategoryFilter] = useState<'all' | 'character' | 'world' | 'beast' | 'place' | 'item'>('all')
  const [isBibleSelectionMode, setIsBibleSelectionMode] = useState(false)
  const [selectedBibleIds, setSelectedBibleIds] = useState<Set<string>>(new Set())
  const [showMultiBibleDeleteModal, setShowMultiBibleDeleteModal] = useState(false)

  const activeBibleEntry = bibleEntries.find(e => e.id === activeBibleEntryId)

  // Brain Map States
  const [brainEntries, setBrainEntries] = useState<BrainEntry[]>([])
  const [brainSearchQuery, setBrainSearchQuery] = useState('')
  const [selectedBrainEntryId, setSelectedBrainEntryId] = useState<string | null>(null)
  const [brainTypeFilter, setBrainTypeFilter] = useState<BrainTypeFilter>('all')
  const [selectedBrainEntityName, setSelectedBrainEntityName] = useState<string | null>(null)
  const [brainAskQuestion, setBrainAskQuestion] = useState('')
  const [brainAskAnswer, setBrainAskAnswer] = useState('')
  const [brainAskLoading, setBrainAskLoading] = useState(false)
  const [brainAskError, setBrainAskError] = useState('')

  // Ambient Sound States
  const [activeSound, setActiveSound] = useState<string>('none')
  const [soundVolume, setSoundVolume] = useState<number>(0.5)
  const synthRef = useRef<AudioFocusSynthesizer | null>(null)

  // Slash Menu Commands States
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuQuery, setSlashMenuQuery] = useState("")
  const [slashMenuIndex, setSlashMenuIndex] = useState(0)
  
  // AI Lore Generation States
  const [showAILoreModal, setShowAILoreModal] = useState(false)
  const [aiLoreName, setAiLoreName] = useState("")
  const [aiLoreCategory, setAiLoreCategory] = useState<"character" | "world">("character")
  const [aiLoreContext, setAiLoreContext] = useState("")
  const [aiLoreLoading, setAiLoreLoading] = useState(false)
  const [aiLoreError, setAiLoreError] = useState("")

  // Appearance Prompt Lab States
  const [appearanceName, setAppearanceName] = useState("")
  const [appearanceStyle, setAppearanceStyle] = useState("cinematic fantasy character concept art")
  const [appearanceBeastForm, setAppearanceBeastForm] = useState("")
  const [appearanceDemiForm, setAppearanceDemiForm] = useState("")
  const [appearanceHumanForm, setAppearanceHumanForm] = useState("")
  const [appearanceResult, setAppearanceResult] = useState<AppearancePromptResult | null>(null)
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState("")
  const [appearanceCopiedKey, setAppearanceCopiedKey] = useState<string | null>(null)

  // Hover Tooltip States
  const [hoveredLore, setHoveredLore] = useState<BibleEntry | null>(null)
  const [hoveredLorePosition, setHoveredLorePosition] = useState<{ top: number; left: number } | null>(null)

  // Autocomplete States
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const [autocompleteTriggerPos, setAutocompleteTriggerPos] = useState(0)

  const handleLoreMouseEnter = (e: React.MouseEvent, entry: BibleEntry) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredLore(entry)
    setHoveredLorePosition({
      top: rect.top + window.scrollY - 10,
      left: rect.left + window.scrollX + rect.width / 2
    })
  }

  const handleLoreMouseLeave = () => {
    setHoveredLore(null)
    setHoveredLorePosition(null)
  }

  const persistLeftSidebarWidth = (width: number) => {
    const clamped = clampLeftSidebarWidth(width)
    setLeftSidebarWidth(clamped)
    window.localStorage.setItem('penpad_left_sidebar_width', String(clamped))
  }

  const startLeftSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isLeftSidebarOpen) return

    event.preventDefault()
    const startX = event.clientX
    const startWidth = leftSidebarWidth
    document.body.classList.add('resizing-sidebar')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setLeftSidebarWidth(clampLeftSidebarWidth(startWidth + moveEvent.clientX - startX))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('resizing-sidebar')
      setLeftSidebarWidth(current => {
        const clamped = clampLeftSidebarWidth(current)
        window.localStorage.setItem('penpad_left_sidebar_width', String(clamped))
        return clamped
      })
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  const handleSidebarResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 24 : -24
    persistLeftSidebarWidth(leftSidebarWidth + direction)
  }

  const handleLoreClick = (entry: BibleEntry) => {
    setActiveSidebarTab('bible')
    setIsLeftSidebarOpen(true)
    setActiveBibleEntryId(entry.id)
    setIsBibleDrawerOpen(true)
  }

  const handleGenerateAILore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiLoreName.trim() || !user || !projectId) return
    setAiLoreLoading(true)
    setAiLoreError("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_lore",
          name: aiLoreName,
          category: aiLoreCategory,
          context: aiLoreContext
        })
      })
      const data = await res.json()
      if (data.error) {
        setAiLoreError(data.error)
      } else {
        const now = Date.now()
        const newEntry: BibleEntry = {
          id: crypto.randomUUID(),
          name: aiLoreName,
          category: aiLoreCategory,
          content: data.text || "",
          createdAt: now,
          updatedAt: now
        }
        const updated = [newEntry, ...bibleEntries]
        setBibleEntries(updated)
        localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(updated))
        
        await saveBibleEntryToCloud(user.uid, projectId, newEntry)

        setActiveBibleEntryId(newEntry.id)
        setIsBibleDrawerOpen(true)
        setShowAILoreModal(false)
        setAiLoreName("")
        setAiLoreContext("")
      }
    } catch (err) {
      setAiLoreError(err instanceof Error ? err.message : "Failed to generate lore")
    } finally {
      setAiLoreLoading(false)
    }
  }

  const appearanceFormLabels: Record<AppearanceFormKey, string> = {
    beastForm: "Beast Form",
    demiHumanForm: "Demi-human Form",
    humanForm: "Human Form"
  }

  const hasAppearanceDescription = Boolean(
    appearanceBeastForm.trim() ||
    appearanceDemiForm.trim() ||
    appearanceHumanForm.trim() ||
    aiSelectionText.trim()
  )

  const buildAppearanceLoreContent = (result: AppearancePromptResult) => {
    const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
    const chapterLine = activeNote
      ? `${activeChapterNumber ? `Chapter ${activeChapterNumber} - ` : ""}${activeNote.title || "Untitled"}`
      : "No chapter selected"
    const prompts = result.prompts || {}
    const notes = Array.isArray(result.consistencyNotes) && result.consistencyNotes.length > 0
      ? result.consistencyNotes.map(note => `- ${note}`).join("\n")
      : "- Keep recognizable traits consistent across every form."

    return [
      "## Appearance Prompt Sheet",
      `Source: ${chapterLine}`,
      `Style Direction: ${appearanceStyle}`,
      "",
      result.overview ? `### Visual Core\n${result.overview}\n` : "",
      "### Beast Form",
      prompts.beastForm || "Not generated.",
      "",
      "### Demi-human Form",
      prompts.demiHumanForm || "Not generated.",
      "",
      "### Human Form",
      prompts.humanForm || "Not generated.",
      "",
      "### Consistency Notes",
      notes,
      "",
      result.negativePrompt ? `### Negative Prompt\n${result.negativePrompt}` : ""
    ].filter(Boolean).join("\n")
  }

  const handleGenerateAppearancePrompts = async () => {
    if (!hasAppearanceDescription) {
      setAppearanceError("Describe at least one form or highlight a description in the chapter first.")
      return
    }

    setAppearanceLoading(true)
    setAppearanceError("")
    setAppearanceResult(null)

    try {
      const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
      const chapterContext = activeNote?.content
        ? activeNote.content.slice(0, 5000)
        : ""
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appearance_prompts",
          name: appearanceName,
          style: appearanceStyle,
          selectedText: aiSelectionText,
          forms: {
            beastForm: appearanceBeastForm,
            demiHumanForm: appearanceDemiForm,
            humanForm: appearanceHumanForm
          },
          chapter: activeNote ? {
            title: activeNote.title,
            chapterNumber: activeChapterNumber,
            content: chapterContext
          } : null,
          memory: buildStoryMemoryContext()
        })
      })
      const data = await res.json()
      if (data.error) {
        setAppearanceError(data.error)
      } else {
        setAppearanceResult(data.appearancePrompts || { overview: "", prompts: {}, negativePrompt: "", consistencyNotes: [], characterName: appearanceName })
        if (!appearanceName.trim() && data.appearancePrompts?.characterName) {
          setAppearanceName(data.appearancePrompts.characterName)
        }
      }
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Failed to generate appearance prompts")
    } finally {
      setAppearanceLoading(false)
    }
  }

  const copyAppearanceText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setAppearanceCopiedKey(key)
    setTimeout(() => setAppearanceCopiedKey(null), 1500)
  }

  const saveAppearanceToLore = async () => {
    if (!appearanceResult || !user || !projectId) return

    const now = Date.now()
    const entryName = appearanceResult.characterName || appearanceName || "Appearance Prompt Sheet"
    const newEntry: BibleEntry = {
      id: crypto.randomUUID(),
      name: entryName,
      category: appearanceBeastForm.trim() || appearanceDemiForm.trim() ? "beast" : "character",
      content: buildAppearanceLoreContent(appearanceResult),
      createdAt: now,
      updatedAt: now
    }

    const updated = [newEntry, ...bibleEntries]
    setBibleEntries(updated)
    localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(updated))
    await saveBibleEntryToCloud(user.uid, projectId, newEntry)

    setActiveSidebarTab("bible")
    setIsLeftSidebarOpen(true)
    setActiveBibleEntryId(newEntry.id)
    setIsBibleDrawerOpen(true)
  }

  const getLoreAliases = useCallback((entry: BibleEntry) => {
    const rawName = entry.name || ""
    const withoutMarkdown = rawName.replace(/[\[\]#*_`]/g, " ").replace(/\s+/g, " ").trim()
    const afterColon = withoutMarkdown.includes(":") ? withoutMarkdown.split(":").pop()?.trim() || "" : ""
    const withoutTitleTag = withoutMarkdown.replace(/\b(Name|Title|Character|Place|Item|Lore)\s*:\s*/gi, "").trim()

    return Array.from(new Set([rawName, withoutMarkdown, afterColon, withoutTitleTag]
      .map(alias => alias.trim())
      .filter(alias => alias.length > 1)))
  }, [])

  const highlightBibleEntries = (text: string) => {
    if (!bibleEntries.length || !text) return text
    
    const aliasEntries = bibleEntries.flatMap(entry =>
      getLoreAliases(entry).map(alias => ({ entry, alias }))
    ).sort((a, b) => b.alias.length - a.alias.length)

    if (aliasEntries.length === 0) return text

    const escapedNames = aliasEntries.map(item => item.alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    const regex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi')

    const parts = text.split(regex)
    if (parts.length === 1) return text

    return parts.map((part, index) => {
      const match = aliasEntries.find(item => item.alias.toLowerCase() === part.toLowerCase())
      if (match) {
        return (
          <span 
            key={index} 
            className="lore-chip-preview"
            onMouseEnter={(e) => handleLoreMouseEnter(e, match.entry)}
            onMouseLeave={handleLoreMouseLeave}
            onClick={() => handleLoreClick(match.entry)}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  const injectLoreChips = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      return highlightBibleEntries(node)
    }
    
    if (React.isValidElement(node)) {
      if (node.type === 'code' || node.type === 'pre') {
        return node
      }
      
      const children = React.Children.map(node.props.children, child => injectLoreChips(child))
      return React.cloneElement(node, { ...node.props, children })
    }
    
    return node
  }

  // Scan activeNote.content for bibleEntries
  const getMentionedLore = useCallback(() => {
    if (!activeNote || !activeNote.content || !bibleEntries.length) return []
    
    return bibleEntries.filter(entry => {
      if (!entry.name || entry.name.trim().length <= 1) return false
      return getLoreAliases(entry).some(alias => {
        const escaped = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const regex = new RegExp(`\\b${escaped}\\b`, 'i')
        return regex.test(activeNote.content)
      })
    })
  }, [activeNote, bibleEntries, getLoreAliases])

  const mentionedLore = getMentionedLore()

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
  const [exportHistory, setExportHistory] = useState<Record<string, ExportHistoryRecord>>({})
  const [exportModal, setExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('folder')
  const [isTypewriterMode, setIsTypewriterMode] = useState(false)
  const [theme, setTheme] = useState('midnight')

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

  const getVolumesStorageKey = useCallback(() => {
    return projectId ? `penpad_volumes_${projectId}` : ""
  }, [projectId])

  const getCollapsedVolumesStorageKey = useCallback(() => {
    return projectId ? `penpad_collapsed_volumes_${projectId}` : ""
  }, [projectId])

  const getExportHistoryStorageKey = useCallback(() => {
    return projectId ? `penpad_export_history_${projectId}` : ""
  }, [projectId])

  const persistVolumes = useCallback((nextVolumes: ManuscriptVolume[]) => {
    const key = getVolumesStorageKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(nextVolumes))
    setVolumes(nextVolumes)
  }, [getVolumesStorageKey])

  const fetchVolumes = useCallback(() => {
    if (!projectId) return
    try {
      const storedVolumes = localStorage.getItem(getVolumesStorageKey())
      const volumeList: ManuscriptVolume[] = storedVolumes ? JSON.parse(storedVolumes) : []
      setVolumes(volumeList.sort((a, b) => a.sortOrder - b.sortOrder))

      const storedCollapsed = localStorage.getItem(getCollapsedVolumesStorageKey())
      const collapsedList: string[] = storedCollapsed ? JSON.parse(storedCollapsed) : []
      setCollapsedVolumeIds(new Set(collapsedList))

      const storedHistory = localStorage.getItem(getExportHistoryStorageKey())
      const history: Record<string, ExportHistoryRecord> = storedHistory ? JSON.parse(storedHistory) : {}
      setExportHistory(history)
      savedFilenamesRef.current = new Map(Object.entries(history).map(([chapterId, record]) => [chapterId, record.filename]))
      setSavedChapters(new Set(Object.keys(history)))
    } catch (e) {
      console.error("Failed to load volume or export history:", e)
      setVolumes([])
      setCollapsedVolumeIds(new Set())
      setExportHistory({})
    }
  }, [projectId, getVolumesStorageKey, getCollapsedVolumesStorageKey, getExportHistoryStorageKey])

  const fetchNotes = useCallback(async () => {
    if (!user || !projectId) return
    setIsLoadingNotes(true)
    try {
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      noteList.sort((a: Note, b: Note) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
      setNotes(noteList)
      if (noteList.length > 0 && !activeNoteId) {
        setActiveNoteId(noteList[0].id)
      }
      
      const syncedNotes = await syncChaptersWithCloud(user.uid, projectId, noteList)
      const orderedSyncedNotes = syncedNotes.sort((a: Note, b: Note) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
      setNotes(orderedSyncedNotes)
      if (syncedNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(orderedSyncedNotes[0].id)
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

  // Brain Map Logic
  const fetchBrain = useCallback(async () => {
    if (!user || !projectId) return
    try {
      const stored = localStorage.getItem(`penpad_brain_${projectId}`)
      const entryList: BrainEntry[] = stored ? JSON.parse(stored) : []
      setBrainEntries(entryList)

      const synced = await syncBrainWithCloud(user.uid, projectId, entryList)
      setBrainEntries(synced)
    } catch {
      console.error("Fetch/Sync brain entries failed")
    }
  }, [user, projectId])

  const getChapterNumberFromTitle = (title?: string) => {
    const match = title?.match(/\bchapter\s*0*(\d+)\b/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  const getNoteSortValue = (note: Note) => {
    if (Number.isFinite(note.sortOrder)) return note.sortOrder as number
    return getChapterNumberFromTitle(note.title) ?? note.createdAt
  }

  const getOrderedNotesList = (noteList: Note[]) => {
    return [...noteList].sort((a, b) => {
      const aSort = getNoteSortValue(a)
      const bSort = getNoteSortValue(b)
      if (aSort !== bSort) return aSort - bSort
      return a.title.localeCompare(b.title, undefined, { numeric: true })
    })
  }

  const getNoteChapterNumber = (note: Note) => {
    const titleNumber = getChapterNumberFromTitle(note.title)
    if (titleNumber) return titleNumber

    const chapterIndex = getOrderedNotesList(notes).findIndex(n => n.id === note.id)
    return chapterIndex >= 0 ? chapterIndex + 1 : null
  }

  const handleAddToBrain = async () => {
    const text = aiSelectionText.trim()
    if (!text || !user || !projectId || !activeNote) return

    const now = Date.now()
    const chapterNumber = getNoteChapterNumber(activeNote)
    const newEntry: BrainEntry = {
      id: crypto.randomUUID(),
      highlightedText: text,
      aiSummary: "Analyzing...",
      chapterTitle: activeNote.title || "Untitled",
      chapterId: activeNote.id,
      ...(chapterNumber ? { chapterNumber } : {}),
      createdAt: now,
      updatedAt: now
    }

    // Immediately add with placeholder — zero lag
    const updated = [newEntry, ...brainEntries]
    setBrainEntries(updated)
    localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(updated))

    // Clear selection
    setAiSelectionText("")
    setAiSelectionStart(0)
    setAiSelectionEnd(0)

    // Fire-and-forget AI analysis in background
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "brain_analyze",
        highlightedText: text,
        chapterContent: activeNote.content,
        chapterTitle: activeNote.title,
        chapterNumber,
        existingBrainEntries: brainEntries
          .filter(entry => entry.aiSummary !== "Analyzing...")
          .slice(0, 50)
      })
    })
      .then(res => res.json())
      .then(data => {
        const summary = data.text || data.error || "Could not analyze."
        const finalEntry: BrainEntry = {
          ...newEntry,
          aiSummary: summary,
          entityType: data.entityType || "unknown",
          entityName: data.entityName || text,
          importance: data.importance || "minor",
          connections: Array.isArray(data.connections) ? data.connections : [],
          updatedAt: Date.now()
        }

        setBrainEntries(prev => {
          const list = prev.map(e => e.id === newEntry.id ? finalEntry : e)
          localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(list))
          return list
        })

        saveBrainEntryToCloud(user.uid, projectId, finalEntry)
      })
      .catch(() => {
        const errorEntry = { ...newEntry, aiSummary: "Analysis failed. Try again.", updatedAt: Date.now() }
        setBrainEntries(prev => {
          const list = prev.map(e => e.id === newEntry.id ? errorEntry : e)
          localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(list))
          return list
        })
      })
  }

  const deleteBrainEntry = async (entryId: string) => {
    if (!projectId || !user) return
    try {
      const filtered = brainEntries.filter(e => e.id !== entryId)
      setBrainEntries(filtered)
      localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(filtered))
      await deleteBrainEntryFromCloud(user.uid, projectId, entryId)
    } catch (e) {
      console.error("Failed to delete brain entry:", e)
    }
  }

  const updateBrainEntry = (entryId: string, updates: Partial<BrainEntry>) => {
    if (!projectId || !user) return

    const updatedEntry = brainEntries.find(entry => entry.id === entryId)
    if (!updatedEntry) return

    const finalEntry = { ...updatedEntry, ...updates, updatedAt: Date.now() }
    const updatedList = brainEntries.map(entry => entry.id === entryId ? finalEntry : entry)

    setBrainEntries(updatedList)
    localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(updatedList))
    saveBrainEntryToCloud(user.uid, projectId, finalEntry)
  }

  const askBrainMap = async () => {
    const question = brainAskQuestion.trim()
    if (!question || brainAskLoading) return

    setBrainAskLoading(true)
    setBrainAskError("")
    setBrainAskAnswer("")

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brain_ask",
          question,
          brainEntries: brainEntries.filter(entry => entry.aiSummary !== "Analyzing...")
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not ask Brain Map")
      setBrainAskAnswer(data.text || "No answer returned.")
    } catch (err) {
      setBrainAskError(err instanceof Error ? err.message : "Could not ask Brain Map")
    } finally {
      setBrainAskLoading(false)
    }
  }

  const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

  const getVersionKey = useCallback((noteId: string) => {
    return projectId ? `penpad_versions_${projectId}_${noteId}` : ""
  }, [projectId])

  const loadChapterVersions = useCallback((noteId: string) => {
    const key = getVersionKey(noteId)
    if (!key) return []
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) as ChapterVersion[] : []
    } catch {
      return []
    }
  }, [getVersionKey])

  const saveChapterVersion = useCallback((note: Note, timestamp: number) => {
    const key = getVersionKey(note.id)
    if (!key || !note.content.trim()) return

    const versions = loadChapterVersions(note.id)
    const latest = versions[0]
    if (latest && latest.content === note.content) return
    if (latest && timestamp - latest.savedAt < 1000 * 60 * 5) return

    const nextVersions: ChapterVersion[] = [
      {
        id: crypto.randomUUID(),
        title: note.title || "Untitled",
        content: note.content,
        savedAt: timestamp,
        wordCount: countWords(note.content)
      },
      ...versions
    ].slice(0, 12)

    localStorage.setItem(key, JSON.stringify(nextVersions))
    if (note.id === activeNoteId) setChapterVersions(nextVersions)
  }, [activeNoteId, getVersionKey, loadChapterVersions])

  const restoreChapterVersion = (version: ChapterVersion) => {
    if (!activeNote) return
    updateActiveNote({ title: version.title, content: version.content })
    setShowVersionsModal(false)
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

      saveChapterVersion(updatedNote, now)
      await saveChapterToCloud(user.uid, projectId, updatedNote)
      setLastSavedAt(now)
      setSyncStatus('saved')
    } catch (e) {
      console.error("Save note failed:", e)
      setSyncStatus('error')
    }
  }, [user, projectId, saveChapterVersion])

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
      fetchVolumes()
      fetchNotes()
      fetchBible()
      fetchBrain()
    }
  }, [user, projectId, fetchProjectName, fetchVolumes, fetchNotes, fetchBible, fetchBrain])

  useEffect(() => {
    if (activeNoteId) {
      setChapterVersions(loadChapterVersions(activeNoteId))
    } else {
      setChapterVersions([])
    }
  }, [activeNoteId, loadChapterVersions])

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

  const getChapterExportFingerprint = (note: Note) => {
    const raw = `${note.title || ""}\n${note.content || ""}\n${note.updatedAt || 0}`
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
    }
    return `${note.updatedAt || 0}:${raw.length}:${hash}`
  }

  const persistExportHistory = useCallback((nextHistory: Record<string, ExportHistoryRecord>) => {
    const key = getExportHistoryStorageKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify(nextHistory))
    setExportHistory(nextHistory)
    savedFilenamesRef.current = new Map(Object.entries(nextHistory).map(([chapterId, record]) => [chapterId, record.filename]))
    setSavedChapters(new Set(Object.keys(nextHistory)))
  }, [getExportHistoryStorageKey])

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
      setExportHistory(prev => {
        const next = {
          ...prev,
          [note.id]: {
            filename: newFilename,
            fingerprint: getChapterExportFingerprint(note),
            exportedAt: Date.now()
          }
        }
        const key = getExportHistoryStorageKey()
        if (key) localStorage.setItem(key, JSON.stringify(next))
        savedFilenamesRef.current = new Map(Object.entries(next).map(([chapterId, record]) => [chapterId, record.filename]))
        return next
      })
    } catch (e) {
      console.error("Failed to save chapter:", e)
    }
  }, [getExportHistoryStorageKey])

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
      
      const sortedNotes = getOrderedNotesList(notes)
      const chaptersToExport = sortedNotes.filter(note => {
        const record = exportHistory[note.id]
        return !record || record.fingerprint !== getChapterExportFingerprint(note)
      })

      if (chaptersToExport.length === 0) {
        setExportProgress(100)
        setIsExporting(false)
        setExportModal(false)
        alert("All chapters are already exported and unchanged.")
        return
      }
      
      for (let i = 0; i < chaptersToExport.length; i++) {
        await saveSingleChapterToFolder(chaptersToExport[i], targetDir)
        setExportProgress(Math.round(((i + 1) / chaptersToExport.length) * 100))
      }
      
      setIsExporting(false)
      setExportModal(false)
    } catch (e) {
      console.error("Export failed:", e)
      setIsExporting(false)
      alert(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const getExportChapters = () => {
    return getOrderedNotesList(notes)
  }

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  const buildExportContent = (format: Exclude<ExportFormat, 'folder' | 'pdf'>) => {
    const chapters = getExportChapters()
    if (format === 'md') {
      return `# ${projectName}\n\n${chapters.map(note => `## ${note.title || "Untitled"}\n\n${note.content || ""}`).join("\n\n")}`
    }

    if (format === 'html' || format === 'doc') {
      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(projectName)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 760px; margin: 48px auto; line-height: 1.7; color: #111827; }
    h1 { text-align: center; page-break-after: always; }
    h2 { page-break-before: always; margin-top: 0; }
    p { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(projectName)}</h1>
  ${chapters.map(note => `<section><h2>${escapeHtml(note.title || "Untitled")}</h2><p>${escapeHtml(note.content || "")}</p></section>`).join("\n")}
</body>
</html>`
    }

    return chapters.map(note => `${note.title || "Untitled"}\n${"=".repeat((note.title || "Untitled").length)}\n\n${note.content || ""}`).join("\n\n\n")
  }

  const downloadExportFile = (content: string, extension: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName || "manuscript"}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportManuscript = async () => {
    if (exportFormat === 'folder') {
      await exportManuscriptToFolder()
      return
    }

    if (notes.length === 0) {
      alert("No chapters to export")
      return
    }

    if (exportFormat === 'pdf') {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        alert("Popup blocked. Allow popups to print or save as PDF.")
        return
      }
      printWindow.document.write(buildExportContent('html'))
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      setExportModal(false)
      return
    }

    const content = buildExportContent(exportFormat)
    const exportMeta = {
      txt: { extension: 'txt', type: 'text/plain;charset=utf-8' },
      md: { extension: 'md', type: 'text/markdown;charset=utf-8' },
      html: { extension: 'html', type: 'text/html;charset=utf-8' },
      doc: { extension: 'doc', type: 'application/msword;charset=utf-8' }
    }[exportFormat]

    downloadExportFile(content, exportMeta.extension, exportMeta.type)
    setExportModal(false)
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
    { name: "Appearance Lab", cmd: "/appearance", desc: "Open Appearance Prompt Lab", action: () => { setActiveSidebarTab('appearance'); setIsLeftSidebarOpen(true) } },
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

  const handleAutocompleteSelect = (suggestion: string) => {
    const textarea = textareaRef.current
    if (!textarea || !activeNote) return
    
    const text = textarea.value
    const cursor = textarea.selectionStart
    
    // Replace the typed query with the full suggestion
    const before = text.substring(0, autocompleteTriggerPos)
    const after = text.substring(cursor)
    
    const newContent = before + suggestion + after
    updateActiveNote({ content: newContent })
    
    // Position cursor at the end of the completed name
    const newCursorPos = autocompleteTriggerPos + suggestion.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
    
    setShowAutocomplete(false)
    setAutocompleteSuggestions([])
  }

  const handleAddSelectionToBible = async (category: "character" | "world" | "beast" | "place" | "item" = "character") => {
    const name = aiSelectionText.trim()
    if (!name || !user || !projectId) return
    
    try {
      const stored = localStorage.getItem(`penpad_bible_${projectId}`)
      const entryList: BibleEntry[] = stored ? JSON.parse(stored) : []
      
      const exists = entryList.some(e => e.name.toLowerCase() === name.toLowerCase())
      if (exists) {
        return
      }

      const newEntry: BibleEntry = {
        id: crypto.randomUUID(),
        name: name,
        category: category,
        content: `Manually added as a ${category}.`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      entryList.unshift(newEntry)
      localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(entryList))
      setBibleEntries(entryList)
      
      await saveBibleEntryToCloud(user.uid, projectId, newEntry)
      
      // Clear selection text
      setAiSelectionText("")
      setAiSelectionStart(0)
      setAiSelectionEnd(0)
    } catch (e) {
      console.error("Failed to add highlighted text to Story Bible:", e)
    }
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
    } else if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex(prev => (prev + 1) % Math.min(5, autocompleteSuggestions.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex(prev => (prev - 1 + Math.min(5, autocompleteSuggestions.length)) % Math.min(5, autocompleteSuggestions.length))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (autocompleteSuggestions[autocompleteIndex]) {
          handleAutocompleteSelect(autocompleteSuggestions[autocompleteIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowAutocomplete(false)
        setAutocompleteSuggestions([])
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
      setShowAutocomplete(false)
    } else {
      if (showSlashMenu) {
        setShowSlashMenu(false)
        setSlashMenuQuery("")
      }

      // Autocomplete check
      const lastLineIdx = textBeforeCursor.lastIndexOf("\n")
      const lastPunctuationIdx = Math.max(
        textBeforeCursor.lastIndexOf(","),
        textBeforeCursor.lastIndexOf("."),
        textBeforeCursor.lastIndexOf("!"),
        textBeforeCursor.lastIndexOf("?"),
        textBeforeCursor.lastIndexOf("\""),
        textBeforeCursor.lastIndexOf("“"),
        textBeforeCursor.lastIndexOf("("),
        textBeforeCursor.lastIndexOf("[")
      )
      const splitIdx = Math.max(lastWordIdx, lastLineIdx, lastPunctuationIdx)
      const currentWord = textBeforeCursor.substring(splitIdx + 1)
      
      const cleanWord = currentWord.replace(/[^A-Za-z]/g, "")
      if (cleanWord.length >= 2) {
        const matches = bibleEntries
          .map(entry => entry.name)
          .filter(name => {
            const words = name.split(/\s+/)
            return words.some(w => w.toLowerCase().startsWith(cleanWord.toLowerCase()))
          })

        if (matches.length > 0) {
          setAutocompleteSuggestions(matches)

          setAutocompleteTriggerPos(cursor - cleanWord.length)
          setShowAutocomplete(true)
          setAutocompleteIndex(0)
        } else {
          setShowAutocomplete(false)
          setAutocompleteSuggestions([])
        }
      } else {
        setShowAutocomplete(false)
        setAutocompleteSuggestions([])
      }
    }
  }

  const buildStoryMemoryContext = () => {
    const activeChapterNumber = activeNote ? getNoteChapterNumber(activeNote) : null
    const nearbyChapters = [...notes]
      .filter(note => note.id !== activeNote?.id)
      .sort((a, b) => Math.abs((getNoteChapterNumber(a) || 9999) - (activeChapterNumber || 9999)) - Math.abs((getNoteChapterNumber(b) || 9999) - (activeChapterNumber || 9999)))
      .slice(0, 3)
      .map(note => `${note.title}: ${(note.content || "").slice(0, 900)}`)

    return {
      projectName,
      activeChapter: activeNote ? {
        title: activeNote.title,
        chapterNumber: activeChapterNumber
      } : null,
      nearbyChapters,
      brainEntries: brainEntries
        .filter(entry => entry.aiSummary && entry.aiSummary !== "Analyzing...")
        .slice(0, 20)
        .map(entry => ({
          entityName: entry.entityName || entry.highlightedText,
          entityType: entry.entityType || "unknown",
          importance: entry.importance || "minor",
          chapterNumber: entry.chapterNumber,
          summary: entry.aiSummary,
          connections: entry.connections || []
        })),
      loreEntries: bibleEntries.slice(0, 16).map(entry => ({
        name: entry.name,
        category: entry.category,
        content: entry.content.slice(0, 900)
      }))
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
        body: JSON.stringify({ action: "continue", content: contextText, memory: buildStoryMemoryContext() })
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
        body: JSON.stringify({ action: "rewrite", content: aiSelectionText, style: aiTone, memory: buildStoryMemoryContext() })
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
        body: JSON.stringify({ action: "outline", prompt: aiOutlinePrompt, memory: buildStoryMemoryContext() })
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
        volumeId: activeNote?.volumeId || null,
        sortOrder: getNextChapterSortOrder(notes),
      }
      
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      const updatedNotes = getOrderedNotesList([...noteList, newNote])
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(updatedNotes))
      setNotes(updatedNotes)
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
        setSelectedBrainEntryId(null)
        setChapterMoveMenu(null)
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

  const getNextChapterSortOrder = (existingNotes: Note[]) => {
    if (existingNotes.length === 0) return 1
    return Math.max(...existingNotes.map(note => getNoteSortValue(note))) + 1
  }

  const createNewVolume = () => {
    if (!projectId) return
    const defaultName = `Volume ${volumes.length + 1}`
    const title = prompt("Name this volume:", defaultName)
    if (title === null) return
    const trimmedTitle = title.trim() || defaultName
    const now = Date.now()
    const newVolume: ManuscriptVolume = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      createdAt: now,
      updatedAt: now,
      sortOrder: volumes.length > 0 ? Math.max(...volumes.map(volume => volume.sortOrder)) + 1 : 1
    }
    persistVolumes([...volumes, newVolume].sort((a, b) => a.sortOrder - b.sortOrder))
    setCollapsedVolumeIds(prev => {
      const next = new Set(prev)
      next.delete(newVolume.id)
      localStorage.setItem(getCollapsedVolumesStorageKey(), JSON.stringify(Array.from(next)))
      return next
    })
  }

  const toggleVolumeCollapsed = (volumeId: string) => {
    setCollapsedVolumeIds(prev => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      const key = getCollapsedVolumesStorageKey()
      if (key) localStorage.setItem(key, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const renameVolume = (volumeId: string) => {
    const volume = volumes.find(item => item.id === volumeId)
    if (!volume) return
    const title = prompt("Rename volume:", volume.title)
    if (title === null) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    persistVolumes(volumes.map(item =>
      item.id === volumeId ? { ...item, title: trimmedTitle, updatedAt: Date.now() } : item
    ))
  }

  const createNewNote = async (volumeId?: string | null) => {
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
        volumeId: volumeId === UNASSIGNED_VOLUME_ID ? null : volumeId || null,
        sortOrder: getNextChapterSortOrder(notes),
      }
      
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      const noteList: Note[] = stored ? JSON.parse(stored) : []
      const updatedNotes = getOrderedNotesList([...noteList, newNote])
      
      localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(updatedNotes))
      setNotes(updatedNotes)
      setActiveNoteId(newNote.id)
      setViewMode('edit')

      saveChapterToCloud(user.uid, projectId, newNote)
    } catch (e) {
      console.error("Failed to create note:", e)
    }
  }

  const moveChapterToVolume = async (noteId: string, volumeId: string | null) => {
    if (!projectId) return
    const normalizedVolumeId = volumeId === UNASSIGNED_VOLUME_ID ? null : volumeId
    const movingNote = notes.find(note => note.id === noteId)
    if (!movingNote) return

    const targetVolumeNotes = notes.filter(note => (note.volumeId || null) === normalizedVolumeId && note.id !== noteId)
    const nextSortOrder = targetVolumeNotes.length > 0
      ? Math.max(...targetVolumeNotes.map(note => getNoteSortValue(note))) + 0.01
      : getNextChapterSortOrder(notes)
    const updatedNote: Note = {
      ...movingNote,
      volumeId: normalizedVolumeId,
      sortOrder: nextSortOrder,
      updatedAt: Date.now()
    }
    const updatedNotes = getOrderedNotesList(notes.map(note => note.id === noteId ? updatedNote : note))
    setNotes(updatedNotes)
    localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(updatedNotes))
    setChapterMoveMenu(null)
    setDraggedChapterId(null)

    if (user) {
      await saveChapterToCloud(user.uid, projectId, updatedNote)
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

  const orderedNotes = getOrderedNotesList(notes)
  const orderedFilteredNotes = getOrderedNotesList(filteredNotes)
  const sortedVolumes = [...volumes].sort((a, b) => a.sortOrder - b.sortOrder)
  const knownVolumeIds = new Set(sortedVolumes.map(volume => volume.id))
  const orphanVolumeIds = Array.from(new Set(orderedFilteredNotes
    .map(note => note.volumeId)
    .filter((volumeId): volumeId is string => typeof volumeId === "string" && volumeId.length > 0 && !knownVolumeIds.has(volumeId))))
  const unassignedFilteredNotes = orderedFilteredNotes.filter(note => !note.volumeId)
  const manuscriptVolumeGroups = [
    ...sortedVolumes.map(volume => ({
      id: volume.id,
      title: volume.title,
      isSystem: false,
      chapters: orderedFilteredNotes.filter(note => note.volumeId === volume.id)
    })),
    ...orphanVolumeIds.map((volumeId, index) => ({
      id: volumeId,
      title: `Recovered Volume ${index + 1}`,
      isSystem: true,
      chapters: orderedFilteredNotes.filter(note => note.volumeId === volumeId)
    })),
    ...(unassignedFilteredNotes.length > 0 || sortedVolumes.length === 0
      ? [{
          id: UNASSIGNED_VOLUME_ID,
          title: sortedVolumes.length === 0 ? "Chapters" : "Unassigned Chapters",
          isSystem: true,
          chapters: unassignedFilteredNotes
        }]
      : [])
  ]

  const sortedTimelineNotes = [...orderedNotes].sort((a, b) => {
    const aNumber = getNoteChapterNumber(a)
    const bNumber = getNoteChapterNumber(b)
    if (aNumber && bNumber) return aNumber - bNumber
    return a.title.localeCompare(b.title, undefined, { numeric: true })
  })

  const manuscriptStats = {
    chapters: notes.length,
    words: notes.reduce((total, note) => total + countWords(note.content || ""), 0),
    brainEntries: brainEntries.length,
    loreEntries: bibleEntries.length,
    criticalBrainEntries: brainEntries.filter(entry => entry.importance === 'critical').length,
    averageChapterWords: notes.length > 0
      ? Math.round(notes.reduce((total, note) => total + countWords(note.content || ""), 0) / notes.length)
      : 0
  }

  const globalSearchResults: GlobalSearchResult[] = (() => {
    const query = globalSearchQuery.trim().toLowerCase()
    if (!query) return []

    const chapterResults = notes
      .filter(note => note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
      .slice(0, 8)
      .map(note => {
        const content = note.content || ""
        const index = content.toLowerCase().indexOf(query)
        const preview = index >= 0 ? content.slice(Math.max(0, index - 60), index + 140) : content.slice(0, 160)
        return {
          id: `chapter-${note.id}`,
          source: 'chapter' as SearchSource,
          title: note.title || "Untitled",
          subtitle: getNoteChapterNumber(note) ? `Chapter ${getNoteChapterNumber(note)}` : "Chapter",
          preview,
          chapterId: note.id
        }
      })

    const brainResults = brainEntries
      .filter(entry =>
        entry.highlightedText.toLowerCase().includes(query) ||
        entry.aiSummary.toLowerCase().includes(query) ||
        (entry.entityName || "").toLowerCase().includes(query) ||
        (entry.connections || []).some(connection => connection.toLowerCase().includes(query))
      )
      .slice(0, 8)
      .map(entry => ({
        id: `brain-${entry.id}`,
        source: 'brain' as SearchSource,
        title: entry.entityName || entry.highlightedText,
        subtitle: `${entry.chapterNumber ? `Chapter ${entry.chapterNumber}` : entry.chapterTitle || "Brain Map"} - ${entry.entityType || "Brain Map"}`,
        preview: entry.aiSummary,
        chapterId: entry.chapterId
      }))

    const loreResults = bibleEntries
      .filter(entry => entry.name.toLowerCase().includes(query) || entry.content.toLowerCase().includes(query))
      .slice(0, 8)
      .map(entry => ({
        id: `lore-${entry.id}`,
        source: 'lore' as SearchSource,
        title: entry.name,
        subtitle: entry.category,
        preview: entry.content.slice(0, 180)
      }))

    return [...chapterResults, ...brainResults, ...loreResults].slice(0, 18)
  })()

  const openGlobalSearchResult = (result: GlobalSearchResult) => {
    if (result.source === 'chapter' && result.chapterId) {
      setActiveNoteId(result.chapterId)
      setShowGlobalSearch(false)
      setViewMode('edit')
    } else if (result.source === 'brain') {
      setActiveSidebarTab('brain')
      setIsLeftSidebarOpen(true)
      setBrainSearchQuery(result.title)
      setShowGlobalSearch(false)
    } else if (result.source === 'lore') {
      const entry = bibleEntries.find(item => item.name === result.title)
      if (entry) {
        setActiveSidebarTab('bible')
        setIsLeftSidebarOpen(true)
        setActiveBibleEntryId(entry.id)
        setIsBibleDrawerOpen(true)
      }
      setShowGlobalSearch(false)
    }
  }

  const brainTypeOptions: { value: BrainTypeFilter; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'character', label: 'Characters' },
    { value: 'place', label: 'Places' },
    { value: 'object', label: 'Objects' },
    { value: 'concept', label: 'Concepts' },
    { value: 'event', label: 'Events' },
    { value: 'foreshadowing', label: 'Foreshadowing' },
    { value: 'unknown', label: 'Unknown' }
  ]

  const getBrainEntryType = (entry: BrainEntry): BrainEntityType => entry.entityType || 'unknown'
  const getBrainEntryImportance = (entry: BrainEntry): BrainImportance => entry.importance || 'minor'
  const getBrainEntryEntityName = (entry: BrainEntry) => entry.entityName || entry.highlightedText

  const filteredBrainEntries = brainEntries.filter(e => {
    const query = brainSearchQuery.toLowerCase()
    const matchesSearch = !query ||
      e.highlightedText.toLowerCase().includes(query) ||
      e.aiSummary.toLowerCase().includes(query) ||
      e.chapterTitle.toLowerCase().includes(query) ||
      (e.entityName || "").toLowerCase().includes(query) ||
      (e.connections || []).some(connection => connection.toLowerCase().includes(query))
    const matchesType = brainTypeFilter === 'all' || getBrainEntryType(e) === brainTypeFilter
    return matchesSearch && matchesType
  })

  const selectedBrainEntry = selectedBrainEntryId 
    ? brainEntries.find(e => e.id === selectedBrainEntryId) || null
    : null

  const getBrainEntryChapterNumber = (entry: BrainEntry) => {
    if (entry.chapterNumber) return entry.chapterNumber

    const chapter = notes.find(note => note.id === entry.chapterId)
    const titleNumber = getChapterNumberFromTitle(chapter?.title || entry.chapterTitle)
    if (titleNumber) return titleNumber

    const chapterIndex = notes.findIndex(note => note.id === entry.chapterId)
    return chapterIndex >= 0 ? chapterIndex + 1 : null
  }

  const getBrainEntryChapterLabel = (entry: BrainEntry) => {
    const chapterNumber = getBrainEntryChapterNumber(entry)
    return chapterNumber ? `Chapter ${chapterNumber}` : "Chapter ?"
  }

  const getBrainEntryChapterTitle = (entry: BrainEntry) => {
    const chapter = notes.find(note => note.id === entry.chapterId)
    return chapter?.title || entry.chapterTitle || "Untitled"
  }

  const formatBrainEntryDate = (entry: BrainEntry) => {
    const timestamp = entry.updatedAt || entry.createdAt
    if (!timestamp) return ""
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const getBrainTypeLabel = (type: BrainEntityType) => {
    const option = brainTypeOptions.find(item => item.value === type)
    return option?.label.replace(/s$/, '') || 'Unknown'
  }

  const renderBrainTypeIcon = (type: BrainEntityType, size = 12) => {
    switch (type) {
      case 'character':
        return <User size={size} />
      case 'place':
        return <MapPin size={size} />
      case 'object':
        return <Package size={size} />
      case 'concept':
        return <Globe size={size} />
      case 'event':
        return <BookOpen size={size} />
      case 'foreshadowing':
        return <Sparkles size={size} />
      default:
        return <BrainCircuit size={size} />
    }
  }

  const getBrainEntityGroups = () => {
    const groups = new Map<string, { name: string; type: BrainEntityType; entries: BrainEntry[]; criticalCount: number }>()

    for (const entry of brainEntries) {
      const name = getBrainEntryEntityName(entry).trim()
      if (!name) continue
      const key = name.toLowerCase()
      const existing = groups.get(key)
      if (existing) {
        existing.entries.push(entry)
        if (getBrainEntryImportance(entry) === 'critical') existing.criticalCount += 1
      } else {
        groups.set(key, {
          name,
          type: getBrainEntryType(entry),
          entries: [entry],
          criticalCount: getBrainEntryImportance(entry) === 'critical' ? 1 : 0
        })
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.criticalCount - a.criticalCount || b.entries.length - a.entries.length || a.name.localeCompare(b.name))
  }

  const brainEntityGroups = getBrainEntityGroups()
  const selectedBrainEntity = selectedBrainEntityName
    ? brainEntityGroups.find(group => group.name.toLowerCase() === selectedBrainEntityName.toLowerCase()) || null
    : null

  const filteredBibleEntries = bibleEntries.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(bibleSearchQuery.toLowerCase()) ||
                          e.content.toLowerCase().includes(bibleSearchQuery.toLowerCase())
    const matchesFilter = bibleCategoryFilter === 'all' || e.category === bibleCategoryFilter
    return matchesSearch && matchesFilter
  })

  const toggleBibleEntrySelection = (entryId: string) => {
    setSelectedBibleIds(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const toggleBibleSelectAll = () => {
    const allFilteredIds = filteredBibleEntries.map(e => e.id)
    const allSelected = allFilteredIds.every(id => selectedBibleIds.has(id))
    
    if (allSelected) {
      setSelectedBibleIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedBibleIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleBibleSelectionMode = () => {
    setIsBibleSelectionMode(prev => {
      if (prev) {
        setSelectedBibleIds(new Set())
      }
      return !prev
    })
  }

  const deleteSelectedBibleEntries = async () => {
    if (!projectId || selectedBibleIds.size === 0) return
    try {
      const filtered = bibleEntries.filter(e => !selectedBibleIds.has(e.id))
      setBibleEntries(filtered)
      localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(filtered))

      if (user) {
        await Promise.all(
          Array.from(selectedBibleIds).map(id =>
            deleteBibleEntryFromCloud(user.uid, projectId, id)
          )
        )
      }

      if (activeBibleEntryId && selectedBibleIds.has(activeBibleEntryId)) {
        setActiveBibleEntryId(null)
        setIsBibleDrawerOpen(false)
      }

      setSelectedBibleIds(new Set())
      setIsBibleSelectionMode(false)
      setShowMultiBibleDeleteModal(false)
    } catch (e) {
      console.error("Failed to delete selected bible entries:", e)
    }
  }

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'character':
        return <User size={16} className="text-primary" />
      case 'beast':
        return <PawPrint size={16} style={{ color: 'rgb(245, 158, 11)' }} />
      case 'place':
        return <MapPin size={16} style={{ color: 'rgb(16, 185, 129)' }} />
      case 'item':
        return <Package size={16} style={{ color: 'rgb(168, 85, 247)' }} />
      case 'world':
      default:
        return <Globe size={16} className="text-accent" />
    }
  }

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

      {showGlobalSearch && (
        <div className="command-palette-overlay" onClick={() => setShowGlobalSearch(false)}>
          <div className="global-search-modal glass" onClick={e => e.stopPropagation()}>
            <div className="palette-header">
              <Search size={15} className="glow-icon" />
              <input
                type="text"
                placeholder="Search chapters, Brain Map, and lore..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowGlobalSearch(false)
                  if (e.key === 'Enter' && globalSearchResults[0]) openGlobalSearchResult(globalSearchResults[0])
                }}
                autoFocus
              />
              <span className="esc-hint">ESC</span>
            </div>
            <div className="global-search-results">
              {globalSearchQuery.trim() && globalSearchResults.length === 0 && (
                <div className="empty-palette">No matches in this manuscript</div>
              )}
              {!globalSearchQuery.trim() && (
                <div className="global-search-empty">
                  <Search size={22} />
                  <span>Search across chapters, Brain Map entries, and story bible lore.</span>
                </div>
              )}
              {globalSearchResults.map(result => (
                <button
                  key={result.id}
                  className={`global-search-result source-${result.source}`}
                  onClick={() => openGlobalSearchResult(result)}
                >
                  <span className="global-result-source">
                    {result.source === 'chapter' ? <FileText size={13} /> : result.source === 'brain' ? <BrainCircuit size={13} /> : <BookOpen size={13} />}
                    {result.source}
                  </span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <p>{result.preview || "No preview available"}</p>
                </button>
              ))}
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
          <button
            className="btn-icon"
            onClick={() => setShowGlobalSearch(true)}
            title="Search manuscript, Brain Map, and lore"
          >
            <Search size={18} />
          </button>
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
          {lastSavedAt && (
            <span className="last-saved-label">
              {new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn-icon"
            onClick={() => setShowVersionsModal(true)}
            title="Chapter version history"
            disabled={!activeNote}
          >
            <History size={18} />
          </button>
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
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'insights' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'insights' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('insights')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Manuscript Insights"
              >
                <Layers size={20} />
              </button>

              <button
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'appearance' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'appearance' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('appearance')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Appearance Lab"
              >
                <Eye size={20} />
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

              <button 
                className={`activity-btn ${isLeftSidebarOpen && activeSidebarTab === 'brain' ? 'active' : ''}`}
                onClick={() => {
                  if (activeSidebarTab === 'brain' && isLeftSidebarOpen) {
                    setIsLeftSidebarOpen(false)
                  } else {
                    setActiveSidebarTab('brain')
                    setIsLeftSidebarOpen(true)
                  }
                }}
                title="Brain Map"
              >
                <BrainCircuit size={20} />
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
          <button className="fab-btn fab-new" onClick={() => createNewNote()} title="New Chapter">
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
          <aside
            className={`editor-sidebar glass ${isLeftSidebarOpen ? 'open' : 'collapsed'}`}
            style={{ width: isLeftSidebarOpen ? leftSidebarWidth : 0 }}
          >
            
            {/* TAB 1: MANUSCRIPT CHAPTERS */}
            {activeSidebarTab === 'manuscript' && (
              <div className="sidebar-tab-content fade-in">
                <div className="sidebar-section">
                  <button className="btn-new" onClick={() => createNewNote()}>
                    <Plus size={16} />
                    New Chapter
                  </button>
                  <button className="btn-export btn-volume-add" onClick={createNewVolume}>
                    <Plus size={16} />
                    Add Volume
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
                  {manuscriptVolumeGroups.map(group => {
                    const isCollapsed = collapsedVolumeIds.has(group.id)
                    return (
                      <div
                        key={group.id}
                        className={`volume-group ${draggedChapterId ? 'drag-ready' : ''}`}
                        onDragOver={(e) => {
                          if (draggedChapterId) e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedChapterId) {
                            moveChapterToVolume(draggedChapterId, group.id)
                          }
                        }}
                      >
                        <div className="volume-header">
                          <button
                            type="button"
                            className="volume-toggle"
                            onClick={() => toggleVolumeCollapsed(group.id)}
                            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.title}`}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            type="button"
                            className="volume-title"
                            onClick={() => !group.isSystem && renameVolume(group.id)}
                            title={group.isSystem ? group.title : "Rename volume"}
                          >
                            {group.title}
                          </button>
                          <span className="volume-count">{group.chapters.length}</span>
                          <button
                            type="button"
                            className="volume-add-chapter"
                            onClick={() => createNewNote(group.id)}
                            title={`Add chapter to ${group.title}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="volume-chapters">
                            {group.chapters.map(note => {
                              const isSelected = selectedNoteIds.has(note.id);
                              const exportRecord = exportHistory[note.id]
                              const needsExport = !exportRecord || exportRecord.fingerprint !== getChapterExportFingerprint(note)
                              return (
                                <div
                                  key={note.id}
                                  draggable={!isSelectionMode}
                                  onDragStart={() => setDraggedChapterId(note.id)}
                                  onDragEnd={() => setDraggedChapterId(null)}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    setChapterMoveMenu({ noteId: note.id, x: e.clientX, y: e.clientY })
                                  }}
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
                                    <button
                                      type="button"
                                      className={`checkbox-custom ${isSelected ? 'checked' : ''}`}
                                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${note.title || 'Untitled'}`}
                                      aria-pressed={isSelected}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleNoteSelection(note.id)
                                      }}
                                    >
                                      {isSelected && <Check size={10} strokeWidth={3} />}
                                    </button>
                                  ) : (
                                    <FileText size={16} />
                                  )}
                                  <span className="chapter-title">{note.title || 'Untitled'}</span>
                                  {!needsExport && <span className="chapter-exported-badge">Exported</span>}
                                  
                                  {!isSelectionMode && (
                                    <div className="chapter-actions">
                                      <button 
                                        className={`btn-save-chapter ${savedChapters.has(note.id) && !needsExport ? 'saved' : ''}`}
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
                                        title={needsExport ? "Save chapter" : "Chapter already exported"}
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
                            {group.chapters.length === 0 && (
                              <div className="volume-empty">Drop chapters here or add a new one.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: MANUSCRIPT INSIGHTS */}
            {activeSidebarTab === 'insights' && (
              <div className="sidebar-tab-content insights-panel fade-in">
                <span className="section-title">Manuscript Insights</span>
                <div className="manuscript-insights glass-light">
                  <div className="insights-grid">
                    <div>
                      <strong>{manuscriptStats.words.toLocaleString()}</strong>
                      <span>words</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.averageChapterWords.toLocaleString()}</strong>
                      <span>avg/ch</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.brainEntries}</strong>
                      <span>brain</span>
                    </div>
                    <div>
                      <strong>{manuscriptStats.loreEntries}</strong>
                      <span>lore</span>
                    </div>
                  </div>
                  <div className="insight-callout">
                    <Star size={14} />
                    <span>{manuscriptStats.criticalBrainEntries} critical Brain Map entr{manuscriptStats.criticalBrainEntries === 1 ? 'y' : 'ies'}</span>
                  </div>
                </div>

                <div className="insights-section-header">
                  <span>Chapter Timeline</span>
                  <button
                    className="btn-text-action"
                    onClick={() => setShowTimelinePanel(prev => !prev)}
                  >
                    {showTimelinePanel ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showTimelinePanel && (
                  <div className="chapter-timeline insights-timeline">
                    {sortedTimelineNotes.map(note => {
                      const chapterBrainEntries = brainEntries.filter(entry => entry.chapterId === note.id)
                      const chapterWords = countWords(note.content || "")
                      return (
                        <button
                          key={note.id}
                          className={`timeline-item ${note.id === activeNoteId ? 'active' : ''}`}
                          onClick={() => {
                            setActiveNoteId(note.id)
                            setActiveSidebarTab('manuscript')
                          }}
                        >
                          <span className="timeline-dot"></span>
                          <div className="timeline-content">
                            <strong>{getNoteChapterNumber(note) ? `Chapter ${getNoteChapterNumber(note)}` : note.title}</strong>
                            <small>{note.title || 'Untitled'} - {chapterWords.toLocaleString()} words</small>
                            <em>{chapterBrainEntries.length} Brain Map entr{chapterBrainEntries.length === 1 ? 'y' : 'ies'}</em>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: APPEARANCE PROMPT LAB */}
            {activeSidebarTab === 'appearance' && (
              <div className="sidebar-tab-content appearance-panel fade-in">
                <div className="appearance-header">
                  <span className="section-title">Appearance Lab</span>
                  {activeNote && (
                    <span className="appearance-chapter-chip">
                      {getNoteChapterNumber(activeNote) ? `Chapter ${getNoteChapterNumber(activeNote)}` : "Current chapter"}
                    </span>
                  )}
                </div>

                <div className="appearance-card glass-light">
                  <div className="ai-form-field">
                    <label>Name</label>
                    <input
                      type="text"
                      className="input"
                      value={appearanceName}
                      onChange={(e) => setAppearanceName(e.target.value)}
                      placeholder="e.g. Veyrath, Moonfang Elder"
                      disabled={appearanceLoading}
                    />
                  </div>

                  <div className="ai-form-field">
                    <label>Visual Style</label>
                    <select
                      className="ai-select"
                      value={appearanceStyle}
                      onChange={(e) => setAppearanceStyle(e.target.value)}
                      disabled={appearanceLoading}
                    >
                      <option value="cinematic fantasy character concept art">Cinematic fantasy concept art</option>
                      <option value="anime key visual, high detail">Anime key visual</option>
                      <option value="dark xianxia character design sheet">Dark xianxia design sheet</option>
                      <option value="realistic film character design">Realistic film character design</option>
                      <option value="game-ready creature concept art">Game-ready creature concept art</option>
                    </select>
                  </div>

                  {aiSelectionText.trim() && (
                    <button
                      className="appearance-selection-btn"
                      onClick={() => {
                        const selected = aiSelectionText.trim()
                        if (!appearanceBeastForm.trim()) {
                          setAppearanceBeastForm(selected)
                        } else if (!appearanceDemiForm.trim()) {
                          setAppearanceDemiForm(selected)
                        } else {
                          setAppearanceHumanForm(selected)
                        }
                      }}
                      disabled={appearanceLoading}
                    >
                      <Sparkles size={13} />
                      Use highlighted description
                    </button>
                  )}

                  {([
                    {
                      key: "beastForm" as AppearanceFormKey,
                      label: "Beast Form",
                      value: appearanceBeastForm,
                      setter: setAppearanceBeastForm,
                      placeholder: "Describe the full beast shape, body structure, fur/scales, eyes, aura, size, scars, horns, wings, markings..."
                    },
                    {
                      key: "demiHumanForm" as AppearanceFormKey,
                      label: "Demi-human Form",
                      value: appearanceDemiForm,
                      setter: setAppearanceDemiForm,
                      placeholder: "Describe the hybrid form, retained beast traits, posture, clothing, weapons, expression, cultivation aura..."
                    },
                    {
                      key: "humanForm" as AppearanceFormKey,
                      label: "Human Form",
                      value: appearanceHumanForm,
                      setter: setAppearanceHumanForm,
                      placeholder: "Describe the human disguise or true human form, hair, eyes, build, clothing, subtle beast tells..."
                    }
                  ]).map(form => (
                    <div className="ai-form-field" key={form.key}>
                      <label>{form.label}</label>
                      <textarea
                        className="ai-textarea appearance-textarea"
                        value={form.value}
                        onChange={(e) => form.setter(e.target.value)}
                        placeholder={form.placeholder}
                        disabled={appearanceLoading}
                      />
                    </div>
                  ))}

                  {appearanceError && (
                    <div className="ai-error-box">
                      <AlertCircle size={16} />
                      <span>{appearanceError}</span>
                    </div>
                  )}

                  <button
                    className="btn-ai-action"
                    onClick={handleGenerateAppearancePrompts}
                    disabled={appearanceLoading || !hasAppearanceDescription}
                  >
                    {appearanceLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Generate Prompts
                      </>
                    )}
                  </button>
                </div>

                {appearanceResult && (
                  <div className="appearance-results">
                    {appearanceResult.overview && (
                      <div className="appearance-overview">
                        <span>Visual Core</span>
                        <p>{appearanceResult.overview}</p>
                      </div>
                    )}

                    {(Object.keys(appearanceFormLabels) as AppearanceFormKey[]).map(formKey => {
                      const promptText = appearanceResult.prompts?.[formKey]
                      if (!promptText) return null
                      return (
                        <div className="appearance-prompt-card" key={formKey}>
                          <div className="appearance-prompt-header">
                            <strong>{appearanceFormLabels[formKey]}</strong>
                            <button
                              className="btn-ai-sub btn-ai-secondary"
                              onClick={() => copyAppearanceText(formKey, promptText)}
                            >
                              <Copy size={12} />
                              {appearanceCopiedKey === formKey ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p>{promptText}</p>
                        </div>
                      )
                    })}

                    {appearanceResult.negativePrompt && (
                      <div className="appearance-prompt-card muted">
                        <div className="appearance-prompt-header">
                          <strong>Negative Prompt</strong>
                          <button
                            className="btn-ai-sub btn-ai-secondary"
                            onClick={() => copyAppearanceText("negative", appearanceResult.negativePrompt || "")}
                          >
                            <Copy size={12} />
                            {appearanceCopiedKey === "negative" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p>{appearanceResult.negativePrompt}</p>
                      </div>
                    )}

                    {Array.isArray(appearanceResult.consistencyNotes) && appearanceResult.consistencyNotes.length > 0 && (
                      <div className="appearance-notes">
                        <span>Keep Consistent</span>
                        {appearanceResult.consistencyNotes.map(note => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                    )}

                    <div className="appearance-actions">
                      <button
                        className="btn-ai-sub btn-ai-primary"
                        onClick={saveAppearanceToLore}
                      >
                        <Save size={12} />
                        Save to Lore
                      </button>
                      <button
                        className="btn-ai-sub btn-ai-secondary"
                        onClick={() => copyAppearanceText("all", buildAppearanceLoreContent(appearanceResult))}
                      >
                        <Copy size={12} />
                        {appearanceCopiedKey === "all" ? "Copied" : "Copy All"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CHARACTER & WORLD BIBLE */}
            {activeSidebarTab === 'bible' && (
              <div className="sidebar-tab-content fade-in flex flex-col h-full">
                <div className="sidebar-section bible-header-actions">
                  <button className="btn-new" onClick={createNewBibleEntry} style={{ flex: 1 }}>
                    <Plus size={14} />
                    New Lore
                  </button>
                  <button className="btn-export" onClick={() => setShowAILoreModal(true)} style={{ flex: 1, marginTop: 0, padding: '0.75rem' }}>
                    <Sparkles size={14} className="text-accent" style={{ marginRight: '4px' }} />
                    AI Generate
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

                <div className={`sidebar-chapters-header ${isBibleSelectionMode ? 'selection-active' : ''}`}>
                  {isBibleSelectionMode ? (
                    <>
                      <span className="selection-count">{selectedBibleIds.size} selected</span>
                      <div className="selection-actions">
                        <button className="btn-text-action" onClick={toggleBibleSelectAll}>
                          {selectedBibleIds.size === filteredBibleEntries.length ? 'None' : 'All'}
                        </button>
                        <button 
                          className="btn-text-action danger" 
                          disabled={selectedBibleIds.size === 0}
                          onClick={() => setShowMultiBibleDeleteModal(true)}
                        >
                          Delete
                        </button>
                        <button className="btn-text-action" onClick={toggleBibleSelectionMode}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Story Bible</span>
                      <button className="btn-select-mode" onClick={toggleBibleSelectionMode}>
                        Select
                      </button>
                    </>
                  )}
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
                    People
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'beast' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('beast')}
                  >
                    Beasts
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'place' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('place')}
                  >
                    Places
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'world' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('world')}
                  >
                    World
                  </button>
                  <button 
                    className={`filter-chip ${bibleCategoryFilter === 'item' ? 'active' : ''}`}
                    onClick={() => setBibleCategoryFilter('item')}
                  >
                    Items
                  </button>
                </div>

                <div className="chapter-list bible-list">
                  {filteredBibleEntries.map(entry => {
                    const isSelected = selectedBibleIds.has(entry.id);
                    return (
                      <div 
                        key={entry.id} 
                        className={`chapter-item ${activeBibleEntryId === entry.id ? 'active' : ''} ${isBibleSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isBibleSelectionMode) {
                            toggleBibleEntrySelection(entry.id)
                          } else {
                            setActiveBibleEntryId(entry.id)
                            setIsBibleDrawerOpen(true)
                          }
                        }}
                      >
                        {isBibleSelectionMode ? (
                          <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        ) : (
                          renderCategoryIcon(entry.category)
                        )}
                        <span className="chapter-title">{entry.name || 'Untitled'}</span>
                        {!isBibleSelectionMode && (
                          <button 
                            className="btn-delete-chapter"
                            onClick={(e) => { e.stopPropagation(); deleteBibleEntry(entry.id) }}
                            title="Delete entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
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

            {/* TAB 4: BRAIN MAP */}
            {activeSidebarTab === 'brain' && (
              <div className="sidebar-tab-content brain-panel fade-in">
                <span className="section-title text-xs font-bold uppercase tracking-wider text-dim">Brain Map</span>
                {brainEntityGroups.length > 0 && (
                  <div className="brain-entity-strip">
                    {brainEntityGroups.slice(0, 6).map(group => (
                      <button
                        key={group.name}
                        className="brain-entity-chip"
                        onClick={() => setSelectedBrainEntityName(group.name)}
                        title={group.name}
                      >
                        {renderBrainTypeIcon(group.type, 11)}
                        <span>{group.name}</span>
                        <strong>{group.entries.length}</strong>
                      </button>
                    ))}
                  </div>
                )}

                <div className="brain-ask-panel glass-light">
                  <div className="brain-ask-header">
                    <MessageSquare size={13} />
                    <span>Ask Brain Map</span>
                  </div>
                  <textarea
                    value={brainAskQuestion}
                    onChange={(e) => setBrainAskQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault()
                        askBrainMap()
                      }
                    }}
                    placeholder="Where did I first mention the black door?"
                    className="brain-ask-input"
                  />
                  <button
                    className="brain-ask-button"
                    onClick={askBrainMap}
                    disabled={brainAskLoading || !brainAskQuestion.trim()}
                  >
                    {brainAskLoading ? <Loader2 size={13} className="spin" /> : <MessageSquare size={13} />}
                    Ask
                  </button>
                  {(brainAskAnswer || brainAskError) && (
                    <div className={`brain-ask-answer ${brainAskError ? 'error' : ''}`}>
                      {brainAskError ? brainAskError : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{brainAskAnswer}</ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
                <p className="ai-instructions">Highlight text and click Brain to save with AI context.</p>
                
                <div className="search-bar" style={{ marginBottom: '0.75rem' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search brain entries..."
                    value={brainSearchQuery}
                    onChange={(e) => setBrainSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <select
                  value={brainTypeFilter}
                  onChange={(e) => setBrainTypeFilter(e.target.value as BrainTypeFilter)}
                  className="brain-type-filter"
                >
                  {brainTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <div className="brain-entries-list">
                  {(() => {
                    const filtered = filteredBrainEntries
                    
                    if (filtered.length === 0) {
                      return <div className="empty-state-text">No brain entries yet. Highlight text and click Brain to add.</div>
                    }

                    let lastChapter = ""
                    return filtered.map((entry) => {
                      const showDivider = entry.chapterTitle !== lastChapter
                      lastChapter = entry.chapterTitle
                      return (
                        <div key={entry.id}>
                          {showDivider && (
                            <div className="brain-chapter-divider">
                              <span className="brain-chapter-label">— {entry.chapterTitle || "Untitled"} —</span>
                            </div>
                          )}
                          <div 
                            className="brain-entry-card glass-light"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedBrainEntryId(entry.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setSelectedBrainEntryId(entry.id)
                              }
                            }}
                            aria-label={`Open Brain Map entry for ${entry.highlightedText}`}
                          >
                            <div className="brain-entry-header">
                              <div className="brain-entry-card-main">
                                <div className="brain-entry-meta-row">
                                  <span className="brain-chapter-badge">{getBrainEntryChapterLabel(entry)}</span>
                                  <button
                                    className={`brain-type-badge type-${getBrainEntryType(entry)}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setBrainTypeFilter(getBrainEntryType(entry))
                                    }}
                                    title={getBrainTypeLabel(getBrainEntryType(entry))}
                                  >
                                    {renderBrainTypeIcon(getBrainEntryType(entry), 11)}
                                    {getBrainTypeLabel(getBrainEntryType(entry))}
                                  </button>
                                  <span className={`brain-importance-badge importance-${getBrainEntryImportance(entry)}`}>
                                    <Star size={10} />
                                    {getBrainEntryImportance(entry)}
                                  </span>
                                  {entry.aiSummary === "Analyzing..." && (
                                    <span className="brain-pending-badge">
                                      <Loader2 size={11} className="spin" />
                                      Analyzing
                                    </span>
                                  )}
                                </div>
                                <button
                                  className="brain-entity-name"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBrainEntityName(getBrainEntryEntityName(entry))
                                  }}
                                >
                                  {getBrainEntryEntityName(entry)}
                                </button>
                                <span className="brain-highlight-text">&ldquo;{entry.highlightedText}&rdquo;</span>
                                {(entry.connections || []).length > 0 && (
                                  <span className="brain-connection-count">
                                    <Link2 size={10} />
                                    {entry.connections?.length} link{entry.connections?.length === 1 ? '' : 's'}
                                  </span>
                                )}
                              </div>
                              <button 
                                className="btn-delete-chapter brain-card-delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteBrainEntry(entry.id)
                                }}
                                onKeyDown={(e) => e.stopPropagation()}
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="brain-entry-summary">
                              {entry.aiSummary === "Analyzing..." ? (
                                <span className="brain-loading"><Loader2 size={12} className="spin" /> Analyzing...</span>
                              ) : (
                                <p>{entry.aiSummary}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
            <div
              className="sidebar-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuemin={MIN_LEFT_SIDEBAR_WIDTH}
              aria-valuemax={MAX_LEFT_SIDEBAR_WIDTH}
              aria-valuenow={leftSidebarWidth}
              tabIndex={0}
              onPointerDown={startLeftSidebarResize}
              onKeyDown={handleSidebarResizeKeyDown}
            />
          </aside>
        )}

        {/* Central Writing Workspace */}
        <main className="editor-main">
          {activeNote ? (
            <div className="editor-workspace fade-in">
              
              {/* Markdown Formatting Toolbar: Hide in Zen Mode */}
              {viewMode === 'edit' && !isZenMode && (
                <div className="editor-controls-row">
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
                    <div className="fmt-divider"></div>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("character")} 
                      title="Select text, then click to save as a person"
                      disabled={!aiSelectionText.trim()}
                    >
                      <User size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Person</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("beast")} 
                      title="Select text, then click to save as a beast"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <PawPrint size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Beast</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("place")} 
                      title="Select text, then click to save as a place"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <MapPin size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Place</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("world")} 
                      title="Select text, then click to save as world lore"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <Globe size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>World</span>
                    </button>
                    <button 
                      className={`fmt-btn-action ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={() => handleAddSelectionToBible("item")} 
                      title="Select text, then click to save as an item"
                      style={{ marginLeft: '4px' }}
                      disabled={!aiSelectionText.trim()}
                    >
                      <Package size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Item</span>
                    </button>
                    <div className="fmt-divider"></div>
                    <button 
                      className={`fmt-btn-action fmt-btn-brain ${!aiSelectionText.trim() ? 'disabled' : ''}`}
                      onClick={handleAddToBrain} 
                      title="Select text, then click to save to Brain Map with AI analysis"
                      disabled={!aiSelectionText.trim()}
                    >
                      <BrainCircuit size={13} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Brain</span>
                    </button>
                  </div>

                  {mentionedLore.length > 0 && (
                    <div className="mentioned-lore-container glass-light">
                      <span className="mentioned-label">Mentions:</span>
                      <div className="mentioned-chips-row">
                        {mentionedLore.map(entry => (
                          <button 
                            key={entry.id} 
                            className={`mentioned-lore-chip ${entry.category}`}
                            onClick={() => handleLoreClick(entry)}
                            title={`View ${entry.name}`}
                          >
                            <span>{entry.category === 'character' ? '👤' : 
                                   entry.category === 'beast' ? '🐾' : 
                                   entry.category === 'place' ? '📍' : '🗺️'}</span>
                            <span className="chip-name">{entry.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                    
                    {/* Autocomplete suggestions dropdown */}
                    {showAutocomplete && autocompleteSuggestions.length > 0 && (
                      <div className="autocomplete-panel glass" onClick={e => e.stopPropagation()}>
                        <div className="autocomplete-header">
                          <Sparkles size={12} className="glow-icon" />
                          <span>Suggestions</span>
                          <button 
                            className="autocomplete-close-btn" 
                            onClick={(e) => { e.stopPropagation(); setShowAutocomplete(false); setAutocompleteSuggestions([]); }}
                            title="Dismiss suggestions"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="autocomplete-list">
                          {autocompleteSuggestions.slice(0, 5).map((suggestion, idx) => (
                            <div 
                              key={suggestion} 
                              className={`autocomplete-item ${idx === autocompleteIndex ? 'selected' : ''}`}
                              onClick={() => handleAutocompleteSelect(suggestion)}
                            >
                              <span className="suggestion-text">{suggestion}</span>
                              {idx === autocompleteIndex && <span className="tab-hint">Enter/Tab</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="markdown-preview" style={{ fontFamily, fontSize: `${fontSize}px` }}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p>{React.Children.map(children, child => injectLoreChips(child))}</p>,
                        li: ({ children }) => <li>{React.Children.map(children, child => injectLoreChips(child))}</li>,
                        h1: ({ children }) => <h1>{React.Children.map(children, child => injectLoreChips(child))}</h1>,
                        h2: ({ children }) => <h2>{React.Children.map(children, child => injectLoreChips(child))}</h2>,
                        h3: ({ children }) => <h3>{React.Children.map(children, child => injectLoreChips(child))}</h3>,
                        h4: ({ children }) => <h4>{React.Children.map(children, child => injectLoreChips(child))}</h4>,
                        h5: ({ children }) => <h5>{React.Children.map(children, child => injectLoreChips(child))}</h5>,
                        h6: ({ children }) => <h6>{React.Children.map(children, child => injectLoreChips(child))}</h6>,
                        blockquote: ({ children }) => <blockquote>{React.Children.map(children, child => injectLoreChips(child))}</blockquote>,
                      }}
                    >
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
                  onChange={(e) => updateActiveBibleEntry({ category: e.target.value as 'character' | 'world' | 'beast' | 'place' | 'item' })}
                  className="ai-select"
                >
                  <option value="character">👤 Person (Cast, Protagonist, NPC)</option>
                  <option value="beast">🐾 Beast (Creature, Monster, Companion)</option>
                  <option value="place">📍 Place (Location, Region, Sect, Building)</option>
                  <option value="world">🗺️ World (Magic, Lore, Concept)</option>
                  <option value="item">📦 Item (Weapon, Artifact, Object)</option>
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

        {selectedBrainEntry && (
          <div className="modal-overlay" onClick={() => setSelectedBrainEntryId(null)}>
            <div className="modal brain-detail-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header brain-detail-header">
                <div>
                  <h2 className="modal-title">Brain Map Entry</h2>
                  <p className="modal-description">
                    {getBrainEntryChapterLabel(selectedBrainEntry)} - {getBrainEntryChapterTitle(selectedBrainEntry)}
                  </p>
                </div>
                <button 
                  className="btn-close-ai" 
                  onClick={() => setSelectedBrainEntryId(null)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="brain-detail-meta">
                <span className="brain-chapter-badge">{getBrainEntryChapterLabel(selectedBrainEntry)}</span>
                <span className={`brain-type-badge type-${getBrainEntryType(selectedBrainEntry)}`}>
                  {renderBrainTypeIcon(getBrainEntryType(selectedBrainEntry), 11)}
                  {getBrainTypeLabel(getBrainEntryType(selectedBrainEntry))}
                </span>
                <span className={`brain-importance-badge importance-${getBrainEntryImportance(selectedBrainEntry)}`}>
                  <Star size={10} />
                  {getBrainEntryImportance(selectedBrainEntry)}
                </span>
                {formatBrainEntryDate(selectedBrainEntry) && (
                  <span className="brain-detail-date">{formatBrainEntryDate(selectedBrainEntry)}</span>
                )}
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">Entity</span>
                <button
                  className="brain-detail-entity-link"
                  onClick={() => {
                    setSelectedBrainEntryId(null)
                    setSelectedBrainEntityName(getBrainEntryEntityName(selectedBrainEntry))
                  }}
                >
                  {renderBrainTypeIcon(getBrainEntryType(selectedBrainEntry), 14)}
                  {getBrainEntryEntityName(selectedBrainEntry)}
                </button>
              </div>

              <div className="brain-detail-controls">
                <label>
                  <span className="brain-detail-label">Type</span>
                  <select
                    value={getBrainEntryType(selectedBrainEntry)}
                    onChange={(e) => updateBrainEntry(selectedBrainEntry.id, { entityType: e.target.value as BrainEntityType })}
                    className="brain-detail-select"
                  >
                    {brainTypeOptions.filter(option => option.value !== 'all').map(option => (
                      <option key={option.value} value={option.value}>{option.label.replace(/s$/, '')}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="brain-detail-label">Importance</span>
                  <select
                    value={getBrainEntryImportance(selectedBrainEntry)}
                    onChange={(e) => updateBrainEntry(selectedBrainEntry.id, { importance: e.target.value as BrainImportance })}
                    className="brain-detail-select"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">Keyword / Highlight</span>
                <div className="brain-detail-keyword">
                  &ldquo;{selectedBrainEntry.highlightedText}&rdquo;
                </div>
              </div>

              <div className="brain-detail-section">
                <span className="brain-detail-label">AI Analysis</span>
                <div className="brain-detail-summary">
                  {selectedBrainEntry.aiSummary === "Analyzing..." ? (
                    <span className="brain-loading">
                      <Loader2 size={14} className="spin" />
                      Analyzing...
                    </span>
                  ) : (
                    <p>{selectedBrainEntry.aiSummary}</p>
                  )}
                </div>
              </div>

              {(selectedBrainEntry.connections || []).length > 0 && (
                <div className="brain-detail-section">
                  <span className="brain-detail-label">Connections</span>
                  <div className="brain-connection-list">
                    {selectedBrainEntry.connections?.map(connection => (
                      <div key={connection} className="brain-connection-item">
                        <Link2 size={12} />
                        <span>{connection}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedBrainEntity && (
          <div className="modal-overlay" onClick={() => setSelectedBrainEntityName(null)}>
            <div className="modal brain-detail-modal brain-entity-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header brain-detail-header">
                <div>
                  <h2 className="modal-title">{selectedBrainEntity.name}</h2>
                  <p className="modal-description">
                    {getBrainTypeLabel(selectedBrainEntity.type)} dossier - {selectedBrainEntity.entries.length} entr{selectedBrainEntity.entries.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <button
                  className="btn-close-ai"
                  onClick={() => setSelectedBrainEntityName(null)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="brain-detail-meta">
                <span className={`brain-type-badge type-${selectedBrainEntity.type}`}>
                  {renderBrainTypeIcon(selectedBrainEntity.type, 11)}
                  {getBrainTypeLabel(selectedBrainEntity.type)}
                </span>
                {selectedBrainEntity.criticalCount > 0 && (
                  <span className="brain-importance-badge importance-critical">
                    <Star size={10} />
                    critical
                  </span>
                )}
              </div>

              <div className="brain-entity-entry-list">
                {selectedBrainEntity.entries
                  .slice()
                  .sort((a, b) => (getBrainEntryChapterNumber(a) || 9999) - (getBrainEntryChapterNumber(b) || 9999))
                  .map(entry => (
                    <button
                      key={entry.id}
                      className="brain-entity-entry"
                      onClick={() => {
                        setSelectedBrainEntityName(null)
                        setSelectedBrainEntryId(entry.id)
                      }}
                    >
                      <div className="brain-entity-entry-top">
                        <span className="brain-chapter-badge">{getBrainEntryChapterLabel(entry)}</span>
                        <span className={`brain-importance-badge importance-${getBrainEntryImportance(entry)}`}>
                          <Star size={10} />
                          {getBrainEntryImportance(entry)}
                        </span>
                      </div>
                      <strong>{entry.highlightedText}</strong>
                      <p>{entry.aiSummary}</p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {chapterMoveMenu && (
          <div className="chapter-move-menu-backdrop" onClick={() => setChapterMoveMenu(null)}>
            <div
              className="chapter-move-menu glass"
              style={{
                top: chapterMoveMenu.y,
                left: chapterMoveMenu.x
              }}
              onClick={e => e.stopPropagation()}
            >
              <span className="chapter-move-title">Move to volume</span>
              {sortedVolumes.map(volume => (
                <button
                  key={volume.id}
                  onClick={() => moveChapterToVolume(chapterMoveMenu.noteId, volume.id)}
                >
                  {volume.title}
                </button>
              ))}
              <button onClick={() => moveChapterToVolume(chapterMoveMenu.noteId, UNASSIGNED_VOLUME_ID)}>
                Unassigned Chapters
              </button>
            </div>
          </div>
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

        {showMultiBibleDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowMultiBibleDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Multiple Story Bible Entries</h2>
                <p className="modal-description">Are you sure you want to delete the {selectedBibleIds.size} selected entries? This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowMultiBibleDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={deleteSelectedBibleEntries}>Delete All</button>
              </div>
            </div>
          </div>
        )}

        {showVersionsModal && activeNote && (
          <div className="modal-overlay" onClick={() => setShowVersionsModal(false)}>
            <div className="modal versions-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Chapter History</h2>
                <p className="modal-description">
                  Recent autosaved versions of &ldquo;{activeNote.title || 'Untitled'}&rdquo;.
                </p>
              </div>
              <div className="version-list">
                {chapterVersions.length === 0 ? (
                  <div className="empty-state-text">No history yet. Versions appear after autosaves.</div>
                ) : chapterVersions.map(version => (
                  <div key={version.id} className="version-item">
                    <div>
                      <strong>{new Date(version.savedAt).toLocaleString()}</strong>
                      <span>{version.wordCount.toLocaleString()} words</span>
                      <p>{version.content.slice(0, 180) || "Empty chapter"}</p>
                    </div>
                    <button className="btn-ai-sub btn-ai-primary" onClick={() => restoreChapterVersion(version)}>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowVersionsModal(false)}>Close</button>
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
                    : exportFormat === 'folder'
                      ? `${getOrderedNotesList(notes).filter(note => !exportHistory[note.id] || exportHistory[note.id].fingerprint !== getChapterExportFingerprint(note)).length} of ${notes.length} chapters need folder export. Unchanged exported chapters will be skipped.`
                      : `Export ${notes.length} chapter${notes.length === 1 ? '' : 's'} in the format you need.`}
                </p>
              </div>
              {!isExporting && (
                <div className="export-format-grid">
                  {[
                    { value: 'folder', label: 'Folder', hint: 'Separate .txt files' },
                    { value: 'txt', label: 'TXT', hint: 'Plain manuscript' },
                    { value: 'md', label: 'Markdown', hint: 'Headings preserved' },
                    { value: 'html', label: 'HTML', hint: 'Styled web file' },
                    { value: 'doc', label: 'Word', hint: 'Opens in Word' },
                    { value: 'pdf', label: 'PDF', hint: 'Print/save dialog' }
                  ].map(option => (
                    <button
                      key={option.value}
                      className={`export-format ${exportFormat === option.value ? 'active' : ''}`}
                      onClick={() => setExportFormat(option.value as ExportFormat)}
                    >
                      <FileDown size={15} />
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </button>
                  ))}
                </div>
              )}
              {isExporting && (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${exportProgress}%` }}></div>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                {!isExporting && exportFormat === 'folder' && Object.keys(exportHistory).length > 0 && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => persistExportHistory({})}
                  >
                    Reset History
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setExportModal(false)} disabled={isExporting}>Cancel</button>
                <button className="btn btn-primary" onClick={exportManuscript} disabled={isExporting}>
                  {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                  {isExporting ? 'Exporting...' : 'Export Manuscript'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAILoreModal && (
          <div className="modal-overlay" onClick={() => !aiLoreLoading && setShowAILoreModal(false)}>
            <div className="modal glass" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} className="text-accent" />
                  Generate Lore with AI
                </h2>
                <p className="modal-description">
                  Enter a name and short prompt to automatically draft a detailed World Bible entry.
                </p>
              </div>
              <form onSubmit={handleGenerateAILore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="ai-form-field">
                  <label>Name / Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Aurelius, Elderwood Forest"
                    value={aiLoreName}
                    onChange={e => setAiLoreName(e.target.value)}
                    required
                    disabled={aiLoreLoading}
                  />
                </div>
                <div className="ai-form-field">
                  <label>Category</label>
                  <select
                    className="ai-select"
                    value={aiLoreCategory}
                    onChange={e => setAiLoreCategory(e.target.value as "character" | "world")}
                    disabled={aiLoreLoading}
                  >
                    <option value="character">👤 Character</option>
                    <option value="world">🗺️ World Item / Location</option>
                  </select>
                </div>
                <div className="ai-form-field">
                  <label>Context / Concept (Optional)</label>
                  <textarea
                    className="ai-textarea"
                    placeholder="e.g. A weary time-traveler seeking a lost artifact, or an ancient woods where stars fall."
                    value={aiLoreContext}
                    onChange={e => setAiLoreContext(e.target.value)}
                    disabled={aiLoreLoading}
                  />
                </div>
                {aiLoreError && (
                  <div className="ai-error-box">
                    <AlertCircle size={16} />
                    <span>{aiLoreError}</span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowAILoreModal(false)}
                    disabled={aiLoreLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={aiLoreLoading || !aiLoreName.trim()}
                  >
                    {aiLoreLoading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {hoveredLore && hoveredLorePosition && (
          <div 
            className="lore-hover-card glass"
            style={{
              position: 'absolute',
              top: hoveredLorePosition.top,
              left: hoveredLorePosition.left,
              transform: 'translate(-50%, -100%)',
              zIndex: 400,
              pointerEvents: 'none'
            }}
          >
            <div className="hover-card-header">
              <span className={`category-badge ${hoveredLore.category}`}>
                {hoveredLore.category === 'character' ? '👤 Person' : 
                 hoveredLore.category === 'beast' ? '🐾 Beast' : 
                 hoveredLore.category === 'place' ? '📍 Place' : '🗺️ World'}
              </span>
              <h4 className="hover-card-title">{hoveredLore.name}</h4>
            </div>
            <div className="hover-card-body">
              {hoveredLore.content ? (
                <p className="line-clamp-3">{hoveredLore.content.replace(/[#*`>_\-]/g, '').substring(0, 150)}...</p>
              ) : (
                <p className="no-info">No biography or notes entered yet.</p>
              )}
            </div>
            <div className="hover-card-footer">
              <span>Click to view details</span>
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

        /* World Bible Integration Styles */
        .bible-header-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 0.75rem;
        }

        .editor-controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .mentioned-lore-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          max-width: 50%;
          overflow: hidden;
        }

        .mentioned-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-dim);
          white-space: nowrap;
        }

        .mentioned-chips-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .mentioned-chips-row::-webkit-scrollbar {
          display: none;
        }

        .mentioned-lore-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          transition: var(--transition);
          white-space: nowrap;
        }

        .mentioned-lore-chip:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .mentioned-lore-chip.character {
          border-color: rgba(99, 102, 241, 0.2);
        }

        .mentioned-lore-chip.character:hover {
          background: var(--primary-light);
          color: var(--primary-hover);
          border-color: var(--primary);
        }

        .mentioned-lore-chip.world {
          border-color: rgba(167, 139, 250, 0.2);
        }

        .mentioned-lore-chip.world:hover {
          background: var(--accent-light);
          color: var(--accent);
          border-color: var(--accent);
        }

        .mentioned-lore-chip.beast {
          border-color: rgba(245, 158, 11, 0.2);
        }

        .mentioned-lore-chip.beast:hover {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(245, 158, 11);
          border-color: rgb(245, 158, 11);
        }

        .mentioned-lore-chip.place {
          border-color: rgba(16, 185, 129, 0.2);
        }

        .mentioned-lore-chip.place:hover {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(16, 185, 129);
          border-color: rgb(16, 185, 129);
        }

        .mentioned-lore-chip.item {
          border-color: rgba(168, 85, 247, 0.2);
        }

        .mentioned-lore-chip.item:hover {
          background: rgba(168, 85, 247, 0.1);
          color: rgb(168, 85, 247);
          border-color: rgb(168, 85, 247);
        }

        .chip-name {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lore-chip-preview {
          color: var(--accent);
          font-weight: 600;
          border-bottom: 1px dashed var(--accent);
          cursor: pointer;
          transition: var(--transition);
          padding: 0 2px;
        }

        .lore-chip-preview:hover {
          color: var(--accent-light);
          background: rgba(167, 139, 250, 0.15);
          border-bottom-style: solid;
        }

        .lore-hover-card {
          width: 260px;
          padding: 1rem;
          border-radius: var(--radius-md);
          background: rgba(15, 17, 23, 0.95);
          border: 1px solid var(--surface-border);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px -3px var(--primary-glow);
          color: var(--text-primary);
          animation: fadeInCard 0.2s ease-out forwards;
        }

        @keyframes fadeInCard {
          from { opacity: 0; transform: translate(-50%, -95%); }
          to { opacity: 1; transform: translate(-50%, -100%); }
        }

        .hover-card-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 0.5rem;
          border-bottom: 1px solid var(--surface-border);
          padding-bottom: 0.5rem;
        }

        .category-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .category-badge.character {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .category-badge.beast {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(245, 158, 11);
        }

        .category-badge.place {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(16, 185, 129);
        }

        .category-badge.world {
          background: var(--accent-light);
          color: var(--accent);
        }

        .hover-card-title {
          font-family: var(--font-outfit);
          font-size: 1rem;
          font-weight: 700;
        }

        .hover-card-body {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .hover-card-body .no-info {
          font-style: italic;
          color: var(--text-dim);
        }

        .hover-card-footer {
          font-size: 0.65rem;
          color: var(--text-dim);
          text-align: right;
          border-top: 1px dashed var(--surface-border);
          padding-top: 0.25rem;
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

        .last-saved-label {
          color: var(--text-dim);
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
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
          display: flex;
          flex-direction: column;
          padding: 1rem;
          border-right: 1px solid var(--surface-border);
          background: var(--surface-raised);
          flex-shrink: 0;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
          position: relative;
        }

        .editor-sidebar.collapsed {
          width: 0px;
          padding: 0px;
          border-right: none;
          opacity: 0;
          pointer-events: none;
        }

        .resizing-sidebar,
        .resizing-sidebar * {
          cursor: col-resize !important;
          user-select: none !important;
        }

        .resizing-sidebar .editor-sidebar {
          transition: none;
        }

        .sidebar-resize-handle {
          position: absolute;
          top: 0;
          right: -4px;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          z-index: 5;
          touch-action: none;
        }

        .sidebar-resize-handle::after {
          content: "";
          position: absolute;
          top: 0.75rem;
          right: 3px;
          bottom: 0.75rem;
          width: 2px;
          border-radius: var(--radius-full);
          background: transparent;
          transition: var(--transition);
        }

        .sidebar-resize-handle:hover::after,
        .sidebar-resize-handle:focus-visible::after,
        .resizing-sidebar .sidebar-resize-handle::after {
          background: var(--primary);
        }

        .sidebar-tab-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
        }

        .sidebar-section {
          margin-bottom: 0.75rem;
        }

        .manuscript-insights {
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
        }

        .insights-panel {
          gap: 0.75rem;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          margin-bottom: 0.65rem;
        }

        .insights-grid div {
          padding: 0.55rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.035);
        }

        .insights-grid strong {
          display: block;
          color: var(--text-primary);
          font-size: 0.94rem;
          line-height: 1.1;
        }

        .insights-grid span {
          display: block;
          color: var(--text-dim);
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 0.2rem;
        }

        .btn-timeline-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          width: 100%;
          height: 30px;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-timeline-toggle:hover {
          color: var(--primary);
          border-color: var(--primary);
        }

        .insight-callout {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.62rem;
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-sm);
          background: rgba(245, 158, 11, 0.08);
          color: rgb(252, 211, 77);
          font-size: 0.76rem;
          font-weight: 800;
        }

        .insights-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--text-dim);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .chapter-timeline {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          max-height: 260px;
          overflow-y: auto;
          padding-right: 0.2rem;
          margin-bottom: 0.75rem;
        }

        .insights-timeline {
          max-height: none;
          flex: 1;
          margin-bottom: 0;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          width: 100%;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          padding: 0.62rem;
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .timeline-item:hover,
        .timeline-item.active {
          border-color: rgba(99, 102, 241, 0.35);
          background: var(--primary-light);
        }

        .timeline-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--primary);
          margin-top: 0.28rem;
          flex-shrink: 0;
        }

        .timeline-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
        }

        .timeline-content strong,
        .timeline-content small,
        .timeline-content em {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .timeline-content strong {
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .timeline-content small,
        .timeline-content em {
          color: var(--text-dim);
          font-size: 0.68rem;
          font-style: normal;
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
          padding: 0.5rem 0.75rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-dim);
          margin-bottom: 0.75rem;
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
          gap: 0.55rem;
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
          padding: 0;
          background: transparent;
          border: 1.5px solid var(--text-dim);
          border-radius: 4px;
          transition: var(--transition);
          flex-shrink: 0;
          cursor: pointer;
        }

        .checkbox-custom.checked {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .checkbox-custom:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .volume-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          padding: 0.2rem;
          transition: var(--transition);
        }

        .volume-group.drag-ready {
          border-color: rgba(99, 102, 241, 0.18);
          background: rgba(99, 102, 241, 0.04);
        }

        .volume-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 34px;
          padding: 0.35rem 0.5rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--surface-border);
        }

        .volume-toggle,
        .volume-title,
        .volume-add-chapter {
          border: 0;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .volume-toggle,
        .volume-add-chapter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .volume-toggle:hover,
        .volume-add-chapter:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .volume-title {
          flex: 1;
          min-width: 0;
          padding: 0;
          color: var(--text-primary);
          font-size: 0.78rem;
          font-weight: 800;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .volume-count {
          flex-shrink: 0;
          min-width: 22px;
          padding: 0.12rem 0.38rem;
          border-radius: var(--radius-full);
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          text-align: center;
        }

        .volume-chapters {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 0.35rem;
        }

        .volume-empty {
          padding: 0.55rem 0.75rem;
          color: var(--text-dim);
          font-size: 0.75rem;
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-sm);
        }

        .chapter-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-secondary);
        }

        .chapter-item[draggable="true"] {
          cursor: grab;
        }

        .chapter-item[draggable="true"]:active {
          cursor: grabbing;
        }

        .chapter-item.selection-mode {
          border-left: 3px solid transparent;
          user-select: none;
        }

        .chapter-item.selection-mode.selected {
          background: var(--primary-light);
          border-left-color: var(--primary);
          color: var(--text-primary);
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

        .chapter-exported-badge {
          flex-shrink: 0;
          padding: 0.14rem 0.38rem;
          border-radius: var(--radius-full);
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
          border: 1px solid rgba(16, 185, 129, 0.18);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
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

        .btn-volume-add {
          margin-top: 0.5rem;
        }

        .chapter-move-menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 450;
        }

        .chapter-move-menu {
          position: fixed;
          display: flex;
          flex-direction: column;
          min-width: 190px;
          max-width: min(260px, calc(100vw - 1rem));
          padding: 0.4rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          box-shadow: 0 18px 35px rgba(0, 0, 0, 0.35);
        }

        .chapter-move-title {
          padding: 0.35rem 0.45rem 0.45rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .chapter-move-menu button {
          width: 100%;
          padding: 0.5rem 0.55rem;
          border: 0;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          text-align: left;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .chapter-move-menu button:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
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

        /* Appearance Prompt Lab */
        .appearance-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
        }

        .appearance-header,
        .appearance-prompt-header,
        .appearance-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .appearance-chapter-chip {
          flex-shrink: 0;
          padding: 0.25rem 0.45rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(99, 102, 241, 0.24);
          background: rgba(99, 102, 241, 0.1);
          color: rgb(165, 180, 252);
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .appearance-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
        }

        .appearance-textarea {
          min-height: 86px;
          max-height: 160px;
        }

        .appearance-selection-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 32px;
          border: 1px solid rgba(20, 184, 166, 0.24);
          border-radius: var(--radius-sm);
          background: rgba(20, 184, 166, 0.1);
          color: rgb(94, 234, 212);
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .appearance-selection-btn:hover:not(:disabled) {
          border-color: rgba(20, 184, 166, 0.42);
          background: rgba(20, 184, 166, 0.16);
        }

        .appearance-selection-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .appearance-results {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          padding-bottom: 1rem;
        }

        .appearance-overview,
        .appearance-prompt-card,
        .appearance-notes {
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.16);
          padding: 0.75rem;
        }

        .appearance-overview span,
        .appearance-notes span,
        .appearance-prompt-header strong {
          color: var(--text-primary);
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .appearance-overview p,
        .appearance-prompt-card p,
        .appearance-notes p {
          margin: 0.45rem 0 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.55;
          word-break: break-word;
        }

        .appearance-prompt-card {
          border-color: rgba(99, 102, 241, 0.18);
        }

        .appearance-prompt-card.muted {
          border-color: rgba(148, 163, 184, 0.18);
        }

        .appearance-prompt-header .btn-ai-sub {
          flex-shrink: 0;
          min-height: 26px;
          padding: 0.25rem 0.45rem;
        }

        /* Brain Map Styles */
        .brain-panel {
          display: flex;
          flex-direction: column;
        }

        .brain-panel .ai-instructions {
          display: none;
        }

        .brain-entity-strip {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding: 0.15rem 0 0.55rem;
          flex-shrink: 0;
        }

        .brain-entity-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          max-width: 132px;
          padding: 0.38rem 0.48rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }

        .brain-entity-chip:hover {
          border-color: rgba(168, 85, 247, 0.35);
          color: var(--text-primary);
        }

        .brain-entity-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .brain-entity-chip strong {
          font-size: 0.66rem;
          color: var(--primary);
        }

        .brain-ask-panel {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 0.65rem;
          margin-bottom: 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          flex-shrink: 0;
        }

        .brain-ask-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .brain-ask-input {
          width: 100%;
          min-height: 58px;
          max-height: 96px;
          resize: vertical;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.78rem;
          line-height: 1.45;
          padding: 0.55rem;
          outline: none;
        }

        .brain-ask-input:focus {
          border-color: rgba(168, 85, 247, 0.4);
        }

        .brain-ask-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          height: 30px;
          border: 0;
          border-radius: var(--radius-sm);
          background: var(--primary);
          color: white;
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-ask-button:hover:not(:disabled) {
          background: var(--primary-hover);
        }

        .brain-ask-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .brain-ask-answer {
          max-height: 150px;
          overflow-y: auto;
          padding: 0.55rem;
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-secondary);
          font-size: 0.75rem;
          line-height: 1.45;
        }

        .brain-ask-answer.error {
          color: var(--danger);
          background: var(--danger-light);
        }

        .brain-ask-answer p,
        .brain-ask-answer ul {
          margin: 0 0 0.45rem;
        }

        .brain-type-filter {
          width: 100%;
          margin-bottom: 0.75rem;
          padding: 0.48rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.76rem;
          outline: none;
          flex-shrink: 0;
        }

        .brain-type-filter option,
        .brain-detail-select option {
          background: rgb(15, 15, 18);
          color: rgb(226, 232, 240);
        }

        .brain-panel .search-bar {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          width: 100%;
          padding: 0.48rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          flex-shrink: 0;
        }

        .brain-panel .search-input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.78rem;
        }

        .brain-panel .search-input::placeholder {
          color: var(--text-dim);
        }

        .brain-entries-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .brain-chapter-divider {
          display: none;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0;
          margin-top: 0.25rem;
        }

        .brain-chapter-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
          opacity: 0.7;
        }

        .brain-entry-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          min-height: 74px;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          transition: var(--transition);
          cursor: pointer;
          outline: none;
        }

        .brain-entry-card:hover,
        .brain-entry-card:focus-visible {
          border-color: rgba(168, 85, 247, 0.3);
          background: rgba(168, 85, 247, 0.05);
          transform: translateY(-1px);
        }

        .brain-entry-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          width: 100%;
        }

        .brain-entry-card-main {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-entry-meta-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          min-width: 0;
          flex-wrap: wrap;
        }

        .brain-chapter-badge,
        .brain-pending-badge,
        .brain-type-badge,
        .brain-importance-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          width: fit-content;
          border-radius: var(--radius-full);
          padding: 0.22rem 0.5rem;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .brain-type-badge {
          background: rgba(20, 184, 166, 0.11);
          color: rgb(94, 234, 212);
          border: 1px solid rgba(20, 184, 166, 0.2);
          cursor: pointer;
        }

        .brain-type-badge.type-character {
          background: rgba(59, 130, 246, 0.1);
          color: rgb(147, 197, 253);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .brain-type-badge.type-place {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(110, 231, 183);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .brain-type-badge.type-object {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(252, 211, 77);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .brain-type-badge.type-foreshadowing {
          background: rgba(168, 85, 247, 0.12);
          color: rgb(216, 180, 254);
          border-color: rgba(168, 85, 247, 0.22);
        }

        .brain-importance-badge {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-dim);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .brain-importance-badge.importance-major {
          background: rgba(245, 158, 11, 0.1);
          color: rgb(252, 211, 77);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .brain-importance-badge.importance-critical {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(252, 165, 165);
          border-color: rgba(239, 68, 68, 0.22);
        }

        .brain-chapter-badge {
          background: var(--primary-light);
          color: var(--primary-hover);
          border: 1px solid rgba(99, 102, 241, 0.18);
        }

        .brain-pending-badge {
          background: var(--warning-light);
          color: var(--warning);
          border: 1px solid rgba(245, 158, 11, 0.18);
        }

        .brain-highlight-text {
          display: block;
          font-size: 0.78rem;
          font-weight: 600;
          color: rgb(192, 132, 252);
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brain-entity-name {
          display: block;
          max-width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.83rem;
          font-weight: 800;
          line-height: 1.2;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        .brain-entity-name:hover {
          color: rgb(216, 180, 254);
        }

        .brain-connection-count {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-dim);
          font-size: 0.68rem;
          font-weight: 700;
        }

        .brain-card-delete {
          flex-shrink: 0;
        }

        .brain-entry-summary {
          display: none;
          font-size: 0.73rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .brain-entry-summary p {
          margin: 0;
        }

        .brain-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.73rem;
          color: var(--text-dim);
          font-style: italic;
        }

        .brain-detail-modal {
          max-width: 560px;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .brain-detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .brain-detail-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .brain-detail-date {
          font-size: 0.75rem;
          color: var(--text-dim);
        }

        .brain-detail-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .brain-detail-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .brain-detail-controls label {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-detail-select {
          width: 100%;
          padding: 0.55rem 0.6rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border);
          background: rgba(0, 0, 0, 0.16);
          color: var(--text-primary);
          font-size: 0.8rem;
          outline: none;
        }

        .brain-detail-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-dim);
        }

        .brain-detail-keyword,
        .brain-detail-summary {
          padding: 0.875rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.6;
          word-break: break-word;
        }

        .brain-detail-keyword {
          color: rgb(216, 180, 254);
          font-weight: 600;
        }

        .brain-detail-summary {
          max-height: 280px;
          overflow-y: auto;
        }

        .brain-detail-summary p {
          margin: 0;
        }

        .brain-detail-entity-link {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          width: fit-content;
          max-width: 100%;
          padding: 0.55rem 0.7rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-detail-entity-link:hover {
          border-color: rgba(168, 85, 247, 0.35);
        }

        .brain-connection-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .brain-connection-item {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          padding: 0.62rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.12);
          color: var(--text-secondary);
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .brain-entity-modal {
          max-height: min(760px, 86vh);
        }

        .brain-entity-entry-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          max-height: 460px;
          overflow-y: auto;
        }

        .brain-entity-entry {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
          padding: 0.8rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.14);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .brain-entity-entry:hover {
          border-color: rgba(168, 85, 247, 0.32);
          background: rgba(168, 85, 247, 0.05);
        }

        .brain-entity-entry-top {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .brain-entity-entry strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .brain-entity-entry p {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
          margin-bottom: 0.75rem;
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

        .fmt-btn-action {
          display: flex;
          align-items: center;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: var(--primary-hover);
          padding: 0 10px;
          height: 28px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
        }

        .fmt-btn-action:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.25);
          border-color: var(--primary);
          color: var(--primary-hover);
          transform: translateY(-1px);
        }

        .fmt-btn-action.disabled,
        .fmt-btn-action:disabled {
          opacity: 0.35;
          cursor: default;
          transform: none;
        }

        .fmt-btn-brain {
          background: rgba(168, 85, 247, 0.15);
          border-color: rgba(168, 85, 247, 0.3);
          color: rgb(168, 85, 247);
        }
        .fmt-btn-brain:hover:not(:disabled) {
          background: rgba(168, 85, 247, 0.25);
          border-color: rgb(168, 85, 247);
          color: rgb(192, 132, 252);
        }

        /* Autocomplete suggestions panel styles */
        .autocomplete-panel {
          position: absolute;
          top: 8px;
          right: 20px;
          width: 260px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-lg), 0 0 25px -5px var(--primary-glow);
          z-index: 50;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .autocomplete-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--surface-border);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .autocomplete-close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }
        .autocomplete-close-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .autocomplete-list {
          display: flex;
          flex-direction: column;
          padding: 4px;
        }

        .autocomplete-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .autocomplete-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .autocomplete-item.selected {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .tab-hint {
          font-size: 0.65rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-dim);
        }

        @keyframes slideInDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
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

        .global-search-modal {
          width: min(680px, 92vw);
          max-height: 78vh;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          background: var(--surface-raised);
          box-shadow: var(--shadow-xl);
          overflow: hidden;
        }

        .global-search-results {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 58vh;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .global-search-empty {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          color: var(--text-dim);
          font-size: 0.85rem;
        }

        .global-search-result {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.2rem 0.75rem;
          width: 100%;
          padding: 0.85rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .global-search-result:hover {
          border-color: rgba(99, 102, 241, 0.35);
          background: var(--primary-light);
        }

        .global-result-source {
          grid-row: span 3;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          height: fit-content;
          padding: 0.24rem 0.42rem;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.06);
          color: var(--primary);
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .global-search-result strong {
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .global-search-result small {
          color: var(--text-dim);
          font-size: 0.72rem;
          text-transform: capitalize;
        }

        .global-search-result p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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

        .export-format-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
          margin: 1rem 0;
        }

        .export-format {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.2rem 0.5rem;
          align-items: center;
          padding: 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
        }

        .export-format:hover,
        .export-format.active {
          border-color: var(--primary);
          background: var(--primary-light);
        }

        .export-format strong {
          color: var(--text-primary);
          font-size: 0.84rem;
        }

        .export-format span {
          grid-column: 2;
          color: var(--text-dim);
          font-size: 0.7rem;
        }

        .versions-modal {
          max-width: 640px;
        }

        .version-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          max-height: 48vh;
          overflow-y: auto;
        }

        .version-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.035);
        }

        .version-item div {
          min-width: 0;
        }

        .version-item strong,
        .version-item span {
          display: block;
        }

        .version-item strong {
          color: var(--text-primary);
          font-size: 0.86rem;
        }

        .version-item span {
          color: var(--text-dim);
          font-size: 0.72rem;
          margin-top: 0.2rem;
        }

        .version-item p {
          margin: 0.5rem 0 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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
          align-items: flex-start;
          justify-content: center;
          overflow-y: auto;
          padding: 2rem 1rem;
          z-index: 100;
        }

        .modal {
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
          overscroll-behavior: contain;
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
          padding: 0.75rem 1.5rem 1rem 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          overflow: hidden;
          transition: max-width 0.5s ease, padding 0.5s ease;
        }

        /* Zen mode overrides */
        .zen-mode .editor-workspace {
          max-width: 800px;
          padding: 1.5rem 1rem;
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
          margin-bottom: 0.5rem;
          padding: 0;
          transition: font-size 0.5s ease;
        }

        .zen-mode .editor-title-input {
          font-size: 2rem;
          text-align: center;
          margin-bottom: 1rem;
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
          line-height: 1.55;
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
          padding: 1.5rem;
          background: rgba(0,0,0,0.15);
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          line-height: 1.55;
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
          padding: 1rem 1.5rem;
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
          .header-right {
            gap: 0.35rem;
          }
          .last-saved-label {
            display: none;
          }
          .global-search-result {
            grid-template-columns: 1fr;
          }
          .global-result-source {
            grid-row: auto;
            width: fit-content;
          }
          .export-format-grid,
          .brain-detail-controls {
            grid-template-columns: 1fr;
          }
          .version-item {
            flex-direction: column;
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
