"use client"

import { useAuth } from "@/components/Providers"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { FolderPlus, Book, LogOut, Plus, Feather, Search, Clock, FileText, Trash2, Edit2 } from "lucide-react"

interface Project {
  id: string
  name: string
  lastUpdated?: number
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [fetchDone, setFetchDone] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; projectId: string; projectName: string }>({ show: false, projectId: '', projectName: '' })
  const [editModal, setEditModal] = useState<{ show: boolean; projectId: string; name: string }>({ show: false, projectId: '', name: '' })
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({})

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setFetchDone(true)
      return
    }
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      const projectList: Project[] = stored ? JSON.parse(stored) : []
      projectList.sort((a, b) => {
        const timeA = typeof a.lastUpdated === 'number' ? a.lastUpdated : 0
        const timeB = typeof b.lastUpdated === 'number' ? b.lastUpdated : 0
        return timeB - timeA
      })
      
      const counts: Record<string, number> = {}
      for (const project of projectList) {
        const notesStored = localStorage.getItem(`penpad_notes_${project.id}`)
        if (notesStored) {
          const notes = JSON.parse(notesStored)
          counts[project.id] = notes.length
        } else {
          counts[project.id] = 0
        }
      }
      setChapterCounts(counts)
      setProjects(projectList)
    } catch (e) {
      console.error("Failed to parse projects:", e)
    } finally {
      setFetchDone(true)
    }
  }, [user])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    } else if (user) {
      fetchProjects()
    }
  }, [user, loading, router, fetchProjects])

  const createProject = async () => {
    if (!user || !newProjectName.trim()) return
    try {
      const newProject: Project = {
        id: Date.now().toString(),
        name: newProjectName.trim(),
        lastUpdated: Date.now()
      }
      
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      const projectList: Project[] = stored ? JSON.parse(stored) : []
      projectList.unshift(newProject)
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(projectList))
      
      router.push(`/editor?id=${newProject.id}`)
    } catch (e) {
      console.error("Error creating project:", e)
    }
  }

  const deleteProject = async () => {
    if (!user || !deleteModal.projectId) return
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      const projectList: Project[] = stored ? JSON.parse(stored) : []
      const filtered = projectList.filter(p => p.id !== deleteModal.projectId)
      localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(filtered))
      localStorage.removeItem(`penpad_notes_${deleteModal.projectId}`)
      setProjects(filtered)
      setDeleteModal({ show: false, projectId: '', projectName: '' })
    } catch (e) {
      console.error("Error deleting project:", e)
    }
  }

  const editProject = async () => {
    if (!user || !editModal.projectId || !editModal.name.trim()) return
    try {
      const stored = localStorage.getItem(`penpad_projects_${user.uid}`)
      const projectList: Project[] = stored ? JSON.parse(stored) : []
      const idx = projectList.findIndex(p => p.id === editModal.projectId)
      if (idx >= 0) {
        projectList[idx].name = editModal.name.trim()
        localStorage.setItem(`penpad_projects_${user.uid}`, JSON.stringify(projectList))
        setProjects([...projectList])
      }
      setEditModal({ show: false, projectId: '', name: '' })
    } catch (e) {
      console.error("Error editing project:", e)
    }
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <button className="nav-item active">
            <Book size={18} />
            All Projects
          </button>
          <button className="nav-item">
            <Clock size={18} />
            Recent
          </button>
        </nav>

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
            <h1>Archive</h1>
            <p>Your creative workspace</p>
          </div>
          <div className="search-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="search-input"
              placeholder="Search manuscripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="content-body">
          {filteredProjects.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon">
                <FolderPlus size={36} />
              </div>
              <h2 className="empty-state-title">
                {searchQuery ? "No manuscripts found" : "Your archive is empty"}
              </h2>
              <p className="empty-state-description">
                {searchQuery 
                  ? "Try a different search term"
                  : "Every great story begins with a single word. Start your creative journey today."
                }
              </p>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={18} />
                  Create First Manuscript
                </button>
              )}
            </div>
          ) : (
            <div className="projects-grid">
              {filteredProjects.map((project, index) => (
                <div 
                  key={project.id} 
                  className="project-card card card-interactive fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="project-menu">
                    <button 
                      className="btn-menu"
                      onClick={(e) => { e.stopPropagation(); setEditModal({ show: true, projectId: project.id, name: project.name }) }}
                      title="Edit manuscript"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="btn-menu"
                      onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, projectId: project.id, projectName: project.name }) }}
                      title="Delete manuscript"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div onClick={() => router.push(`/editor?id=${project.id}`)}>
                    <div className="project-icon">
                      <FileText size={24} />
                    </div>
                    <div className="project-status">
                      <span className="status status-success">
                        <span className="status-dot"></span>
                        {chapterCounts[project.id] || 0} chapter{(chapterCounts[project.id] || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <h3 className="project-title">{project.name}</h3>
                    <div className="project-meta">
                      <Clock size={14} />
                      <span>Recently edited</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
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
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createProject}>Create</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal.show && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, projectId: '', projectName: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Manuscript</h2>
              <p className="modal-description">Are you sure you want to delete &ldquo;{deleteModal.projectName}&rdquo;? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteModal({ show: false, projectId: '', projectName: '' })}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteProject}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {editModal.show && (
        <div className="modal-overlay" onClick={() => setEditModal({ show: false, projectId: '', name: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Manuscript</h2>
              <p className="modal-description">Rename your manuscript</p>
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
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModal({ show: false, projectId: '', name: '' })}>Cancel</button>
              <button className="btn btn-primary" onClick={editProject}>Save</button>
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
        }

        .search-input {
          width: 100%;
          height: 44px;
          padding: 0 1rem 0 3rem;
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

        .content-body {
          flex: 1;
          overflow-y: auto;
          padding: 3rem;
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
        }

        .project-card:hover {
          border-color: var(--primary-hover);
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl), 0 0 30px -5px var(--primary-glow);
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
        }

        .project-title {
          font-family: var(--font-outfit);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }

        .project-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-dim);
          font-size: 0.8rem;
        }

        .project-menu {
          position: absolute;
          top: 1rem;
          right: 1rem;
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

        .btn-danger {
          background: var(--error);
          color: white;
          border: none;
        }

        .btn-danger:hover {
          background: var(--error-hover);
        }

        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }
          .content-header {
            flex-direction: column;
            gap: 1.5rem;
            align-items: stretch;
            padding: 1.5rem;
          }
          .search-wrapper {
            width: 100%;
          }
          .content-body {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}
