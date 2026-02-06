-- ============================================
-- SCRIPT DE TESTE: Verificar eventos agent_blocked
-- ============================================
-- Execute este script no Supabase SQL Editor para verificar se os eventos estão sendo salvos
-- e se a função está retornando corretamente
-- ============================================

-- 1. Verificar se existem eventos agent_blocked na tabela
SELECT 
  id,
  event_type,
  level,
  message,
  user_id,
  agent_id,
  metadata,
  impact_level,
  created_at
FROM public.tb_system_events
WHERE event_type = 'agent_blocked'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar se a função está retornando os eventos
-- Substitua 'seu-email@exemplo.com' pelo email do usuário que você está testando
SELECT * FROM sp_get_fallbacks_by_email('seu-email@exemplo.com')
WHERE event_type = 'agent_blocked'
ORDER BY created_at DESC;

-- 3. Verificar a contagem
-- Substitua 'seu-email@exemplo.com' pelo email do usuário que você está testando
SELECT sp_count_fallbacks_by_email('seu-email@exemplo.com') as total_fallbacks;

-- 4. Verificar se o user_id está correto nos eventos
SELECT 
  e.id,
  e.event_type,
  e.user_id,
  u.email,
  e.message,
  e.created_at
FROM public.tb_system_events e
LEFT JOIN public.tb_users u ON e.user_id = u.id
WHERE e.event_type = 'agent_blocked'
ORDER BY e.created_at DESC
LIMIT 10;
