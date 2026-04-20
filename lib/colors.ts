import { CommitmentType } from './types'

export const TYPE_COLORS: Record<CommitmentType, { bg: string; text: string; border: string; dot: string }> = {
  teaching:         { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  research_meeting: { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  dot: 'bg-green-500' },
  advising_meeting: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  seminar:          { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  talk:             { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    dot: 'bg-red-500' },
  misc:             { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   dot: 'bg-gray-400' },
}

export const TYPE_LABELS: Record<CommitmentType, string> = {
  teaching:         'Teaching',
  research_meeting: 'Research Meeting',
  advising_meeting: 'Advising',
  seminar:          'Seminar',
  talk:             'Talk',
  misc:             'Misc',
}
