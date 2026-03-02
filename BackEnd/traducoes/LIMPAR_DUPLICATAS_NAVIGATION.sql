-- ============================================
-- LIMPEZA: Remover traduções duplicadas do namespace navigation
-- ============================================
-- Este script remove traduções duplicadas, mantendo apenas a mais recente
-- e corrige especificamente a tradução de governance para pt-BR

-- 1. Primeiro, vamos verificar duplicatas ANTES da limpeza
SELECT 
  language,
  key,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ') as ids,
  STRING_AGG(value, ' | ') as values
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 2. Deletar TODAS as entradas duplicadas de pageTitle.governance para pt-BR
-- (vamos deletar todas e inserir apenas uma correta)
DELETE FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND language = 'pt-BR'
  AND key = 'pageTitle.governance';

-- 3. Inserir apenas UMA entrada correta de governance para pt-BR
INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES 
  (NULL, 'pt-BR', 'navigation', 'pageTitle.governance', 'Governança e Segurança', 'Título página Governance');

-- 4. Para outras duplicatas no namespace navigation, manter apenas a entrada mais recente
-- Deletar duplicatas mantendo apenas a mais recente (updated_at mais recente)
-- Usar uma abordagem que trata NULL corretamente
WITH ranked_translations AS (
  SELECT 
    id,
    companies_id,
    language,
    namespace,
    key,
    ROW_NUMBER() OVER (
      PARTITION BY 
        companies_id,  -- NULL será agrupado corretamente
        language, 
        namespace, 
        key 
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
  FROM public.tb_i18n_translations
  WHERE namespace = 'navigation'
)
DELETE FROM public.tb_i18n_translations
WHERE id IN (
  SELECT id 
  FROM ranked_translations 
  WHERE rn > 1
);

-- 5. Verificar resultado final - não deve haver duplicatas
SELECT 
  language,
  key,
  COUNT(*) as total
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 6. Mostrar todas as traduções de governance para verificar
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
