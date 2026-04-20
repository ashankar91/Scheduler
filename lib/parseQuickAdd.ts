import { CommitmentType, RecurrenceType } from './types'

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

function parseTime(token: string): { hour: number; minute: number } | null {
  const m = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return null
  let hour = parseInt(m[1])
  const minute = m[2] ? parseInt(m[2]) : 0
  const meridiem = m[3]?.toLowerCase()
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  return { hour, minute }
}

function parseTimeRange(token: string): { start: { hour: number; minute: number }; end: { hour: number; minute: number } } | null {
  const m = token.match(/^(.+?)[-–](.+)$/)
  if (!m) return null
  const start = parseTime(m[1])
  if (!start) return null
  let endStr = m[2]
  if (!/am|pm/i.test(endStr) && /am|pm/i.test(m[1])) {
    endStr += m[1].match(/am|pm/i)![0]
  }
  const end = parseTime(endStr)
  if (!end) return null
  return { start, end }
}

function parseDuration(token: string): number | null {
  const h = token.match(/^(\d+(?:\.\d+)?)h$/i)
  if (h) return Math.round(parseFloat(h[1]) * 60)
  const m = token.match(/^(\d+)m(?:in)?$/i)
  if (m) return parseInt(m[1])
  return null
}

function nextWeekday(dayIndex: number): Date {
  const today = new Date()
  const todayDay = today.getDay()
  let diff = dayIndex - todayDay
  if (diff <= 0) diff += 7
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function inferType(allText: string, hasSecondPart: boolean): CommitmentType {
  if (allText.includes('teach') || allText.includes('class') || allText.includes('lecture')) return 'teaching'
  if (allText.includes('talk')) return 'talk'
  if (allText.includes('seminar') || allText.includes('colloquium')) return 'seminar'
  if (allText.includes('advis')) return 'advising_meeting'
  if (allText.includes('research') || allText.includes('meeting')) return 'research_meeting'
  if (hasSecondPart) return 'research_meeting'
  return 'misc'
}

export interface ParsedOneOff {
  kind: 'one-off'
  title: string
  type: CommitmentType
  start: Date
  end: Date
}

export interface ParsedRecurring {
  kind: 'recurring'
  title: string
  type: CommitmentType
  recurrence: RecurrenceType
  days_of_week: number[]  // one or more days
  start_hour: number
  start_minute: number
  duration_minutes: number
  starts_on: string // YYYY-MM-DD
  ends_on?: string  // YYYY-MM-DD
}

export type ParsedEvent = ParsedOneOff | ParsedRecurring

function extractTimeAndDuration(tokens: string[]): {
  startTime: { hour: number; minute: number } | null
  endTime: { hour: number; minute: number } | null
  durationMins: number | null
} {
  let startTime: { hour: number; minute: number } | null = null
  let endTime: { hour: number; minute: number } | null = null
  let durationMins: number | null = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]

    const range = parseTimeRange(t)
    if (range) {
      startTime = range.start
      endTime = range.end
      tokens[i] = '__time__'
      break
    }

    const combined = next && /^(am|pm)$/i.test(next) ? t + next : t
    const parsed = parseTime(combined)
    if (parsed) {
      startTime = parsed
      tokens[i] = '__time__'
      if (combined !== t) tokens[i + 1] = '__meridiem__'

      const afterIdx = combined !== t ? i + 2 : i + 1
      if (afterIdx < tokens.length) {
        const dur = parseDuration(tokens[afterIdx])
        if (dur) {
          durationMins = dur
          tokens[afterIdx] = '__dur__'
        }
      }
      break
    }
  }

  return { startTime, endTime, durationMins }
}

function parseUntilDate(tokens: string[]): { ymd: string; untilIdx: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'until') {
      // "until may 30" or "until may 30 2026"
      const monthToken = tokens[i + 1]
      const dayToken = tokens[i + 2]
      if (monthToken && MONTH_MAP[monthToken] !== undefined && dayToken) {
        const day = parseInt(dayToken)
        if (!isNaN(day)) {
          const yearToken = tokens[i + 3]
          const year = yearToken && /^\d{4}$/.test(yearToken)
            ? parseInt(yearToken)
            : new Date().getFullYear()
          const d = new Date(year, MONTH_MAP[monthToken], day)
          return { ymd: d.toISOString().slice(0, 10), untilIdx: i }
        }
      }
    }
  }
  return null
}

// Words used only to infer type — redundant in the title since type is shown by color/label
const TYPE_KEYWORDS = new Set([
  'research', 'meeting', 'meetings',
  'teaching', 'teach', 'class', 'lecture',
  'seminar', 'colloquium',
  'talk',
  'advising', 'advis',
  'misc',
  'with', // filler word
])

function buildTitle(tokens: string[], originalTokens: string[], extraParts: string[], type: CommitmentType): string {
  const skipWords = new Set([...Object.keys(DAY_MAP), ...Object.keys(MONTH_MAP)])
  // Filter using lowercased tokens but keep original-cased versions
  const titleTokens = tokens
    .map((t, i) => ({ lower: t, orig: originalTokens[i] ?? t }))
    .filter(({ lower: t }) => {
      if (skipWords.has(t)) return false
      if (['__time__', '__meridiem__', '__dur__', '__skip__'].includes(t)) return false
      if (/^(am|pm)$/i.test(t)) return false
      if (/^(every|other|until)$/i.test(t)) return false
      if (/^\d{4}$/.test(t)) return false
      if (TYPE_KEYWORDS.has(t)) return false
      if (parseTime(t)) return false
      if (/^\d{1,2}-\d{1,2}$/.test(t)) return false
      return true
    })
    .map(({ orig }) => orig)
  const parts = [titleTokens.join(' '), ...extraParts].filter(Boolean)
  const raw = parts.join(', ').trim()
  if (raw) return raw

  // Nothing meaningful left — use a type-aware default
  const defaults: Record<CommitmentType, string> = {
    teaching:         'Class',
    research_meeting: 'Research Meeting',
    advising_meeting: 'Advising',
    seminar:          'Seminar',
    talk:             'Talk',
    misc:             'Event',
  }
  return defaults[type]
}

export function parseQuickAdd(input: string): ParsedEvent | null {
  const raw = input.trim()
  if (!raw) return null

  const parts = raw.split(',').map(p => p.trim())
  const tokens = parts[0].toLowerCase().split(/\s+/)
  const originalTokens = parts[0].split(/\s+/) // preserve original casing for title
  const allText = raw.toLowerCase()

  // Detect recurring: starts with "every"
  const isRecurring = tokens[0] === 'every'
  const isBiweekly = isRecurring && tokens[1] === 'other'

  if (isRecurring) {
    // "every mon wed fri 12pm teaching until may 30"
    const daySearchStart = isBiweekly ? 2 : 1

    // Collect all day-of-week tokens
    const daysOfWeek: number[] = []
    for (let i = daySearchStart; i < tokens.length; i++) {
      if (DAY_MAP[tokens[i]] !== undefined) {
        daysOfWeek.push(DAY_MAP[tokens[i]])
        tokens[i] = '__skip__'
      }
    }
    if (daysOfWeek.length === 0) return null

    // Parse "until" end date
    const until = parseUntilDate(tokens)
    if (until) {
      // Mark until tokens as skipped
      tokens[until.untilIdx] = '__skip__'
      tokens[until.untilIdx + 1] = '__skip__'
      tokens[until.untilIdx + 2] = '__skip__'
      if (tokens[until.untilIdx + 3] && /^\d{4}$/.test(tokens[until.untilIdx + 3])) {
        tokens[until.untilIdx + 3] = '__skip__'
      }
    }

    const { startTime, endTime, durationMins } = extractTimeAndDuration(tokens)

    const startHour = startTime?.hour ?? 9
    const startMinute = startTime?.minute ?? 0
    let durMins = 60
    if (endTime) {
      durMins = (endTime.hour * 60 + endTime.minute) - (startHour * 60 + startMinute)
      if (durMins <= 0) durMins = 60
    } else if (durationMins) {
      durMins = durationMins
    }

    // starts_on = next occurrence of the earliest day
    const startsOn = nextWeekday(daysOfWeek[0])

    const recType = inferType(allText, parts.length >= 2)
    return {
      kind: 'recurring',
      title: buildTitle(tokens, originalTokens, parts.slice(1), recType),
      type: recType,
      recurrence: isBiweekly ? 'biweekly' : 'weekly',
      days_of_week: daysOfWeek,
      start_hour: startHour,
      start_minute: startMinute,
      duration_minutes: durMins,
      starts_on: toYMD(startsOn),
      ends_on: until?.ymd,
    }
  }

  // One-off event
  let eventDate: Date | null = null

  for (const t of tokens) {
    if (DAY_MAP[t] !== undefined) {
      eventDate = nextWeekday(DAY_MAP[t])
      break
    }
  }

  if (!eventDate) {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (MONTH_MAP[tokens[i]] !== undefined) {
        const dayMatch = tokens[i + 1].match(/^(\d{1,2})(?:-(\d{1,2}))?$/)
        if (dayMatch) {
          eventDate = new Date(new Date().getFullYear(), MONTH_MAP[tokens[i]], parseInt(dayMatch[1]))
          break
        }
      }
    }
  }

  const { startTime, endTime, durationMins } = extractTimeAndDuration(tokens)

  if (!eventDate) eventDate = new Date()

  const start = new Date(eventDate)
  if (startTime) {
    start.setHours(startTime.hour, startTime.minute, 0, 0)
  } else {
    start.setHours(9, 0, 0, 0)
  }

  const end = new Date(start)
  if (endTime) {
    end.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (durationMins) {
    end.setMinutes(end.getMinutes() + durationMins)
  } else {
    end.setHours(end.getHours() + 1)
  }

  const oneOffType = inferType(allText, parts.length >= 2)
  return {
    kind: 'one-off',
    title: buildTitle(tokens, originalTokens, parts.slice(1), oneOffType),
    type: oneOffType,
    start,
    end,
  }
}
