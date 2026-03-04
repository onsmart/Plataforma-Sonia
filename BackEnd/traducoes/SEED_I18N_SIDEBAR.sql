-- ============================================
-- SEED I18N: Sidebar (Menu Items and Labels)
-- ============================================
-- Traduções para os itens do menu da sidebar
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- GROUPS (Labels dos grupos de menu)
  -- ============================================
  (NULL, 'pt-BR', 'sidebar', 'groups.operations', 'Operations', 'Label do grupo Operations'),
  (NULL, 'pt-BR', 'sidebar', 'groups.aiStrategy', 'AI Strategy', 'Label do grupo AI Strategy'),
  (NULL, 'pt-BR', 'sidebar', 'groups.intelligence', 'Intelligence', 'Label do grupo Intelligence'),
  (NULL, 'pt-BR', 'sidebar', 'groups.admin', 'Admin', 'Label do grupo Admin'),
  
  (NULL, 'en-US', 'sidebar', 'groups.operations', 'Operations', 'Operations group label'),
  (NULL, 'en-US', 'sidebar', 'groups.aiStrategy', 'AI Strategy', 'AI Strategy group label'),
  (NULL, 'en-US', 'sidebar', 'groups.intelligence', 'Intelligence', 'Intelligence group label'),
  (NULL, 'en-US', 'sidebar', 'groups.admin', 'Admin', 'Admin group label'),
  
  (NULL, 'es-ES', 'sidebar', 'groups.operations', 'Operaciones', 'Label del grupo Operations'),
  (NULL, 'es-ES', 'sidebar', 'groups.aiStrategy', 'Estrategia IA', 'Label del grupo AI Strategy'),
  (NULL, 'es-ES', 'sidebar', 'groups.intelligence', 'Inteligencia', 'Label del grupo Intelligence'),
  (NULL, 'es-ES', 'sidebar', 'groups.admin', 'Administración', 'Label del grupo Admin'),
  
  -- ============================================
  -- MENU ITEMS (Itens do menu)
  -- ============================================
  (NULL, 'pt-BR', 'sidebar', 'menuItems.cockpit', 'Cockpit', 'Item do menu Cockpit'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.inbox', 'Universal Inbox', 'Item do menu Inbox'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.playground', 'Playground', 'Item do menu Playground'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.agents', 'Agents Hub', 'Item do menu Agents Hub'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.flows', 'Lógica de Fluxos', 'Item do menu Flows'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.governance', 'Governança', 'Item do menu Governance'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.knowledge', 'Knowledge Base', 'Item do menu Knowledge Base'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.insights', 'Insights & Data', 'Item do menu Insights'),
  (NULL, 'pt-BR', 'sidebar', 'menuItems.configuration', 'Configuration', 'Item do menu Configuration'),
  
  (NULL, 'en-US', 'sidebar', 'menuItems.cockpit', 'Cockpit', 'Cockpit menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.inbox', 'Universal Inbox', 'Inbox menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.playground', 'Playground', 'Playground menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.agents', 'Agents Hub', 'Agents Hub menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.flows', 'Flow Logic', 'Flows menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.governance', 'Governance', 'Governance menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.knowledge', 'Knowledge Base', 'Knowledge Base menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.insights', 'Insights & Data', 'Insights menu item'),
  (NULL, 'en-US', 'sidebar', 'menuItems.configuration', 'Configuration', 'Configuration menu item'),
  
  (NULL, 'es-ES', 'sidebar', 'menuItems.cockpit', 'Cockpit', 'Item del menú Cockpit'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.inbox', 'Bandeja Universal', 'Item del menú Inbox'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.playground', 'Zona de Pruebas', 'Item del menú Playground'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.agents', 'Centro de Agentes', 'Item del menú Agents Hub'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.flows', 'Lógica de Flujos', 'Item del menú Flows'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.governance', 'Gobernanza', 'Item del menú Governance'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.knowledge', 'Base de Conocimiento', 'Item del menú Knowledge Base'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.insights', 'Insights y Datos', 'Item del menú Insights'),
  (NULL, 'es-ES', 'sidebar', 'menuItems.configuration', 'Configuración', 'Item del menú Configuration'),
  
  -- ============================================
  -- USER MENU (Menu do usuário)
  -- ============================================
  (NULL, 'pt-BR', 'sidebar', 'userMenu.enterprisePlan', 'Enterprise Plan', 'Plano do usuário'),
  (NULL, 'pt-BR', 'sidebar', 'userMenu.profile', 'Profile', 'Item do menu Profile'),
  (NULL, 'pt-BR', 'sidebar', 'userMenu.billing', 'Faturamento', 'Item do menu Billing'),
  (NULL, 'pt-BR', 'sidebar', 'userMenu.logout', 'Logout', 'Item do menu Logout'),
  
  (NULL, 'en-US', 'sidebar', 'userMenu.enterprisePlan', 'Enterprise Plan', 'User plan'),
  (NULL, 'en-US', 'sidebar', 'userMenu.profile', 'Profile', 'Profile menu item'),
  (NULL, 'en-US', 'sidebar', 'userMenu.billing', 'Billing', 'Billing menu item'),
  (NULL, 'en-US', 'sidebar', 'userMenu.logout', 'Logout', 'Logout menu item'),
  
  (NULL, 'es-ES', 'sidebar', 'userMenu.enterprisePlan', 'Plan Empresarial', 'Plan del usuario'),
  (NULL, 'es-ES', 'sidebar', 'userMenu.profile', 'Perfil', 'Item del menú Profile'),
  (NULL, 'es-ES', 'sidebar', 'userMenu.billing', 'Facturación', 'Item del menú Billing'),
  (NULL, 'es-ES', 'sidebar', 'userMenu.logout', 'Cerrar Sesión', 'Item del menú Logout'),
  
  -- ============================================
  -- THEME (Tema)
  -- ============================================
  (NULL, 'pt-BR', 'sidebar', 'theme.label', 'Tema', 'Label do toggle de tema'),
  
  (NULL, 'en-US', 'sidebar', 'theme.label', 'Theme', 'Theme toggle label'),
  
  (NULL, 'es-ES', 'sidebar', 'theme.label', 'Tema', 'Label del toggle de tema')
ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
