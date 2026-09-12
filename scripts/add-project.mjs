#!/usr/bin/env node
// Add a research project, mirroring app/projects/projects-client.tsx's createProject().
//
// Usage:
//   node scripts/add-project.mjs "Title of the project"
//   node scripts/add-project.mjs --stage roadmap "Title of the project"
//   node scripts/add-project.mjs --dry-run "Title of the project"

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const VALID_STAGES = ['problem', 'ideas', 'roadmap', 'details', 'writing', 'submitted', 'revision', 'published']

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
  let stage = 'problem'
  let dryRun = false
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stage') stage = argv[++i]
    else if (argv[i] === '--dry-run') dryRun = true
    else rest.push(argv[i])
  }
  return { stage, dryRun, title: rest.join(' ').trim() }
}

async function main() {
  const { stage, dryRun, title } = parseArgs(process.argv.slice(2))

  if (!title) {
    console.error('Usage: node scripts/add-project.mjs [--stage <stage>] [--dry-run] "<title>"')
    process.exit(1)
  }
  if (!VALID_STAGES.includes(stage)) {
    console.error(`--stage must be one of: ${VALID_STAGES.join(', ')}`)
    process.exit(1)
  }

  const row = { title, status: [stage], stage_notes: {} }
  console.log('Project:', JSON.stringify(row, null, 2))

  if (dryRun) {
    console.log('(dry run — nothing was saved)')
    return
  }

  const env = loadEnvLocal()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { error } = await supabase.from('research_projects').insert(row)
  if (error) throw error
  console.log(`Added project "${title}" (stage: ${stage})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
