import { CalendarEvent } from './types'

export interface LayoutEvent extends CalendarEvent {
  col: number
  numCols: number
}

function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  return new Date(a.start_time) < new Date(b.end_time) &&
         new Date(b.start_time) < new Date(a.end_time)
}

export function layoutDayEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return []

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  // Find connected overlap groups (union-find style)
  const group: number[] = sorted.map((_, i) => i)

  function find(i: number): number {
    while (group[i] !== i) { group[i] = group[group[i]]; i = group[i] }
    return i
  }
  function union(i: number, j: number) {
    const ri = find(i), rj = find(j)
    if (ri !== rj) group[ri] = rj
  }

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (overlaps(sorted[i], sorted[j])) union(i, j)
    }
  }

  // Group indices by root
  const groupMap = new Map<number, number[]>()
  for (let i = 0; i < sorted.length; i++) {
    const root = find(i)
    if (!groupMap.has(root)) groupMap.set(root, [])
    groupMap.get(root)!.push(i)
  }

  const result: LayoutEvent[] = new Array(sorted.length)

  for (const indices of groupMap.values()) {
    // Greedy column assignment within group
    const colEndTimes: number[] = []
    const eventCol: number[] = []

    for (const idx of indices) {
      const evStart = new Date(sorted[idx].start_time).getTime()
      let assigned = -1
      for (let c = 0; c < colEndTimes.length; c++) {
        if (colEndTimes[c] <= evStart) {
          colEndTimes[c] = new Date(sorted[idx].end_time).getTime()
          assigned = c
          break
        }
      }
      if (assigned === -1) {
        assigned = colEndTimes.length
        colEndTimes.push(new Date(sorted[idx].end_time).getTime())
      }
      eventCol[idx] = assigned
    }

    const numCols = colEndTimes.length
    for (const idx of indices) {
      result[idx] = { ...sorted[idx], col: eventCol[idx], numCols }
    }
  }

  return result
}
