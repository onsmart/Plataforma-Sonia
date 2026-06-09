import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { databaseI18nBackend } from '../services/i18n/database-backend';
import { localSeedResources } from './local-seed-resources';
import { nestSeedOverrides, seedOverrides } from './seed-overrides';

// Inicializar i18next sem backend customizado (usaremos recursos vazios inicialmente)
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      'fr-FR': ['en-US', 'pt-BR'],
      'de-DE': ['en-US', 'pt-BR'],
      'zh-CN': ['en-US', 'pt-BR'],
      'ja-JP': ['en-US', 'pt-BR'],
      'ru-RU': ['en-US', 'pt-BR'],
      default: ['pt-BR'],
    },
    supportedLngs: ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP', 'ru-RU'],
    defaultNS: 'cockpit',
    ns: ['cockpit', 'inbox', 'playground', 'agentsHub', 'agentConfig', 'flows', 'governance', 'navigation', 'knowledgeBase', 'insights', 'configuration', 'profile', 'sidebar', 'copilot', 'common', 'auth'],
    resources: {
      'pt-BR': {
        cockpit: {},
        inbox: {},
        playground: {},
        agentsHub: {
          header: {
            title: 'Central de Agentes',
            subtitle: 'Agentes de IA s\u00e3o os assistentes que atuam no projeto no dia a dia, atendendo, qualificando ou executando tarefas. Templates s\u00e3o modelos prontos que servem como base para criar novos agentes com mais rapidez, reutilizando configura\u00e7\u00f5es, canais e comportamentos.',
            subtitleOverview: 'Nesta aba voc\u00ea organiza os Agentes de IA que j\u00e1 est\u00e3o em uso no projeto, acompanha os canais onde cada um atua e cria novos agentes a partir de Templates.'
          },
          overview: {
            activeAgentsLabel: 'Agentes ativos',
            activeAgentsDescription: 'operando agora',
            connectedChannelsLabel: 'Canais conectados',
            connectedChannelsDescription: 'canais ativos',
            integrationsLabel: 'Integra\u00e7\u00f5es',
            integrationsDescription: 'fontes conectadas',
            templatesInUseLabel: 'Templates em uso',
            templatesInUseDescription: 'agentes com template'
          },
          channelsSection: {
            eyebrow: 'Canais & Integra\u00e7\u00f5es',
            title: 'Status centralizado dos pontos de contato',
            description: 'Veja cobertura por canal e integra\u00e7\u00f5es conectadas sem navegar para outra \u00e1rea.',
            channelsLabel: 'Canais',
            integrationsLabel: 'Integra\u00e7\u00f5es',
            connectedCopy: 'Canal ativo e pronto para opera\u00e7\u00e3o.',
            partialCopy: 'Integra\u00e7\u00e3o ativa com pontos pendentes.',
            disconnectedCopy: 'Canal dispon\u00edvel, aguardando conex\u00e3o.'
          },
          librarySection: {
            eyebrow: 'Agentes & Templates',
            agentsTitle: 'Agentes em produ\u00e7\u00e3o',
            templatesTitle: 'Biblioteca de templates',
            agentsDescription: 'Acompanhe status, canais e atalhos de gest\u00e3o com mais clareza e menos ru\u00eddo visual.',
            templatesDescription: 'Organize templates com ownership, complexidade e a\u00e7\u00f5es sem blocos redundantes.',
            agentsMetricLabel: 'Agentes',
            templatesMetricLabel: 'Templates',
            agentCreateTitle: 'Implantar Novo Agente',
            agentCreateDescription: 'Come\u00e7ar de um template',
            templateCreateTitle: 'Criar Template',
            templateCreateDescription: 'Come\u00e7ar do zero',
            agentLanguageLabel: 'Idioma',
            templateChannelsLabel: 'Canais',
            templateSkillsLabel: 'Skills',
            templateLinkedCount: '{{count}} vinculadas',
            templateNoExtra: 'Nenhuma extra',
            templateShared: 'Compartilhado',
            templateOwn: 'Seu template',
            templateReadOnly: 'Apenas leitura',
            templateDelete: 'Excluir',
            templateUse: 'Usar template',
            templateUnavailable: 'Template n\u00e3o encontrado',
            defaultLanguage: 'PT'
          },
          tabs: {
            agents: 'Agentes',
            templates: 'Templates'
          },
          channels: {
            status: {
              connected: 'Conectado',
              partial: 'Parcial',
              disconnected: 'Desconectado'
            }
          },
          button: {
            createAgentAi: 'Criar Agente com IA',
          },
          aiSuggest: {
            title: 'Criar com IA é mais rápido',
            description: 'O wizard de IA cria o agente completo em segundos com base no seu objetivo. Quer tentar?',
            useAi: 'Criar com IA',
            useManual: 'Criar manualmente',
            useTemplate: 'Criar template mesmo assim',
          },
          agentLimit: {
            tooltip: 'Limite de {{limit}} agente(s) atingido no plano atual. Faça upgrade para criar mais.',
          },
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {},
        copilot: {
          title: 'Sonia AI Copilot',
          subtitle: 'Sua assistente para navegar e usar a plataforma Sonia.',
          welcome: 'Olá! Eu sou a Sonia Copilot. Posso ajudar você a navegar pela plataforma e tirar dúvidas sobre funcionalidades, planos e fluxos de uso.',
          placeholder: "Digite 'Ir para Inbox'...",
          listening: 'Ouvindo...',
          thinking: 'Pensando...',
          navigatingTo: 'Indo para {{page}}...',
          connectionError: 'Não consegui conectar ao servidor. Tente novamente.',
          voiceUnsupported: 'Seu navegador não suporta entrada por voz.',
          voiceBlocked: 'O microfone está bloqueado neste ambiente. Continue conversando por texto.',
          voiceError: 'Erro de voz: {{error}}',
          bubble: {
            '0': 'Precisa de ajuda? Estou à sua disposição!',
            '1': 'Tem alguma dúvida? Pode me perguntar!',
            '2': 'Posso te guiar pela plataforma!',
            '3': 'Clique aqui e converse comigo!',
          },
        }
      },
      'en-US': {
        cockpit: {},
        inbox: {},
        playground: {},
        agentsHub: {
          header: {
            title: 'Agents Hub',
            subtitle: 'AI Agents are the assistants that work in the project every day, handling conversations, qualification, or operational tasks. Templates are ready-made blueprints used to create new agents faster by reusing settings, channels, and behavior.',
            subtitleOverview: 'In this tab you organize the AI Agents already being used in the project, track the channels where each one operates, and create new agents from Templates.'
          },
          overview: {
            activeAgentsLabel: 'Active Agents',
            activeAgentsDescription: 'running now',
            connectedChannelsLabel: 'Channels Connected',
            connectedChannelsDescription: 'active channels',
            integrationsLabel: 'Integrations',
            integrationsDescription: 'connected sources',
            templatesInUseLabel: 'Templates in Use',
            templatesInUseDescription: 'agents with template'
          },
          channelsSection: {
            eyebrow: 'Channels & Integrations',
            title: 'Centralized touchpoint status',
            description: 'Review channel coverage and connected integrations without leaving this area.',
            channelsLabel: 'Channels',
            integrationsLabel: 'Integrations',
            connectedCopy: 'Active channel ready for operation.',
            partialCopy: 'Integration is active with pending setup.',
            disconnectedCopy: 'Channel available and waiting for connection.'
          },
          librarySection: {
            eyebrow: 'Agents & Templates',
            agentsTitle: 'Agents running in production',
            templatesTitle: 'Template library',
            agentsDescription: 'Track status, channels, and management shortcuts with more clarity and less visual noise.',
            templatesDescription: 'Organize templates with ownership, complexity, and visible actions.',
            agentsMetricLabel: 'Agents',
            templatesMetricLabel: 'Templates',
            agentCreateTitle: 'Deploy New Agent',
            agentCreateDescription: 'Start from a template',
            templateCreateTitle: 'Create Template',
            templateCreateDescription: 'Start from scratch',
            agentLanguageLabel: 'Language',
            templateChannelsLabel: 'Channels',
            templateSkillsLabel: 'Skills',
            templateLinkedCount: '{{count}} linked',
            templateNoExtra: 'No extra skills',
            templateShared: 'Shared',
            templateOwn: 'Your template',
            templateReadOnly: 'Read only',
            templateDelete: 'Delete',
            templateUse: 'Use template',
            templateUnavailable: 'Template not found',
            defaultLanguage: 'EN'
          },
          tabs: {
            agents: 'Agents',
            templates: 'Templates'
          },
          channels: {
            status: {
              connected: 'Connected',
              partial: 'Partial',
              disconnected: 'Disconnected'
            }
          },
          button: {
            createAgentAi: 'Create Agent with AI',
          },
          aiSuggest: {
            title: 'Creating with AI is faster',
            description: 'The AI wizard creates the complete agent in seconds based on your goal. Want to try?',
            useAi: 'Create with AI',
            useManual: 'Create manually',
            useTemplate: 'Create template anyway',
          },
          agentLimit: {
            tooltip: 'Limit of {{limit}} agent(s) reached on your current plan. Upgrade to create more.',
          },
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {},
        copilot: {
          title: 'Sonia AI Copilot',
          subtitle: 'Your AI assistant for navigating and using the SONIA platform.',
          welcome: 'Hello! I am Sonia Copilot. I can help you navigate the platform and answer questions about features, plans, and workflows.',
          placeholder: "Type 'Go to Inbox'...",
          listening: 'Listening...',
          thinking: 'Thinking...',
          navigatingTo: 'Navigating to {{page}}...',
          connectionError: 'Could not connect to the server. Please try again.',
          voiceUnsupported: 'Your browser does not support voice input.',
          voiceBlocked: 'Microphone access is blocked in this environment. Please continue via text.',
          voiceError: 'Voice error: {{error}}',
          bubble: {
            '0': 'Need help? I\'m here for you!',
            '1': 'Have any questions? Just ask!',
            '2': 'I can guide you through the platform!',
            '3': 'Click here to chat with me!',
          },
        }
      },
      'es-ES': {
        cockpit: {},
        inbox: {},
        playground: {},
        agentsHub: {
          header: {
            title: 'Central de Agentes',
            subtitle: 'Los Agentes de IA son los asistentes que trabajan en el proyecto en el dia a dia, atendiendo conversaciones, calificando oportunidades o ejecutando tareas. Las Plantillas son modelos listos que sirven como base para crear nuevos agentes mas rapido, reutilizando configuraciones, canales y comportamientos.',
            subtitleOverview: 'En esta pestaña organizas los Agentes de IA que ya se usan en el proyecto, acompanhas los canales donde actua cada uno y creas nuevos agentes a partir de Plantillas. En la practica, los Agentes de IA realizan el trabajo del dia a dia, mientras que las Plantillas funcionan como modelos listos para acelerar la creacion de nuevas configuraciones.'
          },
          tabs: {
            agents: 'Agentes',
            templates: 'Plantillas'
          },
          channels: {
            status: {
              connected: 'Conectado',
              partial: 'Parcial',
              disconnected: 'Desconectado'
            }
          },
          button: {
            createAgentAi: 'Crear Agente con IA',
          },
          aiSuggest: {
            title: 'Crear con IA es más rápido',
            description: 'El wizard de IA crea el agente completo en segundos según tu objetivo. ¿Quieres intentarlo?',
            useAi: 'Crear con IA',
            useManual: 'Crear manualmente',
            useTemplate: 'Crear plantilla de todos modos',
          },
          agentLimit: {
            tooltip: 'Límite de {{limit}} agente(s) alcanzado en tu plan actual. Haz upgrade para crear más.',
          },
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {},
        copilot: {
          title: 'Sonia AI Copilot',
          subtitle: 'Tu asistente para navegar y usar la plataforma Sonia.',
          welcome: '¡Hola! Soy Sonia Copilot. Puedo ayudarte a navegar por la plataforma y responder dudas sobre funciones, planes y flujos de uso.',
          placeholder: "Escribe 'Ir a Inbox'...",
          listening: 'Escuchando...',
          thinking: 'Pensando...',
          navigatingTo: 'Yendo a {{page}}...',
          connectionError: 'No pude conectar con el servidor. Inténtalo de nuevo.',
          voiceUnsupported: 'Tu navegador no admite entrada por voz.',
          voiceBlocked: 'El micrófono está bloqueado en este entorno. Continúa por texto.',
          voiceError: 'Error de voz: {{error}}',
          bubble: {
            '0': '¿Necesitas ayuda? ¡Estoy aquí para ti!',
            '1': '¿Tienes alguna duda? ¡Pregúntame!',
            '2': '¡Puedo guiarte por la plataforma!',
            '3': '¡Haz clic aquí y habla conmigo!',
          },
        }
      }
    },
    interpolation: {
      escapeValue: false, // React já faz escape
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Não usar cache na inicialização - vamos buscar do banco
    },
  });

// Fallback local gerado a partir dos seeds SQL do backend.
// Ele evita que a UI mostre chaves cruas quando o Supabase/Data API falha,
// enquanto as traducoes do banco continuam tendo prioridade quando carregadas.
Object.entries(localSeedResources).forEach(([language, namespaces]) => {
  Object.entries(namespaces).forEach(([namespace, translations]) => {
    if (Object.keys(translations).length > 0) {
      i18n.addResourceBundle(language, namespace, translations, true, false)
    }
  })
})

Object.entries(seedOverrides).forEach(([language, namespaces]) => {
  Object.entries(namespaces).forEach(([namespace, flatKeys]) => {
    const nested = nestSeedOverrides(flatKeys)
    if (Object.keys(nested).length > 0) {
      i18n.addResourceBundle(language, namespace, nested, true, false)
    }
  })
})

/** Ordem: UI global (sidebar, navegação) primeiro para evitar flash de chaves após F5; depois o restante em paralelo. */
export const I18N_DATABASE_NAMESPACES = [
  'sidebar',
  'navigation',
  'common',
  'auth',
  'copilot',
  'profile',
  'cockpit',
  'inbox',
  'playground',
  'agentsHub',
  'agentConfig',
  'flows',
  'governance',
  'knowledgeBase',
  'insights',
  'configuration',
] as const

// Função para carregar traduções do banco e adicionar ao i18next
export async function loadTranslationsFromDatabase(language: string, companiesId?: string | null) {
  const namespaces = [...I18N_DATABASE_NAMESPACES]

  // Invalidar apenas o cache do idioma específico (não todos os idiomas)
  databaseI18nBackend.invalidateCache(language)

  // Converter null para undefined para manter compatibilidade
  const companiesIdParam = companiesId || undefined

  await Promise.all(
    namespaces.map(async (ns) => {
      try {
        const translations = await databaseI18nBackend.loadTranslations(
          language,
          ns,
          companiesIdParam
        )

        console.log(
          `[i18n] Carregando namespace ${ns} para ${language}:`,
          Object.keys(translations).length,
          'chaves'
        )

        if (Object.keys(translations).length > 0) {
          i18n.addResourceBundle(language, ns, translations, true, true)
          console.log(`[i18n] ✅ Traduções do namespace ${ns} adicionadas ao i18next para ${language}`)
          i18n.emit('added', language, ns)
        } else {
          console.warn(`[i18n] ⚠️ Nenhuma tradução encontrada para namespace ${ns} (${language})`)
        }
      } catch (error) {
        console.error(`[i18n] ❌ Erro ao carregar traduções do namespace ${ns}:`, error)
      }
    })
  )
}

// Carregar traduções iniciais será feito pelo useUserLanguage hook
// Não carregar aqui para evitar race conditions com AuthContext

// Atualizar companies_id quando mudar
if (typeof window !== 'undefined') {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key: string, value: string) {
    originalSetItem.call(this, key, value);
    if (key === 'companies_id') {
      // Invalidar cache quando companies_id mudar
      databaseI18nBackend.invalidateCache();
    }
  };
}

export default i18n;
