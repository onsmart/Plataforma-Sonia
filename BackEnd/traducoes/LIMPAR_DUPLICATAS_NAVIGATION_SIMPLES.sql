-- ============================================
-- LIMPEZA SIMPLES: Remover traduções duplicadas do namespace navigation
-- ============================================
-- Abordagem mais direta: deletar todas as duplicatas e manter apenas uma

-- 1. Verificar duplicatas ANTES da limpeza
SELECT 
  language,
  key,
  COUNT(*) as total
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key, companies_id
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 2. Para pageTitle.governance em pt-BR: deletar TODAS e inserir apenas uma correta
DELETE FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND language = 'pt-BR'
  AND key = 'pageTitle.governance'
  AND (companies_id IS NULL);

-- Inserir apenas uma entrada correta
INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES 
  (NULL, 'pt-BR', 'navigation', 'pageTitle.governance', 'Governança e Segurança', 'Título página Governance');

-- 3. Para outras duplicatas: deletar todas exceto a mais recente
-- Usar uma CTE para identificar quais IDs manter
WITH keep_ids AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        language, 
        namespace, 
        key,
        companies_id
      ORDER BY 
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) as rn
  FROM public.tb_i18n_translations
  WHERE namespace = 'navigation'
)
DELETE FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
  AND id IN (
    SELECT id FROM keep_ids WHERE rn > 1
  );

-- 4. Verificar resultado final
SELECT 
  language,
  key,
  companies_id,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ') as ids
FROM public.tb_i18n_translations
WHERE namespace = 'navigation'
GROUP BY language, key, companies_id
HAVING COUNT(*) > 1
ORDER BY language, key;

-- 5. Mostrar todas as traduções de governance
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
