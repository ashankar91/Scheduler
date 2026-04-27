import { CommitmentType, TripType } from './types'

export const TYPE_COLORS: Record<CommitmentType, { bg: string; text: string; border: string; dot: string }> = {
  teaching:         { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  research_meeting: { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  dot: 'bg-green-500' },
  advising_meeting: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  seminar:          { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  talk:             { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    dot: 'bg-red-500' },
  misc:             { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   dot: 'bg-gray-400' },
}

export const TRIP_STYLES: Record<TripType, { pill: string; banner: string; dot: string; label: string }> = {
  conference: { pill: 'bg-blue-100 text-blue-700 border-blue-200',          banner: 'bg-blue-500 text-white',     dot: 'bg-blue-500',    label: 'Conference'     },
  workshop:   { pill: 'bg-teal-100 text-teal-700 border-teal-200',          banner: 'bg-teal-600 text-white',     dot: 'bg-teal-500',    label: 'Workshop'       },
  seminar:    { pill: 'bg-violet-100 text-violet-700 border-violet-200',    banner: 'bg-violet-500 text-white',   dot: 'bg-violet-500',  label: 'Seminar'        },
  research:   { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', banner: 'bg-emerald-600 text-white',  dot: 'bg-emerald-500', label: 'Research Visit' },
}

export const TYPE_LABELS: Record<CommitmentType, string> = {
  teaching:         'Teaching',
  research_meeting: 'Research Meeting',
  advising_meeting: 'Advising',
  seminar:          'Seminar',
  talk:             'Talk',
  misc:             'Misc',
}
