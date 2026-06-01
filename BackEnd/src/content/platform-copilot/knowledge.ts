export type PlatformKnowledgeChunk = {
  id: string
  title: string
  text: string
  routes?: string[]
  keywords?: string[]
}

/** Corpus curado da plataforma — imutável pelo usuário; sem segredos ou dados de tenant. */
export const PLATFORM_COPILOT_KNOWLEDGE: PlatformKnowledgeChunk[] = [
  {
    id: 'platform-overview',
    title: 'O que é a Plataforma Sonia',
    text:
      'A Plataforma Sonia (Onsmart AI) é uma central de atendimento digital multi-tenant. Permite criar agentes de IA, conectar WhatsApp, CRM, calendário e e-mail, usar base de conhecimento (RAG), fluxos visuais, governança e assinaturas comerciais. O usuário opera tudo pela interface web sem programar.',
    keywords: ['sonia', 'plataforma', 'onsmart', 'o que é'],
  },
  {
    id: 'nav-routes',
    title: 'Navegação entre telas',
    text:
      'Rotas disponíveis na interface: home (início), cockpit (painel operacional), inbox (caixa de entrada WhatsApp), devices (dispositivos IoT), agents (central de agentes), agent-config (configuração de um agente), playground (testar agente), flows (fluxos visuais), knowledge (base de conhecimento), governance (governança avançada), insights (métricas), configuration (configurações gerais), integrations (integrações), profile (perfil e conta). Para ir a uma tela, o assistente pode usar o comando [NAVIGATE: route_id].',
    routes: ['home', 'cockpit', 'inbox', 'agents', 'configuration'],
    keywords: ['navegar', 'ir para', 'menu', 'telas', 'rotas'],
  },
  {
    id: 'home',
    title: 'Tela Início (Home)',
    text:
      'A Home é a página inicial após login. Resume o plano atual, uso de atendimentos, atalhos para áreas principais e orientações de próximos passos (criar agente, conectar WhatsApp, etc.).',
    routes: ['home'],
    keywords: ['início', 'home', 'dashboard inicial'],
  },
  {
    id: 'cockpit',
    title: 'Cockpit',
    text:
      'O Cockpit é o painel operacional com visão geral de agentes, canais, atividade recente e indicadores do dia a dia. Use para acompanhar operação sem entrar em cada módulo separadamente.',
    routes: ['cockpit'],
    keywords: ['cockpit', 'painel', 'operacional'],
  },
  {
    id: 'inbox',
    title: 'Caixa de Entrada (Inbox)',
    text:
      'A Inbox concentra conversas WhatsApp recebidas. Permite visualizar threads, responder manualmente, aprovar decisões do agente quando necessário e acompanhar status de atendimento. Requer integração WhatsApp conectada em Configuração > Integrações.',
    routes: ['inbox'],
    keywords: ['inbox', 'whatsapp', 'conversas', 'mensagens', 'atendimento'],
  },
  {
    id: 'agents-hub',
    title: 'Central de Agentes',
    text:
      'Em Agentes você gerencia agentes de IA em produção e templates reutilizáveis. Pode criar agente a partir de template, ver canais conectados, status (ativo/inativo), abrir configuração do agente ou ir ao Playground para testar. Templates aceleram criação reutilizando papel, canais e comportamentos.',
    routes: ['agents', 'agent-config'],
    keywords: ['agentes', 'templates', 'criar agente', 'central'],
  },
  {
    id: 'agent-config',
    title: 'Configuração do Agente',
    text:
      'Na configuração do agente você define nome, instruções (prompt), idioma principal, modelo de IA, criatividade, arquivos da Knowledge Base vinculados, integrações (CRM, Calendly) e perfil de voz ElevenLabs (planos compatíveis). Alterações aqui afetam apenas aquele agente da sua empresa — não a Sonia Copilot da plataforma.',
    routes: ['agent-config'],
    keywords: ['configurar agente', 'prompt', 'personalidade', 'modelo'],
  },
  {
    id: 'playground',
    title: 'Playground',
    text:
      'O Playground simula conversas com um agente selecionado antes de publicar em canais reais. Suporta texto e, quando configurado, voz via navegador ou ElevenLabs. Ideal para validar respostas, RAG e fluxos de agendamento.',
    routes: ['playground'],
    keywords: ['playground', 'testar', 'simular', 'chat teste'],
  },
  {
    id: 'flows',
    title: 'Fluxos visuais',
    text:
      'Fluxos permite desenhar jornadas de atendimento com nós (mensagens, condições, integrações, handoff humano). Um fluxo pode ser vinculado a integrações WhatsApp. Use para triagem, FAQ guiada ou processos com ramificações.',
    routes: ['flows'],
    keywords: ['fluxos', 'flow', 'automação', 'jornada'],
  },
  {
    id: 'knowledge-base',
    title: 'Base de Conhecimento (RAG)',
    text:
      'Knowledge Base armazena arquivos que alimentam respostas dos seus agentes via RAG. Faça upload, processe embeddings e vincule arquivos a agentes específicos. Disponível nos planos Growth e Enterprise (Receptiva ou Completa). A Sonia Copilot da plataforma tem base própria separada — usuários não treinam a Copilot por aqui.',
    routes: ['knowledge'],
    keywords: ['knowledge', 'rag', 'arquivos', 'base de conhecimento', 'upload'],
  },
  {
    id: 'governance',
    title: 'Governança',
    text:
      'Governança avançada (mascaramento DLP, regras anti-alucinação configuráveis) está disponível nos planos Enterprise (Receptiva ou Completa). Planos Start e Growth usam proteções básicas automáticas sem tela de configuração avançada.',
    routes: ['governance'],
    keywords: ['governança', 'dlp', 'segurança', 'enterprise'],
  },
  {
    id: 'insights',
    title: 'Insights e métricas',
    text:
      'Insights reúne gráficos e indicadores de desempenho: volume de atendimentos, conversões, uso de agentes e tendências. Útil para gestores acompanharem resultados ao longo do tempo.',
    routes: ['insights'],
    keywords: ['insights', 'métricas', 'analytics', 'relatórios'],
  },
  {
    id: 'configuration',
    title: 'Configurações gerais',
    text:
      'Configuration concentra preferências da empresa: equipe, permissões, billing/assinatura, notificações e atalhos para integrações. Administradores gerenciam membros e plano comercial aqui.',
    routes: ['configuration'],
    keywords: ['configuração', 'settings', 'empresa', 'equipe'],
  },
  {
    id: 'integrations',
    title: 'Integrações',
    text:
      'Integrações conecta WhatsApp (Meta Cloud API), CRM (HubSpot etc.), Calendly, e-mail e outros conectores. Cada integração exige credenciais fornecidas pelo usuário na interface — nunca compartilhe chaves em chat. Após conectar, vincule integrações aos agentes ou fluxos desejados.',
    routes: ['integrations', 'configuration'],
    keywords: ['integrações', 'whatsapp', 'crm', 'calendly', 'conectar'],
  },
  {
    id: 'profile',
    title: 'Perfil e conta',
    text:
      'Profile exibe dados da conta, plano, faturamento resumido e preferências pessoais. O idioma da interface é alterado pelo seletor de globo no topo — isso também define o idioma da Sonia Copilot.',
    routes: ['profile'],
    keywords: ['perfil', 'conta', 'idioma', 'profile'],
  },
  {
    id: 'devices-iot',
    title: 'Dispositivos IoT',
    text:
      'Devices (IoT) permite monitorar e acionar dispositivos conectados quando habilitado no projeto. Use para cenários que combinam atendimento digital com automação física.',
    routes: ['devices'],
    keywords: ['iot', 'dispositivos', 'devices'],
  },
  {
    id: 'plans-overview',
    title: 'Planos comerciais',
    text:
      'Existem duas linhas: Sonia Receptiva (inbound/FAQ) e Sonia Completa (inclui outbound/SDR). Tiers: Start, Growth, Enterprise. Limites principais: atendimentos/mês, agentes ativos, RAG (Growth+), governança avançada e SSO (Enterprise). Plano gratuito permite explorar a plataforma com limites reduzidos. Upgrade em Configuration > Billing.',
    routes: ['configuration', 'profile'],
    keywords: ['planos', 'assinatura', 'billing', 'upgrade', 'limites'],
  },
  {
    id: 'plan-rag',
    title: 'RAG por plano',
    text:
      'Knowledge Base (RAG) não está incluída nos planos Start (Receptiva ou Completa). Nos planos Growth e Enterprise o RAG está disponível para arquivos dos agentes da sua empresa.',
    keywords: ['rag', 'plano start', 'knowledge bloqueado'],
  },
  {
    id: 'plan-agents-limit',
    title: 'Limite de agentes',
    text:
      'Start: 1 agente ativo (Receptiva) ou 1 (Completa). Growth: 3 agentes (Receptiva) ou 5 (Completa). Enterprise: agentes ilimitados no app. Ao atingir limite, ative outro agente só após desativar um ou fazer upgrade.',
    keywords: ['limite agentes', 'quantos agentes', 'ativar agente'],
  },
  {
    id: 'plan-atendimentos',
    title: 'Limite de atendimentos',
    text:
      'Start: 200 atendimentos/mês. Growth: 1.500/mês. Enterprise: sem teto no app. Um atendimento corresponde a uma sessão nova em tb_service_sessions no mês. Ao atingir limite, novas sessões WhatsApp são bloqueadas até upgrade ou próximo ciclo.',
    keywords: ['atendimentos', 'limite mensal', '200', '1500'],
  },
  {
    id: 'create-agent-steps',
    title: 'Como criar um agente',
    text:
      'Passos: 1) Ir a Agentes. 2) Escolher template ou criar do zero. 3) Definir nome, idioma e canais. 4) Salvar e abrir Configuração para prompt, integrações e arquivos RAG. 5) Ativar agente. 6) Testar no Playground. 7) Conectar WhatsApp ou fluxo se necessário.',
    routes: ['agents', 'agent-config', 'playground'],
    keywords: ['como criar agente', 'novo agente', 'passo a passo'],
  },
  {
    id: 'copilot-itself',
    title: 'Sonia Copilot da plataforma',
    text:
      'A Sonia Copilot é a assistente fixa da plataforma (ícone brilhante no canto inferior direito). Ajuda com dúvidas sobre navegação e funcionalidades. Suporta texto e voz pelo navegador. Não pode ser treinada, editada ou configurada pelo usuário — apenas o idioma segue o seletor global da interface.',
    keywords: ['copilot', 'assistente', 'sonia copilot', 'ajuda'],
  },
  {
    id: 'language-selector',
    title: 'Idioma da interface e Copilot',
    text:
      'O seletor de idioma (ícone globo) define idioma da interface e da Sonia Copilot. Idiomas suportados: Português (Brasil), Inglês (EUA), Espanhol, Francês, Alemão, Chinês simplificado, Japonês e Russo. Agentes de atendimento têm idioma próprio configurado em Agent Config, independente da Copilot.',
    routes: ['profile'],
    keywords: ['idioma', 'language', 'traduzir', 'português', 'inglês'],
  },
  {
    id: 'whatsapp-setup-high',
    title: 'Conectar WhatsApp (visão geral)',
    text:
      'Para WhatsApp: acesse Integrações, adicione integração Meta Cloud API, informe credenciais da Meta Business (App ID, Phone Number ID etc. conforme formulário), valide webhook e associe agente ou fluxo. Detalhes técnicos de webhook ficam na documentação Meta — não solicite segredos pelo chat da Copilot.',
    routes: ['integrations', 'inbox'],
    keywords: ['whatsapp', 'conectar whatsapp', 'meta', 'integração'],
  },
  {
    id: 'security-user',
    title: 'Segurança para o usuário',
    text:
      'Nunca compartilhe senhas, tokens de API, chaves de webhook ou credenciais de integração em conversas. A Copilot não solicita credenciais. Para problemas de acesso ou billing sensível, contate suporte humano da Onsmart AI.',
    keywords: ['segurança', 'senha', 'token', 'credencial'],
  },
]

/** Padrões que não devem aparecer no corpus (validação em testes). */
export const PLATFORM_KNOWLEDGE_FORBIDDEN_PATTERNS = [
  /\.env\b/i,
  /OPENAI_API_KEY/i,
  /SUPABASE_SERVICE_ROLE/i,
  /service role/i,
  /webhook secret/i,
  /stripe secret/i,
  /api[_-]?key/i,
  /password\s*=/i,
]
