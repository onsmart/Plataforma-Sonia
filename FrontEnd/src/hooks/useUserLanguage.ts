import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase/client';
import { loadTranslationsFromDatabase, I18N_DATABASE_NAMESPACES } from '../i18n/config';

export function useUserLanguage() {
  const { i18n } = useTranslation();
  const { user, companiesId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastLanguageRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    async function loadUserLanguage() {
      // Aguardar até que user esteja disponível
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      // Evitar execuções duplicadas simultâneas
      if (isLoadingRef.current) {
        console.log('[useUserLanguage] Já está carregando, pulando execução duplicada...');
        return;
      }

      // Obter companiesId (do AuthContext ou localStorage)
      const companiesIdToUse = companiesId || localStorage.getItem('companies_id') || null;
      
      // Se companiesId ainda não está disponível, usar undefined (buscará apenas traduções globais)
      // Não bloquear - o segundo useEffect recarregará quando companiesId estiver disponível

      // Verificar se já carregou para o mesmo idioma
      const currentStoredLanguage = localStorage.getItem('i18nextLng');
      if (hasLoadedRef.current && lastLanguageRef.current === currentStoredLanguage && companiesIdToUse) {
        console.log('[useUserLanguage] Idioma já carregado, pulando...');
        setIsLoading(false);
        return;
      }

      isLoadingRef.current = true;

      try {
        console.log('[useUserLanguage] Iniciando carregamento de idioma. companiesId:', companiesIdToUse);
        
        // Buscar preferência do usuário no banco usando função RPC ou SELECT direto
        let targetLanguage = 'pt-BR';
        
        // Tentar usar função RPC primeiro (se existir)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('sp_get_user_language', {
            p_email: user.email.toLowerCase().trim()
          });
          
          if (!rpcError && rpcData) {
            targetLanguage = rpcData;
            console.log('[useUserLanguage] Idioma encontrado via RPC:', targetLanguage);
          } else {
            // Fallback para SELECT direto se RPC não existir
            throw new Error('RPC não disponível, usando SELECT direto');
          }
        } catch (rpcError) {
          // Se RPC não existir, usar SELECT direto
          console.log('[useUserLanguage] RPC não disponível, usando SELECT direto');
          const { data, error } = await supabase
            .from('tb_users')
            .select('language')
            .eq('email', user.email.toLowerCase().trim())
            .maybeSingle();

          if (!error && data?.language) {
            targetLanguage = data.language;
            console.log('[useUserLanguage] Idioma encontrado no banco (SELECT):', targetLanguage);
          } else {
            // Fallback para idioma do navegador ou pt-BR
            const browserLang = navigator.language || 'pt-BR';
            const lower = browserLang.toLowerCase();
            if (lower.startsWith('pt')) {
              targetLanguage = 'pt-BR';
            } else if (lower.startsWith('en')) {
              targetLanguage = 'en-US';
            } else if (lower.startsWith('es')) {
              targetLanguage = 'es-ES';
            } else {
              targetLanguage = 'pt-BR';
            }
            console.log('[useUserLanguage] Usando idioma do navegador:', targetLanguage);
          }
        }

        const supportedAppLanguages = ['pt-BR', 'en-US', 'es-ES'] as const
        if (!supportedAppLanguages.includes(targetLanguage as (typeof supportedAppLanguages)[number])) {
          console.warn('[useUserLanguage] Idioma salvo não tem seeds completos no app, usando pt-BR:', targetLanguage)
          targetLanguage = 'pt-BR'
        }

        // Mudar idioma PRIMEIRO (antes de atualizar localStorage)
        // Isso garante que o i18n use o idioma do banco, não do cache
        await i18n.changeLanguage(targetLanguage);
        
        // Depois atualizar localStorage para sincronização
        localStorage.setItem('i18nextLng', targetLanguage);
        
        // Carregar traduções do banco para o idioma selecionado
        const companiesIdParam = companiesIdToUse ?? undefined;
        console.log('[useUserLanguage] Carregando traduções para', targetLanguage, 'com companiesId:', companiesIdParam);
        await loadTranslationsFromDatabase(targetLanguage, companiesIdParam);
        
        // Marcar como carregado
        hasLoadedRef.current = true;
        lastLanguageRef.current = targetLanguage;
      } catch (error) {
        console.error('Erro ao carregar idioma do usuário:', error);
        const fallbackLang = 'pt-BR';
        localStorage.setItem('i18nextLng', fallbackLang);
        await i18n.changeLanguage(fallbackLang);
        const companiesIdParam = companiesIdToUse ?? undefined;
        await loadTranslationsFromDatabase(fallbackLang, companiesIdParam);
        hasLoadedRef.current = true;
        lastLanguageRef.current = fallbackLang;
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }

    loadUserLanguage();
  }, [user?.email, i18n]);

  // Recarregar traduções quando companiesId mudar (apenas se já tiver carregado uma vez)
  useEffect(() => {
    if (i18n.language && hasLoadedRef.current && companiesId) {
      console.log('[useUserLanguage] companiesId mudou, recarregando traduções para', i18n.language);
      const companiesIdParam = companiesId ?? undefined;
      loadTranslationsFromDatabase(i18n.language, companiesIdParam);
    }
  }, [companiesId]);

  // Função auxiliar para verificar se todas as traduções foram carregadas
  const verifyAllTranslationsLoaded = (language: string, maxRetries: number = 10, delay: number = 200): Promise<boolean> => {
    return new Promise((resolve) => {
      const namespaces = [...I18N_DATABASE_NAMESPACES];
      
      let retries = 0;
      
      const checkTranslations = () => {
        const allLoaded = namespaces.every(ns => {
          const translations = i18n.getResourceBundle(language, ns);
          const hasTranslations = translations && Object.keys(translations).length > 0;
          
          if (!hasTranslations) {
            console.log(`[useUserLanguage] Namespace ${ns} ainda não tem traduções carregadas`);
          }
          
          return hasTranslations;
        });
        
        if (allLoaded) {
          console.log('[useUserLanguage] ✅ Todas as traduções foram carregadas!');
          resolve(true);
          return;
        }
        
        retries++;
        if (retries >= maxRetries) {
          console.warn('[useUserLanguage] ⚠️ Timeout ao verificar traduções. Algumas podem não ter sido carregadas.');
          resolve(false);
          return;
        }
        
        setTimeout(checkTranslations, delay);
      };
      
      checkTranslations();
    });
  };

  const changeLanguage = async (language: string) => {
    if (!user?.email) {
      console.warn('[useUserLanguage] Usuário não autenticado, não é possível salvar idioma');
      return;
    }

    const supportedAppLanguages = ['pt-BR', 'en-US', 'es-ES'] as const
    if (!supportedAppLanguages.includes(language as (typeof supportedAppLanguages)[number])) {
      console.warn('[useUserLanguage] Idioma não suportado:', language)
      return
    }

    // Se já está no mesmo idioma, não fazer nada
    if (language === i18n.language) {
      return;
    }

    setIsChangingLanguage(true); // INICIAR LOADING

    try {
      console.log('[useUserLanguage] Iniciando mudança de idioma para:', language);

      // 1. Atualizar no banco PRIMEIRO (usando email para garantir que encontre o usuário)
      const { error: updateError } = await supabase
        .from('tb_users')
        .update({ language })
        .eq('email', user.email.toLowerCase().trim());

      if (updateError) {
        console.error('[useUserLanguage] Erro ao salvar idioma no banco:', updateError);
        throw updateError;
      }

      console.log('[useUserLanguage] Idioma salvo no banco:', language);

      // 2. Atualizar localStorage
      localStorage.setItem('i18nextLng', language);

      // 3. Mudar idioma no i18n
      await i18n.changeLanguage(language);
      
      // 4. Carregar traduções do banco para o novo idioma
      let companiesIdToUse = companiesId;
      if (!companiesIdToUse) {
        companiesIdToUse = localStorage.getItem('companies_id') || null;
        console.log('[useUserLanguage] companiesId obtido do localStorage:', companiesIdToUse);
      }
      
      console.log('[useUserLanguage] Carregando todas as traduções para:', language);
      await loadTranslationsFromDatabase(language, companiesIdToUse ?? undefined);
      
      // 5. Aguardar um pouco para garantir que as traduções foram processadas
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 6. Verificar se TODAS as traduções foram carregadas antes de liberar
      console.log('[useUserLanguage] Verificando se todas as traduções foram carregadas...');
      const allLoaded = await verifyAllTranslationsLoaded(language);
      
      if (!allLoaded) {
        console.warn('[useUserLanguage] ⚠️ Algumas traduções podem não ter sido carregadas completamente, mas continuando...');
      }
      
      // Atualizar refs
      lastLanguageRef.current = language;
      hasLoadedRef.current = true;

      console.log('[useUserLanguage] ✅ Mudança de idioma concluída:', language);
    } catch (error) {
      console.error('[useUserLanguage] Erro ao mudar idioma:', error);
      throw error;
    } finally {
      setIsChangingLanguage(false); // FINALIZAR LOADING
    }
  };

  return { 
    currentLanguage: i18n.language, 
    changeLanguage, 
    isLoading,
    isChangingLanguage,
    companiesId 
  };
}
