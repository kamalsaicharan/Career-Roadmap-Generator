-- CareerPath AI schema. This migration creates new tables only; it does not
-- reset, drop, or modify any existing application tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  education_level text not null default '',
  qualification text,
  desired_profession text not null default '',
  current_skills text[] not null default '{}',
  skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'intermediate', 'advanced', 'mixed')),
  interests text[] not null default '{}',
  learning_style text not null default '',
  study_minutes_per_day integer not null default 60
    check (study_minutes_per_day between 10 and 600),
  target_completion_date date,
  preferred_resources text[] not null default '{}',
  career_objective text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profession text not null,
  objective text not null default '',
  target_completion_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, profession)
);

create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_goal_id uuid,
  career_title text not null,
  estimated_weeks integer not null check (estimated_weeks between 1 and 260),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (career_goal_id, user_id)
    references public.career_goals(id, user_id) on delete set null (career_goal_id)
);

create table if not exists public.roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid not null,
  phase_number integer not null check (phase_number > 0),
  title text not null,
  summary text not null default '',
  duration_weeks integer not null check (duration_weeks > 0),
  weekly_objectives text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (roadmap_id, phase_number),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete cascade
);

create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid not null,
  phase_id uuid not null,
  title text not null,
  description text not null default '',
  phase_number integer not null check (phase_number > 0),
  week_number integer not null check (week_number > 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete cascade,
  foreign key (phase_id, user_id)
    references public.roadmap_phases(id, user_id) on delete cascade
);

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid,
  title text not null,
  provider text not null default '',
  url text not null,
  resource_type text not null default 'course',
  why_relevant text not null default '',
  created_at timestamptz not null default now(),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete cascade
);

create table if not exists public.project_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid,
  title text not null,
  description text not null default '',
  skills text[] not null default '{}',
  project_url text,
  repo_url text,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete set null (roadmap_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid,
  task_id uuid,
  minutes integer not null check (minutes between 1 and 1440),
  note text not null default '',
  started_at timestamptz not null default now(),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete cascade,
  foreign key (task_id, user_id)
    references public.roadmap_tasks(id, user_id) on delete set null (task_id)
);

create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid,
  skill_name text not null,
  score integer not null check (score between 0 and 5),
  max_score integer not null default 5 check (max_score = 5),
  notes text not null default '',
  assessed_at timestamptz not null default now(),
  foreign key (roadmap_id, user_id)
    references public.roadmaps(id, user_id) on delete cascade
);

create table if not exists public.job_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric(5, 2) not null check (score between 0 and 100),
  categories jsonb not null,
  strengths text[] not null default '{}',
  skill_gaps text[] not null default '{}',
  next_actions text[] not null default '{}',
  assessed_at timestamptz not null default now()
);

create index if not exists career_goals_user_status_idx
  on public.career_goals(user_id, status, updated_at desc);
create index if not exists roadmaps_user_created_idx
  on public.roadmaps(user_id, created_at desc);
create index if not exists roadmap_phases_roadmap_idx
  on public.roadmap_phases(roadmap_id, phase_number);
create index if not exists roadmap_tasks_user_roadmap_idx
  on public.roadmap_tasks(user_id, roadmap_id, week_number);
create index if not exists roadmap_tasks_user_status_idx
  on public.roadmap_tasks(user_id, status);
create index if not exists learning_resources_user_idx
  on public.learning_resources(user_id, created_at desc);
create index if not exists project_portfolios_user_idx
  on public.project_portfolios(user_id, updated_at desc);
create index if not exists study_sessions_user_started_idx
  on public.study_sessions(user_id, started_at desc);
create index if not exists skill_assessments_user_idx
  on public.skill_assessments(user_id, assessed_at desc);
create index if not exists job_readiness_user_assessed_idx
  on public.job_readiness_assessments(user_id, assessed_at desc);

alter table public.profiles enable row level security;
alter table public.career_goals enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_phases enable row level security;
alter table public.roadmap_tasks enable row level security;
alter table public.learning_resources enable row level security;
alter table public.project_portfolios enable row level security;
alter table public.study_sessions enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.job_readiness_assessments enable row level security;

drop policy if exists profiles_owner_only on public.profiles;
create policy profiles_owner_only on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists career_goals_owner_only on public.career_goals;
create policy career_goals_owner_only on public.career_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists roadmaps_owner_only on public.roadmaps;
create policy roadmaps_owner_only on public.roadmaps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists roadmap_phases_owner_only on public.roadmap_phases;
create policy roadmap_phases_owner_only on public.roadmap_phases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists roadmap_tasks_owner_only on public.roadmap_tasks;
create policy roadmap_tasks_owner_only on public.roadmap_tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists learning_resources_owner_only on public.learning_resources;
create policy learning_resources_owner_only on public.learning_resources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists project_portfolios_owner_only on public.project_portfolios;
create policy project_portfolios_owner_only on public.project_portfolios
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists study_sessions_owner_only on public.study_sessions;
create policy study_sessions_owner_only on public.study_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists skill_assessments_owner_only on public.skill_assessments;
create policy skill_assessments_owner_only on public.skill_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists job_readiness_owner_only on public.job_readiness_assessments;
create policy job_readiness_owner_only on public.job_readiness_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.save_careerpath_readiness_assessment(
  p_score numeric,
  p_categories jsonb,
  p_strengths text[],
  p_skill_gaps text[],
  p_next_actions text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_assessment_id uuid := gen_random_uuid();
  v_roadmap_id uuid;
  v_category jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select r.id into v_roadmap_id
  from public.roadmaps as r
  where r.user_id = v_user_id
  order by r.created_at desc
  limit 1;

  insert into public.job_readiness_assessments (
    id, user_id, score, categories, strengths, skill_gaps, next_actions
  ) values (
    v_assessment_id, v_user_id, p_score, p_categories, p_strengths, p_skill_gaps, p_next_actions
  );

  for v_category in select value from pg_catalog.jsonb_array_elements(p_categories)
  loop
    insert into public.skill_assessments (
      user_id, roadmap_id, skill_name, score, max_score, notes
    ) values (
      v_user_id,
      v_roadmap_id,
      v_category ->> 'name',
      (v_category ->> 'score')::integer,
      5,
      'Student self-assessment'
    );
  end loop;

  return v_assessment_id;
end;
$$;

create or replace function public.create_careerpath_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_careerpath on auth.users;
create trigger on_auth_user_created_careerpath
  after insert on auth.users
  for each row execute procedure public.create_careerpath_profile();

grant usage on schema public to authenticated;
revoke all on
  public.profiles,
  public.career_goals,
  public.roadmaps,
  public.roadmap_phases,
  public.roadmap_tasks,
  public.learning_resources,
  public.project_portfolios,
  public.study_sessions,
  public.skill_assessments,
  public.job_readiness_assessments
  from anon, public;
grant select, insert, update, delete on
  public.profiles,
  public.career_goals,
  public.roadmaps,
  public.roadmap_phases,
  public.roadmap_tasks,
  public.learning_resources,
  public.project_portfolios,
  public.study_sessions,
  public.skill_assessments,
  public.job_readiness_assessments
  to authenticated;

revoke all on function public.save_careerpath_readiness_assessment(
  numeric, jsonb, text[], text[], text[]
) from public, anon;
grant execute on function public.save_careerpath_readiness_assessment(
  numeric, jsonb, text[], text[], text[]
) to authenticated;
