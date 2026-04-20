import { RecurringEvent, CalendarEvent } from './types'

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dateFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function expandRecurring(
  recurring: RecurringEvent[],
  exceptions: Set<string>, // "recurringEventId:YYYY-MM-DD"
  rangeStart: Date,        // inclusive
  rangeEnd: Date,          // exclusive
): CalendarEvent[] {
  const results: CalendarEvent[] = []

  // Number of days in range
  const msPerDay = 24 * 60 * 60 * 1000
  const numDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay)

  for (const rec of recurring) {
    const startsOn = dateFromYMD(rec.starts_on)
    const endsOn = rec.ends_on ? dateFromYMD(rec.ends_on) : null

    for (let i = 0; i < numDays; i++) {
      const day = new Date(rangeStart)
      day.setDate(rangeStart.getDate() + i)

      // Does this day match the recurrence day_of_week?
      if (day.getDay() !== rec.day_of_week) continue

      // Is this day within the event's date range?
      if (day < startsOn) continue
      if (endsOn && day > endsOn) continue

      // Is this day within the range?
      if (day < rangeStart || day >= rangeEnd) continue

      // For biweekly: check if the week offset from starts_on is even
      if (rec.recurrence === 'biweekly') {
        const msPerWeek = 7 * 24 * 60 * 60 * 1000
        const weeksSinceStart = Math.round((day.getTime() - startsOn.getTime()) / msPerWeek)
        if (weeksSinceStart % 2 !== 0) continue
      }

      const ymd = toYMD(day)
      const exKey = `${rec.id}:${ymd}`
      if (exceptions.has(exKey)) continue

      const start = new Date(day)
      start.setHours(rec.start_hour, rec.start_minute, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + rec.duration_minutes)

      results.push({
        id: `r:${rec.id}:${ymd}`,
        title: rec.title,
        type: rec.type,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: rec.notes,
        recurring_event_id: rec.id,
        instance_date: ymd,
      })
    }
  }

  return results
}
