create table if not exists public.tb_flow_mock_appointments (
    appointment_id uuid primary key,
    provider_key text not null,
    status text not null check (status in ('confirmed', 'cancelled', 'rescheduled')),
    slot_id text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    specialty text not null,
    doctor_name text not null,
    consultation_type text not null,
    unit_name text not null,
    period text not null,
    timezone text not null default 'America/Sao_Paulo',
    mode text not null check (mode in ('presencial', 'online')),
    location text not null,
    patient_name text null,
    patient_email text null,
    patient_phone text null,
    notes text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_tb_flow_mock_appointments_provider_status
    on public.tb_flow_mock_appointments (provider_key, status, starts_at);

