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

// Tabs only for the 6 stages that have note content (not revision/published)
const TAB_STAGES: ProjectStatus[] = ['problem', 'ideas', 'roadmap', 'details', 'writing', 'submitted']

const STAGE_STYLES: Record<ProjectStatus, { active: string; tab: string; label: string; placeholder: string }> = {
  problem:   { active: 'bg-slate-100 text-slate-700 border-slate-400',    tab: 'border-slate-400 text-slate-700',    label: 'Problem',   placeholder: 'What problem(s) are you attacking? Why is it interesting?' },
  ideas:     { active: 'bg-sky-100 text-sky-700 border-sky-400',          tab: 'border-sky-400 text-sky-700',          label: 'Ideas',     placeholder: 'What are your ideas? What might plausibly work?' },
  roadmap:   { active: 'bg-violet-100 text-violet-700 border-violet-400', tab: 'border-violet-400 text-violet-700',   label: 'Roadmap',   placeholder: 'What is the concrete roadmap? What will yield the paper?' },
  details:   { active: 'bg-amber-100 text-amber-700 border-amber-400',    tab: 'border-amber-400 text-amber-700',     label: 'Details',   placeholder: 'Where are you on working out the details? What calculations/examples remain?' },
  writing:   { active: 'bg-orange-100 text-orange-700 border-orange-400', tab: 'border-orange-400 text-orange-700',   label: 'Writing',   placeholder: 'Where are you on the writing? What sections are done, what remains?' },
  submitted: { active: 'bg-teal-100 text-teal-700 border-teal-400',       tab: 'border-teal-400 text-teal-700',       label: 'Submitted', placeholder: 'Notes on submissions, correspondence, referee comments…' },
  revision:  { active: 'bg-rose-100 text-rose-700 border-rose-400',       tab: 'border-rose-400 text-rose-700',       label: 'Revision',  placeholder: '' },
  published: { active: 'bg-green-100 text-green-700 border-green-400',    tab: 'border-green-400 text-green-700',     label: 'Published', placeholder: '' },
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

type MeetingFilter = 'all' | 'future' | 'past'

export default function ProjectClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ResearchProject | null>(null)
  const [todos, setTodos] = useState<ProjectTodo[]>([])
  const [submissions, setSubmissions] = useState<PaperSubmission[]>([])
  const [linkedEvents, setLinkedEvents] = useState<Event[]>([])
  const [linkedRecurring, setLinkedRecurring] = useState<RecurringEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const [activeTab, setActiveTab] = useState<ProjectStatus>('problem')
  const [tabDraft, setTabDraft] = useState('')
  const [savingTab, setSavingTab] = useState(false)

  const [newTodo, setNewTodo] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)

  const [addingSubmission, setAddingSubmission] = useState(false)
  const [newJournal, setNewJournal] = useState('')
  const [newSubDate, setNewSubDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [meetingFilter, setMeetingFilter] = useState<MeetingFilter>('all')

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
      setTabDraft(p.stage_notes?.[activeTab] ?? '')
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

  async function saveTabNote(tab: ProjectStatus = activeTab, draft: string = tabDraft) {
    if (!project) return
    const newNotes = { ...(project.stage_notes || {}), [tab]: draft }
    await supabase.from('research_projects').update({ stage_notes: newNotes }).eq('id', projectId)
    setProject(prev => prev ? { ...prev, stage_notes: newNotes } : prev)
  }

  async function switchTab(newTab: ProjectStatus) {
    if (project && tabDraft !== (project.stage_notes?.[activeTab] ?? '')) {
      setSavingTab(true)
      await saveTabNote(activeTab, tabDraft)
      setSavingTab(false)
    }
    setActiveTab(newTab)
    setTabDraft(project?.stage_notes?.[newTab] ?? '')
  }

  async function handleSaveTabNote() {
    setSavingTab(true)
    await saveTabNote()
    setSavingTab(false)
  }

  async function toggleStatus(stage: ProjectStatus) {
    if (!project) return
    const current = project.status || []
    const next = current.includes(stage)
      ? current.filter(s => s !== stage)
      : [...current, stage]
    const status = next.length > 0 ? next : [stage]
    await supabase.from('research_projects').update({ status }).eq('id', projectId)
    setProject(prev => prev ? { ...prev, status } : prev)
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

  const now = new Date()
  const filteredEvents = linkedEvents.filter(ev => {
    const start = new Date(ev.start_time)
    if (meetingFilter === 'future') return start >= now
    if (meetingFilter === 'past') return start < now
    return true
  })
  const filteredRecurring = linkedRecurring.filter(rec => {
    if (meetingFilter === 'past') return !!rec.ends_on && new Date(rec.ends_on + 'T23:59:59') < now
    if (meetingFilter === 'future') return !rec.ends_on || new Date(rec.ends_on + 'T23:59:59') >= now
    return true
  })

  const hasLinkedMeetings = linkedEvents.length > 0 || linkedRecurring.length > 0
  const tabDraftChanged = tabDraft !== (project.stage_notes?.[activeTab] ?? '')

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <Link href="/projects" className="text-xs text-gray-400 hover:text-gray-700 mb-4 inline-block">
        ← Projects
      </Link>

      {/* Title */}
      <div className="mb-5">
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

      {/* Stage notes tabs */}
      <div className="mb-8 rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {TAB_STAGES.map(s => {
            const isActive = s === activeTab
            const hasContent = !!(project.stage_notes?.[s]?.trim())
            return (
              <button
                key={s}
                onClick={() => switchTab(s)}
                className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? `${STAGE_STYLES[s].tab} bg-white`
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                {STAGE_STYLES[s].label}
                {hasContent && !isActive && (
                  <span className="ml-1 w-1 h-1 rounded-full bg-gray-300 inline-block align-middle" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-4">
          <textarea
            value={tabDraft}
            onChange={e => setTabDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSaveTabNote() }}
            placeholder={STAGE_STYLES[activeTab].placeholder}
            rows={8}
            className="w-full text-sm text-gray-700 bg-white outline-none resize-none placeholder:text-gray-300 leading-relaxed"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveTabNote}
              disabled={savingTab || !tabDraftChanged}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-30"
            >
              {savingTab ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Status checkboxes */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {STAGES.map(s => {
            const checked = (project.status || []).includes(s)
            return (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStatus(s)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-800 cursor-pointer"
                />
                <span className={`text-xs ${checked ? 'text-gray-800 font-medium' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {STAGE_STYLES[s].label}
                </span>
              </label>
            )
          })}
        </div>
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
            <button onClick={() => setAddingSubmission(true)} className="text-xs text-gray-400 hover:text-gray-700">
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
      {hasLinkedMeetings && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Linked Meetings</div>
            <div className="flex items-center gap-1">
              {(['all', 'future', 'past'] as MeetingFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setMeetingFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                    meetingFilter === f
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            {filteredRecurring.map(rec => {
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
            {filteredEvents.map(ev => {
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
            {filteredEvents.length === 0 && filteredRecurring.length === 0 && (
              <div className="text-sm text-gray-400">No {meetingFilter} meetings.</div>
            )}
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
