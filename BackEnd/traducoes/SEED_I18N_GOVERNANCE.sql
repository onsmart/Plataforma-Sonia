-- ============================================
-- SEED I18N: Governance
-- ============================================
-- Traduções para a página de Governance
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'header.title', 'Governança e Segurança', 'Título da página'),
  (NULL, 'pt-BR', 'governance', 'header.description', 'Gerencie guardrails de IA, políticas de proteção de dados e logs de conformidade.', 'Descrição da página'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore', 'Safety Score', 'Label do Safety Score'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore.excellent', 'Excelente', 'Nota A+'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore.veryGood', 'Muito Bom', 'Nota A'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore.good', 'Bom', 'Nota B'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore.attention', 'Atenção', 'Nota C'),
  (NULL, 'pt-BR', 'governance', 'header.safetyScore.critical', 'Crítico', 'Nota D/F'),
  
  (NULL, 'en-US', 'governance', 'header.title', 'Governance & Security', 'Page title'),
  (NULL, 'en-US', 'governance', 'header.description', 'Manage AI guardrails, data protection policies, and compliance logs.', 'Page description'),
  (NULL, 'en-US', 'governance', 'header.safetyScore', 'Safety Score', 'Safety Score label'),
  (NULL, 'en-US', 'governance', 'header.safetyScore.excellent', 'Excellent', 'A+ grade'),
  (NULL, 'en-US', 'governance', 'header.safetyScore.veryGood', 'Very Good', 'A grade'),
  (NULL, 'en-US', 'governance', 'header.safetyScore.good', 'Good', 'B grade'),
  (NULL, 'en-US', 'governance', 'header.safetyScore.attention', 'Attention', 'C grade'),
  (NULL, 'en-US', 'governance', 'header.safetyScore.critical', 'Critical', 'D/F grade'),
  
  (NULL, 'es-ES', 'governance', 'header.title', 'Gobernanza y Seguridad', 'Título de la página'),
  (NULL, 'es-ES', 'governance', 'header.description', 'Gestiona guardrails de IA, políticas de protección de datos y registros de cumplimiento.', 'Descripción de la página'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore', 'Puntuación de Seguridad', 'Etiqueta de Safety Score'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore.excellent', 'Excelente', 'Nota A+'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore.veryGood', 'Muy Bueno', 'Nota A'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore.good', 'Bueno', 'Nota B'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore.attention', 'Atención', 'Nota C'),
  (NULL, 'es-ES', 'governance', 'header.safetyScore.critical', 'Crítico', 'Nota D/F'),

  -- ============================================
  -- TABS
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'tabs.guardrails', 'AI Guardrails', 'Aba Guardrails'),
  (NULL, 'pt-BR', 'governance', 'tabs.privacy', 'Data Privacy (DLP)', 'Aba Privacy'),
  
  (NULL, 'en-US', 'governance', 'tabs.guardrails', 'AI Guardrails', 'Guardrails tab'),
  (NULL, 'en-US', 'governance', 'tabs.privacy', 'Data Privacy (DLP)', 'Privacy tab'),
  
  (NULL, 'es-ES', 'governance', 'tabs.guardrails', 'Guardrails de IA', 'Pestaña Guardrails'),
  (NULL, 'es-ES', 'governance', 'tabs.privacy', 'Privacidad de Datos (DLP)', 'Pestaña Privacidad'),

  -- ============================================
  -- GUARDRAILS: ALERT
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'guardrails.alert.title', 'Política Global Ativa', 'Título do alerta'),
  (NULL, 'pt-BR', 'governance', 'guardrails.alert.description', 'Essas configurações se aplicam a todos os agentes. Substituições específicas de agentes podem ser configuradas no Agents Hub.', 'Descrição do alerta'),
  
  (NULL, 'en-US', 'governance', 'guardrails.alert.title', 'Global Policy Active', 'Alert title'),
  (NULL, 'en-US', 'governance', 'guardrails.alert.description', 'These settings apply to all agents. Specific agent overrides can be configured in the Agents Hub.', 'Alert description'),
  
  (NULL, 'es-ES', 'governance', 'guardrails.alert.title', 'Política Global Activa', 'Título de la alerta'),
  (NULL, 'es-ES', 'governance', 'guardrails.alert.description', 'Estas configuraciones se aplican a todos los agentes. Las anulaciones específicas de agentes se pueden configurar en el Agents Hub.', 'Descripción de la alerta'),

  -- ============================================
  -- GUARDRAILS: CONTENT MODERATION
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.title', 'Filtros de Moderação de Conteúdo', 'Título moderação'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.description', 'Configure limites de sensibilidade para bloquear conteúdo prejudicial ou inadequado.', 'Descrição moderação'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.hateSpeech', 'Discurso de Ódio e Assédio', 'Label hate speech'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.hateSpeechDesc', 'Bloqueia qualquer conteúdo que possa ser interpretado como ofensivo ou discriminatório.', 'Descrição hate speech'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.sexualContent', 'Conteúdo Sexual', 'Label conteúdo sexual'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.sexualContentDesc', 'Filtra conteúdo sexual inadequado e material explícito.', 'Descrição conteúdo sexual'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.dangerousContent', 'Autoflagelação e Violência', 'Label conteúdo perigoso'),
  (NULL, 'pt-BR', 'governance', 'guardrails.contentModeration.dangerousContentDesc', 'Detecta e bloqueia conteúdo que promove autoflagelação ou violência.', 'Descrição conteúdo perigoso'),
  (NULL, 'pt-BR', 'governance', 'guardrails.slider.permissive', 'Permissivo', 'Label permissivo'),
  (NULL, 'pt-BR', 'governance', 'guardrails.slider.standard', 'Padrão', 'Label padrão'),
  (NULL, 'pt-BR', 'governance', 'guardrails.slider.strict', 'Rigoroso', 'Label rigoroso'),
  (NULL, 'pt-BR', 'governance', 'guardrails.slider.totalBlock', 'Bloqueio Total', 'Label bloqueio total'),
  
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.title', 'Content Moderation Filters', 'Moderation title'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.description', 'Configure sensitivity thresholds for blocking harmful or inappropriate content.', 'Moderation description'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.hateSpeech', 'Hate Speech & Harassment', 'Hate speech label'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.hateSpeechDesc', 'Blocks any content that could be construed as offensive or discriminatory.', 'Hate speech description'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.sexualContent', 'Sexual Content', 'Sexual content label'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.sexualContentDesc', 'Filters inappropriate sexual content and explicit material.', 'Sexual content description'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.dangerousContent', 'Self-Harm & Violence', 'Dangerous content label'),
  (NULL, 'en-US', 'governance', 'guardrails.contentModeration.dangerousContentDesc', 'Detects and blocks content promoting self-harm or violence.', 'Dangerous content description'),
  (NULL, 'en-US', 'governance', 'guardrails.slider.permissive', 'Permissive', 'Permissive label'),
  (NULL, 'en-US', 'governance', 'guardrails.slider.standard', 'Standard', 'Standard label'),
  (NULL, 'en-US', 'governance', 'guardrails.slider.strict', 'Strict', 'Strict label'),
  (NULL, 'en-US', 'governance', 'guardrails.slider.totalBlock', 'Total Block', 'Total block label'),
  
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.title', 'Filtros de Moderación de Contenido', 'Título moderación'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.description', 'Configura umbrales de sensibilidad para bloquear contenido dañino o inapropiado.', 'Descripción moderación'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.hateSpeech', 'Discurso de Odio y Acoso', 'Etiqueta discurso de odio'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.hateSpeechDesc', 'Bloquea cualquier contenido que pueda interpretarse como ofensivo o discriminatorio.', 'Descripción discurso de odio'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.sexualContent', 'Contenido Sexual', 'Etiqueta contenido sexual'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.sexualContentDesc', 'Filtra contenido sexual inapropiado y material explícito.', 'Descripción contenido sexual'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.dangerousContent', 'Autolesión y Violencia', 'Etiqueta contenido peligroso'),
  (NULL, 'es-ES', 'governance', 'guardrails.contentModeration.dangerousContentDesc', 'Detecta y bloquea contenido que promueve autolesión o violencia.', 'Descripción contenido peligroso'),
  (NULL, 'es-ES', 'governance', 'guardrails.slider.permissive', 'Permisivo', 'Etiqueta permisivo'),
  (NULL, 'es-ES', 'governance', 'guardrails.slider.standard', 'Estándar', 'Etiqueta estándar'),
  (NULL, 'es-ES', 'governance', 'guardrails.slider.strict', 'Estricto', 'Etiqueta estricto'),
  (NULL, 'es-ES', 'governance', 'guardrails.slider.totalBlock', 'Bloqueo Total', 'Etiqueta bloqueo total'),

  -- ============================================
  -- GUARDRAILS: BUSINESS RULES
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.competitorBlocking', 'Bloqueio de Concorrentes', 'Título regra concorrentes'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.competitorBlockingDesc', 'Desvia menções de rivais', 'Descrição regra concorrentes'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.competitorBlockingTest', 'Ex: "Me fale do concorrente X"', 'Placeholder teste concorrentes'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.antiHallucination', 'Anti-Alucinação', 'Título regra anti-alucinação'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.antiHallucinationDesc', 'Adesão rigorosa ao RAG', 'Descrição regra anti-alucinação'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.antiHallucinationTest', 'Ex: "Informação não encontrada"', 'Placeholder teste anti-alucinação'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.jailbreakProtection', 'Proteção contra Jailbreak', 'Título regra jailbreak'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.jailbreakProtectionDesc', 'Detecta injeção de prompt', 'Descrição regra jailbreak'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.jailbreakProtectionTest', 'Ex: "Ignore previous instructions"', 'Placeholder teste jailbreak'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.testLabel', 'Testar Regra', 'Label campo teste'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.testBlocked', '⚠️ Regra de Bloqueio Ativada!', 'Mensagem bloqueado'),
  (NULL, 'pt-BR', 'governance', 'guardrails.rules.testAllowed', '✓ Mensagem permitida', 'Mensagem permitido'),
  (NULL, 'pt-BR', 'governance', 'guardrails.button.save', 'Salvar Políticas', 'Botão salvar'),
  (NULL, 'pt-BR', 'governance', 'governance.button.saving', 'Salvando...', 'Botão salvando'),
  
  (NULL, 'en-US', 'governance', 'guardrails.rules.competitorBlocking', 'Competitor Blocking', 'Competitor blocking title'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.competitorBlockingDesc', 'Deflects mentions of rivals', 'Competitor blocking description'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.competitorBlockingTest', 'Ex: "Tell me about competitor X"', 'Competitor blocking test placeholder'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.antiHallucination', 'Anti-Hallucination', 'Anti-hallucination title'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.antiHallucinationDesc', 'Strict RAG adherence', 'Anti-hallucination description'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.antiHallucinationTest', 'Ex: "Information not found"', 'Anti-hallucination test placeholder'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.jailbreakProtection', 'Jailbreak Protection', 'Jailbreak protection title'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.jailbreakProtectionDesc', 'Detects prompt injection', 'Jailbreak protection description'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.jailbreakProtectionTest', 'Ex: "Ignore previous instructions"', 'Jailbreak protection test placeholder'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.testLabel', 'Test Rule', 'Test field label'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.testBlocked', '⚠️ Blocking Rule Activated!', 'Blocked message'),
  (NULL, 'en-US', 'governance', 'guardrails.rules.testAllowed', '✓ Message allowed', 'Allowed message'),
  (NULL, 'en-US', 'governance', 'guardrails.button.save', 'Save Policies', 'Save button'),
  (NULL, 'en-US', 'governance', 'governance.button.saving', 'Saving...', 'Saving button'),
  
  (NULL, 'es-ES', 'governance', 'guardrails.rules.competitorBlocking', 'Bloqueo de Competidores', 'Título regla competidores'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.competitorBlockingDesc', 'Desvía menciones de rivales', 'Descripción regla competidores'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.competitorBlockingTest', 'Ej: "Háblame del competidor X"', 'Placeholder prueba competidores'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.antiHallucination', 'Anti-Alucinación', 'Título regla anti-alucinación'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.antiHallucinationDesc', 'Adherencia estricta al RAG', 'Descripción regla anti-alucinación'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.antiHallucinationTest', 'Ej: "Información no encontrada"', 'Placeholder prueba anti-alucinación'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.jailbreakProtection', 'Protección contra Jailbreak', 'Título regla jailbreak'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.jailbreakProtectionDesc', 'Detecta inyección de prompt', 'Descripción regla jailbreak'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.jailbreakProtectionTest', 'Ej: "Ignora instrucciones anteriores"', 'Placeholder prueba jailbreak'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.testLabel', 'Probar Regla', 'Etiqueta campo prueba'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.testBlocked', '⚠️ ¡Regla de Bloqueo Activada!', 'Mensaje bloqueado'),
  (NULL, 'es-ES', 'governance', 'guardrails.rules.testAllowed', '✓ Mensaje permitido', 'Mensaje permitido'),
  (NULL, 'es-ES', 'governance', 'guardrails.button.save', 'Guardar Políticas', 'Botón guardar'),
  (NULL, 'es-ES', 'governance', 'governance.button.saving', 'Guardando...', 'Botón guardando'),

  -- ============================================
  -- PRIVACY: DLP
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.title', 'Redação de PII (DLP)', 'Título DLP'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.description', 'Detecta e mascara automaticamente informações sensíveis em logs e análises.', 'Descrição DLP'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.protected', 'Protegidos', 'Label protegidos'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.creditCard', 'Números de Cartão de Crédito', 'Label cartão'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.creditCardDesc', 'Mascara sequências PAN (VISA, MC, AMEX)', 'Descrição cartão'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.ssn', 'IDs Nacionais (CPF/SSN)', 'Label CPF/SSN'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.ssnDesc', 'Mascara números de identificação governamental', 'Descrição CPF/SSN'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.email', 'Endereços de Email', 'Label email'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.emailDesc', 'Mascara formatos de email em logs de conversação', 'Descrição email'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.phone', 'Números de Telefone', 'Label telefone'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.phoneDesc', 'Mascara números de telefone detectados', 'Descrição telefone'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.active', 'Ativo', 'Badge ativo'),
  (NULL, 'pt-BR', 'governance', 'privacy.dlp.protecting', 'Protegendo', 'Badge protegendo'),
  
  (NULL, 'en-US', 'governance', 'privacy.dlp.title', 'PII Redaction (DLP)', 'DLP title'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.description', 'Automatically detect and mask sensitive information in logs and analytics.', 'DLP description'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.protected', 'Protected', 'Protected label'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.creditCard', 'Credit Card Numbers', 'Credit card label'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.creditCardDesc', 'Masks PAN sequences (VISA, MC, AMEX)', 'Credit card description'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.ssn', 'National IDs (CPF/SSN)', 'SSN label'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.ssnDesc', 'Masks government identification numbers', 'SSN description'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.email', 'Email Addresses', 'Email label'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.emailDesc', 'Masks email formats in conversation logs', 'Email description'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.phone', 'Phone Numbers', 'Phone label'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.phoneDesc', 'Masks detected phone numbers', 'Phone description'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.active', 'Active', 'Active badge'),
  (NULL, 'en-US', 'governance', 'privacy.dlp.protecting', 'Protecting', 'Protecting badge'),
  
  (NULL, 'es-ES', 'governance', 'privacy.dlp.title', 'Redacción de PII (DLP)', 'Título DLP'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.description', 'Detecta y enmascara automáticamente información sensible en registros y análisis.', 'Descripción DLP'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.protected', 'Protegidos', 'Etiqueta protegidos'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.creditCard', 'Números de Tarjeta de Crédito', 'Etiqueta tarjeta'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.creditCardDesc', 'Enmascara secuencias PAN (VISA, MC, AMEX)', 'Descripción tarjeta'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.ssn', 'IDs Nacionales (CPF/SSN)', 'Etiqueta CPF/SSN'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.ssnDesc', 'Enmascara números de identificación gubernamental', 'Descripción CPF/SSN'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.email', 'Direcciones de Email', 'Etiqueta email'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.emailDesc', 'Enmascara formatos de email en registros de conversación', 'Descripción email'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.phone', 'Números de Teléfono', 'Etiqueta teléfono'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.phoneDesc', 'Enmascara números de teléfono detectados', 'Descripción teléfono'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.active', 'Activo', 'Badge activo'),
  (NULL, 'es-ES', 'governance', 'privacy.dlp.protecting', 'Protegiendo', 'Badge protegiendo'),

  -- ============================================
  -- PRIVACY: PREVIEW
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'privacy.preview.title', 'Preview de Proteção', 'Título preview'),
  (NULL, 'pt-BR', 'governance', 'privacy.preview.description', 'Veja como os dados sensíveis são protegidos em tempo real', 'Descrição preview'),
  (NULL, 'pt-BR', 'governance', 'privacy.preview.user', 'Usuário', 'Label usuário'),
  (NULL, 'pt-BR', 'governance', 'privacy.preview.placeholder', 'Digite uma mensagem com dados sensíveis...', 'Placeholder preview'),
  (NULL, 'pt-BR', 'governance', 'privacy.preview.sonia', 'Sonia AI', 'Label Sonia'),
  (NULL, 'pt-BR', 'governance', 'privacy.preview.footer', 'As alterações se aplicam imediatamente a novas sessões.', 'Rodapé preview'),
  
  (NULL, 'en-US', 'governance', 'privacy.preview.title', 'Protection Preview', 'Preview title'),
  (NULL, 'en-US', 'governance', 'privacy.preview.description', 'See how sensitive data is protected in real-time', 'Preview description'),
  (NULL, 'en-US', 'governance', 'privacy.preview.user', 'User', 'User label'),
  (NULL, 'en-US', 'governance', 'privacy.preview.placeholder', 'Type a message with sensitive data...', 'Preview placeholder'),
  (NULL, 'en-US', 'governance', 'privacy.preview.sonia', 'Sonia AI', 'Sonia label'),
  (NULL, 'en-US', 'governance', 'privacy.preview.footer', 'Changes apply immediately to new sessions.', 'Preview footer'),
  
  (NULL, 'es-ES', 'governance', 'privacy.preview.title', 'Vista Previa de Protección', 'Título vista previa'),
  (NULL, 'es-ES', 'governance', 'privacy.preview.description', 'Vea cómo se protegen los datos sensibles en tiempo real', 'Descripción vista previa'),
  (NULL, 'es-ES', 'governance', 'privacy.preview.user', 'Usuario', 'Etiqueta usuario'),
  (NULL, 'es-ES', 'governance', 'privacy.preview.placeholder', 'Escriba un mensaje con datos sensibles...', 'Placeholder vista previa'),
  (NULL, 'es-ES', 'governance', 'privacy.preview.sonia', 'Sonia AI', 'Etiqueta Sonia'),
  (NULL, 'es-ES', 'governance', 'privacy.preview.footer', 'Los cambios se aplican inmediatamente a nuevas sesiones.', 'Pie de vista previa'),

  -- ============================================
  -- PRIVACY: DATA RETENTION
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'privacy.retention.title', 'Data Retention', 'Título retenção'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.description', 'Políticas de conformidade', 'Descrição retenção'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.chatLogs', 'Retenção de Logs de Chat', 'Label logs chat'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.voiceRecordings', 'Gravações de Voz', 'Label gravações'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.days', 'Dias', 'Label dias'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.eternal', 'Eterno', 'Label eterno'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.days7', '7 dias', 'Botão 7 dias'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.days30', '30 dias', 'Botão 30 dias'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.days90', '90 dias', 'Botão 90 dias'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.year1', '1 ano', 'Botão 1 ano'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.purge.title', 'Política de Purga', 'Título purga'),
  (NULL, 'pt-BR', 'governance', 'privacy.retention.purge.description', 'Dados excluídos são irrecuperáveis após período de carência de 24h.', 'Descrição purga'),
  
  (NULL, 'en-US', 'governance', 'privacy.retention.title', 'Data Retention', 'Retention title'),
  (NULL, 'en-US', 'governance', 'privacy.retention.description', 'Compliance policies', 'Retention description'),
  (NULL, 'en-US', 'governance', 'privacy.retention.chatLogs', 'Chat Logs Retention', 'Chat logs label'),
  (NULL, 'en-US', 'governance', 'privacy.retention.voiceRecordings', 'Voice Recordings', 'Voice recordings label'),
  (NULL, 'en-US', 'governance', 'privacy.retention.days', 'Days', 'Days label'),
  (NULL, 'en-US', 'governance', 'privacy.retention.eternal', 'Eternal', 'Eternal label'),
  (NULL, 'en-US', 'governance', 'privacy.retention.days7', '7 days', '7 days button'),
  (NULL, 'en-US', 'governance', 'privacy.retention.days30', '30 days', '30 days button'),
  (NULL, 'en-US', 'governance', 'privacy.retention.days90', '90 days', '90 days button'),
  (NULL, 'en-US', 'governance', 'privacy.retention.year1', '1 year', '1 year button'),
  (NULL, 'en-US', 'governance', 'privacy.retention.purge.title', 'Purge Policy', 'Purge title'),
  (NULL, 'en-US', 'governance', 'privacy.retention.purge.description', 'Deleted data is unrecoverable after 24h grace period.', 'Purge description'),
  
  (NULL, 'es-ES', 'governance', 'privacy.retention.title', 'Retención de Datos', 'Título retención'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.description', 'Políticas de cumplimiento', 'Descripción retención'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.chatLogs', 'Retención de Registros de Chat', 'Etiqueta registros chat'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.voiceRecordings', 'Grabaciones de Voz', 'Etiqueta grabaciones'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.days', 'Días', 'Etiqueta días'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.eternal', 'Eterno', 'Etiqueta eterno'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.days7', '7 días', 'Botón 7 días'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.days30', '30 días', 'Botón 30 días'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.days90', '90 días', 'Botón 90 días'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.year1', '1 año', 'Botón 1 año'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.purge.title', 'Política de Purga', 'Título purga'),
  (NULL, 'es-ES', 'governance', 'privacy.retention.purge.description', 'Los datos eliminados son irrecuperables después del período de gracia de 24h.', 'Descripción purga'),

  -- ============================================
  -- AUDIT LOGS
  -- ============================================
  (NULL, 'pt-BR', 'governance', 'audit.system', 'Sistema', 'Label sistema'),
  (NULL, 'pt-BR', 'governance', 'audit.iotAction', 'Ação IoT', 'Label ação IoT'),
  (NULL, 'pt-BR', 'governance', 'audit.systemEvent', 'Evento do Sistema', 'Label evento sistema'),
  (NULL, 'pt-BR', 'governance', 'audit.preview.default', 'Olá, meu cartão é 4444 5555 6666 7777, email: teste@exemplo.com, telefone: (11) 98765-4321 e CPF: 123.456.789-00', 'Mensagem padrão preview'),
  
  (NULL, 'en-US', 'governance', 'audit.system', 'System', 'System label'),
  (NULL, 'en-US', 'governance', 'audit.iotAction', 'IoT Action', 'IoT action label'),
  (NULL, 'en-US', 'governance', 'audit.systemEvent', 'System Event', 'System event label'),
  (NULL, 'en-US', 'governance', 'audit.preview.default', 'Hello, my card is 4444 5555 6666 7777, email: test@example.com, phone: (11) 98765-4321 and SSN: 123.456.789-00', 'Default preview message'),
  
  (NULL, 'es-ES', 'governance', 'audit.system', 'Sistema', 'Etiqueta sistema'),
  (NULL, 'es-ES', 'governance', 'audit.iotAction', 'Acción IoT', 'Etiqueta acción IoT'),
  (NULL, 'es-ES', 'governance', 'audit.systemEvent', 'Evento del Sistema', 'Etiqueta evento sistema'),
  (NULL, 'es-ES', 'governance', 'audit.preview.default', 'Hola, mi tarjeta es 4444 5555 6666 7777, email: test@ejemplo.com, teléfono: (11) 98765-4321 y CPF: 123.456.789-00', 'Mensaje predeterminado vista previa')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
