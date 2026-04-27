'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trip, TripTalk, TripTodo, ResearchProject } from '@/lib/types'
import { TRIP_STYLES } from '@/lib/colors'

type TripTab = 'talk' | 'checklist' | 'reimbursement'

export default function TripClient({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [talk, setTalk] = useState<TripTalk | null>(null)
  const [todos, setTodos] = useState<TripTodo[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TripTab>('talk')

  const [talkTitle, setTalkTitle] = useState('')
  const [talkDate, setTalkDate] = useState('')
  const [talkTime, setTalkTime] = useState('')
  const [talkDuration, setTalkDuration] = useState(60)
  const [savingTalk, setSavingTalk] = useState(false)
  const [talkFlash, setTalkFlash] = useState(false)

  const [newTodo, setNewTodo] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)

  const [savingReimb, setSavingReimb] = useState(false)

  const [tripNotes, setTripNotes] = useState('')
  const [savedTripNotes, setSavedTripNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function fetchAll() {
    const [tripRes, talkRes, todoRes, projRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_talks').select('*').eq('trip_id', tripId).maybeSingle(),
      supabase.from('trip_todos').select('*').eq('trip_id', tripId).order('position').order('created_at'),
      supabase.from('research_projects').select('id, title').order('title'),
    ])
    if (tripRes.data) {
      const t = tripRes.data as Trip
      setTrip(t)
      setTripNotes(t.notes ?? '')
      setSavedTripNotes(t.notes ?? '')
    }
    if (talkRes.data) {
      const t = talkRes.data as TripTalk
      setTalk(t)
      setTalkTitle(t.title ?? '')
      setTalkDate(t.talk_date ?? '')
      setTalkTime(t.talk_time ? t.talk_time.slice(0, 5) : '')
      setTalkDuration(t.duration_minutes)
    }
    if (todoRes.data) setTodos(todoRes.data as TripTodo[])
    if (projRes.data) setProjects(projRes.data as ResearchProject[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [tripId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveTalk() {
    setSavingTalk(true)
    const { data } = await supabase
      .from('trip_talks')
      .upsert(
        {
          trip_id: tripId,
          title: talkTitle.trim() || null,
          talk_date: talkDate || null,
          talk_time: talkTime || null,
          duration_minutes: talkDuration,
        },
        { onConflict: 'trip_id' },
      )
      .select()
      .single()
    if (data) setTalk(data as TripTalk)
    setSavingTalk(false)
    setTalkFlash(true)
    setTimeout(() => setTalkFlash(false), 2000)
  }

  async function addTodo() {
    const title = newTodo.trim()
    if (!title) return
    setAddingTodo(true)
    const { data } = await supabase
      .from('trip_todos')
      .insert({ trip_id: tripId, title, done: false, position: todos.length })
      .select()
      .single()
    if (data) setTodos(prev => [...prev, data as TripTodo])
    setNewTodo('')
    setAddingTodo(false)
  }

  async function toggleTodo(todo: TripTodo) {
    await supabase.from('trip_todos').update({ done: !todo.done }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))
  }

  async function deleteTodo(id: string) {
    await supabase.from('trip_todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function toggleReimb(field: 'reimbursement_submitted' | 'reimbursement_received') {
    if (!trip) return
    const val = !trip[field]
    setSavingReimb(true)
    await supabase.from('trips').update({ [field]: val }).eq('id', tripId)
    setTrip(prev => prev ? { ...prev, [field]: val } : prev)
    setSavingReimb(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('trips').update({ notes: tripNotes || null }).eq('id', tripId)
    setSavedTripNotes(tripNotes)
    setSavingNotes(false)
  }

  async function deleteTrip() {
    if (!confirm('Delete this trip? This cannot be undone.')) return
    await supabase.from('trips').delete().eq('id', tripId)
    router.push('/travel')
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
  if (!trip) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Trip not found.</div>

  const s = TRIP_STYLES[trip.type]
  const arrFmt = new Date(trip.arrival_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const depFmt = new Date(trip.departure_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const linkedProject = trip.project_id ? projects.find(p => p.id === trip.project_id) : null

  const talkChanged =
    talkTitle !== (talk?.title ?? '') ||
    talkDate !== (talk?.talk_date ?? '') ||
    talkTime !== (talk?.talk_time ? talk.talk_time.slice(0, 5) : '') ||
    talkDuration !== (talk?.duration_minutes ?? 60)

  const pendingTodos = todos.filter(t => !t.done)
  const doneTodos = todos.filter(t => t.done)

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <Link href="/travel" className="text-xs text-gray-400 hover:text-gray-700 mb-4 inline-block">
        ← Travel
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-xl font-semibold text-gray-900">{trip.place}</h1>
          {trip.name && <span className="text-xl text-gray-400 font-normal">{trip.name}</span>}
          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${s.pill}`}>{s.label}</span>
        </div>
        <div className="text-sm text-gray-500">{arrFmt} – {depFmt}</div>
        {linkedProject && (
          <Link href={`/projects/${trip.project_id}`} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5 inline-block">
            ↗ {linkedProject.title}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(['talk', 'checklist', 'reimbursement'] as TripTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-gray-800 text-gray-800 bg-white'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'talk' ? 'Talk' : t === 'checklist' ? 'Checklist' : 'Reimbursement'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Talk tab */}
          {tab === 'talk' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Talk title</label>
                <input
                  value={talkTitle}
                  onChange={e => setTalkTitle(e.target.value)}
                  placeholder="Title of your talk…"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 placeholder:text-gray-300 w-full"
                />
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Date</label>
                  <input
                    type="date"
                    value={talkDate}
                    min={trip.arrival_date}
                    max={trip.departure_date}
                    onChange={e => setTalkDate(e.target.value)}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Time</label>
                  <input
                    type="time"
                    value={talkTime}
                    onChange={e => setTalkTime(e.target.value)}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Duration (min)</label>
                  <input
                    type="number"
                    value={talkDuration}
                    min={5}
                    step={5}
                    onChange={e => setTalkDuration(Number(e.target.value))}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 w-24"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveTalk}
                  disabled={savingTalk || !talkChanged}
                  className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
                >
                  {savingTalk ? 'Saving…' : 'Save'}
                </button>
                {talkFlash && (
                  <span className="text-xs text-green-600">Saved — will appear on calendar.</span>
                )}
                {!talkFlash && talkDate && talkTime && talk?.talk_date && (
                  <span className="text-xs text-gray-400">Appears on calendar.</span>
                )}
              </div>
            </div>
          )}

          {/* Checklist tab */}
          {tab === 'checklist' && (
            <div>
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
                  placeholder="+ Add a checklist item…"
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
          )}

          {/* Reimbursement tab */}
          {tab === 'reimbursement' && (
            <div className="space-y-3">
              <CheckRow
                checked={trip.reimbursement_submitted}
                label="Reimbursement submitted"
                disabled={savingReimb}
                onChange={() => toggleReimb('reimbursement_submitted')}
              />
              <CheckRow
                checked={trip.reimbursement_received}
                label="Reimbursement received"
                disabled={savingReimb}
                onChange={() => toggleReimb('reimbursement_received')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</div>
        <textarea
          value={tripNotes}
          onChange={e => setTripNotes(e.target.value)}
          placeholder="General notes about this trip…"
          rows={5}
          className="w-full text-sm text-gray-700 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-gray-400 resize-none placeholder:text-gray-300"
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={saveNotes}
            disabled={savingNotes || tripNotes === savedTripNotes}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
          >
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100">
        <button
          onClick={deleteTrip}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Delete this trip
        </button>
      </div>
    </div>
  )
}

function CheckRow({ checked, label, disabled, onChange }: {
  checked: boolean
  label: string
  disabled: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={onChange}
        disabled={disabled}
        className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
          checked ? 'bg-gray-900 border-gray-900' : 'border-gray-300 hover:border-gray-500'
        }`}
      >
        {checked && <span className="text-white text-xs leading-none">✓</span>}
      </button>
      <span className={`text-sm ${checked ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>{label}</span>
    </div>
  )
}

function TodoRow({ todo, onToggle, onDelete }: {
  todo: TripTodo
  onToggle: (t: TripTodo) => void
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
