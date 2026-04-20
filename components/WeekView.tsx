'use client'

import { useMemo } from 'react'
import { CalendarEvent } from '@/lib/types'
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/colors'
import { layoutDayEvents } from '@/lib/layout'

const HOUR_START = 7   // 7am
const HOUR_END   = 21  // 9pm
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

interface Props {
  events: CalendarEvent[]
  weekStart: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onEventClick: (ev: CalendarEvent, domEvent: React.MouseEvent) => void
  onSlotClick?: (date: Date, hour: number) => void
}

export default function WeekView({ events, weekStart, onPrev, onNext, onToday, onEventClick, onSlotClick }: Props) {
  const today = new Date()
  const weekDays = DAYS.map((_, i) => addDays(weekStart, i))

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    if (weekStart.getFullYear() !== end.getFullYear()) {
      return `${weekStart.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
    }
    if (weekStart.getMonth() !== end.getMonth()) {
      return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`
    }
    return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  }, [weekStart])

  const eventsByDay = useMemo(() => {
    const map: Map<number, CalendarEvent[]> = new Map()
    for (let i = 0; i < 7; i++) map.set(i, [])
    for (const ev of events) {
      const d = new Date(ev.start_time)
      const idx = weekDays.findIndex(wd => isSameDay(wd, d))
      if (idx >= 0) map.get(idx)!.push(ev)
    }
    return map
  }, [events, weekDays])

  const layoutByDay = useMemo(() => {
    const map = new Map<number, ReturnType<typeof layoutDayEvents>>()
    for (let i = 0; i < 7; i++) {
      map.set(i, layoutDayEvents(eventsByDay.get(i) ?? []))
    }
    return map
  }, [eventsByDay])

  const ROW_HEIGHT = 48

  function eventStyle(ev: CalendarEvent): React.CSSProperties {
    const start = new Date(ev.start_time)
    const end = new Date(ev.end_time)
    const startH = start.getHours() + start.getMinutes() / 60
    const endH = end.getHours() + end.getMinutes() / 60
    const top = (startH - HOUR_START) * ROW_HEIGHT
    const height = Math.max((endH - startH) * ROW_HEIGHT, 20)
    return { top, height }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onToday} className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">Today</button>
        <button onClick={onPrev} className="text-gray-500 hover:text-gray-900 px-1">‹</button>
        <button onClick={onNext} className="text-gray-500 hover:text-gray-900 px-1">›</button>
        <span className="text-sm font-medium text-gray-800">{weekLabel}</span>
      </div>

      <div className="flex flex-1 overflow-auto">
        <div className="w-14 flex-shrink-0 border-r border-gray-100 bg-white">
          <div className="h-10" />
          {HOURS.map(h => (
            <div key={h} style={{ height: ROW_HEIGHT }} className="flex items-start justify-end pr-2 pt-1">
              <span className="text-xs text-gray-400">
                {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 min-w-0">
          {weekDays.map((day, colIdx) => {
            const isToday = isSameDay(day, today)
            return (
              <div key={colIdx} className="flex-1 border-r border-gray-100 last:border-r-0 min-w-0">
                <div className="h-10 flex flex-col items-center justify-center border-b border-gray-100">
                  <span className="text-xs text-gray-500">{DAYS[colIdx]}</span>
                  <span className={`text-sm font-medium leading-none mt-0.5 ${isToday ? 'text-white bg-gray-900 rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-800'}`}>
                    {day.getDate()}
                  </span>
                </div>

                <div className="relative">
                  {HOURS.map(h => (
                    <div
                      key={h}
                      style={{ height: ROW_HEIGHT }}
                      className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/50"
                      onClick={() => onSlotClick?.(new Date(day), h)}
                    />
                  ))}

                  {(layoutByDay.get(colIdx) ?? []).map(ev => {
                    const c = TYPE_COLORS[ev.type]
                    const style = eventStyle(ev)
                    const isRecurring = !!ev.recurring_event_id
                    const colWidth = 100 / ev.numCols
                    const leftPct = ev.col * colWidth
                    return (
                      <div
                        key={ev.id}
                        onClick={e => onEventClick(ev, e)}
                        className={`absolute rounded px-1.5 py-0.5 overflow-hidden cursor-pointer ${c.bg} ${c.text} border-l-2 ${c.border} hover:brightness-95`}
                        style={{
                          ...style,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${colWidth}% - 4px)`,
                        }}
                        title={`${ev.title} · ${TYPE_LABELS[ev.type]}${isRecurring ? ' (recurring)' : ''}`}
                      >
                        <div className="text-xs font-medium leading-tight truncate">{ev.title}</div>
                        {(style.height as number) > 30 && (
                          <div className="text-xs opacity-70 leading-tight">
                            {new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
