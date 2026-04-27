'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ResearchProject, ProjectTodo, ProjectStatus,
  PaperSubmission, SubmissionOutcome,
  Event, RecurringEvent,
} from '@/lib/types'
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/colors'

const STAGES: ProjectStatus[] = ['problem', 'ideas', 'roadmap', 'details', 'writing', 'submitted', 'revision', 'published']

const STAGE_STYLES: Record<ProjectStatus, { active: string; label: string }> = {
  problem:   { active: 'bg-slate-100 text-slate-600 border-slate-300',    label: 'Problem'   },
  ideas:     { active: 'bg-sky-100 text-sky-700 border-sky-300',          label: 'Ideas'     },
  roadmap:   { active: 'bg-violet-100 text-violet-700 border-violet-300', label: 'Roadmap'   },
  details:   { active: 'bg-amber-100 text-amber-700 border-amber-300',    label: 'Details'   },
  writing:   { active: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Writing'   },
  submitted: { active: 'bg-teal-100 text-teal-700 border-teal-300',       label: 'Submitted' },
  revision:  { active: 'bg-rose-100 text-rose-700 border-rose-300',       label: 'Revision'  },
  published: { active: 'bg-green-100 text-green-700 border-green-300',    label: 'Published' },
}

const OUTCOME_LABELS: Record<SubmissionOutcome, string> = {
  pending:  'Pending',
  revision: 'Revision',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const OUTCOME_STYLES: Record<SubmissionOutcome, string> = {
  pending:  'bg-gray-100 text-gray-600',
  revision: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ProjectClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ResearchProject | null>(null)
  const [todos, setTodos] = useState<ProjectTodo[]>([])
  const [submissions, setSubmissions] = useState<PaperSubmission[]>([])
  const [linkedEvents, setLinkedEvents] = useState<Event[]>([])
  const [linkedRecurring, setLinkedRecurring] = useState<RecurringEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const [newTodo, setNewTodo] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)

  const [addingSubmission, setAddingSubmission] = useState(false)
  const [newJournal, setNewJournal] = useState('')
  const [newSubDate, setNewSubDate] = useState(() => new Date().toISOString().slice(0, 10))

  const titleRef = useRef<HTMLInputElement>(null)

  async function fetchAll() {
    const [projRes, todoRes, subRes, evRes, recRes] = await Promise.all([
      supabase.from('research_projects').select('*').eq('id', projectId).single(),
      supabase.from('project_todos').select('*').eq('project_id', projectId).order('position').order('created_at'),
      supabase.from('paper_submissions').select('*').eq('project_id', projectId).order('submitted_date', { ascending: false }),
      supabase.from('events').select('*').eq('project_id', projectId).order('start_time'),
      supabase.from('recurring_events').select('*').eq('project_id', projectId).order('day_of_week').order('start_hour'),
    ])
    if (projRes.data) {
      const p = projRes.data as ResearchProject
      setProject(p)
      setTitleDraft(p.title)
      setNotesDraft(p.notes ?? '')
    }
    if (todoRes.data) setTodos(todoRes.data as ProjectTodo[])
    if (subRes.data) setSubmissions(subRes.data as PaperSubmission[])
    if (evRes.data) setLinkedEvents(evRes.data as Event[])
    if (recRes.data) setLinkedRecurring(recRes.data as RecurringEvent[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  async function saveTitle() {
    const title = titleDraft.trim()
    if (!title || !project) { setTitleDraft(project?.title ?? ''); setEditingTitle(false); return }
    if (title !== project.title) {
      await supabase.from('research_projects').update({ title }).eq('id', projectId)
      setProject(prev => prev ? { ...prev, title } : prev)
    }
    setEditingTitle(false)
  }

  async function saveStage(status: ProjectStatus) {
    if (!project || status === project.status) return
    await supabase.from('research_projects').update({ status }).eq('id', projectId)
    setProject(prev => prev ? { ...prev, status } : prev)
  }

  async function saveNotes() {
    if (!project) return
    setSavingNotes(true)
    await supabase.from('research_projects').update({ notes: notesDraft || null }).eq('id', projectId)
    setProject(prev => prev ? { ...prev, notes: notesDraft || null } : prev)
    setSavingNotes(false)
  }

  async function addTodo() {
    const title = newTodo.trim()
    if (!title) return
    setAddingTodo(true)
    const { data } = await supabase
      .from('project_todos')
      .insert({ project_id: projectId, title, done: false, position: todos.length })
      .select().single()
    if (data) setTodos(prev => [...prev, data as ProjectTodo])
    setNewTodo('')
    setAddingTodo(false)
  }

  async function toggleTodo(todo: ProjectTodo) {
    await supabase.from('project_todos').update({ done: !todo.done }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))
  }

  async function deleteTodo(id: string) {
    await supabase.from('project_todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function addSubmission() {
    const journal = newJournal.trim()
    if (!journal) return
    const { data } = await supabase
      .from('paper_submissions')
      .insert({ project_id: projectId, journal, submitted_date: newSubDate, outcome: 'pending' })
      .select().single()
    if (data) setSubmissions(prev => [data as PaperSubmission, ...prev])
    setNewJournal('')
    setNewSubDate(new Date().toISOString().slice(0, 10))
    setAddingSubmission(false)
  }

  async function updateOutcome(id: string, outcome: SubmissionOutcome) {
    await supabase.from('paper_submissions').update({ outcome }).eq('id', id)
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, outcome } : s))
  }

  async function deleteSubmission(id: string) {
    await supabase.from('paper_submissions').delete().eq('id', id)
    setSubmissions(prev => prev.filter(s => s.id !== id))
  }

  function recLabel(rec: RecurringEvent): string {
    const day = DAY_NAMES[rec.day_of_week]
    const start = new Date(); start.setHours(rec.start_hour, rec.start_minute, 0, 0)
    const end = new Date(start); end.setMinutes(end.getMinutes() + rec.duration_minutes)
    const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${rec.recurrence === 'biweekly' ? 'Every other' : 'Every'} ${day} · ${t(start)}–${t(end)}`
  }

  function fmtDate(ymd: string) {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
  if (!project) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Project not found.</div>

  const pendingTodos = todos.filter(t => !t.done)
  const doneTodos = todos.filter(t => t.done)

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <Link href="/projects" className="text-xs text-gray-400 hover:text-gray-700 mb-4 inline-block">
        ← Projects
      </Link>

      {/* Title */}
      <div className="mb-4">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setTitleDraft(project.title); setEditingTitle(false) }
            }}
            className="text-xl font-semibold text-gray-900 outline-none border-b-2 border-gray-900 bg-transparent w-full pb-0.5"
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            className="text-xl font-semibold text-gray-900 cursor-text hover:text-gray-600"
            title="Click to edit"
          >
            {project.title}
          </h1>
        )}
      </div>

      {/* Stage selector */}
      <div className="flex flex-wrap gap-1.5 mb-7">
        {STAGES.map(s => (
          <button
            key={s}
            onClick={() => saveStage(s)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              project.status === s
                ? STAGE_STYLES[s].active
                : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}
          >
            {STAGE_STYLES[s].label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</div>
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNotes() }}
          placeholder="Ideas, approach, what you're thinking, where things stand…"
          rows={8}
          className="w-full text-sm text-gray-700 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-gray-400 resize-none placeholder:text-gray-300 leading-relaxed"
        />
        {notesDraft !== (project.notes ?? '') && (
          <div className="flex justify-end mt-1">
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
            >
              {savingNotes ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Todos */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Todos</div>
        {todos.length > 0 && (
          <div className="space-y-1 mb-3">
            {pendingTodos.map(todo => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
            {doneTodos.length > 0 && pendingTodos.length > 0 && (
              <div className="border-t border-gray-100 my-2" />
            )}
            {doneTodos.map(todo => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
            placeholder="+ Add a todo…"
            className="flex-1 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-gray-400 placeholder:text-gray-400"
          />
          {newTodo.trim() && (
            <button
              onClick={addTodo}
              disabled={addingTodo}
              className="text-xs bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40"
            >
              {addingTodo ? '…' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* Submissions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Submissions</div>
          {!addingSubmission && (
            <button
              onClick={() => setAddingSubmission(true)}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              + Add
            </button>
          )}
        </div>

        {addingSubmission && (
          <div className="flex items-center gap-2 mb-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <input
              autoFocus
              value={newJournal}
              onChange={e => setNewJournal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addSubmission()
                if (e.key === 'Escape') { setAddingSubmission(false); setNewJournal('') }
              }}
              placeholder="Journal or venue…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
            />
            <input
              type="date"
              value={newSubDate}
              onChange={e => setNewSubDate(e.target.value)}
              className="text-xs text-gray-600 bg-transparent outline-none border-b border-gray-300 focus:border-gray-500"
            />
            <button
              onClick={addSubmission}
              disabled={!newJournal.trim()}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => { setAddingSubmission(false); setNewJournal('') }}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {submissions.length === 0 && !addingSubmission ? (
          <div className="text-sm text-gray-400">No submissions yet.</div>
        ) : (
          <div className="space-y-1">
            {submissions.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 group">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800 font-medium">{sub.journal}</span>
                  <span className="text-xs text-gray-400 ml-2">{fmtDate(sub.submitted_date)}</span>
                </div>
                <select
                  value={sub.outcome}
                  onChange={e => updateOutcome(sub.id, e.target.value as SubmissionOutcome)}
                  className={`text-xs px-2 py-0.5 rounded border-0 outline-none cursor-pointer ${OUTCOME_STYLES[sub.outcome]}`}
                >
                  {(Object.keys(OUTCOME_LABELS) as SubmissionOutcome[]).map(o => (
                    <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
                  ))}
                </select>
                <button
                  onClick={() => deleteSubmission(sub.id)}
                  className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Meetings */}
      {(linkedEvents.length > 0 || linkedRecurring.length > 0) && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Linked Meetings</div>
          <div className="space-y-1">
            {linkedRecurring.map(rec => {
              const c = TYPE_COLORS[rec.type]
              return (
                <div key={rec.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${c.border} ${c.bg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${c.text} truncate`}>{rec.title}</div>
                    <div className={`text-xs opacity-70 ${c.text}`}>{TYPE_LABELS[rec.type]} · {recLabel(rec)} · recurring</div>
                  </div>
                </div>
              )
            })}
            {linkedEvents.map(ev => {
              const c = TYPE_COLORS[ev.type]
              const dateStr = new Date(ev.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              const t = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return (
                <div key={ev.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${c.border} ${c.bg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${c.text} truncate`}>{ev.title}</div>
                    <div className={`text-xs opacity-70 ${c.text}`}>{TYPE_LABELS[ev.type]} · {dateStr} · {t(ev.start_time)}–{t(ev.end_time)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoRow({
  todo, onToggle, onDelete,
}: {
  todo: ProjectTodo
  onToggle: (t: ProjectTodo) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex items-center gap-2.5 px-1 py-1 rounded"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onToggle(todo)}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          todo.done ? 'bg-gray-900 border-gray-900' : 'border-gray-300 hover:border-gray-500'
        }`}
      >
        {todo.done && <span className="text-white text-xs leading-none">✓</span>}
      </button>
      <span className={`text-sm flex-1 ${todo.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {todo.title}
      </span>
      {hovered && (
        <button onClick={() => onDelete(todo.id)} className="text-xs text-gray-300 hover:text-red-500 ml-1">
          ×
        </button>
      )}
    </div>
  )
}
