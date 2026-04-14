"use client"

import { useAuth } from "@/components/Providers"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { 
  Plus, Search, Sparkles, 
  Eye, Edit3, Maximize2, Minimize2,
  ArrowLeft, Loader2, FileText,
  Feather, ShieldCheck, Zap,
  X, Check, AlertCircle, Trash2,
  Download, Save
} from "lucide-react"
import { LocalIntelligence, Suggestion } from '@/lib/algorithms'
import { MemoriesManager } from '@/lib/memories'
import { restoreDirectoryHandleForProject, saveDirectoryHandleForProject } from '@/lib/db'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
}

type ViewMode = 'edit' | 'preview'

function EditorContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id')

  const [projectName, setProjectName] = useState("Loading...")
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [isFocusMode, setIsFocusMode] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dirHandle, setDirHandle] = useState<any>(null)

  const saveFolderHandleToProject = useCallback(async (handle: FileSystemDirectoryHandle) => {
    if (!projectId) return
    try {
      await saveDirectoryHandleForProject(projectId, handle)
    } catch (e) {
      console.error("Failed to save folder handle:", e)
    }
  }, [projectId])

  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState(18)
  
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([])
  const [aiSummary, setAiSummary] = useState<string[]>([])
  const [localIntel, setLocalIntel] = useState<LocalIntelligence | null>(null)
  const [isLearning, setIsLearning] = useState(false)
  const [highlightedPosition, setHighlightedPosition] = useState<{ start: number; end: number } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; noteId: string; noteTitle: string }>({ show: false, noteId: '', noteTitle: '' })
  const [savedChapters, setSavedChapters] = useState<Set<string>>(new Set())
  const [exportModal, setExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [memoriesManager] = useState(() => new MemoriesManager())
  const [isMemoryChapter, setIsMemoryChapter] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedFilenamesRef = useRef<Map<string, string>>(new Map())

  const scrollToPosition = (start: number, end: number) => {
    const textarea = textareaRef.current
    if (!textarea) return

    setHighlightedPosition({ start, end })

    textarea.focus()
    textarea.setSelectionRange(start, end)

    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24
    const textBeforeCursor = textarea.value.substring(0, start)
    const lines = textBeforeCursor.split('\n').length - 1
    const scrollPosition = lines * lineHeight - textarea.clientHeight / 2

    textarea.scrollTo({
      top: Math.max(0, scrollPosition),
      behavior: 'smooth'
    })

    setTimeout(() => setHighlightedPosition(null), 2000)
  }

  const applySuggestion = (original: string, replacement: string) => {
    if (!activeNote) return
    
    if (original === replacement) {
      setAiSuggestions(prev => prev.filter(s => s.original !== original || s.replacement !== replacement))
      return
    }

    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const startBoundary = /^\w/.test(original) ? '\\b' : ''
    const endBoundary = /\w$/.test(original) ? '\\b' : ''
    
    const regex = new RegExp(`${startBoundary}${escapeRegExp(original)}${endBoundary}`, 'g')
    const newContent = activeNote.content.replace(regex, replacement)
    updateActiveNote({ content: newContent })
    setAiSuggestions(prev => prev.filter(s => s.original !== original || s.replacement !== replacement))
  }

  const learnWord = (word: string, type: 'spelling' | 'style' = 'spelling') => {
    if (localIntel) {
      localIntel.learnWord(word, type)
      setAiSuggestions(prev => prev.filter(s => s.original.toLowerCase() !== word.toLowerCase()))
    }
  }

  useEffect(() => {
    const intel = new LocalIntelligence()
    intel.init().then(success => {
      if (success) setLocalIntel(intel)
    })
  }, [])

  useEffect(() => {
    if (!projectId) return
    
    restoreDirectoryHandleForProject(projectId).then(handle => {
      if (handle) {
        setDirHandle(handle)
      }
    })
  }, [projectId])

  const activeNote = notes.find(n => n && n.id === activeNoteId)

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
      if (stored) {
        const parsed = JSON.parse(stored)
        const noteList = parsed.sort((a: Note, b: Note) => b.updatedAt - a.updatedAt)
        setNotes(noteList)
        if (noteList.length > 0 && !activeNoteId) {
          setActiveNoteId(noteList[0].id)
        }
      } else {
        setNotes([])
      }
    } catch (e) {
      console.error("Fetch notes failed:", e)
      setNotes([])
    } finally {
      setIsLoadingNotes(false)
    }
  }, [user, projectId, activeNoteId])

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
      
      setSyncStatus('saved')
    } catch {
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
    }
  }, [user, projectId, fetchProjectName, fetchNotes])

  useEffect(() => {
    if (activeNote && syncStatus !== 'saving') {
      const timer = setTimeout(() => {
        saveNote(activeNote)
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content, activeNote?.title])

  useEffect(() => {
    if (activeNote?.content && localIntel) {
      const timer = setTimeout(async () => {
        setIsLearning(true)
        await localIntel.ingest(activeNote.content)
        setIsLearning(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [activeNote?.content, localIntel])

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
          // File may not exist, ignore error
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
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      targetDir = await restoreDirectoryHandleForProject(projectId)
      if (targetDir) {
        setDirHandle(targetDir)
      }
    }
    
    if (!targetDir) {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("User cancelled directory picker", e)
        return
      }
    }
    
    await saveSingleChapterToFolder(activeNote, targetDir)
  }, [activeNote, dirHandle, saveSingleChapterToFolder, saveFolderHandleToProject, projectId])

  const exportManuscriptToFolder = async () => {
    if (notes.length === 0) return
    
    let targetDir = dirHandle
    
    if (!targetDir && projectId) {
      targetDir = await restoreDirectoryHandleForProject(projectId)
      if (targetDir) {
        setDirHandle(targetDir)
      }
    }
    
    if (!targetDir) {
      try {
        targetDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirHandle(targetDir)
        await saveFolderHandleToProject(targetDir)
      } catch (e) {
        console.error("User cancelled directory picker", e)
        return
      }
    }
    
    setIsExporting(true)
    setExportProgress(0)
    
    const sortedNotes = [...notes].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
    
    for (let i = 0; i < sortedNotes.length; i++) {
      await saveSingleChapterToFolder(sortedNotes[i], targetDir)
      setExportProgress(Math.round(((i + 1) / sortedNotes.length) * 100))
    }
    
    setIsExporting(false)
    setExportModal(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveCurrentChapterToFolder()
      }
      if (e.key === 'Escape') {
        setIsFocusMode(false)
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
      if (activeNoteId === deleteModal.noteId) {
        setActiveNoteId(filtered.length > 0 ? filtered[0].id : null)
      }
      setDeleteModal({ show: false, noteId: '', noteTitle: '' })
    } catch (e) {
      console.error("Failed to delete note:", e)
    }
  }

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNoteId) return
    const updatedNotes = notes.map((n: Note) => 
      n && n.id === activeNoteId ? { ...n, ...updates, updatedAt: Date.now() } : n
    )
    setNotes(updatedNotes)
  }

  const captureMemories = async () => {
    if (!activeNote || !projectId) return
    
    const memoryChapter = notes.find((n: Note) => n && n.title === 'Memory')
    if (!memoryChapter) {
      alert('Please create a chapter named "Memory" first')
      return
    }
    
    setIsCapturing(true)
    
    try {
      memoriesManager.addChapter(activeNote.id, activeNote.title, activeNote.content)
      const extractedContent = memoriesManager.generateMarkdown()
      
      const updatedContent = memoryChapter.content 
        ? memoryChapter.content + '\n\n---\n\n' + extractedContent
        : extractedContent
      
      const updatedNotes = notes.map((n: Note) => 
        n && n.id === memoryChapter.id 
          ? { ...n, content: updatedContent, updatedAt: Date.now() }
          : n
      )
      
      const stored = localStorage.getItem(`penpad_notes_${projectId}`)
      if (stored) {
        const noteList: Note[] = JSON.parse(stored)
        const storedIdx = noteList.findIndex((n: Note) => n && n.id === memoryChapter.id)
        if (storedIdx > -1) {
          noteList[storedIdx] = { ...noteList[storedIdx], content: updatedContent, updatedAt: Date.now() }
          localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(noteList))
        }
      }
      
      setNotes(updatedNotes)
    } catch (e) {
      console.error("Failed to capture memories:", e)
    } finally {
      setIsCapturing(false)
    }
  }

  useEffect(() => {
    if (activeNote?.title === 'Memory') {
      setIsMemoryChapter(true)
    } else {
      setIsMemoryChapter(false)
    }
  }, [activeNote?.title])

  const executeAiAction = async (action: 'analyze' | 'summary' | 'refine' | 'ingest') => {
    if (!activeNote || !localIntel) return
    
    setIsAiLoading(true)
    
    await new Promise(r => setTimeout(r, 600))
    
    try {
      if (action === 'analyze') {
        const results = localIntel.analyze(activeNote.content)
        setAiSuggestions(results)
        setAiSummary([])
      } else if (action === 'summary') {
        const results = localIntel.summarize(activeNote.content)
        setAiSummary(results)
        setAiSuggestions([])
      } else if (action === 'refine') {
        const refined = localIntel.refine(activeNote.content)
        updateActiveNote({ content: refined })
      } else if (action === 'ingest') {
        await localIntel.ingest(activeNote.content)
      }
    } catch {
      console.error("AI action failed")
    } finally {
      setIsAiLoading(false)
    }
  }

  const filteredNotes = notes.filter((n: Note) => n &&
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const wordCount = activeNote?.content ? activeNote.content.split(/\s+/).filter(Boolean).length : 0
  const wordGoal = 1200
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
    <div className={`editor-container ${isFocusMode ? 'focus-mode' : ''}`}>
      <div className="bg-gradient-radial"></div>
      
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
            className="btn-icon" 
            onClick={() => setIsFocusMode(!isFocusMode)}
            title={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          >
            {isFocusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      <div className="editor-body">
        {!isFocusMode && (
          <aside className="editor-sidebar">
            <div className="sidebar-section">
              <button className="btn-new" onClick={createNewNote}>
                <Plus size={16} />
                New Chapter
              </button>
              <button className="btn-export" onClick={() => setExportModal(true)}>
                <Download size={16} />
                Export Manuscript
              </button>
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

            <div className="chapter-list">
              {filteredNotes.map(note => (
                <div 
                  key={note.id} 
                  className={`chapter-item ${activeNoteId === note.id ? 'active' : ''}`}
                  onClick={() => setActiveNoteId(note.id)}
                >
                  <FileText size={16} />
                  <span className="chapter-title">{note.title || 'Untitled'}</span>
                  <div className="chapter-actions">
                    <button 
                      className={`btn-save-chapter ${savedChapters.has(note.id) ? 'saved' : ''}`}
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        let targetDir = dirHandle
                        
                        if (!targetDir && projectId) {
                          targetDir = await restoreDirectoryHandleForProject(projectId)
                          if (targetDir) {
                            setDirHandle(targetDir)
                          }
                        }
                        
                        if (targetDir) {
                          await saveSingleChapterToFolder(note, targetDir)
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
                </div>
              ))}
            </div>
          </aside>
        )}

        <main className="editor-main">
          {activeNote ? (
            <div className="editor-workspace fade-in">
              <div className="editor-title-row">
                <input 
                  className={`editor-title-input ${isMemoryChapter ? 'readonly' : ''}`}
                  value={activeNote.title}
                  onChange={(e) => !isMemoryChapter && updateActiveNote({ title: e.target.value })}
                  placeholder="Chapter Title..."
                  readOnly={isMemoryChapter}
                />
              </div>
              
              <div className="editor-content-area">
                {viewMode === 'edit' ? (
                  <div className="textarea-wrapper">
                    {isMemoryChapter ? (
                      <div className="memories-preview" style={{ fontFamily, fontSize: `${fontSize}px` }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {activeNote.content || "_Your captured memories will appear here._"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea 
                        ref={textareaRef}
                        className="editor-textarea"
                        value={activeNote.content}
                        onChange={(e) => updateActiveNote({ content: e.target.value })}
                        placeholder="Begin writing..."
                        spellCheck={false}
                        style={{ fontFamily, fontSize: `${fontSize}px` }}
                      />
                    )}
                    {highlightedPosition && (
                      <div 
                        className="highlight-overlay"
                        style={{
                          '--highlight-start': highlightedPosition.start,
                          '--highlight-end': highlightedPosition.end,
                        } as React.CSSProperties}
                      />
                    )}
                  </div>
                ) : (
                  <div className="markdown-preview" style={{ fontFamily, fontSize: `${fontSize}px` }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeNote.content || "_Start writing to see preview..."}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
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
                  {localIntel && !isMemoryChapter && (
                    <span className="ai-status badge badge-success">
                      <ShieldCheck size={12} />
                      AI Active
                    </span>
                  )}
                  {isLearning && !isMemoryChapter && (
                    <span className="learning-indicator">
                      <Zap size={12} className="pulse" />
                      Learning
                    </span>
                  )}
                </div>
                
                {!isMemoryChapter && (
                  <div className="status-right">
                    <button 
                      className="btn-capture" 
                      onClick={captureMemories}
                      disabled={isCapturing}
                    >
                      {isCapturing ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {isCapturing ? 'Capturing...' : 'Capture Memories'}
                    </button>
                    <button className="btn-action" onClick={() => executeAiAction('refine')}>
                      <Sparkles size={14} />
                      Refine
                    </button>
                    <button className="btn-ai-trigger" onClick={() => setShowAiPanel(true)}>
                      <Brain size={16} />
                      Intelligence Hub
                    </button>
                  </div>
                )}
              </div>
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

        {showAiPanel && (
          <aside className="ai-panel">
            <div className="ai-panel-header">
              <div className="ai-header-left">
                <Sparkles size={18} className="ai-icon" />
                <h3>Intelligence Hub</h3>
              </div>
              <div className="ai-header-right">
                {localIntel ? (
                  <span className="ai-status-badge">
                    <ShieldCheck size={12} />
                    Local AI
                  </span>
                ) : (
                  <span className="ai-status-badge loading">
                    <Loader2 size={12} className="spin" />
                    Loading
                  </span>
                )}
                <button className="btn-close" onClick={() => setShowAiPanel(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
          
            <div className="ai-panel-body">
              <div className="ai-tools">
                <button className="tool-btn" onClick={() => executeAiAction('summary')}>
                  <FileText size={18} />
                  <span>Summarize</span>
                </button>
                <button className="tool-btn" onClick={() => executeAiAction('analyze')}>
                  <Search size={18} />
                  <span>Deep Audit</span>
                </button>
                <button className="tool-btn" onClick={() => executeAiAction('ingest')}>
                  <Feather size={18} />
                  <span>Ingest Style</span>
                </button>
              </div>

              {isAiLoading && (
                <div className="ai-loading">
                  <Loader2 size={20} className="spin" />
                  <span>Analyzing text...</span>
                </div>
              )}
              
              {!isAiLoading && aiSummary.length === 0 && aiSuggestions.length === 0 && (
                <div className="ai-empty">
                  <Sparkles size={32} />
                  <p>Click &ldquo;Deep Audit&rdquo; to check your writing</p>
                  <span className="ai-hint">Checks spelling, grammar, and style</span>
                </div>
              )}

              <div className="ai-results">
                {aiSummary.length > 0 && (
                  <div className="ai-card">
                    <div className="ai-card-header">
                      <h4>Summary</h4>
                      <button className="clear-btn" onClick={() => setAiSummary([])}>Clear</button>
                    </div>
                    <ul>
                      {aiSummary.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {aiSuggestions.length > 0 && (
                  <div className="ai-card">
                    <div className="ai-card-header">
                      <h4>{aiSuggestions.length} Issues Found</h4>
                      <button className="clear-btn" onClick={() => setAiSuggestions([])}>Clear</button>
                    </div>
                    <div className="suggestions-list">
                      {aiSuggestions.map((s, i) => (
                        <div 
                          key={i} 
                          className={`suggestion-item ${s.type}`}
                          onClick={() => s.position && scrollToPosition(s.position.start, s.position.end)}
                          title={s.position ? `Click to jump to line ${s.position.line}, column ${s.position.column}` : 'Go to editor to find this'}
                        >
                          <div className="suggestion-header">
                            <span className={`type-badge ${s.type}`}>{s.type}</span>
                            {s.position && <span className="location-badge">Line {s.position.line}</span>}
                            <div className="suggestion-actions">
                              {s.original !== s.replacement && (
                                <button 
                                  className="action-apply"
                                  onClick={(e) => { e.stopPropagation(); applySuggestion(s.original, s.replacement) }}
                                >
                                  <Check size={12} />
                                  Apply
                                </button>
                              )}
                              <button
                                className="action-learn"
                                onClick={(e) => { e.stopPropagation(); learnWord(s.original, s.type as 'spelling' | 'style') }}
                              >
                                Learn
                              </button>
                            </div>
                          </div>
                          <div className="suggestion-content">
                            <span className="original">{s.original}</span>
                            {s.replacement && (
                              <>
                                <span className="arrow">→</span>
                                <span className="replacement">{s.replacement}</span>
                              </>
                            )}
                          </div>
                          <p className="explanation">{s.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
          background: rgba(10, 10, 15, 0.8);
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

        .font-selector {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: var(--radius-md);
        }

        .font-selector select {
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

        .font-selector select option {
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

        .editor-sidebar {
          width: 280px;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          border-right: 1px solid var(--surface-border);
          background: rgba(10, 10, 15, 0.5);
          flex-shrink: 0;
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
        }

        .editor-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1.5rem 2rem;
          max-width: 100%;
          width: 100%;
          overflow: hidden;
        }

        .editor-title-input {
          width: 100%;
          background: transparent;
          border: none;
          font-family: var(--font-outfit);
          font-size: 1.875rem;
          font-weight: 800;
          color: var(--text-primary);
          outline: none;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
          padding: 0;
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

        .memories-preview {
          flex: 1;
          padding: 1.5rem;
          background: var(--surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--surface-border);
          line-height: 1.8;
          color: var(--text-secondary);
          min-height: 500px;
          overflow-y: auto;
        }

        .memories-preview h1 {
          font-family: var(--font-outfit);
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .memories-preview h2 {
          font-family: var(--font-outfit);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary);
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .memories-preview ul {
          padding-left: 1.25rem;
        }

        .memories-preview li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
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
          line-height: 1.0;
          resize: none;
          outline: none;
          font-family: Georgia, serif;
          min-height: 0;
          position: relative;
          z-index: 1;
        }

        .highlight-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
        }

        .editor-textarea::placeholder {
          color: var(--text-dim);
        }

        .markdown-preview {
          flex: 1;
          padding: 3rem;
          background: var(--surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          line-height: 2;
          color: var(--text-secondary);
          min-height: 500px;
        }

        .editor-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0;
          flex-shrink: 0;
          border-top: 1px solid var(--surface-border);
          gap: 0.5rem;
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

        .ai-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .learning-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--warning);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.6rem 1rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-action:hover {
          border-color: var(--primary);
          color: var(--primary-hover);
        }

        .btn-ai-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.6rem 1.25rem;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border: none;
          border-radius: var(--radius-md);
          color: white;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-ai-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -5px var(--primary-glow);
        }

        .btn-capture {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.6rem 1.25rem;
          background: var(--accent);
          border: none;
          border-radius: var(--radius-md);
          color: white;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-capture:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -5px var(--accent);
        }

        .btn-capture:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .empty-editor-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-dim);
          gap: 1.5rem;
        }

        .empty-icon {
          opacity: 0.2;
        }

        .ai-panel {
          width: 380px;
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border-left: 1px solid var(--surface-border);
          flex-shrink: 0;
        }

        .ai-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--surface-border);
        }

        .ai-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ai-icon {
          color: var(--accent);
        }

        .ai-panel-header h3 {
          font-family: var(--font-outfit);
          font-size: 1.1rem;
          font-weight: 700;
        }

        .ai-header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .ai-status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--success);
          background: var(--success-light);
          padding: 4px 8px;
          border-radius: var(--radius-full);
        }

        .ai-status-badge.loading {
          color: var(--text-dim);
          background: var(--surface-hover);
        }

        .btn-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: var(--transition);
        }

        .btn-close:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .ai-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .ai-tools {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 1.25rem 1rem;
          background: var(--surface-hover);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
        }

        .tool-btn:hover {
          border-color: var(--primary);
          color: var(--primary-hover);
          transform: translateY(-2px);
        }

        .tool-btn span {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .ai-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 2rem;
          color: var(--accent);
          font-weight: 600;
        }

        .ai-results {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .ai-card {
          background: var(--surface-hover);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .ai-card h4 {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent);
          margin-bottom: 1rem;
        }

        .ai-card ul {
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ai-card li {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .suggestion-item {
          padding: 12px;
          background: var(--background);
          border-radius: var(--radius-md);
          border-left: 3px solid var(--primary);
        }

        .suggestion-item.spelling {
          border-left-color: var(--error);
        }

        .suggestion-item.style {
          border-left-color: var(--primary);
        }

        .suggestion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .type-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: var(--radius-xs);
        }

        .type-badge.spelling {
          background: var(--error-light);
          color: var(--error);
        }

        .type-badge.style {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .location-badge {
          font-size: 0.65rem;
          color: var(--text-dim);
          background: var(--surface-hover);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          font-weight: 500;
        }

        .suggestion-item {
          cursor: pointer;
          transition: var(--transition);
        }

        .suggestion-item:hover {
          background: var(--surface-hover);
        }

        .suggestion-actions {
          display: flex;
          gap: 6px;
        }

        .action-apply {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: var(--primary);
          border: none;
          border-radius: var(--radius-sm);
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
        }

        .action-apply:hover {
          background: var(--primary-hover);
        }

        .action-learn {
          padding: 4px 8px;
          background: var(--success-light);
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          color: var(--success);
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
        }

        .action-learn:hover {
          border-color: var(--success);
        }

        .ai-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .ai-card-header h4 {
          margin-bottom: 0;
        }

        .clear-btn {
          padding: 4px 10px;
          background: var(--surface-hover);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          color: var(--text-dim);
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }

        .clear-btn:hover {
          background: var(--error-light);
          color: var(--error);
          border-color: var(--error);
        }

        .ai-hint {
          font-size: 0.8rem;
          color: var(--text-dim);
          margin-top: 0.5rem;
        }

        .suggestion-content {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          margin-bottom: 4px;
        }

        .original {
          color: var(--text-dim);
          text-decoration: line-through;
        }

        .arrow {
          color: var(--text-dim);
        }

        .replacement {
          color: var(--text-primary);
          font-weight: 600;
        }

        .explanation {
          font-size: 0.8rem;
          color: var(--text-dim);
          margin: 0;
          line-height: 1.4;
        }

        .ai-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: var(--text-dim);
          text-align: center;
        }

        .ai-empty p {
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .focus-mode .editor-sidebar,
        .focus-mode .ai-panel {
          display: none;
        }

        .focus-mode .editor-workspace {
          max-width: 1000px;
          padding: 4rem 3rem;
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
          .editor-sidebar,
          .ai-panel {
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
        }
      `}</style>
    </div>
  )
}

function Brain(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
    </svg>
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
