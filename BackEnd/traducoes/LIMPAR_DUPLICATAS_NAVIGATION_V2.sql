-- ============================================
-- LIMPEZA V2: Remover traduções duplicadas do namespace navigation
-- ============================================
-- Este script remove TODAS as duplicatas e garante apenas uma entrada por chave

-- 1. Verificar duplicatas ANTES da limpeza
SELECT 
  language,
  key,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ') as ids
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key, COALESCE(companies_id::text, 'NULL')
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 2. Deletar TODAS as entradas duplicadas, mantendo apenas a mais recente
-- Usar DELETE com subquery para garantir que apenas uma entrada seja mantida
DELETE FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND id NOT IN (
    SELECT DISTINCT ON (COALESCE(companies_id::text, 'NULL'), language, namespace, key)
      id
    FROM public.tb_i18n_translations
    WHERE namespace = 'navigation'
    ORDER BY 
      COALESCE(companies_id::text, 'NULL'),
      language,
      namespace,
      key,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST,
      id DESC
  );

-- 3. Garantir que a tradução CORRETA de governance para pt-BR existe
-- (deletar todas e inserir apenas uma)
DELETE FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND language = 'pt-BR'
  AND key = 'pageTitle.governance';

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES 
  (NULL, 'pt-BR', 'navigation', 'pageTitle.governance', 'Governança e Segurança', 'Título página Governance');

-- 4. Verificar resultado final - não deve haver duplicatas
SELECT 
  language,
  key,
  COALESCE(companies_id::text, 'NULL') as companies_id,
  COUNT(*) as total
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key, COALESCE(companies_id::text, 'NULL')
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 5. Mostrar todas as traduções de governance para verificar
SELECT 
  id,
  companies_id,
  language,
  key,
  value,
  updated_at
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND key = 'pageTitle.governance'
ORDER BY language, updated_at DESC;
