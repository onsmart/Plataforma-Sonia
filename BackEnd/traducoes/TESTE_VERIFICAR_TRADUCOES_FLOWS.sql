-- ============================================
-- TESTE: Verificar traduções do Flows
-- ============================================
-- Execute este script para verificar se as traduções foram inseridas corretamente
-- ============================================

-- Verificar quantas traduções existem para o namespace 'flows'
SELECT 
  language,
  COUNT(*) as total_traducoes,
  COUNT(DISTINCT key) as chaves_unicas
FROM public.tb_i18n_translations
WHERE namespace = 'flows'
  AND is_active = true
GROUP BY language
ORDER BY language;

-- Verificar algumas traduções específicas
SELECT 
  language,
  namespace,
  key,
  value,
  is_active
FROM public.tb_i18n_translations
WHERE namespace = 'flows'
  AND key IN ('button.blocks', 'button.saveFlow', 'editor.title', 'empty.startCreating')
  AND is_active = true
ORDER BY language, key;

-- Verificar se há traduções globais (companies_id = NULL)
SELECT 
  COUNT(*) as total_globais
FROM public.tb_i18n_translations
WHERE namespace = 'flows'
  AND companies_id IS NULL
  AND is_active = true;

-- Verificar todas as chaves disponíveis para flows
SELECT DISTINCT key
FROM public.tb_i18n_translations
WHERE namespace = 'flows'
  AND is_active = true
ORDER BY key;
