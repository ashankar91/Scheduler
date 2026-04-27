-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

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

-- One talk per trip (unique constraint enables upsert)
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
