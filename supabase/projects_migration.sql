-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Research Projects
create table if not exists research_projects (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  notes       text,
  status      text not null default 'problem' check (status in ('problem', 'ideas', 'roadmap', 'details', 'writing', 'submitted', 'revision', 'published')),
  created_at  timestamptz default now()
);

alter table research_projects enable row level security;
create policy "Allow all" on research_projects for all using (true) with check (true);

-- Project Todos
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

-- Paper Submissions log
create table if not exists paper_submissions (
  id              uuid default gen_random_uuid() primary key,
  project_id      uuid not null references research_projects(id) on delete cascade,
  journal         text not null,
  submitted_date  date not null,
  outcome         text not null default 'pending' check (outcome in ('pending', 'revision', 'accepted', 'rejected')),
  created_at      timestamptz default now()
);

alter table paper_submissions enable row level security;
create policy "Allow all" on paper_submissions for all using (true) with check (true);

-- Link events and recurring_events to projects (nullable FK)
alter table events add column if not exists project_id uuid references research_projects(id) on delete set null;
alter table recurring_events add column if not exists project_id uuid references research_projects(id) on delete set null;
