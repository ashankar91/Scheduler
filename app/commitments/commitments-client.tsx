'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Event, RecurringEvent, CommitmentType } from '@/lib/types'
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/colors'

const ALL_TYPES: CommitmentType[] = ['teaching', 'research_meeting', 'advising_meeting', 'seminar', 'talk', 'misc']

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CommitmentsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [recurring, setRecurring] = useState<RecurringEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CommitmentType | 'all'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function fetchAll() {
    let q = supabase.from('events').select('*').order('start_time', { ascending: true })
    if (filter !== 'all') q = q.eq('type', filter)

    let rq = supabase.from('recurring_events').select('*').order('day_of_week').order('start_hour')
    if (filter !== 'all') rq = rq.eq('type', filter)

    const [evRes, recRes] = await Promise.all([q, rq])
    if (!evRes.error && evRes.data) setEvents(evRes.data as Event[])
    if (!recRes.error && recRes.data) setRecurring(recRes.data as RecurringEvent[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    setDeleting(id)
    await supabase.from('events').delete().eq('id', id)
    setDeleting(null)
    fetchAll()
  }

  async function deleteRecurring(id: string) {
    if (!confirm('Delete this recurring series? All occurrences will be removed.')) return
    setDeleting(id)
    await supabase.from('recurring_events').delete().eq('id', id)
    setDeleting(null)
    fetchAll()
  }

  const grouped = events.reduce<Record<string, Event[]>>((acc, ev) => {
    const d = new Date(ev.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (!acc[d]) acc[d] = []
    acc[d].push(ev)
    return acc
  }, {})

  function recLabel(rec: RecurringEvent): string {
    const day = DAY_NAMES[rec.day_of_week]
    const start = new Date()
    start.setHours(rec.start_hour, rec.start_minute, 0, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + rec.duration_minutes)
    const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    const freq = rec.recurrence === 'biweekly' ? 'Every other' : 'Every'
    return `${freq} ${day} · ${timeStr}`
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border ${filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </button>
        {ALL_TYPES.map(t => {
          const c = TYPE_COLORS[t]
          const active = filter === t
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${active ? `${c.bg} ${c.text} ${c.border}` : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {TYPE_LABELS[t]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* Recurring section */}
          {recurring.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recurring</div>
              <div className="space-y-1">
                {recurring.map(rec => {
                  const c = TYPE_COLORS[rec.type]
                  return (
                    <div key={rec.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${c.border} ${c.bg}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${c.text} truncate`}>{rec.title}</div>
                        <div className={`text-xs opacity-70 ${c.text}`}>
                          {TYPE_LABELS[rec.type]} · {recLabel(rec)}
                        </div>
                        {rec.notes && <div className={`text-xs mt-0.5 opacity-60 ${c.text} truncate`}>{rec.notes}</div>}
                      </div>
                      <button
                        onClick={() => deleteRecurring(rec.id)}
                        disabled={deleting === rec.id}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 ml-2"
                        title="Delete series"
                      >
                        {deleting === rec.id ? '…' : '×'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* One-off events */}
          {Object.keys(grouped).length > 0 && (
            <div>
              {recurring.length > 0 && (
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">One-off</div>
              )}
              <div className="space-y-6">
                {Object.entries(grouped).map(([date, dayEvents]) => (
                  <div key={date}>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{date}</div>
                    <div className="space-y-1">
                      {dayEvents.map(ev => {
                        const c = TYPE_COLORS[ev.type]
                        return (
                          <div key={ev.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${c.border} ${c.bg}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium ${c.text} truncate`}>{ev.title}</div>
                              <div className={`text-xs opacity-70 ${c.text}`}>
                                {TYPE_LABELS[ev.type]} · {new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{new Date(ev.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              {ev.notes && <div className={`text-xs mt-0.5 opacity-60 ${c.text} truncate`}>{ev.notes}</div>}
                            </div>
                            <button
                              onClick={() => deleteEvent(ev.id)}
                              disabled={deleting === ev.id}
                              className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 ml-2"
                            >
                              {deleting === ev.id ? '…' : '×'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recurring.length === 0 && Object.keys(grouped).length === 0 && (
            <div className="text-sm text-gray-400">No events. Press <kbd className="font-mono bg-gray-100 px-1 rounded">K</kbd> to quick-add.</div>
          )}
        </div>
      )}
    </div>
  )
}
