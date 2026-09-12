#!/usr/bin/env node
// Add a trip (conference/workshop/seminar/colloquium/research visit), mirroring
// the same fields and defaults as the "+ New" form on the Travel page
// (app/travel/travel-client.tsx).
//
// Usage:
//   node scripts/add-trip.mjs --place "Boston" --arrival 2026-10-01 --departure 2026-10-05
//   node scripts/add-trip.mjs --type workshop --place "Remote" --name "NT Seminar" --arrival 2026-11-02 --no-talk
//   node scripts/add-trip.mjs --place "Zurich" --arrival 2026-12-01 --departure 2026-12-03 --project "Some Project" --notes "invited talk"
//   node scripts/add-trip.mjs --dry-run --place "Boston" --arrival 2026-10-01

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const VALID_TYPES = ['conference', 'workshop', 'seminar', 'colloquium', 'research']

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

function parseArgs(argv) {
  const opts = {
    type: 'conference',
    name: null,
    place: null,
    arrival: null,
    departure: null,
    givingTalk: true,
    project: null,
    notes: null,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--type') opts.type = argv[++i]
    else if (a === '--name') opts.name = argv[++i]
    else if (a === '--place') opts.place = argv[++i]
    else if (a === '--arrival') opts.arrival = argv[++i]
    else if (a === '--departure') opts.departure = argv[++i]
    else if (a === '--no-talk') opts.givingTalk = false
    else if (a === '--project') opts.project = argv[++i]
    else if (a === '--notes') opts.notes = argv[++i]
    else if (a === '--dry-run') opts.dryRun = true
    else {
      console.error(`Unrecognized argument: ${a}`)
      process.exit(1)
    }
  }
  return opts
}

function usageAndExit(msg) {
  if (msg) console.error(msg + '\n')
  console.error(`Usage: node scripts/add-trip.mjs --place "<city/venue>" --arrival YYYY-MM-DD [--departure YYYY-MM-DD] [--type ${VALID_TYPES.join('|')}] [--name "..."] [--no-talk] [--project "<title>"] [--notes "..."] [--dry-run]`)
  process.exit(1)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.place || !opts.place.trim()) usageAndExit('--place is required')
  if (!opts.arrival || !/^\d{4}-\d{2}-\d{2}$/.test(opts.arrival)) usageAndExit('--arrival YYYY-MM-DD is required')
  if (!opts.departure) opts.departure = opts.arrival
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.departure)) usageAndExit('--departure must be YYYY-MM-DD')
  if (opts.departure < opts.arrival) usageAndExit('--departure cannot be before --arrival')
  if (!VALID_TYPES.includes(opts.type)) usageAndExit(`--type must be one of: ${VALID_TYPES.join(', ')}`)

  const env = loadEnvLocal()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  let projectId = null
  if (opts.project) {
    const { data, error } = await supabase.from('research_projects').select('id, title')
    if (error) throw error
    const matches = data.filter(p => p.title.toLowerCase().includes(opts.project.toLowerCase()))
    if (matches.length === 0) usageAndExit(`No project matches "${opts.project}". Existing: ${data.map(p => p.title).join(', ') || '(none)'}`)
    if (matches.length > 1) usageAndExit(`"${opts.project}" matches multiple projects: ${matches.map(p => p.title).join(', ')} — be more specific`)
    projectId = matches[0].id
  }

  const row = {
    type: opts.type,
    name: opts.name?.trim() || null,
    place: opts.place.trim(),
    arrival_date: opts.arrival,
    departure_date: opts.departure,
    giving_talk: opts.givingTalk,
    project_id: projectId,
    reimbursement_submitted: false,
    reimbursement_received: false,
    notes: opts.notes || null,
  }

  console.log('Trip:', JSON.stringify(row, null, 2))

  if (opts.dryRun) {
    console.log('(dry run — nothing was saved)')
    return
  }

  const { error } = await supabase.from('trips').insert(row)
  if (error) throw error
  console.log(`Added trip to ${row.place} (${row.arrival_date} – ${row.departure_date})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
