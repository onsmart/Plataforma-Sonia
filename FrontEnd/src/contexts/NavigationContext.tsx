import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

// Define valid routes for the application
export type RoutePath =
  | 'cockpit'
  | 'inbox'
  | 'devices'
  | 'agents'
  | 'playground'
  | 'flows'
  | 'knowledge'
  | 'governance'
  | 'insights'
  | 'configuration'
  | 'profile'
  | 'agent-config';

// Helper to validate routes
const isValidRoute = (path: string): boolean => {
  const validRoutes: RoutePath[] = [
    'cockpit',
    'inbox',
    'devices',
    'agents',
    'playground',
    'flows',
    'knowledge',
    'governance',
    'insights',
    'configuration',
    'profile',
    'agent-config'
  ];
  return validRoutes.includes(path as RoutePath);
};

/** Retorne `false` para cancelar a navegação (ex.: fluxo com alterações não salvas). */
export type NavigationBeforeHandler = (targetPath: string) => boolean;

export type NavigationNavigateOptions = {
  bypassBlockers?: boolean;
};

interface NavigationContextType {
  currentRoute: RoutePath;
  navigate: (path: RoutePath | string, options?: NavigationNavigateOptions) => void;
  getPageTitle: () => string;
  registerNavigationBlocker: (handler: NavigationBeforeHandler) => () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation('navigation');
  const { session, loading: authLoading } = useAuth();
  const navigationBlockersRef = useRef(new Set<NavigationBeforeHandler>());
  
  // Initialize state from current hash or default to cockpit
  const getInitialRoute = (): RoutePath => {
    const hash = window.location.hash.replace('#', '');
    return isValidRoute(hash) ? (hash as RoutePath) : 'cockpit';
  };

  const [currentRoute, setCurrentRoute] = useState<RoutePath>(getInitialRoute);
  const [translationsReady, setTranslationsReady] = useState(false);
  const [, setForceUpdate] = useState(0);

  // Garantir que as traduções do namespace navigation estejam carregadas
  // IMPORTANTE: Só carregar traduções quando o usuário estiver autenticado
  useEffect(() => {
    // Não tentar carregar traduções se ainda estiver carregando autenticação ou se não houver sessão
    if (authLoading || !session) {
      console.log('[NavigationContext] Aguardando autenticação antes de carregar traduções');
      return;
    }

    const checkTranslations = async () => {
      try {
        const currentLang = i18n.language || 'pt-BR';
        const navigationTranslations = i18n.getResourceBundle(currentLang, 'navigation');
        
        console.log('[NavigationContext] Verificando traduções para', currentLang);
        console.log('[NavigationContext] Traduções disponíveis:', navigationTranslations ? Object.keys(navigationTranslations).length : 0, 'chaves');
        if (navigationTranslations) {
          console.log('[NavigationContext] Chaves disponíveis:', Object.keys(navigationTranslations));
        }
        
        if (navigationTranslations && Object.keys(navigationTranslations).length > 0) {
          console.log('[NavigationContext] ✅ Traduções já disponíveis:', Object.keys(navigationTranslations).length, 'chaves');
          setTranslationsReady(true);
        } else {
          console.log('[NavigationContext] ⚠️ Traduções não encontradas, carregando...');
          const { loadTranslationsFromDatabase } = await import('../i18n/config');
          const { databaseI18nBackend } = await import('../services/i18n/database-backend');
          
          // Invalidar cache explicitamente antes de carregar
          databaseI18nBackend.invalidateCache(currentLang, 'navigation');
          
          const companiesId = localStorage.getItem('companies_id') || undefined;
          console.log('[NavigationContext] Carregando traduções com companiesId:', companiesId);
          await loadTranslationsFromDatabase(currentLang, companiesId);
          
          // Aguardar um pouco para garantir que as traduções foram adicionadas
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verificar novamente após carregar
          const updatedTranslations = i18n.getResourceBundle(currentLang, 'navigation');
          console.log('[NavigationContext] Após carregar, traduções disponíveis:', updatedTranslations ? Object.keys(updatedTranslations).length : 0, 'chaves');
          if (updatedTranslations) {
            console.log('[NavigationContext] Chaves após carregar:', Object.keys(updatedTranslations));
            console.log('[NavigationContext] Valor de pageTitle.governance:', updatedTranslations['pageTitle.governance']);
          }
          
          // Forçar atualização do i18n para notificar componentes
          i18n.emit('loaded');
          i18n.emit('added', currentLang, 'navigation');
          setTranslationsReady(true);
          // Forçar re-render do componente
          setForceUpdate(prev => prev + 1);
        }
      } catch (error: any) {
        // Tratar erros de abort (não são críticos)
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log('[NavigationContext] Requisição abortada (não crítico)');
          return;
        }
        console.error('[NavigationContext] Erro ao carregar traduções:', error);
      }
    };
    
    checkTranslations();
    
    // Escutar mudanças no i18n
    const handleLanguageChanged = () => {
      if (session) {
        checkTranslations();
      }
    };
    
    const handleLoaded = () => {
      const currentLang = i18n.language || 'pt-BR';
      const navigationTranslations = i18n.getResourceBundle(currentLang, 'navigation');
      if (navigationTranslations && Object.keys(navigationTranslations).length > 0) {
        setTranslationsReady(true);
        // Forçar re-render do componente
        setForceUpdate(prev => prev + 1);
      }
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    i18n.on('loaded', handleLoaded);
    i18n.on('added', handleLoaded);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
      i18n.off('loaded', handleLoaded);
      i18n.off('added', handleLoaded);
    };
  }, [i18n, session, authLoading]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      // Remove query strings para validar a rota
      const routePath = hash.split('?')[0];
      if (isValidRoute(routePath)) {
        setCurrentRoute(routePath as RoutePath);
      } else {
        // Redirect invalid hashes to cockpit
        window.location.hash = '#cockpit';
        setCurrentRoute('cockpit');
      }
    };

    // Set initial hash if empty
    if (!window.location.hash) {
      window.location.hash = '#cockpit';
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const registerNavigationBlocker = useCallback((handler: NavigationBeforeHandler) => {
    navigationBlockersRef.current.add(handler);
    return () => {
      navigationBlockersRef.current.delete(handler);
    };
  }, []);

  const navigate = useCallback((path: RoutePath | string, options?: NavigationNavigateOptions) => {
    const target = String(path).replace(/^#/, '');
    if (!options?.bypassBlockers) {
      for (const blocker of navigationBlockersRef.current) {
        try {
          if (blocker(target) === false) {
            return;
          }
        } catch (e) {
          console.error('[NavigationContext] Erro em navigation blocker:', e);
        }
      }
    }
    window.location.hash = `#${target}`;
  }, []);

  const getPageTitle = () => {
    // Fallbacks caso traduções não estejam disponíveis
    const fallbacks: Record<RoutePath, string> = {
      'cockpit': 'Operations Cockpit',
      'inbox': 'Universal Inbox',
      'devices': 'IoT & Physical Devices',
      'agents': 'Agents & Workflows',
      'playground': 'Agent Playground',
      'flows': 'Flows',
      'knowledge': 'Knowledge Base',
      'governance': 'Governança e Segurança',
      'insights': 'Insights & Data',
      'configuration': 'Platform Configuration',
      'profile': 'User Profile',
      'agent-config': 'Agent Configuration'
    };

    // Verificar se traduções estão disponíveis
    const currentLang = i18n.language || 'pt-BR';
    const navigationTranslations = i18n.getResourceBundle(currentLang, 'navigation');
    const hasTranslations = navigationTranslations && Object.keys(navigationTranslations).length > 0;
    
    // Log para debug
    if (currentRoute === 'governance') {
      console.log('[NavigationContext] getPageTitle para governance:', {
        currentLang,
        hasTranslations,
        translationValue: navigationTranslations?.['pageTitle.governance'],
        allKeys: navigationTranslations ? Object.keys(navigationTranslations) : []
      });
    }
    
    if (!hasTranslations) {
      console.log('[NavigationContext] Traduções não disponíveis, usando fallback para', currentRoute);
      return fallbacks[currentRoute] || fallbacks.cockpit;
    }

    const translated = (() => {
      switch (currentRoute) {
        case 'cockpit': return t('pageTitle.cockpit', { defaultValue: fallbacks.cockpit });
        case 'inbox': return t('pageTitle.inbox', { defaultValue: fallbacks.inbox });
        case 'devices': return t('pageTitle.devices', { defaultValue: fallbacks.devices });
        case 'agents': return t('pageTitle.agents', { defaultValue: fallbacks.agents });
        case 'playground': return t('pageTitle.playground', { defaultValue: fallbacks.playground });
        case 'flows': return t('pageTitle.flows', { defaultValue: fallbacks.flows });
        case 'knowledge': return t('pageTitle.knowledge', { defaultValue: fallbacks.knowledge });
        case 'governance': {
          const result = t('pageTitle.governance', { defaultValue: fallbacks.governance });
          console.log('[NavigationContext] Tradução de governance:', result);
          return result;
        }
        case 'insights': return t('pageTitle.insights', { defaultValue: fallbacks.insights });
        case 'configuration': return t('pageTitle.configuration', { defaultValue: fallbacks.configuration });
        case 'profile': return t('pageTitle.profile', { defaultValue: fallbacks.profile });
        case 'agent-config': return t('pageTitle.agentConfig', { defaultValue: fallbacks['agent-config'] });
        default: return t('pageTitle.cockpit', { defaultValue: fallbacks.cockpit });
      }
    })();

    // Se retornou a chave (tradução não encontrada), usar fallback
    if (translated.startsWith('pageTitle.')) {
      console.log('[NavigationContext] Tradução não encontrada para', currentRoute, 'usando fallback');
      return fallbacks[currentRoute] || fallbacks.cockpit;
    }

    return translated;
  };

  return (
    <NavigationContext.Provider
      value={{ currentRoute, navigate, getPageTitle, registerNavigationBlocker }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
