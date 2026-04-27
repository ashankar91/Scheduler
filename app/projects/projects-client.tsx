'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ResearchProject, ProjectTodo, ProjectStatus } from '@/lib/types'

const STAGES: ProjectStatus[] = ['problem', 'ideas', 'roadmap', 'details', 'writing', 'submitted', 'revision', 'published']

const STAGE_STYLES: Record<ProjectStatus, { pill: string; dot: string; label: string }> = {
  problem:   { pill: 'bg-slate-100 text-slate-600 border-slate-300',    dot: 'bg-slate-400',  label: 'Problem'   },
  ideas:     { pill: 'bg-sky-100 text-sky-700 border-sky-300',          dot: 'bg-sky-400',    label: 'Ideas'     },
  roadmap:   { pill: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-400', label: 'Roadmap'   },
  details:   { pill: 'bg-amber-100 text-amber-700 border-amber-300',    dot: 'bg-amber-400',  label: 'Details'   },
  writing:   { pill: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-400', label: 'Writing'   },
  submitted: { pill: 'bg-teal-100 text-teal-700 border-teal-300',       dot: 'bg-teal-400',   label: 'Submitted' },
  revision:  { pill: 'bg-rose-100 text-rose-700 border-rose-300',       dot: 'bg-rose-400',   label: 'Revision'  },
  published: { pill: 'bg-green-100 text-green-700 border-green-300',    dot: 'bg-green-500',  label: 'Published' },
}

const GROUPS: { label: string; stages: ProjectStatus[] }[] = [
  { label: 'In Progress',      stages: ['problem', 'ideas', 'roadmap', 'details', 'writing'] },
  { label: 'Submitted / Out',  stages: ['submitted', 'revision'] },
  { label: 'Published',        stages: ['published'] },
]

// Primary stage = most advanced checked stage, used for grouping
function primaryStage(status: ProjectStatus[]): ProjectStatus {
  if (!status?.length) return 'problem'
  return status.reduce((max, s) =>
    STAGES.indexOf(s) > STAGES.indexOf(max) ? s : max, status[0])
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [todos, setTodos] = useState<Pick<ProjectTodo, 'project_id' | 'done'>[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    const [projRes, todoRes] = await Promise.all([
      supabase.from('research_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_todos').select('project_id, done'),
    ])
    if (projRes.data) setProjects(projRes.data as ResearchProject[])
    if (todoRes.data) setTodos(todoRes.data as Pick<ProjectTodo, 'project_id' | 'done'>[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function createProject() {
    const title = newTitle.trim()
    if (!title) return
    setSaving(true)
    const { data, error } = await supabase
      .from('research_projects')
      .insert({ title, status: ['problem'], stage_notes: {} })
      .select()
      .single()
    setSaving(false)
    if (error) {
      alert(`Could not create project: ${error.message}`)
      return
    }
    setNewTitle('')
    setCreating(false)
    if (data) router.push(`/projects/${data.id}`)
  }

  function pendingCount(projectId: string) {
    return todos.filter(t => t.project_id === projectId && !t.done).length
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Research Projects</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700"
          >
            + New
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl border border-gray-200 bg-gray-50">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createProject()
              if (e.key === 'Escape') { setCreating(false); setNewTitle('') }
            }}
            placeholder="Working title…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
          />
          <button
            onClick={createProject}
            disabled={saving || !newTitle.trim()}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? '…' : 'Create'}
          </button>
          <button
            onClick={() => { setCreating(false); setNewTitle('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-gray-400">No projects yet. Create one to get started.</div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(({ label, stages }) => {
            const group = projects.filter(p => stages.includes(primaryStage(p.status)))
            if (group.length === 0) return null
            return (
              <div key={label}>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</div>
                <div className="space-y-2">
                  {group.map(project => {
                    const pending = pendingCount(project.id)
                    const notes = project.stage_notes || {}
                    const firstNote = Object.values(notes).find(n => n?.trim())
                    return (
                      <button
                        key={project.id}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${STAGE_STYLES[primaryStage(project.status)].dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                                {project.title}
                              </span>
                              {(project.status || []).map(s => (
                                <span key={s} className={`text-xs px-2 py-0.5 rounded-full border ${STAGE_STYLES[s].pill}`}>
                                  {STAGE_STYLES[s].label}
                                </span>
                              ))}
                            </div>
                            {firstNote && (
                              <div className="text-xs text-gray-500 truncate">{firstNote}</div>
                            )}
                            {pending > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {pending} todo{pending !== 1 ? 's' : ''} pending
                              </div>
                            )}
                          </div>
                          <span className="text-gray-300 text-sm group-hover:text-gray-400 flex-shrink-0 mt-0.5">›</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
