"use client"

import { useAuth } from "@/components/Providers"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback, useMemo } from "react"
import { FolderPlus, Book, LogOut, Plus, Feather, Search, Clock, FileText, Trash2, Edit2, FolderOpen, BrainCircuit, Library, BarChart3, ArrowRight, Palette, Archive, ArchiveRestore, SortAsc, X, Check, TrendingUp, Target } from "lucide-react"
import { saveDirectoryHandleForProject } from '@/lib/db'
import { syncProjectsWithCloud, saveProjectToCloud, deleteProjectFromCloud, Note, BrainEntry, BibleEntry } from '@/lib/sync'

interface Milestone {
  id: string
  title: string
  reqWords: number
  description: string
  badge: string
}

const MILESTONES: Milestone[] = [
  { id: "spark", title: "Spark of Insight", reqWords: 100, description: "Jotted down the first 100 words of your manuscript.", badge: "✨" },
  { id: "awakening", title: "Awakening", reqWords: 500, description: "Amassed 500 words — the journey begins.", badge: "🌱" },
  { id: "scribe", title: "Novice Scribe", reqWords: 1000, description: "Wrote your first 1,000 words.", badge: "📜" },
  { id: "condensation", title: "Qi Condensation", reqWords: 2500, description: "2,500 words — your prose begins to take shape.", badge: "💧" },
  { id: "disciple", title: "Sect Disciple", reqWords: 5000, description: "Amassed 5,000 words of lore.", badge: "🔮" },
  { id: "foundation", title: "Foundation Establishment", reqWords: 7500, description: "7,500 words — a solid foundation for your story.", badge: "🏛️" },
  { id: "elder", title: "Grand Elder", reqWords: 10000, description: "Reached 10,000 words of manuscript.", badge: "⚡" },
  { id: "core", title: "Core Formation", reqWords: 15000, description: "15,000 words — your narrative core solidifies.", badge: "💠" },
  { id: "immortal", title: "Ascended Immortal", reqWords: 25000, description: "Achieved 25,000 words.", badge: "🌌" },
  { id: "soul", title: "Nascent Soul", reqWords: 35000, description: "35,000 words — your story develops a soul of its own.", badge: "🔷" },
  { id: "sovereign", title: "Heavenly Sovereign", reqWords: 50000, description: "Penned a grand epic of 50,000 words.", badge: "👑" },
  { id: "dao", title: "Dao Seeking", reqWords: 75000, description: "75,000 words — you pursue the Dao of storytelling.", badge: "☯️" },
  { id: "transcendent", title: "Transcendent God", reqWords: 100000, description: "100,000 words — a transcendent achievement.", badge: "🏆" },
  { id: "primordial", title: "Chaos Primordial", reqWords: 150000, description: "150,000 words — your legend enters the primordial annals.", badge: "🌀" },
  { id: "eternal", title: "Eternal Void", reqWords: 200000, description: "200,000 words — an eternal saga for the ages.", badge: "♾️" }
]

const THEMES = [
  { id: "theme-midnight", name: "Midnight", icon: "🌙" },
  { id: "theme-sepia", name: "Sepia", icon: "📜" },
  { id: "theme-forest", name: "Forest", icon: "🌲" },
  { id: "theme-obsidian", name: "Obsidian", icon: "🪨" },
  { id: "theme-nordic", name: "Nordic", icon: "❄️" },
  { id: "theme-lavender", name: "Lavender", icon: "💜" },
  { id: "theme-solarized-light", name: "Solarized", icon: "☀️" }
]

interface Project {
  id: string
  name: string
  lastUpdated?: number
  lastOpened?: number
  archived?: boolean
}

interface ProjectStats {
  chapters: number
  words: number
  brainEntries: number
  loreEntries: number
  lastChapterTitle: string
  lastEditedAt: number
  matches: string[]
}

type SortKey = "lastEdited" | "title" | "wordCount" | "created"
type ViewFilter = "all" | "active" | "archived"

const getNextMilestone = (wordCount: number): { current: Milestone | null; next: Milestone | null; percent: number } => {
  let current: Milestone | null = null
  let next: Milestone | null = null
  for (const m of MILESTONES) {
    if (wordCount >= m.reqWords) {
      current = m
    } else {
      next = m
      break
    }
  }
  if (!next) return { current, next: null, percent: 100 }
  const prevReq = current?.reqWords || 0
  const percent = ((wordCount - prevReq) / (next.reqWords - prevReq)) * 100
  return { current, next, percent: Math.min(100, Math.max(0, percent)) }
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [fetchDone, setFetchDone] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [createFolderHandle, setCreateFolderHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; projectId: string; projectName: string }>({ show: false, projectId: '', projectName: '' })
  const [editModal, setEditModal] = useState<{ show: boolean; projectId: string; name: string; folderHandle: FileSystemDirectoryHandle | null }>({ show: false, projectId: '', name: '', folderHandle: null })
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({})
  const [sortKey, setSortKey] = useState<SortKey>("lastEdited")
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active")
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [currentTheme, setCurrentTheme] = useState("theme-midnight")
  const [showArchiveModal, setShowArchiveModal] = useState<{ show: boolean; projectId: string; projectName: string }>({ show: false, projectId: '', projectName: '' })
  const [dailyWordLogs, setDailyWordLogs] = useState<Record<string, Record<string, number>>>({})

  const safeParse = <T,>(value: string | null, fallback: T): T => {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

  const getProjectStats = useCallback((project: Project): ProjectStats => {
    const notes = safeParse<Note[]>(localStorage.getItem(`penpad_notes_${project.id}`), [])
    const brain = safeParse<BrainEntry[]>(localStorage.getItem(`penpad_brain_${project.id}`), [])
    const lore = safeParse<BibleEntry[]>(localStorage.getItem(`penpad_bible_${project.id}`), [])
    const sortedNotes = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const lastEditedAt = Math.max(project.lastUpdated || 0, sortedNotes[0]?.updatedAt || 0)

    return {
      chapters: notes.length,
      words: notes.reduce((total, note) => total + countWords(note.content || ""), 0),
      brainEntries: brain.length,
      loreEntries: lore.length,
      lastChapterTitle: sortedNotes[0]?.title || "No chapters yet",
      lastEditedAt,
      matches: [
        ...notes.slice(0, 6).map(note => note.title),
        ...brain.slice(0, 6).map(entry => entry.entityName || entry.highlightedText),
        ...lore.slice(0, 6).map(entry => entry.name)
      ].filter(Boolean)
    }
  }, [])

  const getStats = useCallback((list: Project[]) => {
    const stats: Record<string, ProjectStats> = {}
    for (const project of list) {
      stats[project.id] = getProjectStats(project)
    }
    return stats
  }, [getProjectStats])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not edited yet"
    const now = Date.now()
    const diff = now - timestamp
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const loadDailyWordLogs = useCallback((projectList: Project[]) => {
    const logs: Record<string, Record<string, number>> = {}
    for (const p of projectList) {
      const stored = localStorage.getItem(`penpad_daily_word_log_${p.id}`)
      if (stored) {
        try { logs[p.id] = JSON.parse(stored) } catch { logs[p.id] = {} }
      } else {
        logs[p.id] = {}
      }
    }
    setDailyWordLogs(logs)
  }, [])

  const computeAggregateStreaks = useCallback(() => {
    const combinedLog: Record<string, number> = {}
    for (const projectId of Object.keys(dailyWordLogs)) {
      const log = dailyWordLogs[projectId]
      for (const [dateStr, count] of Object.entries(log)) {
        combinedLog[dateStr] = (combinedLog[dateStr] || 0) + count
      }
    }

    const dates = Object.keys(combinedLog)
      .filter(dateStr => combinedLog[dateStr] > 0)
      .map(dateStr => new Date(dateStr + "T00:00:00"))
      .sort((a, b) => a.getTime() - b.getTime())

    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, totalDaysWritten: 0, todayWritten: 0 }

    let longest = 0
    let current = 0
    let tempStreak = 0
    let prevDate: Date | null = null

    for (let idx = 0; idx < dates.length; idx++) {
      const d = dates[idx]
      if (prevDate === null) {
        tempStreak = 1
      } else {
        const diffTime = Math.abs(d.getTime() - prevDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 1) {
          tempStreak++
        } else {
          if (tempStreak > longest) longest = tempStreak
          tempStreak = 1
        }
      }
      prevDate = d
    }
    if (tempStreak > longest) longest = tempStreak

    const todayStr = new Date().toLocaleDateString('en-CA')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')

    const hasWrittenToday = (combinedLog[todayStr] || 0) > 0
    const hasWrittenYesterday = (combinedLog[yesterdayStr] || 0) > 0

    if (!hasWrittenToday && !hasWrittenYesterday) {
      current = 0
    } else {
      let runningStreak = 0
      const checkDate = hasWrittenToday ? new Date() : yesterday
      while (true) {
        const checkStr = checkDate.toLocaleDateString('en-CA')
        if ((combinedLog[checkStr] || 0) > 0) {
          runningStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
      current = runningStreak
    }

    return {
      currentStreak: current,
      longestStreak: longest,
      totalDaysWritten: dates.length,
      todayWritten: combinedLog[todayStr] || 0
    }
  }, [dailyWordLogs])

  const aggregateStreaks = useMemo(() => computeAggregateStreaks(), [computeAggregateStreaks])

  const dailyWritingGoal = useMemo(() => {
    if (typeof window === "undefined") return 1000
    const stored = localStorage.getItem("penpad_daily_writing_goal")
    return stored ? Number(stored) : 1000
  }, [])

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setFetchDone(true)
      return
    }
    try {
      const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
      stored.sort((a, b) => {
        const timeA = typeof a.lastUpdated === 'number' ? a.lastUpdated : 0
        const timeB = typeof b.lastUpdated === 'number' ? b.lastUpdated : 0
        return timeB - timeA
      })

      setProjectStats(getStats(stored))
      setProjects(stored)
      loadDailyWordLogs(stored)
      setFetchDone(true)

      const syncedProjects = await syncProjectsWithCloud(user.uid, stored)
      setProjectStats(getStats(syncedProjects))
      setProjects(syncedProjects)
      loadDailyWordLogs(syncedProjects)
    } catch (e) {
      console.error("Failed to fetch/sync projects:", e)
      setFetchDone(true)
    }
  }, [user, loadDailyWordLogs, getStats])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    } else if (user) {
      fetchProjects()
    }
  }, [user, loading, router, fetchProjects])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("penpad_theme")
    if (saved) {
      setCurrentTheme(saved)
      document.body.className = saved
    } else {
      document.body.className = "theme-midnight"
    }
  }, [])

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId)
    document.body.className = themeId
    localStorage.setItem("penpad_theme", themeId)
    setShowThemePicker(false)
  }

  const updateLastOpened = (projectId: string) => {
    if (!user) return
    const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
    const idx = stored.findIndex(p => p.id === projectId)
    if (idx >= 0) {
      stored[idx].lastOpened = Date.now()
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(stored))
    }
  }

  const openProject = (projectId: string) => {
    updateLastOpened(projectId)
    router.push(`/editor?id=${projectId}`)
  }

  const createProject = async () => {
    if (!user || !newProjectName.trim()) return
    try {
      const newProject: Project = {
        id: Date.now().toString(),
        name: newProjectName.trim(),
        lastUpdated: Date.now(),
        lastOpened: Date.now()
      }

      const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
      stored.unshift(newProject)
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(stored))

      saveProjectToCloud(user.uid, newProject)

      if (createFolderHandle) {
        await saveDirectoryHandleForProject(newProject.id, createFolderHandle)
      }

      setShowCreateModal(false)
      setNewProjectName("")
      setCreateFolderHandle(null)

      router.push(`/editor?id=${newProject.id}`)
    } catch (e) {
      console.error("Error creating project:", e)
    }
  }

  const deleteProject = async () => {
    if (!user || !deleteModal.projectId) return
    try {
      const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
      const filtered = stored.filter(p => p.id !== deleteModal.projectId)
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(filtered))
      localStorage.removeItem(`penpad_notes_${deleteModal.projectId}`)
      localStorage.removeItem(`penpad_brain_${deleteModal.projectId}`)
      localStorage.removeItem(`penpad_bible_${deleteModal.projectId}`)
      setProjects(filtered)
      setProjectStats(getStats(filtered))

      deleteProjectFromCloud(user.uid, deleteModal.projectId)

      setDeleteModal({ show: false, projectId: '', projectName: '' })
    } catch (e) {
      console.error("Error deleting project:", e)
    }
  }

  const editProject = async () => {
    if (!user || !editModal.projectId || !editModal.name.trim()) return
    try {
      const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
      const idx = stored.findIndex(p => p.id === editModal.projectId)
      if (idx >= 0) {
        stored[idx].name = editModal.name.trim()
        stored[idx].lastUpdated = Date.now()
        localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(stored))
        setProjects([...stored])
        setProjectStats(getStats(stored))

        saveProjectToCloud(user.uid, stored[idx])
      }

      if (editModal.folderHandle) {
        await saveDirectoryHandleForProject(editModal.projectId, editModal.folderHandle)
      }

      setEditModal({ show: false, projectId: '', name: '', folderHandle: null })
    } catch (e) {
      console.error("Error editing project:", e)
    }
  }

  const archiveProject = () => {
    if (!user || !showArchiveModal.projectId) return
    const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
    const idx = stored.findIndex(p => p.id === showArchiveModal.projectId)
    if (idx >= 0) {
      stored[idx].archived = true
      stored[idx].lastUpdated = Date.now()
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(stored))
      setProjects([...stored])
      setProjectStats(getStats(stored))
    }
    setShowArchiveModal({ show: false, projectId: '', projectName: '' })
  }

  const restoreProject = (projectId: string) => {
    if (!user) return
    const stored = safeParse<Project[]>(localStorage.getItem(`penpad_projects_${user.uid}`), [])
    const idx = stored.findIndex(p => p.id === projectId)
    if (idx >= 0) {
      stored[idx].archived = false
      stored[idx].lastUpdated = Date.now()
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(stored))
      setProjects([...stored])
      setProjectStats(getStats(stored))
    }
  }

  const sortProjects = useCallback((list: Project[]): Project[] => {
    const sorted = [...list]
    switch (sortKey) {
      case "title":
        sorted.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        break
      case "wordCount": {
        sorted.sort((a, b) => {
          const statsA = projectStats[a.id]
          const statsB = projectStats[b.id]
          return (statsB?.words || 0) - (statsA?.words || 0)
        })
        break
      }
      case "created":
        sorted.sort((a, b) => {
          const idA = parseInt(a.id)
          const idB = parseInt(b.id)
          return (idB || 0) - (idA || 0)
        })
        break
      case "lastEdited":
      default:
        sorted.sort((a, b) => {
          const timeA = projectStats[a.id]?.lastEditedAt || a.lastUpdated || 0
          const timeB = projectStats[b.id]?.lastEditedAt || b.lastUpdated || 0
          return timeB - timeA
        })
        break
    }
    return sorted
  }, [projectStats, sortKey])

  const filteredProjects = useMemo(() => {
    let list = projects

    if (viewFilter === "active") {
      list = list.filter(p => !p.archived)
    } else if (viewFilter === "archived") {
      list = list.filter(p => p.archived)
    }

    const query = searchQuery.toLowerCase().trim()

    if (query) {
      const wordCountMatch = query.match(/^(\d+)-(\d+)$/)
      if (wordCountMatch) {
        const min = parseInt(wordCountMatch[1])
        const max = parseInt(wordCountMatch[2])
        list = list.filter(p => {
          const stats = projectStats[p.id]
          if (!stats) return false
          return stats.words >= min && stats.words <= max
        })
      } else {
        list = list.filter(p => {
          const stats = projectStats[p.id]
          const nameMatch = p.name.toLowerCase().includes(query)
          const chapterMatch = stats?.lastChapterTitle.toLowerCase().includes(query)
          const tagMatch = stats?.matches.some(match => match.toLowerCase().includes(query))
          return nameMatch || chapterMatch || tagMatch
        })
      }
    }

    return sortProjects(list)
  }, [projects, viewFilter, searchQuery, projectStats, sortProjects])

  const totalStats = useMemo(() => {
    const activeProjects = projects.filter(p => !p.archived)
    return activeProjects.reduce((totals, project) => {
      const stats = projectStats[project.id]
      if (!stats) return totals
      return {
        chapters: totals.chapters + stats.chapters,
        words: totals.words + stats.words,
        brainEntries: totals.brainEntries + stats.brainEntries,
        loreEntries: totals.loreEntries + stats.loreEntries
      }
    }, { chapters: 0, words: 0, brainEntries: 0, loreEntries: 0 })
  }, [projects, projectStats])

  const visibleCounts = useMemo(() => {
    const active = projects.filter(p => !p.archived).length
    const archived = projects.filter(p => p.archived).length
    return { active, archived, total: projects.length }
  }, [projects])

  if (loading || !fetchDone) {
    return (
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
  }

  return (
    <div className="dashboard">
      <div className="bg-gradient-radial"></div>

      <aside className="sidebar glass">
        <div className="sidebar-top">
          <div className="logo">
            <div className="logo-icon">
              <Feather size={20} />
            </div>
            <span className="logo-text">PenPad</span>
          </div>
          <button className="btn-create" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            New Manuscript
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">Workspace</span>
          <button
            className={`nav-item ${viewFilter === "active" ? "active" : ""}`}
            onClick={() => setViewFilter("active")}
          >
            <Book size={18} />
            All Projects
            <span className="nav-count">{visibleCounts.active}</span>
          </button>
          <button
            className={`nav-item ${viewFilter === "all" ? "active" : ""}`}
            onClick={() => setViewFilter("all")}
          >
            <Clock size={18} />
            Recent
          </button>
          <button
            className={`nav-item ${viewFilter === "archived" ? "active" : ""}`}
            onClick={() => setViewFilter("archived")}
          >
            <Archive size={18} />
            Archived
            {visibleCounts.archived > 0 && (
              <span className="nav-count">{visibleCounts.archived}</span>
            )}
          </button>
        </nav>

        <div className="sidebar-section">
          <span className="nav-label">Appearance</span>
          <div className="theme-selector-trigger" onClick={() => setShowThemePicker(!showThemePicker)}>
            <Palette size={16} />
            <span>{THEMES.find(t => t.id === currentTheme)?.name || "Theme"}</span>
            <span className="theme-current-badge">{THEMES.find(t => t.id === currentTheme)?.icon}</span>
          </div>
          {showThemePicker && (
            <div className="theme-picker-dropdown">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-option ${currentTheme === theme.id ? "active" : ""}`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <span className="theme-icon">{theme.icon}</span>
                  <span>{theme.name}</span>
                  {currentTheme === theme.id && <Check size={14} className="theme-check" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-card glass-light">
            <div className="avatar avatar-md">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.email?.split('@')[0]}</span>
              <span className="user-plan">Premium</span>
            </div>
            <button className="btn-icon" onClick={() => signOut()} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <div className="header-left">
            <h1>{viewFilter === "archived" ? "Archived" : viewFilter === "all" ? "Recent" : "Archive"}</h1>
            <p>
              {viewFilter === "archived"
                ? `${visibleCounts.archived} archived manuscript${visibleCounts.archived === 1 ? '' : 's'}`
                : `${visibleCounts.active} manuscript${visibleCounts.active === 1 ? '' : 's'} in your creative workspace`
              }
            </p>
          </div>
          <div className="header-controls">
            <div className="sort-wrapper">
              <SortAsc size={16} className="sort-icon" />
              <select
                className="sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="lastEdited">Last Edited</option>
                <option value="title">Title A-Z</option>
                <option value="wordCount">Word Count</option>
                <option value="created">Created</option>
              </select>
            </div>
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, chapter, tag, or range (e.g. 1000-5000)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery("")}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="content-body">
          <section className="workspace-stats">
            <div className="stat-tile">
              <Book size={18} />
              <div>
                <strong>{totalStats.chapters}</strong>
                <span>Chapters</span>
              </div>
            </div>
            <div className="stat-tile">
              <BarChart3 size={18} />
              <div>
                <strong>{totalStats.words.toLocaleString()}</strong>
                <span>Words</span>
              </div>
            </div>
            <div className="stat-tile">
              <BrainCircuit size={18} />
              <div>
                <strong>{totalStats.brainEntries}</strong>
                <span>Brain Map</span>
              </div>
            </div>
            <div className="stat-tile">
              <Library size={18} />
              <div>
                <strong>{totalStats.loreEntries}</strong>
                <span>Lore</span>
              </div>
            </div>
            <div className="stat-tile stat-streak">
              <TrendingUp size={18} />
              <div>
                <strong style={{ fontSize: '1rem' }}>🔥 {aggregateStreaks.currentStreak} days</strong>
                <span>Current streak</span>
              </div>
            </div>
            <div className="stat-tile">
              <Target size={18} />
              <div>
                <strong>{aggregateStreaks.todayWritten.toLocaleString()} / {dailyWritingGoal.toLocaleString()}</strong>
                <span>Today&apos;s goal</span>
              </div>
              <div className="stat-mini-bar">
                <div
                  className="stat-mini-bar-fill"
                  style={{ width: `${Math.min(100, (aggregateStreaks.todayWritten / dailyWritingGoal) * 100)}%` }}
                />
              </div>
            </div>
          </section>

          {filteredProjects.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon">
                <FolderPlus size={36} />
              </div>
              <h2 className="empty-state-title">
                {searchQuery
                  ? "No manuscripts found"
                  : viewFilter === "archived"
                    ? "No archived manuscripts"
                    : "Your archive is empty"
                }
              </h2>
              <p className="empty-state-description">
                {searchQuery
                  ? "Try a different search term or range (e.g. 1000-5000)"
                  : viewFilter === "archived"
                    ? "Archive manuscripts to keep your workspace clean"
                    : "Every great story begins with a single word. Start your creative journey today."
                }
              </p>
              {!searchQuery && viewFilter !== "archived" && (
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={18} />
                  Create First Manuscript
                </button>
              )}
            </div>
          ) : (
            <div className="projects-grid">
              {filteredProjects.map((project, index) => {
                const stats = projectStats[project.id] || getProjectStats(project)
                const milestone = getNextMilestone(stats.words)
                return (
                  <div
                    key={project.id}
                    className={`project-card card card-interactive fade-in ${project.archived ? "archived" : ""}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="project-menu">
                      <button
                        className="btn-menu"
                        onClick={(e) => { e.stopPropagation(); setEditModal({ show: true, projectId: project.id, name: project.name, folderHandle: null }) }}
                        title="Edit manuscript"
                      >
                        <Edit2 size={16} />
                      </button>
                      {!project.archived ? (
                        <button
                          className="btn-menu"
                          onClick={(e) => { e.stopPropagation(); setShowArchiveModal({ show: true, projectId: project.id, projectName: project.name }) }}
                          title="Archive manuscript"
                        >
                          <Archive size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn-menu btn-restore"
                          onClick={(e) => { e.stopPropagation(); restoreProject(project.id) }}
                          title="Restore manuscript"
                        >
                          <ArchiveRestore size={16} />
                        </button>
                      )}
                      <button
                        className="btn-menu btn-menu-danger"
                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, projectId: project.id, projectName: project.name }) }}
                        title="Delete manuscript"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div onClick={() => openProject(project.id)}>
                      <div className="project-icon">
                        <FileText size={24} />
                      </div>
                      <div className="project-status">
                        <span className="status status-success">
                          <span className="status-dot"></span>
                          {stats.chapters} chapter{stats.chapters !== 1 ? 's' : ''}
                        </span>
                        {project.archived && (
                          <span className="status status-pending" style={{ marginLeft: '0.5rem' }}>
                            <Archive size={12} />
                            Archived
                          </span>
                        )}
                      </div>
                      <h3 className="project-title">{project.name}</h3>
                      <p className="project-last-chapter">{stats.lastChapterTitle}</p>
                      <div className="project-metrics">
                        <span><BarChart3 size={13} />{stats.words.toLocaleString()} words</span>
                        <span><BrainCircuit size={13} />{stats.brainEntries}</span>
                        <span><Library size={13} />{stats.loreEntries}</span>
                      </div>

                      {!project.archived && milestone.next && (
                        <div className="project-milestone-progress">
                          <div className="project-milestone-header">
                            <span className="project-milestone-badge">{milestone.current?.badge || "🌱"}</span>
                            <span className="project-milestone-label">
                              {milestone.next.reqWords.toLocaleString()} words
                            </span>
                          </div>
                          <div className="project-progress-bar-track">
                            <div
                              className="project-progress-bar-fill"
                              style={{ width: `${milestone.percent}%` }}
                            />
                          </div>
                          <span className="project-progress-pct">{Math.round(milestone.percent)}%</span>
                        </div>
                      )}

                      <div className="project-meta">
                        <Clock size={14} />
                        <span>
                          {project.lastOpened
                            ? `Opened ${formatDate(project.lastOpened)}`
                            : formatDate(stats.lastEditedAt)
                          }
                        </span>
                      </div>
                      <div className="project-actions">
                        <button
                          className="btn-open-project"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProject(project.id)
                          }}
                        >
                          Continue
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)} onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Manuscript</h2>
              <p className="modal-description">Give your creative space a name</p>
            </div>
            <input
              type="text"
              className="input"
              placeholder="e.g., The Silent Echo"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              autoFocus
            />
            <div className="modal-folder-row">
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
                    setCreateFolderHandle(dirHandle)
                  } catch {
                    console.error("User cancelled folder selection")
                  }
                }}
              >
                <FolderOpen size={16} />
                {createFolderHandle ? ' Folder Selected' : ' Select Folder (Optional)'}
              </button>
              {createFolderHandle && (
                <span className="modal-folder-name">{createFolderHandle.name}</span>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowCreateModal(false); setCreateFolderHandle(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={createProject}>Create</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal.show && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, projectId: '', projectName: '' })} onKeyDown={(e) => e.key === 'Escape' && setDeleteModal({ show: false, projectId: '', projectName: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Manuscript</h2>
              <p className="modal-description">Are you sure you want to delete &ldquo;{deleteModal.projectName}&rdquo;? This action cannot be undone. All chapters, brain entries, and lore will be permanently removed.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, projectId: '', projectName: '' })}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteProject}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {editModal.show && (
        <div className="modal-overlay" onClick={() => setEditModal({ show: false, projectId: '', name: '', folderHandle: null })} onKeyDown={(e) => e.key === 'Escape' && setEditModal({ show: false, projectId: '', name: '', folderHandle: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Manuscript</h2>
              <p className="modal-description">Rename your manuscript or change save location</p>
            </div>
            <input
              type="text"
              className="input"
              placeholder="Manuscript name"
              value={editModal.name}
              onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && editProject()}
              autoFocus
            />
            <div className="modal-folder-row">
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
                    setEditModal({ ...editModal, folderHandle: dirHandle })
                  } catch {
                    console.error("User cancelled folder selection")
                  }
                }}
              >
                <FolderOpen size={16} />
                {editModal.folderHandle ? ' Change Folder' : ' Select Save Folder'}
              </button>
              {editModal.folderHandle && (
                <span className="modal-folder-name">{editModal.folderHandle.name}</span>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModal({ show: false, projectId: '', name: '', folderHandle: null })}>Cancel</button>
              <button className="btn btn-primary" onClick={editProject}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal.show && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal({ show: false, projectId: '', projectName: '' })} onKeyDown={(e) => e.key === 'Escape' && setShowArchiveModal({ show: false, projectId: '', projectName: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Archive Manuscript</h2>
              <p className="modal-description">Move &ldquo;{showArchiveModal.projectName}&rdquo; to archives? It will be hidden from your active workspace but not deleted.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowArchiveModal({ show: false, projectId: '', projectName: '' })}>Cancel</button>
              <button className="btn btn-primary" onClick={archiveProject} style={{ background: 'var(--warning)', color: '#000' }}>Archive</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard {
          display: flex;
          height: 100vh;
          background: var(--background);
          color: var(--text-primary);
          position: relative;
        }

        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--surface-border);
          padding: 1.5rem;
          position: relative;
          z-index: 10;
          flex-shrink: 0;
        }

        .sidebar-top {
          margin-bottom: 2.5rem;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .logo-text {
          font-family: var(--font-outfit);
          font-weight: 700;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
        }

        .btn-create {
          width: 100%;
          padding: 0.875rem;
          border-radius: var(--radius-md);
          background: var(--primary);
          color: white;
          border: none;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: var(--transition);
          box-shadow: var(--shadow-glow);
        }

        .btn-create:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
        }

        .sidebar-nav {
          flex: 1;
        }

        .nav-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
          margin-bottom: 0.75rem;
          padding-left: 0.75rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: var(--transition);
          text-align: left;
          margin-bottom: 0.25rem;
        }

        .nav-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .nav-count {
          margin-left: auto;
          background: var(--surface-border);
          padding: 0.125rem 0.5rem;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-dim);
        }

        .nav-item.active .nav-count {
          background: var(--primary);
          color: white;
        }

        .sidebar-section {
          padding: 1rem 0;
          border-top: 1px solid var(--surface-border);
          margin-top: 0.5rem;
        }

        .theme-selector-trigger {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          border-radius: var(--radius-md);
          background: var(--surface-hover);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          margin: 0 0 0.5rem 0;
        }

        .theme-selector-trigger:hover {
          background: var(--surface);
          color: var(--text-primary);
        }

        .theme-current-badge {
          margin-left: auto;
          font-size: 1rem;
        }

        .theme-picker-dropdown {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.5rem;
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          margin: 0 0 0.5rem 0;
        }

        .theme-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: var(--transition);
          text-align: left;
        }

        .theme-option:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .theme-option.active {
          background: var(--primary-light);
          color: var(--primary-hover);
        }

        .theme-icon {
          font-size: 1rem;
        }

        .theme-check {
          margin-left: auto;
          color: var(--primary);
        }

        .sidebar-footer {
          padding-top: 1.5rem;
          border-top: 1px solid var(--surface-border);
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: var(--radius-lg);
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-plan {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .content-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2rem 3rem;
          border-bottom: 1px solid var(--surface-border);
          background: rgba(10, 10, 15, 0.5);
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .header-left h1 {
          font-family: var(--font-outfit);
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.25rem;
        }

        .header-left p {
          color: var(--text-dim);
          font-size: 0.9rem;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .sort-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .sort-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          pointer-events: none;
        }

        .sort-select {
          height: 44px;
          padding: 0 2rem 0 2.5rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-full);
          color: var(--text-primary);
          font-size: 0.85rem;
          cursor: pointer;
          outline: none;
          transition: var(--transition);
          appearance: none;
          -webkit-appearance: none;
        }

        .sort-select:hover, .sort-select:focus {
          border-color: var(--primary);
        }

        .search-wrapper {
          position: relative;
          width: 320px;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 44px;
          padding: 0 3rem 0 3rem;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-full);
          color: var(--text-primary);
          font-size: 0.9rem;
          transition: var(--transition);
          outline: none;
        }

        .search-input:focus {
          border-color: var(--primary);
          background: var(--primary-light);
        }

        .search-input::placeholder {
          color: var(--text-dim);
        }

        .search-clear {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          transition: var(--transition);
        }

        .search-clear:hover {
          color: var(--text-primary);
          background: var(--surface-hover);
        }

        .content-body {
          flex: 1;
          overflow-y: auto;
          padding: 3rem;
        }

        .workspace-stats {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .stat-tile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          background: var(--surface);
          color: var(--text-secondary);
          position: relative;
          overflow: hidden;
        }

        .stat-tile svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .stat-tile strong {
          display: block;
          color: var(--text-primary);
          font-family: var(--font-outfit);
          font-size: 1.2rem;
          line-height: 1.1;
        }

        .stat-tile span {
          display: block;
          color: var(--text-dim);
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 0.15rem;
        }

        .stat-mini-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--surface-hover);
        }

        .stat-mini-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--accent));
          border-radius: 0 3px 3px 0;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .project-card {
          padding: 1.75rem;
          border-radius: var(--radius-xl);
          cursor: pointer;
          opacity: 0;
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
        }

        .project-card:hover {
          border-color: var(--primary-hover);
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl), 0 0 30px -5px var(--primary-glow);
        }

        .project-card.archived {
          opacity: 0.6;
        }

        .project-card.archived:hover {
          opacity: 0.85;
        }

        .project-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 1.25rem;
        }

        .project-status {
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
        }

        .project-title {
          font-family: var(--font-outfit);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.35rem;
          padding-right: 3.5rem;
          overflow-wrap: anywhere;
        }

        .project-last-chapter {
          min-height: 1.2rem;
          margin-bottom: 0.9rem;
          color: var(--text-dim);
          font-size: 0.82rem;
          line-height: 1.45;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .project-metrics {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.9rem;
        }

        .project-metrics span {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.45rem;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .project-milestone-progress {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .project-milestone-header {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          flex-shrink: 0;
        }

        .project-milestone-badge {
          font-size: 0.85rem;
        }

        .project-milestone-label {
          font-size: 0.65rem;
          color: var(--text-dim);
          font-weight: 600;
          white-space: nowrap;
        }

        .project-progress-bar-track {
          flex: 1;
          height: 4px;
          background: var(--surface-hover);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .project-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--accent));
          border-radius: var(--radius-full);
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .project-progress-pct {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--text-dim);
          min-width: 2.5rem;
          text-align: right;
        }

        .project-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-dim);
          font-size: 0.8rem;
        }

        .project-actions {
          margin-top: 1rem;
        }

        .btn-open-project {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          width: 100%;
          height: 36px;
          border: 0;
          border-radius: var(--radius-md);
          background: var(--primary-light);
          color: var(--primary-hover);
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-open-project:hover {
          background: var(--primary);
          color: white;
        }

        .project-menu {
          position: absolute;
          top: 1rem;
          right: 1rem;
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: var(--transition);
        }

        .project-card:hover .project-menu {
          opacity: 1;
        }

        .btn-menu {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }

        .btn-menu:hover {
          background: var(--error-light);
          border-color: var(--error);
          color: var(--error);
        }

        .btn-menu.btn-restore:hover {
          background: var(--success-light);
          border-color: var(--success);
          color: var(--success);
        }

        .btn-menu.btn-menu-danger:hover {
          background: var(--error-light);
          border-color: var(--error);
          color: var(--error);
        }

        .btn-danger {
          background: var(--error);
          color: white;
          border: none;
        }

        .btn-danger:hover {
          background: var(--error-hover);
        }

        .modal-folder-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-folder-name {
          font-size: 12px;
          color: var(--text-dim);
        }

        @media (max-width: 1100px) {
          .workspace-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .dashboard {
            height: 100dvh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .sidebar {
            display: none;
          }
          .content-header {
            flex-direction: column;
            gap: 1.5rem;
            align-items: stretch;
            padding: 1.5rem;
          }
          .header-controls {
            flex-direction: column;
            gap: 0.75rem;
          }
          .sort-wrapper {
            width: 100%;
          }
          .sort-select {
            width: 100%;
          }
          .search-wrapper {
            width: 100%;
          }
          .content-body {
            padding: 1.5rem;
          }
          .workspace-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .project-title {
            padding-right: 0;
          }
          .project-menu {
            opacity: 1;
          }
        }

        @media (max-width: 480px) {
          .workspace-stats {
            grid-template-columns: 1fr;
          }
          .projects-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
