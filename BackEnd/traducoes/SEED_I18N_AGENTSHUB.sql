-- ============================================
-- SEED I18N: AgentsHub
-- ============================================
-- Traduções para a página AgentsHub
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'header.title', 'Agents Hub', 'Título da página'),
  (NULL, 'pt-BR', 'agentsHub', 'header.subtitle', 'Gerencie sua força de trabalho global e omnichannel para SDR e Suporte.', 'Subtítulo da página'),
  
  (NULL, 'en-US', 'agentsHub', 'header.title', 'Agents Hub', 'Page title'),
  (NULL, 'en-US', 'agentsHub', 'header.subtitle', 'Manage your global, omnichannel workforce for SDR and Support.', 'Page subtitle'),
  
  (NULL, 'es-ES', 'agentsHub', 'header.title', 'Centro de Agentes', 'Título de la página'),
  (NULL, 'es-ES', 'agentsHub', 'header.subtitle', 'Gestiona tu fuerza de trabajo global y omnicanal para SDR y Soporte.', 'Subtítulo de la página'),

  -- ============================================
  -- BUTTONS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'button.deployNewAgent', 'Implantar Novo Agente', 'Botão para criar novo agente'),
  (NULL, 'pt-BR', 'agentsHub', 'button.deployAgent', 'Implantar Agente', 'Botão para implantar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'button.createSonia', 'Criar Sonia', 'Botão para criar Sonia'),
  (NULL, 'pt-BR', 'agentsHub', 'button.createTemplate', 'Criar Template', 'Botão para criar template'),
  (NULL, 'pt-BR', 'agentsHub', 'button.manage', 'Gerenciar', 'Botão para gerenciar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'button.useTemplate', 'Usar Template', 'Botão para usar template'),
  (NULL, 'pt-BR', 'agentsHub', 'button.startFromTemplate', 'Começar de um template', 'Texto do botão'),
  (NULL, 'pt-BR', 'agentsHub', 'button.startFromScratch', 'Começar do zero', 'Texto do botão'),
  
  (NULL, 'en-US', 'agentsHub', 'button.deployNewAgent', 'Deploy New Agent', 'Button to create new agent'),
  (NULL, 'en-US', 'agentsHub', 'button.deployAgent', 'Deploy Agent', 'Button to deploy agent'),
  (NULL, 'en-US', 'agentsHub', 'button.createSonia', 'Create Sonia', 'Button to create Sonia'),
  (NULL, 'en-US', 'agentsHub', 'button.createTemplate', 'Create Template', 'Button to create template'),
  (NULL, 'en-US', 'agentsHub', 'button.manage', 'Manage', 'Button to manage agent'),
  (NULL, 'en-US', 'agentsHub', 'button.useTemplate', 'Use Template', 'Button to use template'),
  (NULL, 'en-US', 'agentsHub', 'button.startFromTemplate', 'Start from a template', 'Button text'),
  (NULL, 'en-US', 'agentsHub', 'button.startFromScratch', 'Start from scratch', 'Button text'),
  
  (NULL, 'es-ES', 'agentsHub', 'button.deployNewAgent', 'Desplegar Nuevo Agente', 'Botón para crear nuevo agente'),
  (NULL, 'es-ES', 'agentsHub', 'button.deployAgent', 'Desplegar Agente', 'Botón para desplegar agente'),
  (NULL, 'es-ES', 'agentsHub', 'button.createSonia', 'Crear Sonia', 'Botón para crear Sonia'),
  (NULL, 'es-ES', 'agentsHub', 'button.createTemplate', 'Crear Plantilla', 'Botón para crear plantilla'),
  (NULL, 'es-ES', 'agentsHub', 'button.manage', 'Gestionar', 'Botón para gestionar agente'),
  (NULL, 'es-ES', 'agentsHub', 'button.useTemplate', 'Usar Plantilla', 'Botón para usar plantilla'),
  (NULL, 'es-ES', 'agentsHub', 'button.startFromTemplate', 'Empezar desde una plantilla', 'Texto del botón'),
  (NULL, 'es-ES', 'agentsHub', 'button.startFromScratch', 'Empezar desde cero', 'Texto del botón'),

  -- ============================================
  -- TABS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'tabs.activeWorkforce', 'Força de Trabalho Ativa', 'Aba de agentes ativos'),
  (NULL, 'pt-BR', 'agentsHub', 'tabs.templates', 'Templates', 'Aba de templates'),
  
  (NULL, 'en-US', 'agentsHub', 'tabs.activeWorkforce', 'Active Workforce', 'Active agents tab'),
  (NULL, 'en-US', 'agentsHub', 'tabs.templates', 'Templates', 'Templates tab'),
  
  (NULL, 'es-ES', 'agentsHub', 'tabs.activeWorkforce', 'Fuerza de Trabajo Activa', 'Pestaña de agentes activos'),
  (NULL, 'es-ES', 'agentsHub', 'tabs.templates', 'Plantillas', 'Pestaña de plantillas'),

  -- ============================================
  -- DIALOG: CREATE AGENT
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.title', 'Criar Nova Sonia', 'Título do diálogo'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.progress.0', 'Configure sua assistente virtual personalizada em poucos passos.', 'Mensagem de progresso 0%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.progress.25', 'Você está no caminho certo!', 'Mensagem de progresso 25%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.progress.50', 'Continue preenchendo os campos para criar sua Sonia.', 'Mensagem de progresso 50%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.progress.75', 'Quase lá! Complete os campos restantes.', 'Mensagem de progresso 75%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createAgent.progress.100', '✨ Falta pouco para sua Sonia ganhar vida!', 'Mensagem de progresso 100%'),
  
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.title', 'Create New Sonia', 'Dialog title'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.progress.0', 'Configure your personalized virtual assistant in a few steps.', 'Progress message 0%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.progress.25', 'You are on the right track!', 'Progress message 25%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.progress.50', 'Keep filling in the fields to create your Sonia.', 'Progress message 50%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.progress.75', 'Almost there! Complete the remaining fields.', 'Progress message 75%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createAgent.progress.100', '✨ Just a little more for your Sonia to come to life!', 'Progress message 100%'),
  
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.title', 'Crear Nueva Sonia', 'Título del diálogo'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.progress.0', 'Configura tu asistente virtual personalizada en pocos pasos.', 'Mensaje de progreso 0%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.progress.25', '¡Estás en el camino correcto!', 'Mensaje de progreso 25%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.progress.50', 'Continúa completando los campos para crear tu Sonia.', 'Mensaje de progreso 50%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.progress.75', '¡Casi ahí! Completa los campos restantes.', 'Mensaje de progreso 75%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createAgent.progress.100', '✨ ¡Falta poco para que tu Sonia cobre vida!', 'Mensaje de progreso 100%'),

  -- ============================================
  -- DIALOG: CREATE TEMPLATE
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createTemplate.title', 'Criar Template', 'Título do diálogo'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createTemplate.progress.0', 'Configure um template reutilizável para criar agentes.', 'Mensagem de progresso 0%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createTemplate.progress.33', 'Continue preenchendo os campos para criar seu template.', 'Mensagem de progresso 33%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createTemplate.progress.66', 'Quase lá! Complete os campos restantes.', 'Mensagem de progresso 66%'),
  (NULL, 'pt-BR', 'agentsHub', 'dialog.createTemplate.progress.100', '✨ Template pronto para ser criado!', 'Mensagem de progresso 100%'),
  
  (NULL, 'en-US', 'agentsHub', 'dialog.createTemplate.title', 'Create Template', 'Dialog title'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createTemplate.progress.0', 'Configure a reusable template to create agents.', 'Progress message 0%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createTemplate.progress.33', 'Keep filling in the fields to create your template.', 'Progress message 33%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createTemplate.progress.66', 'Almost there! Complete the remaining fields.', 'Progress message 66%'),
  (NULL, 'en-US', 'agentsHub', 'dialog.createTemplate.progress.100', '✨ Template ready to be created!', 'Progress message 100%'),
  
  (NULL, 'es-ES', 'agentsHub', 'dialog.createTemplate.title', 'Crear Plantilla', 'Título del diálogo'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createTemplate.progress.0', 'Configura una plantilla reutilizable para crear agentes.', 'Mensaje de progreso 0%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createTemplate.progress.33', 'Continúa completando los campos para crear tu plantilla.', 'Mensaje de progreso 33%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createTemplate.progress.66', '¡Casi ahí! Completa los campos restantes.', 'Mensaje de progreso 66%'),
  (NULL, 'es-ES', 'agentsHub', 'dialog.createTemplate.progress.100', '✨ ¡Plantilla lista para ser creada!', 'Mensaje de progreso 100%'),

  -- ============================================
  -- FORM: IDENTITY
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.title', 'Identidade', 'Título da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.description', 'Informações básicas da sua Sonia', 'Descrição da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.nameLabel', 'Dê um nome para sua Sonia', 'Label do campo nome'),
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.namePlaceholder', 'Ex: Maria Atendimento ou João Vendas', 'Placeholder do campo nome'),
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.languageLabel', 'Em qual idioma ela vai conversar?', 'Label do campo idioma'),
  (NULL, 'pt-BR', 'agentsHub', 'form.identity.languagePlaceholder', 'Selecione o idioma principal', 'Placeholder do campo idioma'),
  
  (NULL, 'en-US', 'agentsHub', 'form.identity.title', 'Identity', 'Section title'),
  (NULL, 'en-US', 'agentsHub', 'form.identity.description', 'Basic information about your Sonia', 'Section description'),
  (NULL, 'en-US', 'agentsHub', 'form.identity.nameLabel', 'Give your Sonia a name', 'Name field label'),
  (NULL, 'en-US', 'agentsHub', 'form.identity.namePlaceholder', 'Ex: Maria Support or João Sales', 'Name field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.identity.languageLabel', 'What language will she speak?', 'Language field label'),
  (NULL, 'en-US', 'agentsHub', 'form.identity.languagePlaceholder', 'Select the primary language', 'Language field placeholder'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.identity.title', 'Identidad', 'Título de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.identity.description', 'Información básica de tu Sonia', 'Descripción de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.identity.nameLabel', 'Dale un nombre a tu Sonia', 'Etiqueta del campo nombre'),
  (NULL, 'es-ES', 'agentsHub', 'form.identity.namePlaceholder', 'Ej: María Atención o Juan Ventas', 'Placeholder del campo nombre'),
  (NULL, 'es-ES', 'agentsHub', 'form.identity.languageLabel', '¿En qué idioma hablará?', 'Etiqueta del campo idioma'),
  (NULL, 'es-ES', 'agentsHub', 'form.identity.languagePlaceholder', 'Selecciona el idioma principal', 'Placeholder del campo idioma'),

  -- ============================================
  -- FORM: TECHNICAL
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.technical.title', 'Configuração Técnica', 'Título da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.technical.description', 'Defina como sua Sonia vai funcionar', 'Descrição da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.technical.roleLabel', 'Qual o papel da sua Sonia?', 'Label do campo papel'),
  (NULL, 'pt-BR', 'agentsHub', 'form.technical.rolePlaceholder', 'Escolha um template de função', 'Placeholder do campo papel'),
  
  (NULL, 'en-US', 'agentsHub', 'form.technical.title', 'Technical Configuration', 'Section title'),
  (NULL, 'en-US', 'agentsHub', 'form.technical.description', 'Define how your Sonia will work', 'Section description'),
  (NULL, 'en-US', 'agentsHub', 'form.technical.roleLabel', 'What is your Sonia''s role?', 'Role field label'),
  (NULL, 'en-US', 'agentsHub', 'form.technical.rolePlaceholder', 'Choose a function template', 'Role field placeholder'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.technical.title', 'Configuración Técnica', 'Título de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.technical.description', 'Define cómo funcionará tu Sonia', 'Descripción de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.technical.roleLabel', '¿Cuál es el papel de tu Sonia?', 'Etiqueta del campo papel'),
  (NULL, 'es-ES', 'agentsHub', 'form.technical.rolePlaceholder', 'Elige una plantilla de función', 'Placeholder del campo papel'),

  -- ============================================
  -- FORM: ADVANCED
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.title', 'Configurações Avançadas (opcional)', 'Título do accordion'),
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.communicationLabel', 'Conexão de Comunicação', 'Label do campo comunicação'),
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.communicationPlaceholder', 'Selecione como ela vai se comunicar', 'Placeholder do campo comunicação'),
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.crmLabel', 'Integração com CRM', 'Label do campo CRM'),
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.crmPlaceholder', 'Conecte com seu CRM', 'Placeholder do campo CRM'),
  (NULL, 'pt-BR', 'agentsHub', 'form.advanced.noCRM', 'Não usar CRM', 'Opção sem CRM'),
  
  (NULL, 'en-US', 'agentsHub', 'form.advanced.title', 'Advanced Settings (optional)', 'Accordion title'),
  (NULL, 'en-US', 'agentsHub', 'form.advanced.communicationLabel', 'Communication Connection', 'Communication field label'),
  (NULL, 'en-US', 'agentsHub', 'form.advanced.communicationPlaceholder', 'Select how she will communicate', 'Communication field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.advanced.crmLabel', 'CRM Integration', 'CRM field label'),
  (NULL, 'en-US', 'agentsHub', 'form.advanced.crmPlaceholder', 'Connect with your CRM', 'CRM field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.advanced.noCRM', 'Don''t use CRM', 'No CRM option'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.title', 'Configuraciones Avanzadas (opcional)', 'Título del acordeón'),
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.communicationLabel', 'Conexión de Comunicación', 'Etiqueta del campo comunicación'),
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.communicationPlaceholder', 'Selecciona cómo se comunicará', 'Placeholder del campo comunicación'),
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.crmLabel', 'Integración con CRM', 'Etiqueta del campo CRM'),
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.crmPlaceholder', 'Conecta con tu CRM', 'Placeholder del campo CRM'),
  (NULL, 'es-ES', 'agentsHub', 'form.advanced.noCRM', 'No usar CRM', 'Opción sin CRM'),

  -- ============================================
  -- FORM: PERSONALITY
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.personality.title', 'Personalidade', 'Título da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.personality.description', 'Defina como sua Sonia se comporta', 'Descrição da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.personality.behaviorLabel', 'Como ela deve se comportar?', 'Label do campo comportamento'),
  (NULL, 'pt-BR', 'agentsHub', 'form.personality.behaviorTooltip', 'Descreva o tom de voz e como a IA deve se portar (ex: amigável, formal, usa emojis).', 'Tooltip do campo comportamento'),
  (NULL, 'pt-BR', 'agentsHub', 'form.personality.behaviorPlaceholder', 'Ex: Seja cordial, responda de forma direta e use um tom profissional...', 'Placeholder do campo comportamento'),
  
  (NULL, 'en-US', 'agentsHub', 'form.personality.title', 'Personality', 'Section title'),
  (NULL, 'en-US', 'agentsHub', 'form.personality.description', 'Define how your Sonia behaves', 'Section description'),
  (NULL, 'en-US', 'agentsHub', 'form.personality.behaviorLabel', 'How should she behave?', 'Behavior field label'),
  (NULL, 'en-US', 'agentsHub', 'form.personality.behaviorTooltip', 'Describe the tone of voice and how the AI should behave (e.g., friendly, formal, uses emojis).', 'Behavior field tooltip'),
  (NULL, 'en-US', 'agentsHub', 'form.personality.behaviorPlaceholder', 'Ex: Be cordial, respond directly and use a professional tone...', 'Behavior field placeholder'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.personality.title', 'Personalidad', 'Título de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.personality.description', 'Define cómo se comporta tu Sonia', 'Descripción de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.personality.behaviorLabel', '¿Cómo debe comportarse?', 'Etiqueta del campo comportamiento'),
  (NULL, 'es-ES', 'agentsHub', 'form.personality.behaviorTooltip', 'Describe el tono de voz y cómo debe comportarse la IA (ej: amigable, formal, usa emojis).', 'Tooltip del campo comportamiento'),
  (NULL, 'es-ES', 'agentsHub', 'form.personality.behaviorPlaceholder', 'Ej: Sé cordial, responde de forma directa y usa un tono profesional...', 'Placeholder del campo comportamiento'),

  -- ============================================
  -- FORM: PROGRESS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.progress.step', 'Passo {{current}} de {{total}}', 'Indicador de passo'),
  
  (NULL, 'en-US', 'agentsHub', 'form.progress.step', 'Step {{current}} of {{total}}', 'Step indicator'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.progress.step', 'Paso {{current}} de {{total}}', 'Indicador de paso'),

  -- ============================================
  -- FORM: TEMPLATE - IDENTITY
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.title', 'Identidade', 'Título da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.description', 'Informações básicas do template', 'Descrição da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.nameLabel', 'Dê um nome para o template', 'Label do campo nome'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.namePlaceholder', 'Ex: Atendente L1 ou Vendedor Especialista', 'Placeholder do campo nome'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.roleLabel', 'Qual o papel/função deste template?', 'Label do campo papel'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.identity.rolePlaceholder', 'Ex: Suporte ao Cliente ou Vendas', 'Placeholder do campo papel'),
  
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.title', 'Identity', 'Section title'),
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.description', 'Basic template information', 'Section description'),
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.nameLabel', 'Give the template a name', 'Name field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.namePlaceholder', 'Ex: L1 Support or Sales Specialist', 'Name field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.roleLabel', 'What is the role/function of this template?', 'Role field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.identity.rolePlaceholder', 'Ex: Customer Support or Sales', 'Role field placeholder'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.title', 'Identidad', 'Título de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.description', 'Información básica de la plantilla', 'Descripción de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.nameLabel', 'Dale un nombre a la plantilla', 'Etiqueta del campo nombre'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.namePlaceholder', 'Ej: Atención L1 o Vendedor Especialista', 'Placeholder del campo nombre'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.roleLabel', '¿Cuál es el papel/función de esta plantilla?', 'Etiqueta del campo papel'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.identity.rolePlaceholder', 'Ej: Soporte al Cliente o Ventas', 'Placeholder del campo papel'),

  -- ============================================
  -- FORM: TEMPLATE - CONFIGURATION
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.title', 'Configuração', 'Título da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.description', 'Defina como o template funciona', 'Descrição da seção'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.systemScriptLabel', 'Script do Sistema', 'Label do campo script'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.systemScriptTooltip', 'Prompt do sistema que define o comportamento do agente.', 'Tooltip do campo script'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.systemScriptPlaceholder', 'Ex: Você é um agente de atendimento especializado em resolver problemas técnicos...', 'Placeholder do campo script'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.iconLabel', 'Ícone', 'Label do campo ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.iconPlaceholder', 'Selecione um ícone', 'Placeholder do campo ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.icon.users', 'Users', 'Opção de ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.icon.messageCircle', 'Message Circle', 'Opção de ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.icon.barChart', 'Bar Chart', 'Opção de ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.icon.settings', 'Settings', 'Opção de ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.icon.bot', 'Bot', 'Opção de ícone'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.complexityLabel', 'Complexidade', 'Label do campo complexidade'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.complexityPlaceholder', 'Selecione a complexidade', 'Placeholder do campo complexidade'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.complexity.simple', 'Simples', 'Opção de complexidade'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.complexity.intermediate', 'Intermediário', 'Opção de complexidade'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.configuration.complexity.advanced', 'Avançado', 'Opção de complexidade'),
  
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.title', 'Configuration', 'Section title'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.description', 'Define how the template works', 'Section description'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.systemScriptLabel', 'System Script', 'Script field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.systemScriptTooltip', 'System prompt that defines the agent''s behavior.', 'Script field tooltip'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.systemScriptPlaceholder', 'Ex: You are a support agent specialized in solving technical problems...', 'Script field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.iconLabel', 'Icon', 'Icon field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.iconPlaceholder', 'Select an icon', 'Icon field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.icon.users', 'Users', 'Icon option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.icon.messageCircle', 'Message Circle', 'Icon option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.icon.barChart', 'Bar Chart', 'Icon option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.icon.settings', 'Settings', 'Icon option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.icon.bot', 'Bot', 'Icon option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.complexityLabel', 'Complexity', 'Complexity field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.complexityPlaceholder', 'Select the complexity', 'Complexity field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.complexity.simple', 'Simple', 'Complexity option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.complexity.intermediate', 'Intermediate', 'Complexity option'),
  (NULL, 'en-US', 'agentsHub', 'form.template.configuration.complexity.advanced', 'Advanced', 'Complexity option'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.title', 'Configuración', 'Título de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.description', 'Define cómo funciona la plantilla', 'Descripción de la sección'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.systemScriptLabel', 'Script del Sistema', 'Etiqueta del campo script'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.systemScriptTooltip', 'Prompt del sistema que define el comportamiento del agente.', 'Tooltip del campo script'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.systemScriptPlaceholder', 'Ej: Eres un agente de atención especializado en resolver problemas técnicos...', 'Placeholder del campo script'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.iconLabel', 'Icono', 'Etiqueta del campo icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.iconPlaceholder', 'Selecciona un icono', 'Placeholder del campo icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.icon.users', 'Users', 'Opción de icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.icon.messageCircle', 'Message Circle', 'Opción de icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.icon.barChart', 'Bar Chart', 'Opción de icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.icon.settings', 'Settings', 'Opción de icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.icon.bot', 'Bot', 'Opción de icono'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.complexityLabel', 'Complejidad', 'Etiqueta del campo complejidad'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.complexityPlaceholder', 'Selecciona la complejidad', 'Placeholder del campo complejidad'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.complexity.simple', 'Simple', 'Opción de complejidad'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.complexity.intermediate', 'Intermedio', 'Opción de complejidad'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.configuration.complexity.advanced', 'Avanzado', 'Opción de complejidad'),

  -- ============================================
  -- FORM: TEMPLATE - OPTIONAL
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'form.template.optional.title', 'Configurações Opcionais', 'Título do accordion'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.optional.channelsLabel', 'Canais de Comunicação', 'Label do campo canais'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.optional.skillsLabel', 'Habilidades', 'Label do campo habilidades'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.optional.skillsPlaceholder', 'Selecione uma habilidade...', 'Placeholder do campo habilidades'),
  (NULL, 'pt-BR', 'agentsHub', 'form.template.optional.skillsSearch', 'Buscar habilidades...', 'Placeholder da busca'),
  
  (NULL, 'en-US', 'agentsHub', 'form.template.optional.title', 'Optional Settings', 'Accordion title'),
  (NULL, 'en-US', 'agentsHub', 'form.template.optional.channelsLabel', 'Communication Channels', 'Channels field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.optional.skillsLabel', 'Skills', 'Skills field label'),
  (NULL, 'en-US', 'agentsHub', 'form.template.optional.skillsPlaceholder', 'Select a skill...', 'Skills field placeholder'),
  (NULL, 'en-US', 'agentsHub', 'form.template.optional.skillsSearch', 'Search skills...', 'Search placeholder'),
  
  (NULL, 'es-ES', 'agentsHub', 'form.template.optional.title', 'Configuraciones Opcionales', 'Título del acordeón'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.optional.channelsLabel', 'Canales de Comunicación', 'Etiqueta del campo canales'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.optional.skillsLabel', 'Habilidades', 'Etiqueta del campo habilidades'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.optional.skillsPlaceholder', 'Selecciona una habilidad...', 'Placeholder del campo habilidades'),
  (NULL, 'es-ES', 'agentsHub', 'form.template.optional.skillsSearch', 'Buscar habilidades...', 'Placeholder de la búsqueda'),

  -- ============================================
  -- CHANNELS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'channels.status.connected', 'Conectado', 'Status conectado'),
  (NULL, 'pt-BR', 'agentsHub', 'channels.status.partial', 'Parcial', 'Status parcial'),
  (NULL, 'pt-BR', 'agentsHub', 'channels.status.disconnected', 'Desconectado', 'Status desconectado'),
  
  (NULL, 'en-US', 'agentsHub', 'channels.status.connected', 'Connected', 'Connected status'),
  (NULL, 'en-US', 'agentsHub', 'channels.status.partial', 'Partial', 'Partial status'),
  (NULL, 'en-US', 'agentsHub', 'channels.status.disconnected', 'Disconnected', 'Disconnected status'),
  
  (NULL, 'es-ES', 'agentsHub', 'channels.status.connected', 'Conectado', 'Estado conectado'),
  (NULL, 'es-ES', 'agentsHub', 'channels.status.partial', 'Parcial', 'Estado parcial'),
  (NULL, 'es-ES', 'agentsHub', 'channels.status.disconnected', 'Desconectado', 'Estado desconectado'),

  -- ============================================
  -- ACTIONS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'actions.reactivate', 'Reativar', 'Ação reativar'),
  (NULL, 'pt-BR', 'agentsHub', 'actions.pause', 'Pausar', 'Ação pausar'),
  (NULL, 'pt-BR', 'agentsHub', 'actions.delete', 'Excluir Agente', 'Ação excluir'),
  
  (NULL, 'en-US', 'agentsHub', 'actions.reactivate', 'Reactivate', 'Reactivate action'),
  (NULL, 'en-US', 'agentsHub', 'actions.pause', 'Pause', 'Pause action'),
  (NULL, 'en-US', 'agentsHub', 'actions.delete', 'Delete Agent', 'Delete action'),
  
  (NULL, 'es-ES', 'agentsHub', 'actions.reactivate', 'Reactivar', 'Acción reactivar'),
  (NULL, 'es-ES', 'agentsHub', 'actions.pause', 'Pausar', 'Acción pausar'),
  (NULL, 'es-ES', 'agentsHub', 'actions.delete', 'Eliminar Agente', 'Acción eliminar'),

  -- ============================================
  -- AGENT
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'agent.noTemplate', 'Sem template', 'Mensagem sem template'),
  (NULL, 'pt-BR', 'agentsHub', 'agent.templateNotFound', 'Template não encontrado', 'Mensagem template não encontrado'),
  (NULL, 'pt-BR', 'agentsHub', 'agent.noTemplateAssigned', 'Nenhum template atribuído.', 'Mensagem sem template atribuído'),
  
  (NULL, 'en-US', 'agentsHub', 'agent.noTemplate', 'No template', 'No template message'),
  (NULL, 'en-US', 'agentsHub', 'agent.templateNotFound', 'Template not found', 'Template not found message'),
  (NULL, 'en-US', 'agentsHub', 'agent.noTemplateAssigned', 'No template assigned.', 'No template assigned message'),
  
  (NULL, 'es-ES', 'agentsHub', 'agent.noTemplate', 'Sin plantilla', 'Mensaje sin plantilla'),
  (NULL, 'es-ES', 'agentsHub', 'agent.templateNotFound', 'Plantilla no encontrada', 'Mensaje plantilla no encontrada'),
  (NULL, 'es-ES', 'agentsHub', 'agent.noTemplateAssigned', 'Ninguna plantilla asignada.', 'Mensaje sin plantilla asignada'),

  -- ============================================
  -- TEMPLATE
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'template.noDescription', 'Sem descrição disponível.', 'Mensagem sem descrição'),
  
  (NULL, 'en-US', 'agentsHub', 'template.noDescription', 'No description available.', 'No description message'),
  
  (NULL, 'es-ES', 'agentsHub', 'template.noDescription', 'Sin descripción disponible.', 'Mensaje sin descripción'),

  -- ============================================
  -- EMPTY STATES
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'empty.noAgents', 'Nenhum agente implantado', 'Título estado vazio'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noAgentsDescription', 'Implante seu primeiro agente de IA para começar.', 'Descrição estado vazio'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noTemplates', 'Nenhum template disponível', 'Título estado vazio'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noTemplatesDescription', 'Crie seu primeiro template para começar', 'Descrição estado vazio'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noIntegrations', 'Nenhuma integração encontrada', 'Mensagem sem integrações'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noCRMs', 'Nenhum CRM conectado. Configure na tela de Integrações.', 'Mensagem sem CRMs'),
  (NULL, 'pt-BR', 'agentsHub', 'empty.noSkills', 'Nenhuma habilidade encontrada.', 'Mensagem sem habilidades'),
  
  (NULL, 'en-US', 'agentsHub', 'empty.noAgents', 'No agents deployed', 'Empty state title'),
  (NULL, 'en-US', 'agentsHub', 'empty.noAgentsDescription', 'Deploy your first AI agent to get started.', 'Empty state description'),
  (NULL, 'en-US', 'agentsHub', 'empty.noTemplates', 'No templates available', 'Empty state title'),
  (NULL, 'en-US', 'agentsHub', 'empty.noTemplatesDescription', 'Create your first template to get started', 'Empty state description'),
  (NULL, 'en-US', 'agentsHub', 'empty.noIntegrations', 'No integrations found', 'No integrations message'),
  (NULL, 'en-US', 'agentsHub', 'empty.noCRMs', 'No CRM connected. Configure in the Integrations screen.', 'No CRMs message'),
  (NULL, 'en-US', 'agentsHub', 'empty.noSkills', 'No skills found.', 'No skills message'),
  
  (NULL, 'es-ES', 'agentsHub', 'empty.noAgents', 'Ningún agente desplegado', 'Título estado vacío'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noAgentsDescription', 'Despliega tu primer agente de IA para comenzar.', 'Descripción estado vacío'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noTemplates', 'Ninguna plantilla disponible', 'Título estado vacío'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noTemplatesDescription', 'Crea tu primera plantilla para comenzar', 'Descripción estado vacío'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noIntegrations', 'Ninguna integración encontrada', 'Mensaje sin integraciones'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noCRMs', 'Ningún CRM conectado. Configura en la pantalla de Integraciones.', 'Mensaje sin CRMs'),
  (NULL, 'es-ES', 'agentsHub', 'empty.noSkills', 'Ninguna habilidad encontrada.', 'Mensaje sin habilidades'),

  -- ============================================
  -- LOADING
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'loading.templates', 'Carregando templates...', 'Mensagem de carregamento'),
  (NULL, 'pt-BR', 'agentsHub', 'loading.integrations', 'Carregando integrações...', 'Mensagem de carregamento'),
  (NULL, 'pt-BR', 'agentsHub', 'loading.crms', 'Carregando CRMs...', 'Mensagem de carregamento'),
  
  (NULL, 'en-US', 'agentsHub', 'loading.templates', 'Loading templates...', 'Loading message'),
  (NULL, 'en-US', 'agentsHub', 'loading.integrations', 'Loading integrations...', 'Loading message'),
  (NULL, 'en-US', 'agentsHub', 'loading.crms', 'Loading CRMs...', 'Loading message'),
  
  (NULL, 'es-ES', 'agentsHub', 'loading.templates', 'Cargando plantillas...', 'Mensaje de carga'),
  (NULL, 'es-ES', 'agentsHub', 'loading.integrations', 'Cargando integraciones...', 'Mensaje de carga'),
  (NULL, 'es-ES', 'agentsHub', 'loading.crms', 'Cargando CRMs...', 'Mensaje de carga'),

  -- ============================================
  -- ERRORS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'errors.error', 'Erro', 'Título de erro'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.emailNotFound', 'Email do usuário não encontrado. Faça login novamente.', 'Erro email não encontrado'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.nameRequired', 'Nome obrigatório', 'Erro nome obrigatório'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.nameRequiredDescription', 'Por favor, informe um nome para o agente.', 'Descrição erro nome'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.templateNotSelected', 'Template não selecionado', 'Erro template não selecionado'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.templateNotSelectedDescription', 'Por favor, selecione um template para o agente.', 'Descrição erro template'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.personalityRequired', 'Personalidade obrigatória', 'Erro personalidade obrigatória'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.personalityRequiredDescription', 'Por favor, descreva como sua Sonia deve se comportar.', 'Descrição erro personalidade'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.createAgent', 'Erro ao criar agente', 'Erro criar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.unknownError', 'Erro desconhecido', 'Erro desconhecido'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.unknownErrorCreatingAgent', 'Erro desconhecido ao criar agente', 'Erro desconhecido criar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.functionNotFound', 'Função não encontrada', 'Erro função não encontrada'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.functionNotFoundDescription', 'A função sp_create_agent_by_email não existe no banco de dados. Execute o script SQL para criá-la.', 'Descrição erro função'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.functionNotFoundDescription2', 'A função sp_create_agent_by_email não foi encontrada. Verifique se ela foi criada no banco de dados.', 'Descrição erro função 2'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.resourceNotFound', 'Recurso não encontrado', 'Erro recurso não encontrado'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.invalidTemplate', 'Template inválido', 'Erro template inválido'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.userNotFound', 'Usuário não encontrado', 'Erro usuário não encontrado'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.pauseAgent', 'Erro ao pausar agente', 'Erro pausar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.reactivateAgent', 'Erro ao reativar agente', 'Erro reativar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'errors.cancelAgent', 'Erro ao cancelar agente', 'Erro cancelar agente'),
  
  (NULL, 'en-US', 'agentsHub', 'errors.error', 'Error', 'Error title'),
  (NULL, 'en-US', 'agentsHub', 'errors.emailNotFound', 'User email not found. Please log in again.', 'Email not found error'),
  (NULL, 'en-US', 'agentsHub', 'errors.nameRequired', 'Name required', 'Name required error'),
  (NULL, 'en-US', 'agentsHub', 'errors.nameRequiredDescription', 'Please provide a name for the agent.', 'Name error description'),
  (NULL, 'en-US', 'agentsHub', 'errors.templateNotSelected', 'Template not selected', 'Template not selected error'),
  (NULL, 'en-US', 'agentsHub', 'errors.templateNotSelectedDescription', 'Please select a template for the agent.', 'Template error description'),
  (NULL, 'en-US', 'agentsHub', 'errors.personalityRequired', 'Personality required', 'Personality required error'),
  (NULL, 'en-US', 'agentsHub', 'errors.personalityRequiredDescription', 'Please describe how your Sonia should behave.', 'Personality error description'),
  (NULL, 'en-US', 'agentsHub', 'errors.createAgent', 'Error creating agent', 'Create agent error'),
  (NULL, 'en-US', 'agentsHub', 'errors.unknownError', 'Unknown error', 'Unknown error'),
  (NULL, 'en-US', 'agentsHub', 'errors.unknownErrorCreatingAgent', 'Unknown error creating agent', 'Unknown error creating agent'),
  (NULL, 'en-US', 'agentsHub', 'errors.functionNotFound', 'Function not found', 'Function not found error'),
  (NULL, 'en-US', 'agentsHub', 'errors.functionNotFoundDescription', 'The sp_create_agent_by_email function does not exist in the database. Run the SQL script to create it.', 'Function error description'),
  (NULL, 'en-US', 'agentsHub', 'errors.functionNotFoundDescription2', 'The sp_create_agent_by_email function was not found. Check if it was created in the database.', 'Function error description 2'),
  (NULL, 'en-US', 'agentsHub', 'errors.resourceNotFound', 'Resource not found', 'Resource not found error'),
  (NULL, 'en-US', 'agentsHub', 'errors.invalidTemplate', 'Invalid template', 'Invalid template error'),
  (NULL, 'en-US', 'agentsHub', 'errors.userNotFound', 'User not found', 'User not found error'),
  (NULL, 'en-US', 'agentsHub', 'errors.pauseAgent', 'Error pausing agent', 'Pause agent error'),
  (NULL, 'en-US', 'agentsHub', 'errors.reactivateAgent', 'Error reactivating agent', 'Reactivate agent error'),
  (NULL, 'en-US', 'agentsHub', 'errors.cancelAgent', 'Error canceling agent', 'Cancel agent error'),
  
  (NULL, 'es-ES', 'agentsHub', 'errors.error', 'Error', 'Título de error'),
  (NULL, 'es-ES', 'agentsHub', 'errors.emailNotFound', 'Email de usuario no encontrado. Por favor, inicia sesión nuevamente.', 'Error email no encontrado'),
  (NULL, 'es-ES', 'agentsHub', 'errors.nameRequired', 'Nombre obligatorio', 'Error nombre obligatorio'),
  (NULL, 'es-ES', 'agentsHub', 'errors.nameRequiredDescription', 'Por favor, proporciona un nombre para el agente.', 'Descripción error nombre'),
  (NULL, 'es-ES', 'agentsHub', 'errors.templateNotSelected', 'Plantilla no seleccionada', 'Error plantilla no seleccionada'),
  (NULL, 'es-ES', 'agentsHub', 'errors.templateNotSelectedDescription', 'Por favor, selecciona una plantilla para el agente.', 'Descripción error plantilla'),
  (NULL, 'es-ES', 'agentsHub', 'errors.personalityRequired', 'Personalidad obligatoria', 'Error personalidad obligatoria'),
  (NULL, 'es-ES', 'agentsHub', 'errors.personalityRequiredDescription', 'Por favor, describe cómo debe comportarse tu Sonia.', 'Descripción error personalidad'),
  (NULL, 'es-ES', 'agentsHub', 'errors.createAgent', 'Error al crear agente', 'Error crear agente'),
  (NULL, 'es-ES', 'agentsHub', 'errors.unknownError', 'Error desconocido', 'Error desconocido'),
  (NULL, 'es-ES', 'agentsHub', 'errors.unknownErrorCreatingAgent', 'Error desconocido al crear agente', 'Error desconocido crear agente'),
  (NULL, 'es-ES', 'agentsHub', 'errors.functionNotFound', 'Función no encontrada', 'Error función no encontrada'),
  (NULL, 'es-ES', 'agentsHub', 'errors.functionNotFoundDescription', 'La función sp_create_agent_by_email no existe en la base de datos. Ejecuta el script SQL para crearla.', 'Descripción error función'),
  (NULL, 'es-ES', 'agentsHub', 'errors.functionNotFoundDescription2', 'La función sp_create_agent_by_email no fue encontrada. Verifica si fue creada en la base de datos.', 'Descripción error función 2'),
  (NULL, 'es-ES', 'agentsHub', 'errors.resourceNotFound', 'Recurso no encontrado', 'Error recurso no encontrado'),
  (NULL, 'es-ES', 'agentsHub', 'errors.invalidTemplate', 'Plantilla inválida', 'Error plantilla inválida'),
  (NULL, 'es-ES', 'agentsHub', 'errors.userNotFound', 'Usuario no encontrado', 'Error usuario no encontrado'),
  (NULL, 'es-ES', 'agentsHub', 'errors.pauseAgent', 'Error al pausar agente', 'Error pausar agente'),
  (NULL, 'es-ES', 'agentsHub', 'errors.reactivateAgent', 'Error al reactivar agente', 'Error reactivar agente'),
  (NULL, 'es-ES', 'agentsHub', 'errors.cancelAgent', 'Error al cancelar agente', 'Error cancelar agente'),

  -- ============================================
  -- SUCCESS
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'success.agentCreated', 'Agente criado com sucesso!', 'Sucesso criar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'success.agentCreatedDescription', '{{name}} foi criado e está ativo.', 'Descrição sucesso criar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'success.agentPaused', 'Agente pausado com sucesso', 'Sucesso pausar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'success.agentReactivated', 'Agente reativado com sucesso', 'Sucesso reativar agente'),
  (NULL, 'pt-BR', 'agentsHub', 'success.agentCancelled', 'Agente cancelado com sucesso', 'Sucesso cancelar agente'),
  
  (NULL, 'en-US', 'agentsHub', 'success.agentCreated', 'Agent created successfully!', 'Create agent success'),
  (NULL, 'en-US', 'agentsHub', 'success.agentCreatedDescription', '{{name}} has been created and is active.', 'Create agent success description'),
  (NULL, 'en-US', 'agentsHub', 'success.agentPaused', 'Agent paused successfully', 'Pause agent success'),
  (NULL, 'en-US', 'agentsHub', 'success.agentReactivated', 'Agent reactivated successfully', 'Reactivate agent success'),
  (NULL, 'en-US', 'agentsHub', 'success.agentCancelled', 'Agent cancelled successfully', 'Cancel agent success'),
  
  (NULL, 'es-ES', 'agentsHub', 'success.agentCreated', '¡Agente creado con éxito!', 'Éxito crear agente'),
  (NULL, 'es-ES', 'agentsHub', 'success.agentCreatedDescription', '{{name}} ha sido creado y está activo.', 'Descripción éxito crear agente'),
  (NULL, 'es-ES', 'agentsHub', 'success.agentPaused', 'Agente pausado con éxito', 'Éxito pausar agente'),
  (NULL, 'es-ES', 'agentsHub', 'success.agentReactivated', 'Agente reactivado con éxito', 'Éxito reactivar agente'),
  (NULL, 'es-ES', 'agentsHub', 'success.agentCancelled', 'Agente cancelado con éxito', 'Éxito cancelar agente'),

  -- ============================================
  -- CONFIRM
  -- ============================================
  (NULL, 'pt-BR', 'agentsHub', 'confirm.cancelAgent', 'Tem certeza que deseja cancelar este agente?', 'Confirmação cancelar agente'),
  
  (NULL, 'en-US', 'agentsHub', 'confirm.cancelAgent', 'Are you sure you want to cancel this agent?', 'Cancel agent confirmation'),
  
  (NULL, 'es-ES', 'agentsHub', 'confirm.cancelAgent', '¿Estás seguro de que deseas cancelar este agente?', 'Confirmación cancelar agente')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
