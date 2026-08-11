-- Job Application Bot — initial schema
-- Run this once against your Supabase project (SQL editor, or via the Supabase MCP connector).

create extension if not exists pgcrypto;

create table if not exists system_state (
  id int primary key default 1,
  status text not null default 'active' check (status in ('active','paused')),
  updated_at timestamptz not null default now()
);
insert into system_state (id, status) values (1, 'active') on conflict (id) do nothing;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,                -- 'himalayas' | 'remoteok' | 'wwr'
  source_job_id text not null,         -- source's own id/guid, for de-duping
  title text not null,
  company text not null,
  description text,
  apply_url text,
  location_restrictions text[],        -- countries the posting restricts to (empty/null = worldwide)
  worldwide boolean default false,
  requires_us_auth boolean default false,  -- true if text screen flagged US-authorization language
  category text,
  ats_type text,                       -- 'greenhouse' | 'lever' | 'ashby' | 'other' | null
  discovered_at timestamptz not null default now(),
  unique (source, source_job_id)
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) unique,
  status text not null default 'pending'
    check (status in ('pending','tailored','submitted','failed','skipped_manual_ats')),
  tailored_resume_summary text,
  tailored_note text,
  fail_reason text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_applications_status on applications(status);
create index if not exists idx_jobs_discovered_at on jobs(discovered_at);
