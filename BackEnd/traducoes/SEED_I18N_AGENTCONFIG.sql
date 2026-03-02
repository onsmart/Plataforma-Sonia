-- ============================================
-- SEED I18N: AgentConfig
-- ============================================
-- Traduções para a página de configuração do agente
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'header.editBrain', 'Editar Cérebro', 'Título quando editando'),
  (NULL, 'pt-BR', 'agentConfig', 'header.newBrain', 'Novo Cérebro', 'Título quando criando'),
  (NULL, 'pt-BR', 'agentConfig', 'header.highPerformance', 'Configuração de Alta Performance', 'Subtítulo'),
  
  (NULL, 'en-US', 'agentConfig', 'header.editBrain', 'Edit Brain', 'Title when editing'),
  (NULL, 'en-US', 'agentConfig', 'header.newBrain', 'New Brain', 'Title when creating'),
  (NULL, 'en-US', 'agentConfig', 'header.highPerformance', 'High Performance Configuration', 'Subtitle'),
  
  (NULL, 'es-ES', 'agentConfig', 'header.editBrain', 'Editar Cerebro', 'Título al editar'),
  (NULL, 'es-ES', 'agentConfig', 'header.newBrain', 'Nuevo Cerebro', 'Título al crear'),
  (NULL, 'es-ES', 'agentConfig', 'header.highPerformance', 'Configuración de Alto Rendimiento', 'Subtítulo'),

  -- ============================================
  -- BUTTONS
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'button.cancel', 'Cancelar', 'Botão cancelar'),
  (NULL, 'pt-BR', 'agentConfig', 'button.saveSonia', 'Salvar Sonia', 'Botão salvar'),
  (NULL, 'pt-BR', 'agentConfig', 'button.updateSonia', 'ATUALIZAR SONIA', 'Botão atualizar'),
  
  (NULL, 'en-US', 'agentConfig', 'button.cancel', 'Cancel', 'Cancel button'),
  (NULL, 'en-US', 'agentConfig', 'button.saveSonia', 'Save Sonia', 'Save button'),
  (NULL, 'en-US', 'agentConfig', 'button.updateSonia', 'UPDATE SONIA', 'Update button'),
  
  (NULL, 'es-ES', 'agentConfig', 'button.cancel', 'Cancelar', 'Botón cancelar'),
  (NULL, 'es-ES', 'agentConfig', 'button.saveSonia', 'Guardar Sonia', 'Botón guardar'),
  (NULL, 'es-ES', 'agentConfig', 'button.updateSonia', 'ACTUALIZAR SONIA', 'Botón actualizar'),

  -- ============================================
  -- IDENTITY
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'identity.title', 'Identidade da IA', 'Título da seção'),
  (NULL, 'pt-BR', 'agentConfig', 'identity.nameLabel', 'Nome da sua Sonia', 'Label do campo nome'),
  (NULL, 'pt-BR', 'agentConfig', 'identity.namePlaceholder', 'Ex: Sonia Atendimento VIP', 'Placeholder do campo nome'),
  (NULL, 'pt-BR', 'agentConfig', 'identity.instructionsLabel', 'Instruções Mentais (Prompt)', 'Label do campo instruções'),
  (NULL, 'pt-BR', 'agentConfig', 'identity.instructionsPlaceholder', 'Defina como ela deve agir...', 'Placeholder do campo instruções'),
  
  (NULL, 'en-US', 'agentConfig', 'identity.title', 'AI Identity', 'Section title'),
  (NULL, 'en-US', 'agentConfig', 'identity.nameLabel', 'Your Sonia''s Name', 'Name field label'),
  (NULL, 'en-US', 'agentConfig', 'identity.namePlaceholder', 'Ex: Sonia VIP Support', 'Name field placeholder'),
  (NULL, 'en-US', 'agentConfig', 'identity.instructionsLabel', 'Mental Instructions (Prompt)', 'Instructions field label'),
  (NULL, 'en-US', 'agentConfig', 'identity.instructionsPlaceholder', 'Define how she should act...', 'Instructions field placeholder'),
  
  (NULL, 'es-ES', 'agentConfig', 'identity.title', 'Identidad de la IA', 'Título de la sección'),
  (NULL, 'es-ES', 'agentConfig', 'identity.nameLabel', 'Nombre de tu Sonia', 'Etiqueta del campo nombre'),
  (NULL, 'es-ES', 'agentConfig', 'identity.namePlaceholder', 'Ej: Sonia Atención VIP', 'Placeholder del campo nombre'),
  (NULL, 'es-ES', 'agentConfig', 'identity.instructionsLabel', 'Instrucciones Mentales (Prompt)', 'Etiqueta del campo instrucciones'),
  (NULL, 'es-ES', 'agentConfig', 'identity.instructionsPlaceholder', 'Define cómo debe actuar...', 'Placeholder del campo instrucciones'),

  -- ============================================
  -- CONNECTIONS
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'connections.title', 'Conexões e Knowledge Base', 'Título da seção'),
  (NULL, 'pt-BR', 'agentConfig', 'connections.crmLabel', 'Integração CRM Ativa', 'Label do campo CRM'),
  (NULL, 'pt-BR', 'agentConfig', 'connections.crmPlaceholder', 'Selecione um CRM...', 'Placeholder do campo CRM'),
  (NULL, 'pt-BR', 'agentConfig', 'connections.noCRM', 'Nenhum CRM vinculado', 'Opção sem CRM'),
  (NULL, 'pt-BR', 'agentConfig', 'connections.filesLabel', 'Arquivos Selecionados (RAG)', 'Label do campo arquivos'),
  
  (NULL, 'en-US', 'agentConfig', 'connections.title', 'Connections and Knowledge Base', 'Section title'),
  (NULL, 'en-US', 'agentConfig', 'connections.crmLabel', 'Active CRM Integration', 'CRM field label'),
  (NULL, 'en-US', 'agentConfig', 'connections.crmPlaceholder', 'Select a CRM...', 'CRM field placeholder'),
  (NULL, 'en-US', 'agentConfig', 'connections.noCRM', 'No CRM linked', 'No CRM option'),
  (NULL, 'en-US', 'agentConfig', 'connections.filesLabel', 'Selected Files (RAG)', 'Files field label'),
  
  (NULL, 'es-ES', 'agentConfig', 'connections.title', 'Conexiones y Base de Conocimiento', 'Título de la sección'),
  (NULL, 'es-ES', 'agentConfig', 'connections.crmLabel', 'Integración CRM Activa', 'Etiqueta del campo CRM'),
  (NULL, 'es-ES', 'agentConfig', 'connections.crmPlaceholder', 'Selecciona un CRM...', 'Placeholder del campo CRM'),
  (NULL, 'es-ES', 'agentConfig', 'connections.noCRM', 'Ningún CRM vinculado', 'Opción sin CRM'),
  (NULL, 'es-ES', 'agentConfig', 'connections.filesLabel', 'Archivos Seleccionados (RAG)', 'Etiqueta del campo archivos'),

  -- ============================================
  -- NEURAL
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'neural.title', 'Ajuste Neural', 'Título da seção'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.providerLabel', 'Provedor de IA', 'Label do campo provedor'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.modelLabel', 'Modelo de IA', 'Label do campo modelo'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.creativityLabel', 'Biscoitos (Criatividade)', 'Label do slider criatividade'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.exact', 'Exato', 'Valor mínimo do slider'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.creative', 'Criativo', 'Valor máximo do slider'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.responseSizeLabel', 'Tamanho da Resposta', 'Label do slider tamanho'),
  (NULL, 'pt-BR', 'agentConfig', 'neural.tokens', 'tkn', 'Unidade de tokens'),
  
  (NULL, 'en-US', 'agentConfig', 'neural.title', 'Neural Tuning', 'Section title'),
  (NULL, 'en-US', 'agentConfig', 'neural.providerLabel', 'AI Provider', 'Provider field label'),
  (NULL, 'en-US', 'agentConfig', 'neural.modelLabel', 'AI Model', 'Model field label'),
  (NULL, 'en-US', 'agentConfig', 'neural.creativityLabel', 'Cookies (Creativity)', 'Creativity slider label'),
  (NULL, 'en-US', 'agentConfig', 'neural.exact', 'Exact', 'Slider minimum value'),
  (NULL, 'en-US', 'agentConfig', 'neural.creative', 'Creative', 'Slider maximum value'),
  (NULL, 'en-US', 'agentConfig', 'neural.responseSizeLabel', 'Response Size', 'Size slider label'),
  (NULL, 'en-US', 'agentConfig', 'neural.tokens', 'tkn', 'Tokens unit'),
  
  (NULL, 'es-ES', 'agentConfig', 'neural.title', 'Ajuste Neural', 'Título de la sección'),
  (NULL, 'es-ES', 'agentConfig', 'neural.providerLabel', 'Proveedor de IA', 'Etiqueta del campo proveedor'),
  (NULL, 'es-ES', 'agentConfig', 'neural.modelLabel', 'Modelo de IA', 'Etiqueta del campo modelo'),
  (NULL, 'es-ES', 'agentConfig', 'neural.creativityLabel', 'Galletas (Creatividad)', 'Etiqueta del slider creatividad'),
  (NULL, 'es-ES', 'agentConfig', 'neural.exact', 'Exacto', 'Valor mínimo del slider'),
  (NULL, 'es-ES', 'agentConfig', 'neural.creative', 'Creativo', 'Valor máximo del slider'),
  (NULL, 'es-ES', 'agentConfig', 'neural.responseSizeLabel', 'Tamaño de la Respuesta', 'Etiqueta del slider tamaño'),
  (NULL, 'es-ES', 'agentConfig', 'neural.tokens', 'tkn', 'Unidad de tokens'),

  -- ============================================
  -- SKILLS
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'skills.title', 'Habilidades Sonia', 'Título da seção'),
  (NULL, 'pt-BR', 'agentConfig', 'skills.crm', 'CRM', 'Label habilidade CRM'),
  (NULL, 'pt-BR', 'agentConfig', 'skills.rag', 'RAG', 'Label habilidade RAG'),
  
  (NULL, 'en-US', 'agentConfig', 'skills.title', 'Sonia Skills', 'Section title'),
  (NULL, 'en-US', 'agentConfig', 'skills.crm', 'CRM', 'CRM skill label'),
  (NULL, 'en-US', 'agentConfig', 'skills.rag', 'RAG', 'RAG skill label'),
  
  (NULL, 'es-ES', 'agentConfig', 'skills.title', 'Habilidades Sonia', 'Título de la sección'),
  (NULL, 'es-ES', 'agentConfig', 'skills.crm', 'CRM', 'Etiqueta habilidad CRM'),
  (NULL, 'es-ES', 'agentConfig', 'skills.rag', 'RAG', 'Etiqueta habilidad RAG'),

  -- ============================================
  -- LOADING
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'loading.syncing', 'Sincronizando Sonia...', 'Mensagem de carregamento'),
  
  (NULL, 'en-US', 'agentConfig', 'loading.syncing', 'Syncing Sonia...', 'Loading message'),
  
  (NULL, 'es-ES', 'agentConfig', 'loading.syncing', 'Sincronizando Sonia...', 'Mensaje de carga'),

  -- ============================================
  -- ERRORS
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'errors.nameRequired', 'Dê um nome ao agente!', 'Erro nome obrigatório'),
  (NULL, 'pt-BR', 'agentConfig', 'errors.saveError', 'Erro ao salvar: {{message}}', 'Erro ao salvar'),
  (NULL, 'pt-BR', 'agentConfig', 'errors.unknownError', 'Erro desconhecido', 'Erro desconhecido'),
  
  (NULL, 'en-US', 'agentConfig', 'errors.nameRequired', 'Give the agent a name!', 'Name required error'),
  (NULL, 'en-US', 'agentConfig', 'errors.saveError', 'Error saving: {{message}}', 'Save error'),
  (NULL, 'en-US', 'agentConfig', 'errors.unknownError', 'Unknown error', 'Unknown error'),
  
  (NULL, 'es-ES', 'agentConfig', 'errors.nameRequired', '¡Dale un nombre al agente!', 'Error nombre obligatorio'),
  (NULL, 'es-ES', 'agentConfig', 'errors.saveError', 'Error al guardar: {{message}}', 'Error al guardar'),
  (NULL, 'es-ES', 'agentConfig', 'errors.unknownError', 'Error desconocido', 'Error desconocido'),

  -- ============================================
  -- SUCCESS
  -- ============================================
  (NULL, 'pt-BR', 'agentConfig', 'success.configSaved', 'Configuração salva!', 'Sucesso ao salvar'),
  
  (NULL, 'en-US', 'agentConfig', 'success.configSaved', 'Configuration saved!', 'Save success'),
  
  (NULL, 'es-ES', 'agentConfig', 'success.configSaved', '¡Configuración guardada!', 'Éxito al guardar')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
