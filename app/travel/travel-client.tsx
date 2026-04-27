'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trip, TripType, ResearchProject } from '@/lib/types'
import { TRIP_STYLES } from '@/lib/colors'

const TRIP_TYPES: TripType[] = ['conference', 'workshop', 'seminar', 'research']

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TravelClient() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = toLocalYMD(new Date())
  const [formType, setFormType] = useState<TripType>('conference')
  const [formName, setFormName] = useState('')
  const [formPlace, setFormPlace] = useState('')
  const [formArrival, setFormArrival] = useState(today)
  const [formDeparture, setFormDeparture] = useState(today)
  const [formGivingTalk, setFormGivingTalk] = useState(true)
  const [formProjectId, setFormProjectId] = useState('')

  async function fetchAll() {
    const [tripsRes, projRes] = await Promise.all([
      supabase.from('trips').select('*').order('arrival_date', { ascending: false }),
      supabase.from('research_projects').select('id, title').order('title'),
    ])
    if (tripsRes.data) setTrips(tripsRes.data as Trip[])
    if (projRes.data) setProjects(projRes.data as ResearchProject[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    const d = toLocalYMD(new Date())
    setFormType('conference')
    setFormName('')
    setFormPlace('')
    setFormArrival(d)
    setFormDeparture(d)
    setFormGivingTalk(true)
    setFormProjectId('')
  }

  async function createTrip() {
    if (!formPlace.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('trips')
      .insert({
        type: formType,
        name: formName.trim() || null,
        place: formPlace.trim(),
        arrival_date: formArrival,
        departure_date: formDeparture,
        giving_talk: formGivingTalk,
        project_id: formProjectId || null,
        reimbursement_submitted: false,
        reimbursement_received: false,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { alert(`Could not create trip: ${error.message}`); return }
    setCreating(false)
    resetForm()
    if (data) router.push(`/travel/${data.id}`)
  }

  const now = toLocalYMD(new Date())
  const upcoming = trips.filter(t => t.departure_date >= now)
  const past = trips.filter(t => t.departure_date < now)
  const projMap = Object.fromEntries(projects.map(p => [p.id, p.title]))

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Travel</h1>
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
        <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as TripType)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800"
              >
                {TRIP_TYPES.map(t => (
                  <option key={t} value={t}>{TRIP_STYLES[t].label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs text-gray-500">Name (optional)</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. STOC, NT Seminar…"
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800 placeholder:text-gray-400 focus:border-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs text-gray-500">Place *</label>
              <input
                autoFocus
                value={formPlace}
                onChange={e => setFormPlace(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createTrip()
                  if (e.key === 'Escape') { setCreating(false); resetForm() }
                }}
                placeholder="City or venue…"
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800 placeholder:text-gray-400 focus:border-gray-400"
              />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Arrival</label>
              <input
                type="date"
                value={formArrival}
                onChange={e => {
                  setFormArrival(e.target.value)
                  if (e.target.value > formDeparture) setFormDeparture(e.target.value)
                }}
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Departure</label>
              <input
                type="date"
                value={formDeparture}
                min={formArrival}
                onChange={e => setFormDeparture(e.target.value)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800"
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer pb-1.5">
              <input
                type="checkbox"
                checked={formGivingTalk}
                onChange={e => setFormGivingTalk(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-800"
              />
              <span className="text-sm text-gray-700">Giving a talk</span>
            </label>
          </div>

          {projects.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Linked project (optional)</label>
              <select
                value={formProjectId}
                onChange={e => setFormProjectId(e.target.value)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-800 max-w-xs"
              >
                <option value="">— none —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={createTrip}
              disabled={saving || !formPlace.trim()}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => { setCreating(false); resetForm() }}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : trips.length === 0 ? (
        <div className="text-sm text-gray-400">No trips yet.</div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <TripSection label="Upcoming" trips={upcoming} projMap={projMap} onSelect={id => router.push(`/travel/${id}`)} />
          )}
          {past.length > 0 && (
            <TripSection label="Past" trips={past} projMap={projMap} onSelect={id => router.push(`/travel/${id}`)} />
          )}
        </div>
      )}
    </div>
  )
}

function TripSection({ label, trips, projMap, onSelect }: {
  label: string
  trips: Trip[]
  projMap: Record<string, string>
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</div>
      <div className="space-y-2">
        {trips.map(trip => {
          const s = TRIP_STYLES[trip.type]
          const arrFmt = new Date(trip.arrival_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const depFmt = new Date(trip.departure_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          return (
            <button
              key={trip.id}
              onClick={() => onSelect(trip.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{trip.place}</span>
                    {trip.name && <span className="text-sm text-gray-500">{trip.name}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${s.pill}`}>{s.label}</span>
                    {trip.giving_talk && <span className="text-xs text-gray-400">· Talk</span>}
                  </div>
                  <div className="text-xs text-gray-400">{arrFmt} – {depFmt}</div>
                  {trip.project_id && projMap[trip.project_id] && (
                    <div className="text-xs text-gray-400 mt-0.5">↗ {projMap[trip.project_id]}</div>
                  )}
                  {trip.reimbursement_received ? (
                    <div className="text-xs text-green-600 mt-0.5">Reimbursed</div>
                  ) : trip.reimbursement_submitted ? (
                    <div className="text-xs text-amber-600 mt-0.5">Reimbursement submitted</div>
                  ) : null}
                </div>
                <span className="text-gray-300 text-sm group-hover:text-gray-400 flex-shrink-0 mt-0.5">›</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
