-- ============================================
-- TESTE: Verificar traduções do namespace navigation
-- ============================================
-- Execute este script para verificar se as traduções estão no banco

-- Verificar todas as traduções do namespace navigation
SELECT 
  companies_id,
  language,
  namespace,
  key,
  value,
  description,
  is_active,
  created_at,
  updated_at
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
ORDER BY language, key;

-- Contar traduções por idioma
SELECT 
  language,
  COUNT(*) as total_keys
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language
ORDER BY language;

-- Verificar especificamente a tradução de governance
SELECT 
  language,
  key,
  value
FROM public.tb_i18n_translations
WHERE namespace = 'navigation' 
  AND key = 'pageTitle.governance'
ORDER BY language;
