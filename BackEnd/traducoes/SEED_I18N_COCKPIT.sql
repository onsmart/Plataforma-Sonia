-- ============================================
-- SCRIPT: Inserir traduções do Cockpit
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Traduções do Cockpit em Português (pt-BR)
INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description) VALUES
  -- Header
  (NULL, 'pt-BR', 'cockpit', 'title', 'Cockpit', 'Título principal da página Cockpit'),
  (NULL, 'pt-BR', 'cockpit', 'subtitle', 'Live Status', 'Subtítulo da página Cockpit'),
  
  -- Status do Sistema
  (NULL, 'pt-BR', 'cockpit', 'status.healthy', 'Sistema Saudável', 'Status quando sistema está saudável'),
  (NULL, 'pt-BR', 'cockpit', 'status.stable', 'Sistema Estável', 'Status quando sistema está estável'),
  (NULL, 'pt-BR', 'cockpit', 'status.blocked', 'Sistema Travado', 'Status quando sistema está travado'),
  (NULL, 'pt-BR', 'cockpit', 'status.unstable', 'Instabilidade Detectada', 'Status quando há instabilidade'),
  
  -- Cards de Métricas
  (NULL, 'pt-BR', 'cockpit', 'metrics.interactions', 'Interações', 'Card de interações'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.activeLeads', 'Leads Ativos', 'Card de leads ativos'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.messagesPerMin', 'Msgs / Min', 'Card de mensagens por minuto'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.stuck', 'Travadas', 'Card de conversas travadas'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.fallbacks', 'Fallbacks', 'Card de fallbacks'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.pending', 'Aguardando', 'Card de decisões pendentes'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.taskSuccessRate', 'TAXA DE SUCESSO', 'Card de taxa de sucesso de tarefas'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.averageResponseTime', 'TEMPO MÉDIO RESPOSTA', 'Card de tempo médio de resposta'),
  (NULL, 'pt-BR', 'cockpit', 'metrics.costPerInteraction', 'CUSTO POR INTERAÇÃO', 'Card de custo por interação'),
  
  -- Atividade do Sistema
  (NULL, 'pt-BR', 'cockpit', 'activity.title', 'Atividade do Sistema', 'Título da seção de atividade'),
  (NULL, 'pt-BR', 'cockpit', 'activity.subtitle', 'Logs em tempo real', 'Subtítulo da seção de atividade'),
  (NULL, 'pt-BR', 'cockpit', 'activity.tabs.history', 'Histórico', 'Aba de histórico'),
  (NULL, 'pt-BR', 'cockpit', 'activity.tabs.logs', 'Logs', 'Aba de logs'),
  (NULL, 'pt-BR', 'cockpit', 'activity.tabs.fallbacks', 'Fallbacks', 'Aba de fallbacks'),
  (NULL, 'pt-BR', 'cockpit', 'activity.origin', 'ORIGEM:', 'Label de origem do evento'),
  (NULL, 'pt-BR', 'cockpit', 'activity.autonomous', 'IA Autônoma', 'Texto quando origem é IA autônoma'),
  (NULL, 'pt-BR', 'cockpit', 'activity.actionRequired', 'AÇÃO REQUERIDA', 'Badge de ação requerida'),
  (NULL, 'pt-BR', 'cockpit', 'activity.selectAll', 'Selecionar Tudo', 'Botão para selecionar todos'),
  (NULL, 'pt-BR', 'cockpit', 'activity.selectAllFallbacks', 'Selecionar Todos os Fallbacks', 'Botão para selecionar todos os fallbacks'),
  (NULL, 'pt-BR', 'cockpit', 'activity.itemsSelected', 'Itens selecionados', 'Texto quando há itens selecionados'),
  (NULL, 'pt-BR', 'cockpit', 'activity.readyToClean', 'Pronto para realizar a limpeza do banco', 'Descrição quando há itens selecionados'),
  (NULL, 'pt-BR', 'cockpit', 'activity.cancel', 'Cancelar', 'Botão cancelar'),
  (NULL, 'pt-BR', 'cockpit', 'activity.deleteNow', 'Excluir Agora', 'Botão excluir'),
  (NULL, 'pt-BR', 'cockpit', 'activity.node', 'Node:', 'Label de node'),
  (NULL, 'pt-BR', 'cockpit', 'activity.notAvailable', 'N/A', 'Texto quando não disponível'),
  
  -- IA Workforce
  (NULL, 'pt-BR', 'cockpit', 'workforce.title', 'IA Workforce', 'Título da seção de workforce'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.subtitle', 'Status dos Agentes', 'Subtítulo da seção de workforce'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.status.connected', 'Conectado', 'Status conectado'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.status.paused', 'Pausado', 'Status pausado'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.status.cancelled', 'Cancelado', 'Status cancelado'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.status.inactive', 'Inativo', 'Status inativo'),
  (NULL, 'pt-BR', 'cockpit', 'workforce.status.noStatus', 'Sem Status', 'Status quando não há status'),
  
  -- Mensagens de Erro/Loading
  (NULL, 'pt-BR', 'cockpit', 'errors.loading', 'Erro ao carregar dados', 'Mensagem de erro ao carregar'),
  (NULL, 'pt-BR', 'cockpit', 'errors.tryAgain', 'Tentar Novamente', 'Botão tentar novamente'),
  (NULL, 'pt-BR', 'cockpit', 'errors.auth', 'Erro de autenticação', 'Erro de autenticação'),
  (NULL, 'pt-BR', 'cockpit', 'errors.deleteEvent', 'Erro ao deletar evento', 'Erro ao deletar evento'),
  (NULL, 'pt-BR', 'cockpit', 'errors.deleteLog', 'Erro ao deletar log', 'Erro ao deletar log'),
  (NULL, 'pt-BR', 'cockpit', 'errors.deleteLogs', 'Erro ao deletar logs', 'Erro ao deletar logs'),
  (NULL, 'pt-BR', 'cockpit', 'errors.selectAtLeastOne', 'Selecione pelo menos um evento para deletar', 'Erro ao tentar deletar sem seleção'),
  (NULL, 'pt-BR', 'cockpit', 'errors.selectAtLeastOneLog', 'Selecione pelo menos um log para deletar', 'Erro ao tentar deletar log sem seleção'),
  
  -- Mensagens de Sucesso
  (NULL, 'pt-BR', 'cockpit', 'success.deleted', 'Excluído com sucesso', 'Mensagem de sucesso ao excluir'),
  (NULL, 'pt-BR', 'cockpit', 'success.eventsDeleted', 'evento(s) excluído(s) com sucesso', 'Mensagem de sucesso ao excluir múltiplos eventos'),
  (NULL, 'pt-BR', 'cockpit', 'success.logDeleted', 'Log excluído com sucesso', 'Mensagem de sucesso ao excluir log'),
  (NULL, 'pt-BR', 'cockpit', 'success.logsDeleted', 'log(s) excluído(s) com sucesso', 'Mensagem de sucesso ao excluir múltiplos logs'),
  
  -- Tempo Relativo
  (NULL, 'pt-BR', 'cockpit', 'time.now', 'Agora', 'Texto para tempo atual'),
  (NULL, 'pt-BR', 'cockpit', 'time.secondsAgo', 's atrás', 'Sufixo para segundos atrás'),
  (NULL, 'pt-BR', 'cockpit', 'time.minutesAgo', 'min atrás', 'Sufixo para minutos atrás'),
  (NULL, 'pt-BR', 'cockpit', 'time.hoursAgo', 'h atrás', 'Sufixo para horas atrás'),
  
  -- Tipos de Atividade (Histórico)
  (NULL, 'pt-BR', 'cockpit', 'activity.types.agentsUpdated', 'Agents Alterado', 'Tipo: Agents Alterado'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.flowsUpdated', 'Flows Alterado', 'Tipo: Flows Alterado'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.integrationUpdated', 'Integration Alterada', 'Tipo: Integration Alterada'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.integrationExpired', 'Data expirada', 'Tipo: Data expirada'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.logsCleaned', 'Logs Limpos', 'Tipo: Logs Limpos'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.fallbacksCleaned', 'Fallbacks Limpos', 'Tipo: Fallbacks Limpos'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.workflowNodeExecuted', 'Workflow Node Executado', 'Tipo: Workflow Node Executado'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.workflowExecuted', 'Workflow Executado', 'Tipo: Workflow Executado'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.decisionApproved', 'Decisão Aprovada', 'Tipo: Decisão Aprovada'),
  (NULL, 'pt-BR', 'cockpit', 'activity.types.decisionRejected', 'Decisão Rejeitada', 'Tipo: Decisão Rejeitada'),
  
  -- Mensagens de Logs
  (NULL, 'pt-BR', 'cockpit', 'logs.workflowNodeExecuted', 'Nó do workflow executado', 'Mensagem: workflow node executed'),
  (NULL, 'pt-BR', 'cockpit', 'logs.agentBlocked', 'Agente "{{agent}}" bloqueado - resposta enviada para aprovação no inbox', 'Mensagem: agente bloqueado'),
  (NULL, 'pt-BR', 'cockpit', 'logs.agentBlockedGeneric', 'Agente bloqueado - resposta enviada para aprovação no inbox', 'Mensagem: agente bloqueado genérico'),
  (NULL, 'pt-BR', 'cockpit', 'logs.workflowExecutionCompleted', 'Execução do workflow concluída', 'Mensagem: workflow execution completed'),
  (NULL, 'pt-BR', 'cockpit', 'logs.decisionApproved', 'Decisão aprovada', 'Mensagem: decision approved'),
  (NULL, 'pt-BR', 'cockpit', 'logs.decisionRejected', 'Decisão rejeitada', 'Mensagem: decision rejected'),
  
  -- Mensagens de Fallbacks
  (NULL, 'pt-BR', 'cockpit', 'fallbacks.conditionDefaulted', 'Condição avaliada com {{count}} variável(is) faltando: {{variable}}. Usando resultado padrão: {{defaultValue}}.', 'Mensagem: condição com variáveis faltando'),
  (NULL, 'pt-BR', 'cockpit', 'fallbacks.templateSubstitutionFailed', 'Substituição de template falhou', 'Mensagem: template substitution failed'),
  (NULL, 'pt-BR', 'cockpit', 'fallbacks.inputDefaulted', 'Entrada padrão usada', 'Mensagem: input defaulted'),
  (NULL, 'pt-BR', 'cockpit', 'fallbacks.variableMissing', 'Variável faltando', 'Mensagem: variable missing'),

-- Traduções do Cockpit em Inglês (en-US)
  -- Header
  (NULL, 'en-US', 'cockpit', 'title', 'Cockpit', 'Main title of Cockpit page'),
  (NULL, 'en-US', 'cockpit', 'subtitle', 'Live Status', 'Subtitle of Cockpit page'),
  
  -- Status do Sistema
  (NULL, 'en-US', 'cockpit', 'status.healthy', 'System Healthy', 'Status when system is healthy'),
  (NULL, 'en-US', 'cockpit', 'status.stable', 'System Stable', 'Status when system is stable'),
  (NULL, 'en-US', 'cockpit', 'status.blocked', 'System Blocked', 'Status when system is blocked'),
  (NULL, 'en-US', 'cockpit', 'status.unstable', 'Instability Detected', 'Status when there is instability'),
  
  -- Cards de Métricas
  (NULL, 'en-US', 'cockpit', 'metrics.interactions', 'Interactions', 'Interactions card'),
  (NULL, 'en-US', 'cockpit', 'metrics.activeLeads', 'Active Leads', 'Active leads card'),
  (NULL, 'en-US', 'cockpit', 'metrics.messagesPerMin', 'Msgs / Min', 'Messages per minute card'),
  (NULL, 'en-US', 'cockpit', 'metrics.stuck', 'Stuck', 'Stuck conversations card'),
  (NULL, 'en-US', 'cockpit', 'metrics.fallbacks', 'Fallbacks', 'Fallbacks card'),
  (NULL, 'en-US', 'cockpit', 'metrics.pending', 'Pending', 'Pending decisions card'),
  (NULL, 'en-US', 'cockpit', 'metrics.taskSuccessRate', 'TASK SUCCESS RATE', 'Task success rate card'),
  (NULL, 'en-US', 'cockpit', 'metrics.averageResponseTime', 'AVERAGE RESPONSE TIME', 'Average response time card'),
  (NULL, 'en-US', 'cockpit', 'metrics.costPerInteraction', 'COST PER INTERACTION', 'Cost per interaction card'),
  
  -- Atividade do Sistema
  (NULL, 'en-US', 'cockpit', 'activity.title', 'System Activity', 'Title of activity section'),
  (NULL, 'en-US', 'cockpit', 'activity.subtitle', 'Real-time logs', 'Subtitle of activity section'),
  (NULL, 'en-US', 'cockpit', 'activity.tabs.history', 'History', 'History tab'),
  (NULL, 'en-US', 'cockpit', 'activity.tabs.logs', 'Logs', 'Logs tab'),
  (NULL, 'en-US', 'cockpit', 'activity.tabs.fallbacks', 'Fallbacks', 'Fallbacks tab'),
  (NULL, 'en-US', 'cockpit', 'activity.origin', 'ORIGIN:', 'Event origin label'),
  (NULL, 'en-US', 'cockpit', 'activity.autonomous', 'Autonomous AI', 'Text when origin is autonomous AI'),
  (NULL, 'en-US', 'cockpit', 'activity.actionRequired', 'ACTION REQUIRED', 'Action required badge'),
  (NULL, 'en-US', 'cockpit', 'activity.selectAll', 'Select All', 'Button to select all'),
  (NULL, 'en-US', 'cockpit', 'activity.selectAllFallbacks', 'Select All Fallbacks', 'Button to select all fallbacks'),
  (NULL, 'en-US', 'cockpit', 'activity.itemsSelected', 'Items selected', 'Text when items are selected'),
  (NULL, 'en-US', 'cockpit', 'activity.readyToClean', 'Ready to clean the database', 'Description when items are selected'),
  (NULL, 'en-US', 'cockpit', 'activity.cancel', 'Cancel', 'Cancel button'),
  (NULL, 'en-US', 'cockpit', 'activity.deleteNow', 'Delete Now', 'Delete button'),
  (NULL, 'en-US', 'cockpit', 'activity.node', 'Node:', 'Node label'),
  (NULL, 'en-US', 'cockpit', 'activity.notAvailable', 'N/A', 'Text when not available'),
  
  -- IA Workforce
  (NULL, 'en-US', 'cockpit', 'workforce.title', 'AI Workforce', 'Title of workforce section'),
  (NULL, 'en-US', 'cockpit', 'workforce.subtitle', 'Agent Status', 'Subtitle of workforce section'),
  (NULL, 'en-US', 'cockpit', 'workforce.status.connected', 'Connected', 'Connected status'),
  (NULL, 'en-US', 'cockpit', 'workforce.status.paused', 'Paused', 'Paused status'),
  (NULL, 'en-US', 'cockpit', 'workforce.status.cancelled', 'Cancelled', 'Cancelled status'),
  (NULL, 'en-US', 'cockpit', 'workforce.status.inactive', 'Inactive', 'Inactive status'),
  (NULL, 'en-US', 'cockpit', 'workforce.status.noStatus', 'No Status', 'Status when there is no status'),
  
  -- Mensagens de Erro/Loading
  (NULL, 'en-US', 'cockpit', 'errors.loading', 'Error loading data', 'Error message when loading'),
  (NULL, 'en-US', 'cockpit', 'errors.tryAgain', 'Try Again', 'Try again button'),
  (NULL, 'en-US', 'cockpit', 'errors.auth', 'Authentication error', 'Authentication error'),
  (NULL, 'en-US', 'cockpit', 'errors.deleteEvent', 'Error deleting event', 'Error deleting event'),
  (NULL, 'en-US', 'cockpit', 'errors.deleteLog', 'Error deleting log', 'Error deleting log'),
  (NULL, 'en-US', 'cockpit', 'errors.deleteLogs', 'Error deleting logs', 'Error deleting logs'),
  (NULL, 'en-US', 'cockpit', 'errors.selectAtLeastOne', 'Select at least one event to delete', 'Error when trying to delete without selection'),
  (NULL, 'en-US', 'cockpit', 'errors.selectAtLeastOneLog', 'Select at least one log to delete', 'Error when trying to delete log without selection'),
  
  -- Mensagens de Sucesso
  (NULL, 'en-US', 'cockpit', 'success.deleted', 'Deleted successfully', 'Success message when deleting'),
  (NULL, 'en-US', 'cockpit', 'success.eventsDeleted', 'event(s) deleted successfully', 'Success message when deleting multiple events'),
  (NULL, 'en-US', 'cockpit', 'success.logDeleted', 'Log deleted successfully', 'Success message when deleting log'),
  (NULL, 'en-US', 'cockpit', 'success.logsDeleted', 'log(s) deleted successfully', 'Success message when deleting multiple logs'),
  
  -- Tempo Relativo
  (NULL, 'en-US', 'cockpit', 'time.now', 'Now', 'Text for current time'),
  (NULL, 'en-US', 'cockpit', 'time.secondsAgo', 's ago', 'Suffix for seconds ago'),
  (NULL, 'en-US', 'cockpit', 'time.minutesAgo', 'min ago', 'Suffix for minutes ago'),
  (NULL, 'en-US', 'cockpit', 'time.hoursAgo', 'h ago', 'Suffix for hours ago'),
  
  -- Tipos de Atividade (Histórico)
  (NULL, 'en-US', 'cockpit', 'activity.types.agentsUpdated', 'Agents Updated', 'Type: Agents Updated'),
  (NULL, 'en-US', 'cockpit', 'activity.types.flowsUpdated', 'Flows Updated', 'Type: Flows Updated'),
  (NULL, 'en-US', 'cockpit', 'activity.types.integrationUpdated', 'Integration Updated', 'Type: Integration Updated'),
  (NULL, 'en-US', 'cockpit', 'activity.types.integrationExpired', 'Data Expired', 'Type: Data Expired'),
  (NULL, 'en-US', 'cockpit', 'activity.types.logsCleaned', 'Logs Cleaned', 'Type: Logs Cleaned'),
  (NULL, 'en-US', 'cockpit', 'activity.types.fallbacksCleaned', 'Fallbacks Cleaned', 'Type: Fallbacks Cleaned'),
  (NULL, 'en-US', 'cockpit', 'activity.types.workflowNodeExecuted', 'Workflow Node Executed', 'Type: Workflow Node Executed'),
  (NULL, 'en-US', 'cockpit', 'activity.types.workflowExecuted', 'Workflow Executed', 'Type: Workflow Executed'),
  (NULL, 'en-US', 'cockpit', 'activity.types.decisionApproved', 'Decision Approved', 'Type: Decision Approved'),
  (NULL, 'en-US', 'cockpit', 'activity.types.decisionRejected', 'Decision Rejected', 'Type: Decision Rejected'),
  
  -- Mensagens de Logs
  (NULL, 'en-US', 'cockpit', 'logs.workflowNodeExecuted', 'Workflow node executed', 'Message: workflow node executed'),
  (NULL, 'en-US', 'cockpit', 'logs.agentBlocked', 'Agent "{{agent}}" blocked - response sent for approval in inbox', 'Message: agent blocked'),
  (NULL, 'en-US', 'cockpit', 'logs.agentBlockedGeneric', 'Agent blocked - response sent for approval in inbox', 'Message: generic agent blocked'),
  (NULL, 'en-US', 'cockpit', 'logs.workflowExecutionCompleted', 'Workflow execution completed', 'Message: workflow execution completed'),
  (NULL, 'en-US', 'cockpit', 'logs.decisionApproved', 'Decision approved', 'Message: decision approved'),
  (NULL, 'en-US', 'cockpit', 'logs.decisionRejected', 'Decision rejected', 'Message: decision rejected'),
  
  -- Mensagens de Fallbacks
  (NULL, 'en-US', 'cockpit', 'fallbacks.conditionDefaulted', 'Condition evaluated with {{count}} missing variable(s): {{variable}}. Using default result: {{defaultValue}}.', 'Message: condition with missing variables'),
  (NULL, 'en-US', 'cockpit', 'fallbacks.templateSubstitutionFailed', 'Template substitution failed', 'Message: template substitution failed'),
  (NULL, 'en-US', 'cockpit', 'fallbacks.inputDefaulted', 'Input defaulted', 'Message: input defaulted'),
  (NULL, 'en-US', 'cockpit', 'fallbacks.variableMissing', 'Variable missing', 'Message: variable missing'),

-- Traduções do Cockpit em Espanhol (es-ES)
  -- Header
  (NULL, 'es-ES', 'cockpit', 'title', 'Cockpit', 'Título principal de la página Cockpit'),
  (NULL, 'es-ES', 'cockpit', 'subtitle', 'Estado en Vivo', 'Subtítulo de la página Cockpit'),
  
  -- Status do Sistema
  (NULL, 'es-ES', 'cockpit', 'status.healthy', 'Sistema Saludable', 'Estado cuando el sistema está saludable'),
  (NULL, 'es-ES', 'cockpit', 'status.stable', 'Sistema Estable', 'Estado cuando el sistema está estable'),
  (NULL, 'es-ES', 'cockpit', 'status.blocked', 'Sistema Bloqueado', 'Estado cuando el sistema está bloqueado'),
  (NULL, 'es-ES', 'cockpit', 'status.unstable', 'Inestabilidad Detectada', 'Estado cuando hay inestabilidad'),
  
  -- Cards de Métricas
  (NULL, 'es-ES', 'cockpit', 'metrics.interactions', 'Interacciones', 'Tarjeta de interacciones'),
  (NULL, 'es-ES', 'cockpit', 'metrics.activeLeads', 'Leads Activos', 'Tarjeta de leads activos'),
  (NULL, 'es-ES', 'cockpit', 'metrics.messagesPerMin', 'Msgs / Min', 'Tarjeta de mensajes por minuto'),
  (NULL, 'es-ES', 'cockpit', 'metrics.stuck', 'Atascadas', 'Tarjeta de conversaciones atascadas'),
  (NULL, 'es-ES', 'cockpit', 'metrics.fallbacks', 'Fallbacks', 'Tarjeta de fallbacks'),
  (NULL, 'es-ES', 'cockpit', 'metrics.pending', 'Pendientes', 'Tarjeta de decisiones pendientes'),
  
  -- Atividade do Sistema
  (NULL, 'es-ES', 'cockpit', 'activity.title', 'Actividad del Sistema', 'Título de la sección de actividad'),
  (NULL, 'es-ES', 'cockpit', 'activity.subtitle', 'Logs en tiempo real', 'Subtítulo de la sección de actividad'),
  (NULL, 'es-ES', 'cockpit', 'activity.tabs.history', 'Historial', 'Pestaña de historial'),
  (NULL, 'es-ES', 'cockpit', 'activity.tabs.logs', 'Logs', 'Pestaña de logs'),
  (NULL, 'es-ES', 'cockpit', 'activity.tabs.fallbacks', 'Fallbacks', 'Pestaña de fallbacks'),
  (NULL, 'es-ES', 'cockpit', 'activity.origin', 'ORIGEN:', 'Etiqueta de origen del evento'),
  (NULL, 'es-ES', 'cockpit', 'activity.autonomous', 'IA Autónoma', 'Texto cuando el origen es IA autónoma'),
  (NULL, 'es-ES', 'cockpit', 'activity.actionRequired', 'ACCIÓN REQUERIDA', 'Badge de acción requerida'),
  (NULL, 'es-ES', 'cockpit', 'activity.selectAll', 'Seleccionar Todo', 'Botón para seleccionar todos'),
  (NULL, 'es-ES', 'cockpit', 'activity.selectAllFallbacks', 'Seleccionar Todos los Fallbacks', 'Botón para seleccionar todos los fallbacks'),
  (NULL, 'es-ES', 'cockpit', 'activity.itemsSelected', 'Elementos seleccionados', 'Texto cuando hay elementos seleccionados'),
  (NULL, 'es-ES', 'cockpit', 'activity.readyToClean', 'Listo para realizar la limpieza de la base de datos', 'Descripción cuando hay elementos seleccionados'),
  (NULL, 'es-ES', 'cockpit', 'activity.cancel', 'Cancelar', 'Botón cancelar'),
  (NULL, 'es-ES', 'cockpit', 'activity.deleteNow', 'Eliminar Ahora', 'Botón eliminar'),
  (NULL, 'es-ES', 'cockpit', 'activity.node', 'Nodo:', 'Etiqueta de nodo'),
  (NULL, 'es-ES', 'cockpit', 'activity.notAvailable', 'N/A', 'Texto cuando no está disponible'),
  
  -- IA Workforce
  (NULL, 'es-ES', 'cockpit', 'workforce.title', 'IA Workforce', 'Título de la sección de workforce'),
  (NULL, 'es-ES', 'cockpit', 'workforce.subtitle', 'Estado de los Agentes', 'Subtítulo de la sección de workforce'),
  (NULL, 'es-ES', 'cockpit', 'workforce.status.connected', 'Conectado', 'Estado conectado'),
  (NULL, 'es-ES', 'cockpit', 'workforce.status.paused', 'Pausado', 'Estado pausado'),
  (NULL, 'es-ES', 'cockpit', 'workforce.status.cancelled', 'Cancelado', 'Estado cancelado'),
  (NULL, 'es-ES', 'cockpit', 'workforce.status.inactive', 'Inactivo', 'Estado inactivo'),
  (NULL, 'es-ES', 'cockpit', 'workforce.status.noStatus', 'Sin Estado', 'Estado cuando no hay estado'),
  
  -- Mensagens de Erro/Loading
  (NULL, 'es-ES', 'cockpit', 'errors.loading', 'Error al cargar datos', 'Mensaje de error al cargar'),
  (NULL, 'es-ES', 'cockpit', 'errors.tryAgain', 'Intentar Nuevamente', 'Botón intentar nuevamente'),
  (NULL, 'es-ES', 'cockpit', 'errors.auth', 'Error de autenticación', 'Error de autenticación'),
  (NULL, 'es-ES', 'cockpit', 'errors.deleteEvent', 'Error al eliminar evento', 'Error al eliminar evento'),
  (NULL, 'es-ES', 'cockpit', 'errors.deleteLog', 'Error al eliminar log', 'Error al eliminar log'),
  (NULL, 'es-ES', 'cockpit', 'errors.deleteLogs', 'Error al eliminar logs', 'Error al eliminar logs'),
  (NULL, 'es-ES', 'cockpit', 'errors.selectAtLeastOne', 'Seleccione al menos un evento para eliminar', 'Error al intentar eliminar sin selección'),
  (NULL, 'es-ES', 'cockpit', 'errors.selectAtLeastOneLog', 'Seleccione al menos un log para eliminar', 'Error al intentar eliminar log sin selección'),
  
  -- Mensagens de Sucesso
  (NULL, 'es-ES', 'cockpit', 'success.deleted', 'Eliminado con éxito', 'Mensaje de éxito al eliminar'),
  (NULL, 'es-ES', 'cockpit', 'success.eventsDeleted', 'evento(s) eliminado(s) con éxito', 'Mensaje de éxito al eliminar múltiples eventos'),
  (NULL, 'es-ES', 'cockpit', 'success.logDeleted', 'Log eliminado con éxito', 'Mensaje de éxito al eliminar log'),
  (NULL, 'es-ES', 'cockpit', 'success.logsDeleted', 'log(s) eliminado(s) con éxito', 'Mensaje de éxito al eliminar múltiples logs'),
  
  -- Tempo Relativo
  (NULL, 'es-ES', 'cockpit', 'time.now', 'Ahora', 'Texto para tiempo actual'),
  (NULL, 'es-ES', 'cockpit', 'time.secondsAgo', 's atrás', 'Sufijo para segundos atrás'),
  (NULL, 'es-ES', 'cockpit', 'time.minutesAgo', 'min atrás', 'Sufijo para minutos atrás'),
  (NULL, 'es-ES', 'cockpit', 'time.hoursAgo', 'h atrás', 'Sufijo para horas atrás'),
  
  -- Tipos de Atividade (Histórico)
  (NULL, 'es-ES', 'cockpit', 'activity.types.agentsUpdated', 'Agentes Actualizado', 'Tipo: Agentes Actualizado'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.flowsUpdated', 'Flujos Actualizado', 'Tipo: Flujos Actualizado'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.integrationUpdated', 'Integración Actualizada', 'Tipo: Integración Actualizada'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.integrationExpired', 'Fecha expirada', 'Tipo: Fecha expirada'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.logsCleaned', 'Logs Limpiados', 'Tipo: Logs Limpiados'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.fallbacksCleaned', 'Fallbacks Limpiados', 'Tipo: Fallbacks Limpiados'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.workflowNodeExecuted', 'Nodo de Workflow Ejecutado', 'Tipo: Nodo de Workflow Ejecutado'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.workflowExecuted', 'Workflow Ejecutado', 'Tipo: Workflow Ejecutado'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.decisionApproved', 'Decisión Aprobada', 'Tipo: Decisión Aprobada'),
  (NULL, 'es-ES', 'cockpit', 'activity.types.decisionRejected', 'Decisión Rechazada', 'Tipo: Decisión Rechazada'),
  
  -- Mensagens de Logs
  (NULL, 'es-ES', 'cockpit', 'logs.workflowNodeExecuted', 'Nodo del workflow ejecutado', 'Mensaje: workflow node executed'),
  (NULL, 'es-ES', 'cockpit', 'logs.agentBlocked', 'Agente "{{agent}}" bloqueado - respuesta enviada para aprobación en inbox', 'Mensaje: agente bloqueado'),
  (NULL, 'es-ES', 'cockpit', 'logs.agentBlockedGeneric', 'Agente bloqueado - respuesta enviada para aprobación en inbox', 'Mensaje: agente bloqueado genérico'),
  (NULL, 'es-ES', 'cockpit', 'logs.workflowExecutionCompleted', 'Ejecución del workflow completada', 'Mensaje: workflow execution completed'),
  (NULL, 'es-ES', 'cockpit', 'logs.decisionApproved', 'Decisión aprobada', 'Mensaje: decision approved'),
  (NULL, 'es-ES', 'cockpit', 'logs.decisionRejected', 'Decisión rechazada', 'Mensaje: decision rejected'),
  
  -- Mensagens de Fallbacks
  (NULL, 'es-ES', 'cockpit', 'fallbacks.conditionDefaulted', 'Condición evaluada con {{count}} variable(s) faltante(s): {{variable}}. Usando resultado por defecto: {{defaultValue}}.', 'Mensaje: condición con variables faltantes'),
  (NULL, 'es-ES', 'cockpit', 'fallbacks.templateSubstitutionFailed', 'Sustitución de plantilla falló', 'Mensaje: template substitution failed'),
  (NULL, 'es-ES', 'cockpit', 'fallbacks.inputDefaulted', 'Entrada por defecto usada', 'Mensaje: input defaulted'),
  (NULL, 'es-ES', 'cockpit', 'fallbacks.variableMissing', 'Variable faltante', 'Mensaje: variable missing')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
