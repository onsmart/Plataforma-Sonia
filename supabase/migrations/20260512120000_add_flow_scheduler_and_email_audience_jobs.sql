create table if not exists public.tb_flow_schedule_jobs (
    id uuid primary key default gen_random_uuid(),
    flow_id uuid not null references public.tb_flows(id) on delete cascade,
    user_id uuid null references public.tb_users(id) on delete set null,
    companies_id uuid null references public.tb_companies(id) on delete set null,
    user_email text not null,
    execution_id uuid not null,
    resume_node_id text null,
    scheduled_at timestamptz not null,
    timezone text null,
    status text not null default 'pending',
    trigger_source text null,
    context_json jsonb not null default '{}'::jsonb,
    last_error text null,
    processed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_tb_flow_schedule_jobs_pending
    on public.tb_flow_schedule_jobs (status, scheduled_at);

create table if not exists public.tb_email_audience_jobs (
    id uuid primary key default gen_random_uuid(),
    companies_id uuid null references public.tb_companies(id) on delete set null,
    integrations_id uuid not null,
    flow_id uuid null references public.tb_flows(id) on delete set null,
    execution_id uuid null,
    external_contact_id text null,
    recipient_email text not null,
    recipient_name text null,
    subject text not null,
    text text not null,
    scheduled_at timestamptz not null default now(),
    status text not null default 'pending',
    last_error text null,
    processed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_tb_email_audience_jobs_pending
    on public.tb_email_audience_jobs (status, scheduled_at);
