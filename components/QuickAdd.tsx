'use client'

import { useEffect, useRef, useState } from 'react'
import { parseQuickAdd, ParsedEvent } from '@/lib/parseQuickAdd'
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/colors'
import { supabase } from '@/lib/supabase'
import { RecurrenceType, Event, RecurringEvent } from '@/lib/types'
import { expandRecurring } from '@/lib/recurring'

interface Props {
  onCreated: () => void
}

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  weekly: 'Every week',
  biweekly: 'Every other week',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtTime(hour: number, minute: number): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

interface Conflict { title: string; time: string }

export default function QuickAdd({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<ParsedEvent | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !open) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setInput(''); setNotes(''); setPreview(null); setConflicts([]) }
  }, [open])

  function handleChange(val: string) {
    setInput(val)
    const parsed = val.trim() ? parseQuickAdd(val) : null
    setPreview(parsed)
    if (parsed) checkConflicts(parsed)
    else setConflicts([])
  }

  async function checkConflicts(parsed: ParsedEvent) {
    // Collect time windows to check: { start, end, dayOfWeek? }
    type Window = { start: Date; end: Date }
    const windows: Window[] = []

    if (parsed.kind === 'one-off') {
      windows.push({ start: parsed.start, end: parsed.end })
    } else {
      // For recurring, check the next occurrence of each day
      for (const dow of parsed.days_of_week) {
        const today = new Date()
        const todayDow = today.getDay()
        let diff = dow - todayDow
        if (diff <= 0) diff += 7
        const date = new Date(today)
        date.setDate(today.getDate() + diff)
        const start = new Date(date)
        start.setHours(parsed.start_hour, parsed.start_minute, 0, 0)
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + parsed.duration_minutes)
        windows.push({ start, end })
      }
    }

    if (windows.length === 0) return

    // Fetch a wide enough range to cover all windows
    const minStart = new Date(Math.min(...windows.map(w => w.start.getTime())))
    const maxEnd = new Date(Math.max(...windows.map(w => w.end.getTime())))
    // Expand to full days
    const from = new Date(minStart); from.setHours(0, 0, 0, 0)
    const to = new Date(maxEnd); to.setHours(23, 59, 59, 999)

    const [evRes, recRes, excRes] = await Promise.all([
      supabase.from('events').select('*').gte('start_time', from.toISOString()).lte('start_time', to.toISOString()),
      supabase.from('recurring_events').select('*'),
      supabase.from('recurring_exceptions').select('recurring_event_id, exception_date'),
    ])

    const oneOff = (evRes.data ?? []) as Event[]
    const exSet = new Set<string>(
      ((excRes.data ?? []) as { recurring_event_id: string; exception_date: string }[])
        .map(ex => `${ex.recurring_event_id}:${ex.exception_date}`)
    )
    // Expand recurring for each window day
    const recurringInstances = windows.flatMap(w => {
      const dayStart = new Date(w.start); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1)
      return expandRecurring((recRes.data ?? []) as RecurringEvent[], exSet, dayStart, dayEnd)
    })

    const allExisting = [
      ...oneOff.map(e => ({ title: e.title, start: new Date(e.start_time), end: new Date(e.end_time) })),
      ...recurringInstances.map(e => ({ title: e.title, start: new Date(e.start_time), end: new Date(e.end_time) })),
    ]

    const found: Conflict[] = []
    for (const w of windows) {
      for (const ex of allExisting) {
        if (w.start < ex.end && ex.start < w.end) {
          const timeStr = `${ex.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–${ex.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          if (!found.find(f => f.title === ex.title && f.time === timeStr)) {
            found.push({ title: ex.title, time: timeStr })
          }
        }
      }
    }
    setConflicts(found)
  }

  async function handleSubmit() {
    if (!preview) return
    setSaving(true)

    let error = null

    if (preview.kind === 'one-off') {
      const res = await supabase.from('events').insert({
        title: preview.title,
        type: preview.type,
        start_time: preview.start.toISOString(),
        end_time: preview.end.toISOString(),
        notes: notes.trim() || null,
      })
      error = res.error
    } else {
      // Insert one row per day
      const rows = preview.days_of_week.map(dow => ({
        title: preview.title,
        type: preview.type,
        recurrence: preview.recurrence,
        day_of_week: dow,
        start_hour: preview.start_hour,
        start_minute: preview.start_minute,
        duration_minutes: preview.duration_minutes,
        starts_on: preview.starts_on,
        ends_on: preview.ends_on ?? null,
        notes: notes.trim() || null,
      }))
      const res = await supabase.from('recurring_events').insert(rows)
      error = res.error
    }

    setSaving(false)
    if (!error) {
      setOpen(false)
      onCreated()
    } else {
      alert('Error saving: ' + error.message)
    }
  }

  if (!open) return null

  const colors = preview ? TYPE_COLORS[preview.type] : null

  function renderPreviewDetail() {
    if (!preview) return null
    if (preview.kind === 'one-off') {
      return (
        <>
          <div className="text-sm font-medium text-gray-900 truncate">{preview.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {TYPE_LABELS[preview.type]} · {preview.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
            {preview.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{preview.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        </>
      )
    } else {
      const endMinutes = preview.start_hour * 60 + preview.start_minute + preview.duration_minutes
      const dayStr = preview.days_of_week.map(d => DAY_NAMES[d]).join('/') + (preview.days_of_week.length === 1 ? 's' : '')
      return (
        <>
          <div className="text-sm font-medium text-gray-900 truncate">{preview.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {TYPE_LABELS[preview.type]} · {RECURRENCE_LABELS[preview.recurrence]}, {dayStr} · {fmtTime(preview.start_hour, preview.start_minute)}–{fmtTime(Math.floor(endMinutes / 60), endMinutes % 60)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Starting {preview.starts_on}{preview.ends_on ? ` · Until ${preview.ends_on}` : ''}
          </div>
        </>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/30" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }}
            placeholder='tue 2pm-4pm talk — every tue 10am teaching — every other mon 2pm, alice'
            className="w-full text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        {preview && colors && (
          <>
            <div className="px-4 pt-3 pb-2 flex items-start gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${colors.dot}`} />
              <div className="flex-1 min-w-0">
                {renderPreviewDetail()}
              </div>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 flex-shrink-0"
              >
                {saving ? 'Saving…' : 'Add ↵'}
              </button>
            </div>
            {conflicts.length > 0 && (
              <div className="px-4 pb-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-amber-700 mb-1">Conflicts with existing events:</div>
                  {conflicts.map((c, i) => (
                    <div key={i} className="text-xs text-amber-600">· {c.title} ({c.time})</div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-4 pb-3 border-b border-gray-100">
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }}
                placeholder="Notes (optional) — location, link, etc."
                className="w-full text-xs text-gray-600 outline-none placeholder:text-gray-300 bg-gray-50 rounded px-2 py-1.5"
              />
            </div>
          </>
        )}

        {!preview && input && (
          <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-100">
            Can&apos;t parse — try: <span className="font-mono">tue 2pm-4pm talk</span> or <span className="font-mono">every tue 10am teaching</span>
          </div>
        )}

        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 flex gap-4">
          <span><kbd className="font-mono">↵</kbd> add</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
