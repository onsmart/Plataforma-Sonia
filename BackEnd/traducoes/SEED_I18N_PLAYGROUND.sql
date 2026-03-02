-- ============================================
-- SCRIPT: Inserir traduções do Playground
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Traduções do Playground em Português (pt-BR)
INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description) VALUES
  -- Header
  (NULL, 'pt-BR', 'playground', 'header.title', 'Área de Testes', 'Título do header do Playground'),
  (NULL, 'pt-BR', 'playground', 'header.description', 'Teste seus agentes e automações antes de colocá-los em produção. Aqui você pode conversar com seus agentes e executar workflows.', 'Descrição do header'),
  (NULL, 'pt-BR', 'playground', 'header.testEnvironment', 'Ambiente de Teste', 'Label de ambiente de teste'),
  (NULL, 'pt-BR', 'playground', 'header.availableChannels', 'Canais de comunicação disponíveis', 'Tooltip de canais disponíveis'),
  
  -- Sidebar
  (NULL, 'pt-BR', 'playground', 'sidebar.automationsAvailable', 'Automações Disponíveis', 'Título da seção de automações'),
  (NULL, 'pt-BR', 'playground', 'sidebar.automations', 'Automações', 'Título do tooltip de automações'),
  (NULL, 'pt-BR', 'playground', 'sidebar.automationsDescription', 'Fluxos de trabalho automatizados que executam tarefas em sequência. Clique em um para executá-lo.', 'Descrição do tooltip de automações'),
  (NULL, 'pt-BR', 'playground', 'sidebar.noAutomations', 'Nenhuma automação disponível', 'Mensagem quando não há automações'),
  (NULL, 'pt-BR', 'playground', 'sidebar.agentsAvailable', 'Agentes Disponíveis', 'Título da seção de agentes'),
  (NULL, 'pt-BR', 'playground', 'sidebar.agents', 'Agentes', 'Título do tooltip de agentes'),
  (NULL, 'pt-BR', 'playground', 'sidebar.agentsDescription', 'Seus assistentes virtuais configurados. Selecione um para iniciar uma conversa de teste.', 'Descrição do tooltip de agentes'),
  
  -- Buttons
  (NULL, 'pt-BR', 'playground', 'button.executeAutomation', 'Executar Automação', 'Botão de executar automação'),
  (NULL, 'pt-BR', 'playground', 'button.executeAutomationDescription', 'Inicia a execução deste fluxo de trabalho. Você verá cada etapa sendo processada em tempo real.', 'Descrição do botão de executar automação'),
  (NULL, 'pt-BR', 'playground', 'button.activateVoice', 'Ativar Voz', 'Botão de ativar voz'),
  (NULL, 'pt-BR', 'playground', 'button.deactivateVoice', 'Desativar Voz', 'Botão de desativar voz'),
  (NULL, 'pt-BR', 'playground', 'button.activateVoiceDescription', 'Ativa o modo de voz. O agente falará as respostas e você pode falar ao invés de digitar.', 'Descrição do botão de ativar voz'),
  (NULL, 'pt-BR', 'playground', 'button.deactivateVoiceDescription', 'Clique para desativar o modo de voz. O agente parará de falar e escutar.', 'Descrição do botão de desativar voz'),
  (NULL, 'pt-BR', 'playground', 'button.configure', 'Configurar', 'Botão de configurar'),
  (NULL, 'pt-BR', 'playground', 'button.configureAgent', 'Configurar Agente', 'Título do tooltip de configurar agente'),
  (NULL, 'pt-BR', 'playground', 'button.configureAgentDescription', 'Abre a tela de configuração para personalizar o comportamento, personalidade e capacidades deste agente.', 'Descrição do tooltip de configurar agente'),
  (NULL, 'pt-BR', 'playground', 'button.send', 'ENVIAR', 'Botão de enviar mensagem'),
  
  -- Flow
  (NULL, 'pt-BR', 'playground', 'flow.readyToExecute', 'Pronto para Executar', 'Título quando flow está pronto para executar'),
  (NULL, 'pt-BR', 'playground', 'flow.clickExecuteButton', 'Clique no botão "Executar Automação" no topo da tela para iniciar este fluxo de trabalho.', 'Instrução para executar flow'),
  (NULL, 'pt-BR', 'playground', 'flow.realTimeProcessing', 'Você verá cada etapa sendo processada em tempo real, incluindo as respostas dos agentes envolvidos.', 'Descrição do processamento em tempo real'),
  (NULL, 'pt-BR', 'playground', 'flow.automationsAutoExecute', 'As automações são executadas automaticamente. Use o botão "Executar Automação" no topo da tela.', 'Mensagem sobre execução automática'),
  
  -- Chat
  (NULL, 'pt-BR', 'playground', 'chat.readyToChat', 'Pronto para Conversar', 'Título quando está pronto para conversar'),
  (NULL, 'pt-BR', 'playground', 'chat.typeMessageBelow', 'Digite uma mensagem abaixo para iniciar uma conversa de teste com {{agentName}}.', 'Instrução para digitar mensagem'),
  (NULL, 'pt-BR', 'playground', 'chat.safeArea', 'Esta é uma área segura para testar o comportamento do seu agente antes de colocá-lo em produção.', 'Descrição da área segura'),
  (NULL, 'pt-BR', 'playground', 'chat.promptStarter.help', 'Como você pode me ajudar hoje?', 'Prompt starter de ajuda'),
  (NULL, 'pt-BR', 'playground', 'chat.promptStarter.knowledgeBase', 'Teste a sua base de conhecimento', 'Prompt starter de base de conhecimento'),
  (NULL, 'pt-BR', 'playground', 'chat.promptStarter.explainFeatures', 'Explique suas funcionalidades', 'Prompt starter de funcionalidades'),
  
  -- Input
  (NULL, 'pt-BR', 'playground', 'input.placeholderWithAgent', 'Digite uma mensagem para {{agentName}}...', 'Placeholder quando há agente selecionado'),
  (NULL, 'pt-BR', 'playground', 'input.placeholderNoAgent', 'Selecione um agente para começar...', 'Placeholder quando não há agente selecionado'),
  
  -- Empty States
  (NULL, 'pt-BR', 'playground', 'empty.noAgents', 'Nenhum agente disponível', 'Título quando não há agentes'),
  (NULL, 'pt-BR', 'playground', 'empty.createAgentsFirst', 'Crie e configure seus agentes no Hub de Agentes primeiro para começar a testar.', 'Descrição quando não há agentes'),
  
  -- Errors
  (NULL, 'pt-BR', 'playground', 'errors.loadFlows', 'Erro ao carregar flows', 'Erro ao carregar flows'),
  (NULL, 'pt-BR', 'playground', 'errors.flowOrUserNotFound', 'Flow ou usuário não encontrado', 'Erro quando flow ou usuário não encontrado'),
  (NULL, 'pt-BR', 'playground', 'errors.executeFlow', 'Erro ao executar flow', 'Erro ao executar flow'),
  (NULL, 'pt-BR', 'playground', 'errors.executeFlowError', 'Erro ao executar flow: {{message}}', 'Erro ao executar flow com mensagem'),
  (NULL, 'pt-BR', 'playground', 'errors.userNotAuthenticated', 'Usuário não autenticado', 'Erro quando usuário não está autenticado'),
  (NULL, 'pt-BR', 'playground', 'errors.loadAgents', 'Erro ao carregar agentes', 'Erro ao carregar agentes'),
  (NULL, 'pt-BR', 'playground', 'errors.sendMessage', 'Erro ao enviar mensagem', 'Erro ao enviar mensagem'),
  (NULL, 'pt-BR', 'playground', 'errors.noResponse', 'Sem resposta', 'Texto quando não há resposta'),
  (NULL, 'pt-BR', 'playground', 'errors.connectionError', 'Erro de conexão com o agente.', 'Erro de conexão'),
  
  -- Success
  (NULL, 'pt-BR', 'playground', 'success.flowExecuted', 'Flow executado com sucesso! {{count}} node(s) processado(s)', 'Mensagem de sucesso ao executar flow'),
  
  -- Warning
  (NULL, 'pt-BR', 'playground', 'warning.flowExecutedWithErrors', 'Flow executado com {{count}} erro(s)', 'Aviso quando flow é executado com erros'),

-- Traduções do Playground em Inglês (en-US)
  -- Header
  (NULL, 'en-US', 'playground', 'header.title', 'Test Area', 'Playground header title'),
  (NULL, 'en-US', 'playground', 'header.description', 'Test your agents and automations before putting them into production. Here you can chat with your agents and execute workflows.', 'Header description'),
  (NULL, 'en-US', 'playground', 'header.testEnvironment', 'Test Environment', 'Test environment label'),
  (NULL, 'en-US', 'playground', 'header.availableChannels', 'Available communication channels', 'Available channels tooltip'),
  
  -- Sidebar
  (NULL, 'en-US', 'playground', 'sidebar.automationsAvailable', 'Available Automations', 'Automations section title'),
  (NULL, 'en-US', 'playground', 'sidebar.automations', 'Automations', 'Automations tooltip title'),
  (NULL, 'en-US', 'playground', 'sidebar.automationsDescription', 'Automated workflows that execute tasks in sequence. Click one to execute it.', 'Automations tooltip description'),
  (NULL, 'en-US', 'playground', 'sidebar.noAutomations', 'No automations available', 'Message when there are no automations'),
  (NULL, 'en-US', 'playground', 'sidebar.agentsAvailable', 'Available Agents', 'Agents section title'),
  (NULL, 'en-US', 'playground', 'sidebar.agents', 'Agents', 'Agents tooltip title'),
  (NULL, 'en-US', 'playground', 'sidebar.agentsDescription', 'Your configured virtual assistants. Select one to start a test conversation.', 'Agents tooltip description'),
  
  -- Buttons
  (NULL, 'en-US', 'playground', 'button.executeAutomation', 'Execute Automation', 'Execute automation button'),
  (NULL, 'en-US', 'playground', 'button.executeAutomationDescription', 'Starts the execution of this workflow. You will see each step being processed in real time.', 'Execute automation button description'),
  (NULL, 'en-US', 'playground', 'button.activateVoice', 'Activate Voice', 'Activate voice button'),
  (NULL, 'en-US', 'playground', 'button.deactivateVoice', 'Deactivate Voice', 'Deactivate voice button'),
  (NULL, 'en-US', 'playground', 'button.activateVoiceDescription', 'Activates voice mode. The agent will speak responses and you can speak instead of typing.', 'Activate voice button description'),
  (NULL, 'en-US', 'playground', 'button.deactivateVoiceDescription', 'Click to deactivate voice mode. The agent will stop speaking and listening.', 'Deactivate voice button description'),
  (NULL, 'en-US', 'playground', 'button.configure', 'Configure', 'Configure button'),
  (NULL, 'en-US', 'playground', 'button.configureAgent', 'Configure Agent', 'Configure agent tooltip title'),
  (NULL, 'en-US', 'playground', 'button.configureAgentDescription', 'Opens the configuration screen to customize the behavior, personality and capabilities of this agent.', 'Configure agent tooltip description'),
  (NULL, 'en-US', 'playground', 'button.send', 'SEND', 'Send message button'),
  
  -- Flow
  (NULL, 'en-US', 'playground', 'flow.readyToExecute', 'Ready to Execute', 'Title when flow is ready to execute'),
  (NULL, 'en-US', 'playground', 'flow.clickExecuteButton', 'Click the "Execute Automation" button at the top of the screen to start this workflow.', 'Instruction to execute flow'),
  (NULL, 'en-US', 'playground', 'flow.realTimeProcessing', 'You will see each step being processed in real time, including responses from involved agents.', 'Real-time processing description'),
  (NULL, 'en-US', 'playground', 'flow.automationsAutoExecute', 'Automations are executed automatically. Use the "Execute Automation" button at the top of the screen.', 'Message about automatic execution'),
  
  -- Chat
  (NULL, 'en-US', 'playground', 'chat.readyToChat', 'Ready to Chat', 'Title when ready to chat'),
  (NULL, 'en-US', 'playground', 'chat.typeMessageBelow', 'Type a message below to start a test conversation with {{agentName}}.', 'Instruction to type message'),
  (NULL, 'en-US', 'playground', 'chat.safeArea', 'This is a safe area to test your agent''s behavior before putting it into production.', 'Safe area description'),
  (NULL, 'en-US', 'playground', 'chat.promptStarter.help', 'How can you help me today?', 'Help prompt starter'),
  (NULL, 'en-US', 'playground', 'chat.promptStarter.knowledgeBase', 'Test your knowledge base', 'Knowledge base prompt starter'),
  (NULL, 'en-US', 'playground', 'chat.promptStarter.explainFeatures', 'Explain your features', 'Features prompt starter'),
  
  -- Input
  (NULL, 'en-US', 'playground', 'input.placeholderWithAgent', 'Type a message for {{agentName}}...', 'Placeholder when agent is selected'),
  (NULL, 'en-US', 'playground', 'input.placeholderNoAgent', 'Select an agent to start...', 'Placeholder when no agent is selected'),
  
  -- Empty States
  (NULL, 'en-US', 'playground', 'empty.noAgents', 'No agents available', 'Title when there are no agents'),
  (NULL, 'en-US', 'playground', 'empty.createAgentsFirst', 'Create and configure your agents in the Agents Hub first to start testing.', 'Description when there are no agents'),
  
  -- Errors
  (NULL, 'en-US', 'playground', 'errors.loadFlows', 'Error loading flows', 'Error loading flows'),
  (NULL, 'en-US', 'playground', 'errors.flowOrUserNotFound', 'Flow or user not found', 'Error when flow or user not found'),
  (NULL, 'en-US', 'playground', 'errors.executeFlow', 'Error executing flow', 'Error executing flow'),
  (NULL, 'en-US', 'playground', 'errors.executeFlowError', 'Error executing flow: {{message}}', 'Error executing flow with message'),
  (NULL, 'en-US', 'playground', 'errors.userNotAuthenticated', 'User not authenticated', 'Error when user is not authenticated'),
  (NULL, 'en-US', 'playground', 'errors.loadAgents', 'Error loading agents', 'Error loading agents'),
  (NULL, 'en-US', 'playground', 'errors.sendMessage', 'Error sending message', 'Error sending message'),
  (NULL, 'en-US', 'playground', 'errors.noResponse', 'No response', 'Text when there is no response'),
  (NULL, 'en-US', 'playground', 'errors.connectionError', 'Connection error with agent.', 'Connection error'),
  
  -- Success
  (NULL, 'en-US', 'playground', 'success.flowExecuted', 'Flow executed successfully! {{count}} node(s) processed', 'Success message when executing flow'),
  
  -- Warning
  (NULL, 'en-US', 'playground', 'warning.flowExecutedWithErrors', 'Flow executed with {{count}} error(s)', 'Warning when flow is executed with errors'),

-- Traduções do Playground em Espanhol (es-ES)
  -- Header
  (NULL, 'es-ES', 'playground', 'header.title', 'Área de Pruebas', 'Título del header del Playground'),
  (NULL, 'es-ES', 'playground', 'header.description', 'Prueba tus agentes y automatizaciones antes de ponerlos en producción. Aquí puedes conversar con tus agentes y ejecutar workflows.', 'Descripción del header'),
  (NULL, 'es-ES', 'playground', 'header.testEnvironment', 'Ambiente de Prueba', 'Etiqueta de ambiente de prueba'),
  (NULL, 'es-ES', 'playground', 'header.availableChannels', 'Canales de comunicación disponibles', 'Tooltip de canales disponibles'),
  
  -- Sidebar
  (NULL, 'es-ES', 'playground', 'sidebar.automationsAvailable', 'Automatizaciones Disponibles', 'Título de la sección de automatizaciones'),
  (NULL, 'es-ES', 'playground', 'sidebar.automations', 'Automatizaciones', 'Título del tooltip de automatizaciones'),
  (NULL, 'es-ES', 'playground', 'sidebar.automationsDescription', 'Flujos de trabajo automatizados que ejecutan tareas en secuencia. Haz clic en uno para ejecutarlo.', 'Descripción del tooltip de automatizaciones'),
  (NULL, 'es-ES', 'playground', 'sidebar.noAutomations', 'Ninguna automatización disponible', 'Mensaje cuando no hay automatizaciones'),
  (NULL, 'es-ES', 'playground', 'sidebar.agentsAvailable', 'Agentes Disponibles', 'Título de la sección de agentes'),
  (NULL, 'es-ES', 'playground', 'sidebar.agents', 'Agentes', 'Título del tooltip de agentes'),
  (NULL, 'es-ES', 'playground', 'sidebar.agentsDescription', 'Tus asistentes virtuales configurados. Selecciona uno para iniciar una conversación de prueba.', 'Descripción del tooltip de agentes'),
  
  -- Buttons
  (NULL, 'es-ES', 'playground', 'button.executeAutomation', 'Ejecutar Automatización', 'Botón de ejecutar automatización'),
  (NULL, 'es-ES', 'playground', 'button.executeAutomationDescription', 'Inicia la ejecución de este flujo de trabajo. Verás cada etapa siendo procesada en tiempo real.', 'Descripción del botón de ejecutar automatización'),
  (NULL, 'es-ES', 'playground', 'button.activateVoice', 'Activar Voz', 'Botón de activar voz'),
  (NULL, 'es-ES', 'playground', 'button.deactivateVoice', 'Desactivar Voz', 'Botón de desactivar voz'),
  (NULL, 'es-ES', 'playground', 'button.activateVoiceDescription', 'Activa el modo de voz. El agente hablará las respuestas y puedes hablar en lugar de escribir.', 'Descripción del botón de activar voz'),
  (NULL, 'es-ES', 'playground', 'button.deactivateVoiceDescription', 'Haz clic para desactivar el modo de voz. El agente dejará de hablar y escuchar.', 'Descripción del botón de desactivar voz'),
  (NULL, 'es-ES', 'playground', 'button.configure', 'Configurar', 'Botón de configurar'),
  (NULL, 'es-ES', 'playground', 'button.configureAgent', 'Configurar Agente', 'Título del tooltip de configurar agente'),
  (NULL, 'es-ES', 'playground', 'button.configureAgentDescription', 'Abre la pantalla de configuración para personalizar el comportamiento, personalidad y capacidades de este agente.', 'Descripción del tooltip de configurar agente'),
  (NULL, 'es-ES', 'playground', 'button.send', 'ENVIAR', 'Botón de enviar mensaje'),
  
  -- Flow
  (NULL, 'es-ES', 'playground', 'flow.readyToExecute', 'Listo para Ejecutar', 'Título cuando flow está listo para ejecutar'),
  (NULL, 'es-ES', 'playground', 'flow.clickExecuteButton', 'Haz clic en el botón "Ejecutar Automatización" en la parte superior de la pantalla para iniciar este flujo de trabajo.', 'Instrucción para ejecutar flow'),
  (NULL, 'es-ES', 'playground', 'flow.realTimeProcessing', 'Verás cada etapa siendo procesada en tiempo real, incluyendo las respuestas de los agentes involucrados.', 'Descripción del procesamiento en tiempo real'),
  (NULL, 'es-ES', 'playground', 'flow.automationsAutoExecute', 'Las automatizaciones se ejecutan automáticamente. Usa el botón "Ejecutar Automatización" en la parte superior de la pantalla.', 'Mensaje sobre ejecución automática'),
  
  -- Chat
  (NULL, 'es-ES', 'playground', 'chat.readyToChat', 'Listo para Conversar', 'Título cuando está listo para conversar'),
  (NULL, 'es-ES', 'playground', 'chat.typeMessageBelow', 'Escribe un mensaje a continuación para iniciar una conversación de prueba con {{agentName}}.', 'Instrucción para escribir mensaje'),
  (NULL, 'es-ES', 'playground', 'chat.safeArea', 'Esta es un área segura para probar el comportamiento de tu agente antes de ponerlo en producción.', 'Descripción del área segura'),
  (NULL, 'es-ES', 'playground', 'chat.promptStarter.help', '¿Cómo puedes ayudarme hoy?', 'Prompt starter de ayuda'),
  (NULL, 'es-ES', 'playground', 'chat.promptStarter.knowledgeBase', 'Prueba tu base de conocimiento', 'Prompt starter de base de conocimiento'),
  (NULL, 'es-ES', 'playground', 'chat.promptStarter.explainFeatures', 'Explica tus funcionalidades', 'Prompt starter de funcionalidades'),
  
  -- Input
  (NULL, 'es-ES', 'playground', 'input.placeholderWithAgent', 'Escribe un mensaje para {{agentName}}...', 'Placeholder cuando hay agente seleccionado'),
  (NULL, 'es-ES', 'playground', 'input.placeholderNoAgent', 'Selecciona un agente para comenzar...', 'Placeholder cuando no hay agente seleccionado'),
  
  -- Empty States
  (NULL, 'es-ES', 'playground', 'empty.noAgents', 'Ningún agente disponible', 'Título cuando no hay agentes'),
  (NULL, 'es-ES', 'playground', 'empty.createAgentsFirst', 'Crea y configura tus agentes en el Hub de Agentes primero para comenzar a probar.', 'Descripción cuando no hay agentes'),
  
  -- Errors
  (NULL, 'es-ES', 'playground', 'errors.loadFlows', 'Error al cargar flows', 'Error al cargar flows'),
  (NULL, 'es-ES', 'playground', 'errors.flowOrUserNotFound', 'Flow o usuario no encontrado', 'Error cuando flow o usuario no encontrado'),
  (NULL, 'es-ES', 'playground', 'errors.executeFlow', 'Error al ejecutar flow', 'Error al ejecutar flow'),
  (NULL, 'es-ES', 'playground', 'errors.executeFlowError', 'Error al ejecutar flow: {{message}}', 'Error al ejecutar flow con mensaje'),
  (NULL, 'es-ES', 'playground', 'errors.userNotAuthenticated', 'Usuario no autenticado', 'Error cuando usuario no está autenticado'),
  (NULL, 'es-ES', 'playground', 'errors.loadAgents', 'Error al cargar agentes', 'Error al cargar agentes'),
  (NULL, 'es-ES', 'playground', 'errors.sendMessage', 'Error al enviar mensaje', 'Error al enviar mensaje'),
  (NULL, 'es-ES', 'playground', 'errors.noResponse', 'Sin respuesta', 'Texto cuando no hay respuesta'),
  (NULL, 'es-ES', 'playground', 'errors.connectionError', 'Error de conexión con el agente.', 'Error de conexión'),
  
  -- Success
  (NULL, 'es-ES', 'playground', 'success.flowExecuted', '¡Flow ejecutado con éxito! {{count}} nodo(s) procesado(s)', 'Mensaje de éxito al ejecutar flow'),
  
  -- Warning
  (NULL, 'es-ES', 'playground', 'warning.flowExecutedWithErrors', 'Flow ejecutado con {{count}} error(es)', 'Advertencia cuando flow es ejecutado con errores')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
