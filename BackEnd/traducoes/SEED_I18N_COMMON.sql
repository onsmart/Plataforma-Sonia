-- ============================================
-- SEED I18N: common (app shell, language selector)
-- ============================================
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  (NULL, 'pt-BR', 'common', 'app.platformName', 'SONIA Platform', 'Nome da plataforma no breadcrumb'),
  (NULL, 'pt-BR', 'common', 'app.loadingTranslations', 'Carregando traduções…', 'Overlay ao trocar idioma'),
  (NULL, 'pt-BR', 'common', 'language.search', 'Buscar idioma…', 'Placeholder seletor de idioma'),
  (NULL, 'pt-BR', 'common', 'language.empty', 'Nenhum idioma encontrado.', 'Seletor de idioma vazio'),
  (NULL, 'pt-BR', 'common', 'language.selectAria', 'Selecionar idioma', 'Aria label seletor'),

  (NULL, 'en-US', 'common', 'app.platformName', 'SONIA Platform', 'Platform name in breadcrumb'),
  (NULL, 'en-US', 'common', 'app.loadingTranslations', 'Loading translations…', 'Language switch overlay'),
  (NULL, 'en-US', 'common', 'language.search', 'Search language…', 'Language selector placeholder'),
  (NULL, 'en-US', 'common', 'language.empty', 'No language found.', 'Empty language selector'),
  (NULL, 'en-US', 'common', 'language.selectAria', 'Select language', 'Language selector aria label'),

  (NULL, 'es-ES', 'common', 'app.platformName', 'Plataforma SONIA', 'Nombre plataforma breadcrumb'),
  (NULL, 'es-ES', 'common', 'app.loadingTranslations', 'Cargando traducciones…', 'Overlay cambio idioma'),
  (NULL, 'es-ES', 'common', 'language.search', 'Buscar idioma…', 'Placeholder selector idioma'),
  (NULL, 'es-ES', 'common', 'language.empty', 'No se encontró ningún idioma.', 'Selector vacío'),
  (NULL, 'es-ES', 'common', 'language.selectAria', 'Seleccionar idioma', 'Aria selector idioma')

ON CONFLICT (companies_id, language, namespace, key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = timezone('utc', now());
