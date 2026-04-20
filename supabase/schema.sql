-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists events (
  id         uuid default gen_random_uuid() primary key,
  title      text not null,
  type       text not null check (type in ('teaching', 'research_meeting', 'advising_meeting', 'seminar', 'talk', 'misc')),
  start_time timestamptz not null,
  end_time   timestamptz not null,
  notes      text,
  created_at timestamptz default now()
);

-- Allow public read/write (since this is a personal app with no auth yet)
alter table events enable row level security;

create policy "Allow all" on events for all using (true) with check (true);
