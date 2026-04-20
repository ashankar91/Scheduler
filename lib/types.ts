export type CommitmentType =
  | 'teaching'
  | 'research_meeting'
  | 'advising_meeting'
  | 'seminar'
  | 'talk'
  | 'misc'

export type RecurrenceType = 'weekly' | 'biweekly'

// One-off event stored in DB
export interface Event {
  id: string
  title: string
  type: CommitmentType
  start_time: string // ISO 8601
  end_time: string   // ISO 8601
  notes?: string
  created_at?: string
}

// Recurring event template stored in DB
export interface RecurringEvent {
  id: string
  title: string
  type: CommitmentType
  start_hour: number
  start_minute: number
  duration_minutes: number
  recurrence: RecurrenceType
  day_of_week: number // 0=Sun, 1=Mon, ..., 6=Sat
  starts_on: string   // YYYY-MM-DD
  ends_on?: string | null
  notes?: string
  created_at?: string
}

// Unified display type used by the calendar
export interface CalendarEvent {
  id: string       // for recurring instances: "r:{recurringId}:{YYYY-MM-DD}"
  title: string
  type: CommitmentType
  start_time: string
  end_time: string
  notes?: string
  recurring_event_id?: string  // set if this is a recurring instance
  instance_date?: string       // YYYY-MM-DD, set if recurring instance
}
