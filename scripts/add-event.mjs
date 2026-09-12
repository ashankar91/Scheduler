#!/usr/bin/env node
// Add a calendar event (one-off or recurring) from a plain-English description,
// using the exact same parser the browser's QuickAdd bar uses (lib/parseQuickAdd.ts)
// so results are guaranteed to match what typing it in the app would produce.
//
// Usage:
//   node scripts/add-event.mjs "tue 2pm-4pm talk"
//   node scripts/add-event.mjs "every sun 10:30am 90m research, AI Safety"
//   node scripts/add-event.mjs --notes "room 204" "wed 9am teaching"
//   node scripts/add-event.mjs --dry-run "every mon wed fri 9am teaching until may 30"

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

function compileParser() {
  const outDir = mkdtempSync(path.join(tmpdir(), 'add-event-'))
  execFileSync(
    path.join(root, 'node_modules/.bin/tsc'),
    [
      path.join(root, 'lib/parseQuickAdd.ts'),
      path.join(root, 'lib/types.ts'),
      '--module', 'commonjs',
      '--target', 'es2020',
      '--outDir', outDir,
      '--esModuleInterop',
      '--skipLibCheck',
    ],
    { stdio: 'inherit' },
  )
  return outDir
}

function parseArgs(argv) {
  let dryRun = false
  let notes = null
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true
    else if (argv[i] === '--notes') notes = argv[++i]
    else rest.push(argv[i])
  }
  return { dryRun, notes, text: rest.join(' ') }
}

async function main() {
  const { dryRun, notes, text } = parseArgs(process.argv.slice(2))
  if (!text.trim()) {
    console.error('Usage: node scripts/add-event.mjs [--dry-run] [--notes "..."] "<event description>"')
    process.exit(1)
  }

  const outDir = compileParser()
  let parseQuickAdd
  try {
    ;({ parseQuickAdd } = await import(path.join(outDir, 'parseQuickAdd.js')))
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }

  const parsed = parseQuickAdd(text)
  if (!parsed) {
    console.error(`Could not parse: "${text}"`)
    console.error('Try a format like: "tue 2pm-4pm talk" or "every tue 10am teaching"')
    process.exit(1)
  }

  console.log('Parsed:', JSON.stringify(parsed, null, 2))

  if (dryRun) {
    console.log('(dry run — nothing was saved)')
    return
  }

  const env = loadEnvLocal()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (parsed.kind === 'one-off') {
    const { error } = await supabase.from('events').insert({
      title: parsed.title,
      type: parsed.type,
      start_time: parsed.start.toISOString(),
      end_time: parsed.end.toISOString(),
      notes: notes || null,
    })
    if (error) throw error
    console.log(`Added "${parsed.title}" on ${parsed.start.toLocaleString()}`)
  } else {
    const rows = parsed.days_of_week.map(dow => ({
      title: parsed.title,
      type: parsed.type,
      recurrence: parsed.recurrence,
      day_of_week: dow,
      start_hour: parsed.start_hour,
      start_minute: parsed.start_minute,
      duration_minutes: parsed.duration_minutes,
      starts_on: parsed.starts_on,
      ends_on: parsed.ends_on ?? null,
      notes: notes || null,
    }))
    const { error } = await supabase.from('recurring_events').insert(rows)
    if (error) throw error
    console.log(`Added "${parsed.title}" (${parsed.recurrence}), starting ${parsed.starts_on}${parsed.ends_on ? ` until ${parsed.ends_on}` : ''}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
