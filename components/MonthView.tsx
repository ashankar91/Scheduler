'use client'

import { useMemo } from 'react'
import { CalendarEvent, Trip } from '@/lib/types'
import { TYPE_COLORS, TRIP_STYLES } from '@/lib/colors'

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function startOfMonthGrid(year: number, month: number): Date {
  // First day of month
  const first = new Date(year, month, 1)
  // Shift back to Monday
  const dow = first.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  const d = new Date(first)
  d.setDate(first.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

interface Props {
  events: CalendarEvent[]
  trips?: Trip[]
  year: number
  month: number // 0-indexed
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onEventClick: (ev: CalendarEvent, domEvent: React.MouseEvent) => void
  onDayClick: (date: Date) => void
}

export default function MonthView({ events, trips = [], year, month, onPrev, onNext, onToday, onEventClick, onDayClick }: Props) {
  const today = new Date()

  const gridStart = useMemo(() => startOfMonthGrid(year, month), [year, month])

  // Build 6-week grid (42 days)
  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [gridStart])

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Group trips by date
  const tripsByDate = useMemo(() => {
    const map = new Map<string, Trip[]>()
    for (const day of days) {
      const ymd = toLocalYMD(day)
      const dayTrips = trips.filter(t => t.arrival_date <= ymd && t.departure_date >= ymd)
      if (dayTrips.length > 0) map.set(dayKey(day), dayTrips)
    }
    return map
  }, [trips, days])

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const d = new Date(ev.start_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [events])

  function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onToday} className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">Today</button>
        <button onClick={onPrev} className="text-gray-500 hover:text-gray-900 px-1">‹</button>
        <button onClick={onNext} className="text-gray-500 hover:text-gray-900 px-1">›</button>
        <span className="text-sm font-medium text-gray-800">{monthLabel}</span>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 flex-shrink-0">
        {DAYS.map(d => (
          <div key={d} className="text-xs text-gray-400 text-center py-2">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month
          const isToday = isSameDay(day, today)
          const dayEvents = (eventsByDate.get(dayKey(day)) ?? [])
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
          const visible = dayEvents.slice(0, MAX_VISIBLE)
          const overflow = dayEvents.length - MAX_VISIBLE

          return (
            <div
              key={i}
              className={`border-r border-b border-gray-100 last:border-r-0 p-1 min-h-0 overflow-hidden flex flex-col ${!isCurrentMonth ? 'bg-gray-50/50' : ''}`}
            >
              <div className="flex items-center justify-center mb-1">
                <button
                  onClick={() => onDayClick(new Date(day))}
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full hover:ring-2 hover:ring-gray-300 ${
                    isToday ? 'bg-gray-900 text-white' : isCurrentMonth ? 'text-gray-800' : 'text-gray-300'
                  }`}
                >
                  {day.getDate()}
                </button>
              </div>

              <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                {(tripsByDate.get(dayKey(day)) ?? []).map(trip => {
                  const s = TRIP_STYLES[trip.type]
                  return (
                    <a
                      key={trip.id}
                      href={`/travel/${trip.id}`}
                      onClick={e => e.stopPropagation()}
                      className={`block text-left w-full rounded px-1 py-0.5 truncate text-xs leading-tight ${s.banner} hover:opacity-90`}
                    >
                      {trip.name || trip.place}
                    </a>
                  )
                })}
                {visible.map(ev => {
                  const c = TYPE_COLORS[ev.type]
                  return (
                    <button
                      key={ev.id}
                      onClick={e => onEventClick(ev, e)}
                      className={`text-left w-full rounded px-1 py-0.5 truncate text-xs leading-tight ${c.bg} ${c.text} hover:brightness-95`}
                    >
                      {ev.title}
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <div className="text-xs text-gray-400 px-1">+{overflow} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
