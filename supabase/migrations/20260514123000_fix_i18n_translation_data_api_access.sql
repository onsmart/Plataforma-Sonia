do $$
begin
  if to_regclass('public.tb_i18n_translations') is not null then
    grant select on table public.tb_i18n_translations to anon, authenticated;
    grant all on table public.tb_i18n_translations to service_role;

    alter table public.tb_i18n_translations enable row level security;

    drop policy if exists "i18n active global translations are readable" on public.tb_i18n_translations;
    drop policy if exists "i18n active company translations are readable" on public.tb_i18n_translations;

    create policy "i18n active global translations are readable"
      on public.tb_i18n_translations
      for select
      to anon, authenticated
      using (
        is_active = true
        and companies_id is null
      );

    create policy "i18n active company translations are readable"
      on public.tb_i18n_translations
      for select
      to authenticated
      using (
        is_active = true
        and (
          companies_id is null
          or exists (
            select 1
            from public.tb_company_users cu
            where cu.companies_id = tb_i18n_translations.companies_id
              and cu.user_id = auth.uid()
          )
        )
      );
  end if;
end;
$$;
