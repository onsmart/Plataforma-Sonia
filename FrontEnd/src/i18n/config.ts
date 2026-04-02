import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { databaseI18nBackend } from '../services/i18n/database-backend';

// Inicializar i18next sem backend customizado (usaremos recursos vazios inicialmente)
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US', 'es-ES'],
    defaultNS: 'cockpit',
    ns: ['cockpit', 'inbox', 'playground', 'agentsHub', 'agentConfig', 'flows', 'governance', 'navigation', 'knowledgeBase', 'insights', 'configuration', 'profile', 'sidebar'],
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
          }
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {}
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
          }
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {}
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
          }
        },
        agentConfig: {},
        flows: {},
        governance: {},
        navigation: {},
        knowledgeBase: {},
        insights: {},
        configuration: {},
        profile: {},
        sidebar: {}
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
      checkWhitelist: true,
    },
  });

// Função para carregar traduções do banco e adicionar ao i18next
export async function loadTranslationsFromDatabase(language: string, companiesId?: string | null) {
  const namespaces = ['cockpit', 'inbox', 'playground', 'agentsHub', 'agentConfig', 'flows', 'governance', 'navigation', 'knowledgeBase', 'insights', 'configuration', 'profile', 'sidebar'];
  
  // Invalidar apenas o cache do idioma específico (não todos os idiomas)
  databaseI18nBackend.invalidateCache(language);
  
  // Converter null para undefined para manter compatibilidade
  const companiesIdParam = companiesId || undefined;
  
  for (const ns of namespaces) {
    try {
      const translations = await databaseI18nBackend.loadTranslations(
        language,
        ns,
        companiesIdParam
      );

      console.log(`[i18n] Carregando namespace ${ns} para ${language}:`, Object.keys(translations).length, 'chaves');

      // Adicionar traduções ao i18next (merge=true, deep=true para não sobrescrever outros idiomas)
      if (Object.keys(translations).length > 0) {
        i18n.addResourceBundle(language, ns, translations, true, true);
        console.log(`[i18n] ✅ Traduções do namespace ${ns} adicionadas ao i18next para ${language}`);
        
        // Emitir evento para notificar componentes que as traduções foram adicionadas
        i18n.emit('added', language, ns);
        
        // Verificar se outros idiomas ainda estão presentes
        const allLanguages = Object.keys(i18n.store.data || {});
        console.log(`[i18n] Idiomas carregados no i18next:`, allLanguages);
        allLanguages.forEach(lang => {
          const namespaces = Object.keys(i18n.store.data[lang] || {});
          console.log(`[i18n]   - ${lang}: ${namespaces.length} namespaces (${namespaces.join(', ')})`);
        });
      } else {
        console.warn(`[i18n] ⚠️ Nenhuma tradução encontrada para namespace ${ns} (${language})`);
      }
    } catch (error) {
      console.error(`[i18n] ❌ Erro ao carregar traduções do namespace ${ns}:`, error);
    }
  }
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
