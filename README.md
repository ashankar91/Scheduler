# Scheduler

A personal academic schedule app for managing your calendar, research projects, and travel. Built with Next.js and Supabase.

## Features

- **Calendar** — week/day view, one-off and recurring events, color-coded by type
- **Commitments** — list view of all upcoming events
- **Research Projects** — track projects through stages (problem → published), per-stage notes, todos, submission history
- **Travel** — trip tracker with talk details, reimbursement status, and per-trip todo lists

## Setting up your own instance

### 1. Database (Supabase)

1. Create a free account at [supabase.com](https://supabase.com) and start a new project
2. Go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it
3. Copy your **Project URL** and **anon public key** from **Settings → API**

### 2. Deploy (Vercel)

1. Fork this repo to your own GitHub account
2. Create a free account at [vercel.com](https://vercel.com) and click **Add New Project**
3. Import your forked repo
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
5. Deploy — Vercel builds and hosts it automatically

### 3. Keep Supabase alive (free tier)

Supabase pauses free projects after a week of inactivity. This repo includes a `vercel.json` that runs a daily cron job to ping the database and prevent that. It fires automatically once deployed — no extra setup needed. You can verify it's registered in **Vercel → Settings → Cron Jobs**.

## Local development

```bash
cp .env.local.example .env.local
# fill in your Supabase URL and anon key

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (Postgres)
- [Tailwind CSS](https://tailwindcss.com)
- [Vercel](https://vercel.com) (hosting + cron)
