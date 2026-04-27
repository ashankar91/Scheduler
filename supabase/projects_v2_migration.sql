-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- This updates research_projects: status becomes a text array, notes becomes per-stage jsonb

-- Convert status from single text to text array
alter table research_projects add column if not exists status_new text[] not null default '{problem}';
update research_projects set status_new = array[status] where status_new = '{problem}';
alter table research_projects drop column if exists status;
alter table research_projects rename column status_new to status;

-- Add per-stage notes (replaces the old notes column)
alter table research_projects add column if not exists stage_notes jsonb not null default '{}';
