-- Complete schema for a fresh install.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- (If migrating from an existing Supabase project, use the individual migration
--  files in this directory instead.)

-- Research projects (created first — other tables reference it)
create table if not exists research_projects (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  stage_notes jsonb not null default '{}',
  status      text[] not null default '{problem}',
  created_at  timestamptz default now()
);
alter table research_projects enable row level security;
create policy "Allow all" on research_projects for all using (true) with check (true);

-- One-off calendar events
create table if not exists events (
  id         uuid default gen_random_uuid() primary key,
  title      text not null,
  type       text not null check (type in ('teaching', 'research_meeting', 'advising_meeting', 'seminar', 'talk', 'misc')),
  start_time timestamptz not null,
  end_time   timestamptz not null,
  notes      text,
  project_id uuid references research_projects(id) on delete set null,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Allow all" on events for all using (true) with check (true);

-- Recurring event templates (expanded into instances by the app)
create table if not exists recurring_events (
  id               uuid default gen_random_uuid() primary key,
  title            text not null,
  type             text not null check (type in ('teaching', 'research_meeting', 'advising_meeting', 'seminar', 'talk', 'misc')),
  start_hour       integer not null,
  start_minute     integer not null,
  duration_minutes integer not null,
  recurrence       text not null check (recurrence in ('weekly', 'biweekly')),
  day_of_week      integer not null, -- 0=Sun ... 6=Sat
  starts_on        text not null,    -- YYYY-MM-DD
  ends_on          text,             -- YYYY-MM-DD, null = no end
  notes            text,
  project_id       uuid references research_projects(id) on delete set null,
  created_at       timestamptz default now()
);
alter table recurring_events enable row level security;
create policy "Allow all" on recurring_events for all using (true) with check (true);

-- Deleted instances of recurring events
create table if not exists recurring_exceptions (
  recurring_event_id uuid not null references recurring_events(id) on delete cascade,
  exception_date     text not null, -- YYYY-MM-DD
  primary key (recurring_event_id, exception_date)
);
alter table recurring_exceptions enable row level security;
create policy "Allow all" on recurring_exceptions for all using (true) with check (true);

-- Per-project task list
create table if not exists project_todos (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid not null references research_projects(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz default now()
);
alter table project_todos enable row level security;
create policy "Allow all" on project_todos for all using (true) with check (true);

-- Submission history for a project
create table if not exists paper_submissions (
  id             uuid default gen_random_uuid() primary key,
  project_id     uuid not null references research_projects(id) on delete cascade,
  journal        text not null,
  submitted_date date not null,
  outcome        text not null default 'pending' check (outcome in ('pending', 'revision', 'accepted', 'rejected')),
  created_at     timestamptz default now()
);
alter table paper_submissions enable row level security;
create policy "Allow all" on paper_submissions for all using (true) with check (true);

-- Travel (conferences, workshops, etc.)
create table if not exists trips (
  id                      uuid default gen_random_uuid() primary key,
  type                    text not null check (type in ('conference', 'workshop', 'seminar', 'research')),
  name                    text,
  place                   text not null,
  arrival_date            date not null,
  departure_date          date not null,
  giving_talk             boolean not null default true,
  project_id              uuid references research_projects(id) on delete set null,
  reimbursement_submitted boolean not null default false,
  reimbursement_received  boolean not null default false,
  notes                   text,
  created_at              timestamptz default now()
);
alter table trips enable row level security;
create policy "Allow all" on trips for all using (true) with check (true);

-- Per-trip task list (packing, logistics, etc.)
create table if not exists trip_todos (
  id          uuid default gen_random_uuid() primary key,
  trip_id     uuid not null references trips(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz default now()
);
alter table trip_todos enable row level security;
create policy "Allow all" on trip_todos for all using (true) with check (true);

-- Talk details for a trip (one per trip)
create table if not exists trip_talks (
  id               uuid default gen_random_uuid() primary key,
  trip_id          uuid not null unique references trips(id) on delete cascade,
  title            text,
  talk_date        date,
  talk_time        time,
  duration_minutes integer not null default 60,
  created_at       timestamptz default now()
);
alter table trip_talks enable row level security;
create policy "Allow all" on trip_talks for all using (true) with check (true);
