-- ============================================
-- SCRIPT: Inserir traduções do Inbox
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Traduções do Inbox em Português (pt-BR)
INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description) VALUES
  -- Header
  (NULL, 'pt-BR', 'inbox', 'header.title', 'Inbox SONIA', 'Título do header do Inbox'),
  
  -- Tabs
  (NULL, 'pt-BR', 'inbox', 'tabs.stuckMessages', 'Mensagens Travadas', 'Aba de mensagens travadas'),
  (NULL, 'pt-BR', 'inbox', 'tabs.approvals', 'Aprovações', 'Aba de aprovações'),
  
  -- Search
  (NULL, 'pt-BR', 'inbox', 'search.placeholder', 'Localizar lead...', 'Placeholder do campo de busca'),
  
  -- Loading
  (NULL, 'pt-BR', 'inbox', 'loading', 'Carregando...', 'Texto de carregamento'),
  
  -- Empty States
  (NULL, 'pt-BR', 'inbox', 'empty.queue', 'Fila Limpa', 'Estado vazio quando não há conversas'),
  
  -- Contact
  (NULL, 'pt-BR', 'inbox', 'contact.noAgent', 'Falta de agente', 'Texto quando não há agente atribuído'),
  (NULL, 'pt-BR', 'inbox', 'contact.unknown', 'Contato desconhecido', 'Texto quando contato é desconhecido'),
  
  -- Message
  (NULL, 'pt-BR', 'inbox', 'message.sent', 'Mensagem enviada', 'Texto quando mensagem foi enviada'),
  (NULL, 'pt-BR', 'inbox', 'message.content', 'Conteúdo da Mensagem', 'Label do conteúdo da mensagem'),
  (NULL, 'pt-BR', 'inbox', 'message.fileSent', 'Arquivo ou anexo enviado', 'Texto quando arquivo foi enviado'),
  
  -- Lead
  (NULL, 'pt-BR', 'inbox', 'lead.waiting', 'Lead Aguardando', 'Título quando lead está aguardando'),
  (NULL, 'pt-BR', 'inbox', 'lead.manualIntervention', 'Intervenção manual necessária agora', 'Subtítulo quando intervenção manual é necessária'),
  
  -- Status
  (NULL, 'pt-BR', 'inbox', 'status.critical', 'Status: Crítico', 'Badge de status crítico'),
  
  -- Action
  (NULL, 'pt-BR', 'inbox', 'action.resolveContact', 'Resolver este contato', 'Título da ação de resolver contato'),
  
  -- Select
  (NULL, 'pt-BR', 'inbox', 'select.agentPlaceholder', 'Escolher agente responsável...', 'Placeholder do seletor de agente'),
  
  -- Button
  (NULL, 'pt-BR', 'inbox', 'button.activateAgent', 'ATIVAR AGENTE AGORA', 'Texto do botão de ativar agente'),
  
  -- Time
  (NULL, 'pt-BR', 'inbox', 'time.secondsAgo', 's atrás', 'Sufixo para segundos atrás'),
  (NULL, 'pt-BR', 'inbox', 'time.minutesAgo', 'min atrás', 'Sufixo para minutos atrás'),
  (NULL, 'pt-BR', 'inbox', 'time.hoursAgo', 'h atrás', 'Sufixo para horas atrás'),
  (NULL, 'pt-BR', 'inbox', 'time.ago', 'há {{value}}', 'Formato de tempo relativo'),
  
  -- Decisions
  (NULL, 'pt-BR', 'inbox', 'decisions.title', 'Aprovações Pendentes', 'Título da seção de aprovações'),
  (NULL, 'pt-BR', 'inbox', 'decisions.subtitle', 'Mensagens com baixa confiança aguardando seu aval', 'Subtítulo da seção de aprovações'),
  (NULL, 'pt-BR', 'inbox', 'decisions.syncing', 'Sincronizando decisões...', 'Texto quando está sincronizando decisões'),
  (NULL, 'pt-BR', 'inbox', 'decisions.allProcessed', 'Operação em dia!', 'Título quando todas as decisões foram processadas'),
  (NULL, 'pt-BR', 'inbox', 'decisions.allProcessedDescription', 'Todas as mensagens foram processadas com sucesso.', 'Descrição quando todas as decisões foram processadas'),
  
  -- Errors
  (NULL, 'pt-BR', 'inbox', 'errors.loading', 'Erro ao carregar conversas', 'Erro ao carregar conversas'),
  (NULL, 'pt-BR', 'inbox', 'errors.selectAgent', 'Selecione um agente para atribuir', 'Erro quando não há agente selecionado'),
  (NULL, 'pt-BR', 'inbox', 'errors.assignAgent', 'Erro ao atribuir agente', 'Erro ao atribuir agente'),
  (NULL, 'pt-BR', 'inbox', 'errors.loadingDecisions', 'Erro ao carregar aprovações pendentes', 'Erro ao carregar aprovações pendentes'),
  (NULL, 'pt-BR', 'inbox', 'errors.emailNotAvailable', 'Email do usuário não disponível', 'Erro quando email não está disponível'),
  (NULL, 'pt-BR', 'inbox', 'errors.fetchUser', 'Erro ao buscar usuário', 'Erro ao buscar usuário'),
  (NULL, 'pt-BR', 'inbox', 'errors.userNotFound', 'Usuário não encontrado', 'Erro quando usuário não é encontrado'),
  (NULL, 'pt-BR', 'inbox', 'errors.approveDecision', 'Erro ao aprovar decisão', 'Erro ao aprovar decisão'),
  (NULL, 'pt-BR', 'inbox', 'errors.approveError', 'Erro ao aprovar', 'Erro ao aprovar'),
  (NULL, 'pt-BR', 'inbox', 'errors.rejectDecision', 'Erro ao rejeitar decisão', 'Erro ao rejeitar decisão'),
  (NULL, 'pt-BR', 'inbox', 'errors.rejectError', 'Erro ao rejeitar', 'Erro ao rejeitar'),
  (NULL, 'pt-BR', 'inbox', 'errors.error', 'Erro', 'Label genérico de erro'),
  (NULL, 'pt-BR', 'inbox', 'errors.unknownError', 'Erro desconhecido', 'Erro desconhecido'),
  
  -- Success
  (NULL, 'pt-BR', 'inbox', 'success.agentAssigned', 'Agente atribuído com sucesso!', 'Mensagem de sucesso ao atribuir agente'),
  (NULL, 'pt-BR', 'inbox', 'success.messageApproved', 'Mensagem aprovada e enviada com sucesso!', 'Mensagem de sucesso ao aprovar'),
  (NULL, 'pt-BR', 'inbox', 'success.messageRejected', 'Mensagem rejeitada', 'Mensagem de sucesso ao rejeitar'),
  
  -- Decision Card
  (NULL, 'pt-BR', 'inbox', 'decision.pending', 'Decisão Pendente', 'Título do card de decisão pendente'),
  (NULL, 'pt-BR', 'inbox', 'decision.confidence', 'CONFIANÇA', 'Label de confiança'),
  (NULL, 'pt-BR', 'inbox', 'decision.client', 'Cliente', 'Label do cliente'),
  (NULL, 'pt-BR', 'inbox', 'decision.soniaAI', 'Sonia AI', 'Label da IA'),
  (NULL, 'pt-BR', 'inbox', 'decision.editPlaceholder', 'Edite a resposta da Sonia se necessário...', 'Placeholder do textarea de edição'),
  (NULL, 'pt-BR', 'inbox', 'decision.edited', 'Editado', 'Badge de editado'),
  (NULL, 'pt-BR', 'inbox', 'decision.channel', 'Canal', 'Label de canal'),
  (NULL, 'pt-BR', 'inbox', 'decision.ignore', 'Ignorar Decisão', 'Botão de ignorar'),
  (NULL, 'pt-BR', 'inbox', 'decision.approveAndSend', 'Aprovar e Enviar', 'Botão de aprovar'),
  (NULL, 'pt-BR', 'inbox', 'decision.reason.lowContext', 'Pouco contexto', 'Razão: pouco contexto'),
  (NULL, 'pt-BR', 'inbox', 'decision.reason.ambiguous', 'Mensagem ambígua', 'Razão: mensagem ambígua'),
  (NULL, 'pt-BR', 'inbox', 'decision.reason.highMatch', 'Alta confiança', 'Razão: alta confiança'),
  (NULL, 'pt-BR', 'inbox', 'decision.reason.insufficientData', 'Dados insuficientes', 'Razão: dados insuficientes'),

-- Traduções do Inbox em Inglês (en-US)
  -- Header
  (NULL, 'en-US', 'inbox', 'header.title', 'SONIA Inbox', 'Inbox header title'),
  
  -- Tabs
  (NULL, 'en-US', 'inbox', 'tabs.stuckMessages', 'Stuck Messages', 'Stuck messages tab'),
  (NULL, 'en-US', 'inbox', 'tabs.approvals', 'Approvals', 'Approvals tab'),
  
  -- Search
  (NULL, 'en-US', 'inbox', 'search.placeholder', 'Search lead...', 'Search field placeholder'),
  
  -- Loading
  (NULL, 'en-US', 'inbox', 'loading', 'Loading...', 'Loading text'),
  
  -- Empty States
  (NULL, 'en-US', 'inbox', 'empty.queue', 'Queue Empty', 'Empty state when there are no conversations'),
  
  -- Contact
  (NULL, 'en-US', 'inbox', 'contact.noAgent', 'No agent', 'Text when no agent is assigned'),
  (NULL, 'en-US', 'inbox', 'contact.unknown', 'Unknown contact', 'Text when contact is unknown'),
  
  -- Message
  (NULL, 'en-US', 'inbox', 'message.sent', 'Message sent', 'Text when message was sent'),
  (NULL, 'en-US', 'inbox', 'message.content', 'Message Content', 'Message content label'),
  (NULL, 'en-US', 'inbox', 'message.fileSent', 'File or attachment sent', 'Text when file was sent'),
  
  -- Lead
  (NULL, 'en-US', 'inbox', 'lead.waiting', 'Lead Waiting', 'Title when lead is waiting'),
  (NULL, 'en-US', 'inbox', 'lead.manualIntervention', 'Manual intervention required now', 'Subtitle when manual intervention is required'),
  
  -- Status
  (NULL, 'en-US', 'inbox', 'status.critical', 'Status: Critical', 'Critical status badge'),
  
  -- Action
  (NULL, 'en-US', 'inbox', 'action.resolveContact', 'Resolve this contact', 'Resolve contact action title'),
  
  -- Select
  (NULL, 'en-US', 'inbox', 'select.agentPlaceholder', 'Choose responsible agent...', 'Agent selector placeholder'),
  
  -- Button
  (NULL, 'en-US', 'inbox', 'button.activateAgent', 'ACTIVATE AGENT NOW', 'Activate agent button text'),
  
  -- Time
  (NULL, 'en-US', 'inbox', 'time.secondsAgo', 's ago', 'Suffix for seconds ago'),
  (NULL, 'en-US', 'inbox', 'time.minutesAgo', 'min ago', 'Suffix for minutes ago'),
  (NULL, 'en-US', 'inbox', 'time.hoursAgo', 'h ago', 'Suffix for hours ago'),
  (NULL, 'en-US', 'inbox', 'time.ago', '{{value}} ago', 'Relative time format'),
  
  -- Decisions
  (NULL, 'en-US', 'inbox', 'decisions.title', 'Pending Approvals', 'Approvals section title'),
  (NULL, 'en-US', 'inbox', 'decisions.subtitle', 'Low confidence messages awaiting your approval', 'Approvals section subtitle'),
  (NULL, 'en-US', 'inbox', 'decisions.syncing', 'Syncing decisions...', 'Text when syncing decisions'),
  (NULL, 'en-US', 'inbox', 'decisions.allProcessed', 'All caught up!', 'Title when all decisions have been processed'),
  (NULL, 'en-US', 'inbox', 'decisions.allProcessedDescription', 'All messages have been processed successfully.', 'Description when all decisions have been processed'),
  
  -- Errors
  (NULL, 'en-US', 'inbox', 'errors.loading', 'Error loading conversations', 'Error loading conversations'),
  (NULL, 'en-US', 'inbox', 'errors.selectAgent', 'Select an agent to assign', 'Error when no agent is selected'),
  (NULL, 'en-US', 'inbox', 'errors.assignAgent', 'Error assigning agent', 'Error assigning agent'),
  (NULL, 'en-US', 'inbox', 'errors.loadingDecisions', 'Error loading pending approvals', 'Error loading pending approvals'),
  (NULL, 'en-US', 'inbox', 'errors.emailNotAvailable', 'User email not available', 'Error when email is not available'),
  (NULL, 'en-US', 'inbox', 'errors.fetchUser', 'Error fetching user', 'Error fetching user'),
  (NULL, 'en-US', 'inbox', 'errors.userNotFound', 'User not found', 'Error when user is not found'),
  (NULL, 'en-US', 'inbox', 'errors.approveDecision', 'Error approving decision', 'Error approving decision'),
  (NULL, 'en-US', 'inbox', 'errors.approveError', 'Error approving', 'Error approving'),
  (NULL, 'en-US', 'inbox', 'errors.rejectDecision', 'Error rejecting decision', 'Error rejecting decision'),
  (NULL, 'en-US', 'inbox', 'errors.rejectError', 'Error rejecting', 'Error rejecting'),
  (NULL, 'en-US', 'inbox', 'errors.error', 'Error', 'Generic error label'),
  (NULL, 'en-US', 'inbox', 'errors.unknownError', 'Unknown error', 'Unknown error'),
  
  -- Success
  (NULL, 'en-US', 'inbox', 'success.agentAssigned', 'Agent assigned successfully!', 'Success message when assigning agent'),
  (NULL, 'en-US', 'inbox', 'success.messageApproved', 'Message approved and sent successfully!', 'Success message when approving'),
  (NULL, 'en-US', 'inbox', 'success.messageRejected', 'Message rejected', 'Success message when rejecting'),
  
  -- Decision Card
  (NULL, 'en-US', 'inbox', 'decision.pending', 'Pending Decision', 'Pending decision card title'),
  (NULL, 'en-US', 'inbox', 'decision.confidence', 'CONFIDENCE', 'Confidence label'),
  (NULL, 'en-US', 'inbox', 'decision.client', 'Client', 'Client label'),
  (NULL, 'en-US', 'inbox', 'decision.soniaAI', 'Sonia AI', 'AI label'),
  (NULL, 'en-US', 'inbox', 'decision.editPlaceholder', 'Edit Sonia''s response if necessary...', 'Edit textarea placeholder'),
  (NULL, 'en-US', 'inbox', 'decision.edited', 'Edited', 'Edited badge'),
  (NULL, 'en-US', 'inbox', 'decision.channel', 'Channel', 'Channel label'),
  (NULL, 'en-US', 'inbox', 'decision.ignore', 'Ignore Decision', 'Ignore button'),
  (NULL, 'en-US', 'inbox', 'decision.approveAndSend', 'Approve and Send', 'Approve button'),
  (NULL, 'en-US', 'inbox', 'decision.reason.lowContext', 'Low context', 'Reason: low context'),
  (NULL, 'en-US', 'inbox', 'decision.reason.ambiguous', 'Ambiguous message', 'Reason: ambiguous message'),
  (NULL, 'en-US', 'inbox', 'decision.reason.highMatch', 'High confidence', 'Reason: high confidence'),
  (NULL, 'en-US', 'inbox', 'decision.reason.insufficientData', 'Insufficient data', 'Reason: insufficient data'),

-- Traduções do Inbox em Espanhol (es-ES)
  -- Header
  (NULL, 'es-ES', 'inbox', 'header.title', 'Inbox SONIA', 'Título del header del Inbox'),
  
  -- Tabs
  (NULL, 'es-ES', 'inbox', 'tabs.stuckMessages', 'Mensajes Atascados', 'Pestaña de mensajes atascados'),
  (NULL, 'es-ES', 'inbox', 'tabs.approvals', 'Aprobaciones', 'Pestaña de aprobaciones'),
  
  -- Search
  (NULL, 'es-ES', 'inbox', 'search.placeholder', 'Buscar lead...', 'Placeholder del campo de búsqueda'),
  
  -- Loading
  (NULL, 'es-ES', 'inbox', 'loading', 'Cargando...', 'Texto de carga'),
  
  -- Empty States
  (NULL, 'es-ES', 'inbox', 'empty.queue', 'Fila Vacía', 'Estado vacío cuando no hay conversaciones'),
  
  -- Contact
  (NULL, 'es-ES', 'inbox', 'contact.noAgent', 'Sin agente', 'Texto cuando no hay agente asignado'),
  (NULL, 'es-ES', 'inbox', 'contact.unknown', 'Contacto desconocido', 'Texto cuando contacto es desconocido'),
  
  -- Message
  (NULL, 'es-ES', 'inbox', 'message.sent', 'Mensaje enviado', 'Texto cuando mensaje fue enviado'),
  (NULL, 'es-ES', 'inbox', 'message.content', 'Contenido del Mensaje', 'Etiqueta del contenido del mensaje'),
  (NULL, 'es-ES', 'inbox', 'message.fileSent', 'Archivo o adjunto enviado', 'Texto cuando archivo fue enviado'),
  
  -- Lead
  (NULL, 'es-ES', 'inbox', 'lead.waiting', 'Lead Esperando', 'Título cuando lead está esperando'),
  (NULL, 'es-ES', 'inbox', 'lead.manualIntervention', 'Intervención manual necesaria ahora', 'Subtítulo cuando intervención manual es necesaria'),
  
  -- Status
  (NULL, 'es-ES', 'inbox', 'status.critical', 'Estado: Crítico', 'Badge de estado crítico'),
  
  -- Action
  (NULL, 'es-ES', 'inbox', 'action.resolveContact', 'Resolver este contacto', 'Título de la acción de resolver contacto'),
  
  -- Select
  (NULL, 'es-ES', 'inbox', 'select.agentPlaceholder', 'Elegir agente responsable...', 'Placeholder del selector de agente'),
  
  -- Button
  (NULL, 'es-ES', 'inbox', 'button.activateAgent', 'ACTIVAR AGENTE AHORA', 'Texto del botón de activar agente'),
  
  -- Time
  (NULL, 'es-ES', 'inbox', 'time.secondsAgo', 's atrás', 'Sufijo para segundos atrás'),
  (NULL, 'es-ES', 'inbox', 'time.minutesAgo', 'min atrás', 'Sufijo para minutos atrás'),
  (NULL, 'es-ES', 'inbox', 'time.hoursAgo', 'h atrás', 'Sufijo para horas atrás'),
  (NULL, 'es-ES', 'inbox', 'time.ago', 'hace {{value}}', 'Formato de tiempo relativo'),
  
  -- Decisions
  (NULL, 'es-ES', 'inbox', 'decisions.title', 'Aprobaciones Pendientes', 'Título de la sección de aprobaciones'),
  (NULL, 'es-ES', 'inbox', 'decisions.subtitle', 'Mensajes con baja confianza esperando tu aprobación', 'Subtítulo de la sección de aprobaciones'),
  (NULL, 'es-ES', 'inbox', 'decisions.syncing', 'Sincronizando decisiones...', 'Texto cuando está sincronizando decisiones'),
  (NULL, 'es-ES', 'inbox', 'decisions.allProcessed', '¡Operación al día!', 'Título cuando todas las decisiones fueron procesadas'),
  (NULL, 'es-ES', 'inbox', 'decisions.allProcessedDescription', 'Todos los mensajes fueron procesados con éxito.', 'Descripción cuando todas las decisiones fueron procesadas'),
  
  -- Errors
  (NULL, 'es-ES', 'inbox', 'errors.loading', 'Error al cargar conversaciones', 'Error al cargar conversaciones'),
  (NULL, 'es-ES', 'inbox', 'errors.selectAgent', 'Seleccione un agente para asignar', 'Error cuando no hay agente seleccionado'),
  (NULL, 'es-ES', 'inbox', 'errors.assignAgent', 'Error al asignar agente', 'Error al asignar agente'),
  (NULL, 'es-ES', 'inbox', 'errors.loadingDecisions', 'Error al cargar aprobaciones pendientes', 'Error al cargar aprobaciones pendientes'),
  (NULL, 'es-ES', 'inbox', 'errors.emailNotAvailable', 'Email del usuario no disponible', 'Error cuando email no está disponible'),
  (NULL, 'es-ES', 'inbox', 'errors.fetchUser', 'Error al buscar usuario', 'Error al buscar usuario'),
  (NULL, 'es-ES', 'inbox', 'errors.userNotFound', 'Usuario no encontrado', 'Error cuando usuario no es encontrado'),
  (NULL, 'es-ES', 'inbox', 'errors.approveDecision', 'Error al aprobar decisión', 'Error al aprobar decisión'),
  (NULL, 'es-ES', 'inbox', 'errors.approveError', 'Error al aprobar', 'Error al aprobar'),
  (NULL, 'es-ES', 'inbox', 'errors.rejectDecision', 'Error al rechazar decisión', 'Error al rechazar decisión'),
  (NULL, 'es-ES', 'inbox', 'errors.rejectError', 'Error al rechazar', 'Error al rechazar'),
  (NULL, 'es-ES', 'inbox', 'errors.error', 'Error', 'Etiqueta genérica de error'),
  (NULL, 'es-ES', 'inbox', 'errors.unknownError', 'Error desconocido', 'Error desconocido'),
  
  -- Success
  (NULL, 'es-ES', 'inbox', 'success.agentAssigned', '¡Agente asignado con éxito!', 'Mensaje de éxito al asignar agente'),
  (NULL, 'es-ES', 'inbox', 'success.messageApproved', '¡Mensaje aprobado y enviado con éxito!', 'Mensaje de éxito al aprobar'),
  (NULL, 'es-ES', 'inbox', 'success.messageRejected', 'Mensaje rechazado', 'Mensaje de éxito al rechazar'),
  
  -- Decision Card
  (NULL, 'es-ES', 'inbox', 'decision.pending', 'Decisión Pendiente', 'Título del card de decisión pendiente'),
  (NULL, 'es-ES', 'inbox', 'decision.confidence', 'CONFIANZA', 'Etiqueta de confianza'),
  (NULL, 'es-ES', 'inbox', 'decision.client', 'Cliente', 'Etiqueta del cliente'),
  (NULL, 'es-ES', 'inbox', 'decision.soniaAI', 'Sonia AI', 'Etiqueta de la IA'),
  (NULL, 'es-ES', 'inbox', 'decision.editPlaceholder', 'Edite la respuesta de Sonia si es necesario...', 'Placeholder del textarea de edición'),
  (NULL, 'es-ES', 'inbox', 'decision.edited', 'Editado', 'Badge de editado'),
  (NULL, 'es-ES', 'inbox', 'decision.channel', 'Canal', 'Etiqueta de canal'),
  (NULL, 'es-ES', 'inbox', 'decision.ignore', 'Ignorar Decisión', 'Botón de ignorar'),
  (NULL, 'es-ES', 'inbox', 'decision.approveAndSend', 'Aprobar y Enviar', 'Botón de aprobar'),
  (NULL, 'es-ES', 'inbox', 'decision.reason.lowContext', 'Poco contexto', 'Razón: poco contexto'),
  (NULL, 'es-ES', 'inbox', 'decision.reason.ambiguous', 'Mensaje ambiguo', 'Razón: mensaje ambiguo'),
  (NULL, 'es-ES', 'inbox', 'decision.reason.highMatch', 'Alta confianza', 'Razón: alta confianza'),
  (NULL, 'es-ES', 'inbox', 'decision.reason.insufficientData', 'Datos insuficientes', 'Razón: datos insuficientes')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
