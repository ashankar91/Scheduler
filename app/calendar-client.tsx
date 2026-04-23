'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import WeekView from '@/components/WeekView'
import MonthView from '@/components/MonthView'
import DayView from '@/components/DayView'
import QuickAdd from '@/components/QuickAdd'
import { supabase } from '@/lib/supabase'
import { Event, RecurringEvent, CalendarEvent } from '@/lib/types'
import { expandRecurring } from '@/lib/recurring'
import { TYPE_LABELS, TYPE_COLORS } from '@/lib/colors'

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

// Start of 6-week grid for a given month
function monthGridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1)
  const dow = first.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const d = new Date(first)
  d.setDate(first.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

type CalView = 'week' | 'month' | 'day'

export default function CalendarPage() {
  const [view, setView] = useState<CalView>('week')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([])
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [quickAddInput, setQuickAddInput] = useState<string | undefined>(undefined)
  const popoverRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(async () => {
    let from: Date, to: Date

    if (view === 'week') {
      from = weekStart
      to = addDays(weekStart, 7)
    } else {
      from = monthGridStart(monthYear.year, monthYear.month)
      to = addDays(from, 42)
    }

    const [oneOffRes, recurringRes, exceptionsRes] = await Promise.all([
      supabase.from('events').select('*').gte('start_time', from.toISOString()).lt('start_time', to.toISOString()).order('start_time'),
      supabase.from('recurring_events').select('*'),
      supabase.from('recurring_exceptions').select('recurring_event_id, exception_date'),
    ])

    const oneOff: CalendarEvent[] = ((oneOffRes.data ?? []) as Event[]).map(e => ({
      id: e.id, title: e.title, type: e.type,
      start_time: e.start_time, end_time: e.end_time, notes: e.notes,
    }))

    const exceptionSet = new Set<string>(
      ((exceptionsRes.data ?? []) as { recurring_event_id: string; exception_date: string }[])
        .map(ex => `${ex.recurring_event_id}:${ex.exception_date}`)
    )

    const recurring = expandRecurring(
      (recurringRes.data ?? []) as RecurringEvent[],
      exceptionSet,
      from,
      to,
    )

    setEvents([...oneOff, ...recurring].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setLoading(false)
  }, [view, weekStart, monthYear])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelected(null)
        setPopoverPos(null)
      }
    }
    if (selected) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [selected])

  function handleEventClick(ev: CalendarEvent, domEvent: React.MouseEvent) {
    setSelected(ev)
    setEditingNotes(ev.notes ?? '')
    setPopoverPos({ x: domEvent.clientX, y: domEvent.clientY })
  }

  async function openDay(date: Date) {
    const from = new Date(date); from.setHours(0, 0, 0, 0)
    const to = new Date(date); to.setHours(23, 59, 59, 999)
    const toExcl = addDays(from, 1)

    const [oneOffRes, recurringRes, exceptionsRes] = await Promise.all([
      supabase.from('events').select('*').gte('start_time', from.toISOString()).lt('start_time', toExcl.toISOString()).order('start_time'),
      supabase.from('recurring_events').select('*'),
      supabase.from('recurring_exceptions').select('recurring_event_id, exception_date'),
    ])

    const oneOff: CalendarEvent[] = ((oneOffRes.data ?? []) as Event[]).map(e => ({
      id: e.id, title: e.title, type: e.type,
      start_time: e.start_time, end_time: e.end_time, notes: e.notes,
    }))

    const exSet = new Set<string>(
      ((exceptionsRes.data ?? []) as { recurring_event_id: string; exception_date: string }[])
        .map(ex => `${ex.recurring_event_id}:${ex.exception_date}`)
    )

    const recurring = expandRecurring((recurringRes.data ?? []) as RecurringEvent[], exSet, from, toExcl)
    const all = [...oneOff, ...recurring].sort((a, b) => a.start_time.localeCompare(b.start_time))

    setDayEvents(all)
    setSelectedDay(date)
    setView('day')
  }

  function handleSlotClick(date: Date, hour: number) {
    const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const dateStr = `${MONTHS[date.getMonth()]} ${date.getDate()}`
    const time = hour >= 12
      ? `${hour === 12 ? 12 : hour - 12}pm`
      : `${hour === 0 ? 12 : hour}am`
    setQuickAddInput(`${dateStr} ${time} `)
  }

  async function saveNotes() {
    if (!selected) return
    setSavingNotes(true)
    if (selected.recurring_event_id) {
      await supabase.from('recurring_events').update({ notes: editingNotes || null }).eq('id', selected.recurring_event_id)
    } else {
      await supabase.from('events').update({ notes: editingNotes || null }).eq('id', selected.id)
    }
    setSavingNotes(false)
    setSelected(null)
    fetchEvents()
  }

  async function deleteOneOff() {
    if (!selected) return
    setDeleting(true)
    await supabase.from('events').delete().eq('id', selected.id)
    setDeleting(false)
    setSelected(null)
    fetchEvents()
  }

  async function deleteInstance() {
    if (!selected?.recurring_event_id || !selected.instance_date) return
    setDeleting(true)
    await supabase.from('recurring_exceptions').insert({
      recurring_event_id: selected.recurring_event_id,
      exception_date: selected.instance_date,
    })
    setDeleting(false)
    setSelected(null)
    fetchEvents()
  }

  async function deleteSeries() {
    if (!selected?.recurring_event_id) return
    setDeleting(true)
    await supabase.from('recurring_events').delete().eq('id', selected.recurring_event_id)
    setDeleting(false)
    setSelected(null)
    fetchEvents()
  }

  // Day-view delete handlers (take the event directly, not from `selected`)
  async function dayDeleteOneOff(ev: CalendarEvent) {
    await supabase.from('events').delete().eq('id', ev.id)
    if (selectedDay) openDay(selectedDay)
  }

  async function dayDeleteInstance(ev: CalendarEvent) {
    if (!ev.recurring_event_id || !ev.instance_date) return
    await supabase.from('recurring_exceptions').insert({
      recurring_event_id: ev.recurring_event_id,
      exception_date: ev.instance_date,
    })
    if (selectedDay) openDay(selectedDay)
  }

  async function dayDeleteSeries(ev: CalendarEvent) {
    if (!ev.recurring_event_id) return
    await supabase.from('recurring_events').delete().eq('id', ev.recurring_event_id)
    if (selectedDay) openDay(selectedDay)
  }

  // Sync week↔month navigation when switching views
  function switchView(v: CalView) {
    if (v === 'month') {
      setMonthYear({ year: weekStart.getFullYear(), month: weekStart.getMonth() })
    } else if (v === 'week') {
      setWeekStart(startOfWeek(new Date(monthYear.year, monthYear.month, 1)))
    }
    setView(v)
  }

  function prevMonth() {
    setMonthYear(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  function nextMonth() {
    setMonthYear(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }
  function todayMonth() {
    const n = new Date()
    setMonthYear({ year: n.getFullYear(), month: n.getMonth() })
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View toggle — hidden in day view */}
        {view !== 'day' && (
          <div className="flex justify-end px-4 pt-2 pb-0 bg-white border-b border-transparent">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => switchView('week')}
                className={`px-3 py-1.5 ${view === 'week' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Week
              </button>
              <button
                onClick={() => switchView('month')}
                className={`px-3 py-1.5 ${view === 'month' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Month
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center flex-1 text-sm text-gray-400">Loading…</div>
        ) : view === 'week' ? (
          <WeekView
            events={events}
            weekStart={weekStart}
            onPrev={() => setWeekStart(d => addDays(d, -7))}
            onNext={() => setWeekStart(d => addDays(d, 7))}
            onToday={() => setWeekStart(startOfWeek(new Date()))}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        ) : view === 'month' ? (
          <MonthView
            events={events}
            year={monthYear.year}
            month={monthYear.month}
            onPrev={prevMonth}
            onNext={nextMonth}
            onToday={todayMonth}
            onEventClick={handleEventClick}
            onDayClick={openDay}
          />
        ) : selectedDay ? (
          <DayView
            date={selectedDay}
            events={dayEvents}
            onBack={() => setView('month')}
            onEventNoteSaved={() => openDay(selectedDay)}
            onDeleteOneOff={dayDeleteOneOff}
            onDeleteInstance={dayDeleteInstance}
            onDeleteSeries={dayDeleteSeries}
          />
        ) : null}
      </div>

      {selected && popoverPos && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-64 p-4"
          style={{
            left: Math.min(popoverPos.x, window.innerWidth - 280),
            top: Math.min(popoverPos.y + 8, window.innerHeight - 260),
          }}
        >
          <div className="flex items-start gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${TYPE_COLORS[selected.type].dot}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{selected.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {TYPE_LABELS[selected.type]} · {new Date(selected.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{new Date(selected.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
              {selected.recurring_event_id && (
                <div className="text-xs text-gray-400 mt-0.5 italic">Recurring</div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <textarea
              value={editingNotes}
              onChange={e => setEditingNotes(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) saveNotes() }}
              placeholder="Add notes…"
              rows={3}
              className="w-full text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-2 outline-none focus:border-gray-400 resize-none placeholder:text-gray-300"
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={saveNotes}
                disabled={savingNotes || editingNotes === (selected.notes ?? '')}
                className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg hover:bg-gray-700 disabled:opacity-40"
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {selected.recurring_event_id ? (
              <>
                <button onClick={deleteInstance} disabled={deleting} className="text-xs text-left px-2 py-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-50">
                  Delete this occurrence
                </button>
                <button onClick={deleteSeries} disabled={deleting} className="text-xs text-left px-2 py-1.5 rounded hover:bg-red-50 text-red-700 font-medium disabled:opacity-50">
                  Delete entire series
                </button>
              </>
            ) : (
              <button onClick={deleteOneOff} disabled={deleting} className="text-xs text-left px-2 py-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-50">
                Delete event
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating + button for mobile */}
      {view !== 'day' && (
        <button
          onClick={() => setQuickAddInput('')}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center text-2xl md:hidden hover:bg-gray-700 active:scale-95"
          aria-label="Add event"
        >
          +
        </button>
      )}

      <QuickAdd
        onCreated={fetchEvents}
        initialInput={quickAddInput}
        onClose={() => setQuickAddInput(undefined)}
      />
    </>
  )
}
