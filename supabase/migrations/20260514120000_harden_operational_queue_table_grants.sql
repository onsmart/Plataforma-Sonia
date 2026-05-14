do $$
declare
  table_name text;
  backend_only_tables text[] := array[
    'tb_flow_schedule_jobs',
    'tb_email_audience_jobs',
    'tb_email_integration_settings',
    'tb_whatsapp_campaigns',
    'tb_whatsapp_campaign_jobs',
    'tb_whatsapp_integration_feature_flags',
    'tb_whatsapp_message_events',
    'tb_whatsapp_templates',
    'tb_whatsapp_pricing_schedule'
  ];
begin
  foreach table_name in array backend_only_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
    end if;
  end loop;
end;
$$;
