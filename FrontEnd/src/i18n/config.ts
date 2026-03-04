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
    defaultNS: 'cockpit',
    ns: ['cockpit', 'inbox', 'playground', 'agentsHub', 'agentConfig', 'flows', 'governance', 'navigation', 'knowledgeBase', 'insights', 'configuration', 'profile', 'sidebar'],
    resources: {
      'pt-BR': {
        cockpit: {},
        inbox: {},
        playground: {},
        agentsHub: {},
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
        agentsHub: {},
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
