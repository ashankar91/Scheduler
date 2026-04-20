'use client'

import { useEffect, useState } from 'react'
import { CalendarEvent } from '@/lib/types'
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/colors'
import { supabase } from '@/lib/supabase'

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  date: Date
  events: CalendarEvent[]
  onBack: () => void
  onEventNoteSaved: () => void
  onDeleteOneOff: (ev: CalendarEvent) => void
  onDeleteInstance: (ev: CalendarEvent) => void
  onDeleteSeries: (ev: CalendarEvent) => void
}

export default function DayView({ date, events, onBack, onEventNoteSaved, onDeleteOneOff, onDeleteInstance, onDeleteSeries }: Props) {
  const [dayNotes, setDayNotes] = useState('')
  const [savedDayNotes, setSavedDayNotes] = useState('')
  const [savingDay, setSavingDay] = useState(false)
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({})
  const [savingEvent, setSavingEvent] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const ymd = toYMD(date)

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  // Load day notes
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('day_notes').select('notes').eq('date', ymd).maybeSingle()
      const notes = data?.notes ?? ''
      setDayNotes(notes)
      setSavedDayNotes(notes)
    }
    load()
  }, [ymd])

  // Init event notes from props
  useEffect(() => {
    const map: Record<string, string> = {}
    for (const ev of events) map[ev.id] = ev.notes ?? ''
    setEventNotes(map)
  }, [events])

  async function saveDayNotes() {
    setSavingDay(true)
    await supabase.from('day_notes').upsert({ date: ymd, notes: dayNotes, updated_at: new Date().toISOString() })
    setSavedDayNotes(dayNotes)
    setSavingDay(false)
  }

  async function saveEventNotes(ev: CalendarEvent) {
    setSavingEvent(ev.id)
    const notes = eventNotes[ev.id] ?? ''
    if (ev.recurring_event_id) {
      await supabase.from('recurring_events').update({ notes: notes || null }).eq('id', ev.recurring_event_id)
    } else {
      await supabase.from('events').update({ notes: notes || null }).eq('id', ev.id)
    }
    setSavingEvent(null)
    onEventNoteSaved()
  }

  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onBack} className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 flex items-center gap-1">
          ‹ Back
        </button>
        <span className="text-sm font-medium text-gray-800">{dateLabel}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Day notes */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Day notes</div>
            <textarea
              value={dayNotes}
              onChange={e => setDayNotes(e.target.value)}
              placeholder="Notes for this day…"
              rows={5}
              className="w-full text-sm text-gray-700 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-gray-400 resize-none placeholder:text-gray-300"
            />
            <div className="flex justify-end mt-1.5">
              <button
                onClick={saveDayNotes}
                disabled={savingDay || dayNotes === savedDayNotes}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
              >
                {savingDay ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>

          {/* Events */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {sorted.length === 0 ? 'No events' : `Events (${sorted.length})`}
            </div>
            <div className="space-y-3">
              {sorted.map(ev => {
                const c = TYPE_COLORS[ev.type]
                const isExpanded = expandedEvent === ev.id
                const noteVal = eventNotes[ev.id] ?? ''
                const originalNote = ev.notes ?? ''

                return (
                  <div key={ev.id} className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
                    {/* Event header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${c.text}`}>{ev.title}</div>
                        <div className={`text-xs opacity-70 ${c.text} mt-0.5`}>
                          {TYPE_LABELS[ev.type]} · {new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{new Date(ev.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {ev.recurring_event_id && ' · Recurring'}
                        </div>
                        {!isExpanded && noteVal && (
                          <div className={`text-xs mt-1 opacity-60 ${c.text} line-clamp-2`}>{noteVal}</div>
                        )}
                      </div>
                      <span className={`text-xs opacity-40 ${c.text} flex-shrink-0`}>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded notes + actions */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-black/5">
                        <textarea
                          value={noteVal}
                          onChange={e => setEventNotes(n => ({ ...n, [ev.id]: e.target.value }))}
                          placeholder="Add notes for this event…"
                          rows={4}
                          className={`w-full mt-3 text-sm bg-white/60 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black/20 resize-none placeholder:opacity-30 ${c.text}`}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-3">
                            {ev.recurring_event_id ? (
                              <>
                                <button onClick={() => onDeleteInstance(ev)} className="text-xs text-red-500 hover:text-red-700">Delete this occurrence</button>
                                <button onClick={() => onDeleteSeries(ev)} className="text-xs text-red-600 font-medium hover:text-red-800">Delete series</button>
                              </>
                            ) : (
                              <button onClick={() => onDeleteOneOff(ev)} className="text-xs text-red-500 hover:text-red-700">Delete event</button>
                            )}
                          </div>
                          <button
                            onClick={() => saveEventNotes(ev)}
                            disabled={savingEvent === ev.id || noteVal === originalNote}
                            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40"
                          >
                            {savingEvent === ev.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
