-- ============================================
-- SEED I18N: Navigation (Page Titles)
-- ============================================
-- Traduções para os títulos das páginas no breadcrumb
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- PAGE TITLES
  -- ============================================
  (NULL, 'pt-BR', 'navigation', 'pageTitle.home', 'Início', 'Título página Início'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.cockpit', 'Operations Cockpit', 'Título página Cockpit'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.inbox', 'Universal Inbox', 'Título página Inbox'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.devices', 'IoT & Physical Devices', 'Título página Devices'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.agents', 'Agents & Workflows', 'Título página Agents'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.playground', 'Agent Playground', 'Título página Playground'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.flows', 'Flows', 'Título página Flows'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.knowledge', 'Knowledge Base', 'Título página Knowledge'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.governance', 'Governança e Segurança', 'Título página Governance'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.insights', 'Insights & Data', 'Título página Insights'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.configuration', 'Platform Configuration', 'Título página Configuration'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.profile', 'User Profile', 'Título página Profile'),
  (NULL, 'pt-BR', 'navigation', 'pageTitle.agentConfig', 'Agent Configuration', 'Título página Agent Config'),
  
  (NULL, 'en-US', 'navigation', 'pageTitle.home', 'Home', 'Home page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.cockpit', 'Operations Cockpit', 'Cockpit page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.inbox', 'Universal Inbox', 'Inbox page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.devices', 'IoT & Physical Devices', 'Devices page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.agents', 'Agents & Workflows', 'Agents page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.playground', 'Agent Playground', 'Playground page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.flows', 'Flows', 'Flows page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.knowledge', 'Knowledge Base', 'Knowledge page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.governance', 'AI Governance', 'Governance page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.insights', 'Insights & Data', 'Insights page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.configuration', 'Platform Configuration', 'Configuration page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.profile', 'User Profile', 'Profile page title'),
  (NULL, 'en-US', 'navigation', 'pageTitle.agentConfig', 'Agent Configuration', 'Agent Config page title'),
  
  (NULL, 'es-ES', 'navigation', 'pageTitle.home', 'Inicio', 'Título página Inicio'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.cockpit', 'Cockpit de Operaciones', 'Título página Cockpit'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.inbox', 'Bandeja Universal', 'Título página Inbox'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.devices', 'IoT y Dispositivos Físicos', 'Título página Devices'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.agents', 'Agentes y Flujos de Trabajo', 'Título página Agents'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.playground', 'Zona de Pruebas de Agentes', 'Título página Playground'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.flows', 'Flujos', 'Título página Flows'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.knowledge', 'Base de Conocimiento', 'Título página Knowledge'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.governance', 'Gobernanza y Seguridad', 'Título página Governance'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.insights', 'Insights y Datos', 'Título página Insights'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.configuration', 'Configuración de Plataforma', 'Título página Configuration'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.profile', 'Perfil de Usuario', 'Título página Profile'),
  (NULL, 'es-ES', 'navigation', 'pageTitle.agentConfig', 'Configuración de Agente', 'Título página Agent Config')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
