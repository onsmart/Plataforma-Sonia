import { supabase } from '../../utils/supabase/client';

interface TranslationCache {
  [language: string]: {
    [namespace: string]: {
      [key: string]: string;
    };
  };
}

class DatabaseI18nBackend {
  private cache: TranslationCache = {};
  private cacheTimestamp: { [key: string]: number } = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Busca traduções do banco (com cache)
   * Prioridade: Tenant > Global
   */
  async loadTranslations(
    language: string,
    namespace: string,
    companiesId?: string
  ): Promise<Record<string, string>> {
    const cacheKey = `${companiesId || 'global'}:${language}:${namespace}`;
    const now = Date.now();

    // Verificar cache
    if (
      this.cache[language]?.[namespace] &&
      this.cacheTimestamp[cacheKey] &&
      now - this.cacheTimestamp[cacheKey] < this.CACHE_TTL
    ) {
      return this.cache[language][namespace];
    }

    // Buscar do banco
    console.log(`[DatabaseI18nBackend] Buscando traduções: language=${language}, namespace=${namespace}, companiesId=${companiesId || 'null'}`);
    
    let query = supabase
      .from('tb_i18n_translations')
      .select('key, value')
      .eq('language', language)
      .eq('namespace', namespace)
      .eq('is_active', true);

    // Se tem tenant, buscar traduções do tenant + fallback global
    if (companiesId) {
      try {
        // Buscar traduções do tenant, ordenando por updated_at DESC para pegar a mais recente em caso de duplicatas
        const { data: tenantTranslations, error: tenantError } = await query
          .eq('companies_id', companiesId)
          .order('updated_at', { ascending: false });

        // Tratar erros de abort (não são críticos)
        if (tenantError && tenantError.name !== 'AbortError' && !tenantError.message?.includes('aborted')) {
          console.error(`[DatabaseI18nBackend] Erro ao buscar traduções do tenant:`, tenantError);
        }

        console.log(`[DatabaseI18nBackend] Traduções do tenant (${companiesId}):`, tenantTranslations?.length || 0, tenantError?.name === 'AbortError' ? 'AbortError (ignorado)' : tenantError);

        // Buscar também traduções globais como fallback, ordenando por updated_at DESC
        const { data: globalTranslations, error: globalError } = await supabase
          .from('tb_i18n_translations')
          .select('key, value')
          .eq('language', language)
          .eq('namespace', namespace)
          .is('companies_id', null)
          .eq('is_active', true)
          .order('updated_at', { ascending: false });

        // Tratar erros de abort (não são críticos)
        if (globalError && globalError.name !== 'AbortError' && !globalError.message?.includes('aborted')) {
          console.error(`[DatabaseI18nBackend] Erro ao buscar traduções globais:`, globalError);
        }

        console.log(`[DatabaseI18nBackend] Traduções globais:`, globalTranslations?.length || 0, globalError?.name === 'AbortError' ? 'AbortError (ignorado)' : globalError);

      // Mesclar: tenant sobrescreve global
      // Usar Map para garantir que apenas a primeira ocorrência de cada chave seja mantida
      const merged: Record<string, string> = {};
      
      // Primeiro adiciona globais (a primeira ocorrência de cada chave, que é a mais recente devido ao ORDER BY)
      globalTranslations?.forEach((t) => {
        if (!merged[t.key]) {
          merged[t.key] = t.value;
        }
      });
      
      // Depois sobrescreve com tenant (a primeira ocorrência de cada chave, que é a mais recente)
      tenantTranslations?.forEach((t) => {
        merged[t.key] = t.value;
      });

        if (Object.keys(merged).length > 0) {
          this.cache[language] = this.cache[language] || {};
          this.cache[language][namespace] = merged;
          this.cacheTimestamp[cacheKey] = now;
          return merged;
        }
      } catch (error: any) {
        // Tratar erros de abort (não são críticos)
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log(`[DatabaseI18nBackend] Requisição abortada (não crítico)`);
          return {};
        }
        console.error(`[DatabaseI18nBackend] Erro ao buscar traduções:`, error);
        return {};
      }
    } else {
      try {
        // Apenas globais, ordenando por updated_at DESC para pegar a mais recente em caso de duplicatas
        const { data, error } = await query
          .is('companies_id', null)
          .order('updated_at', { ascending: false });

        // Tratar erros de abort (não são críticos)
        if (error && (error as { name?: string }).name !== 'AbortError' && !(error as { message?: string }).message?.includes('aborted')) {
          console.error(`[DatabaseI18nBackend] ❌ Erro ao buscar traduções globais:`, error);
        }

        console.log(`[DatabaseI18nBackend] Traduções globais (sem tenant):`, data?.length || 0, (error as { name?: string } | null)?.name === 'AbortError' ? 'AbortError (ignorado)' : error);

        if (data && (!error || (error as { name?: string }).name === 'AbortError')) {
          const translations: Record<string, string> = {};
          // Usar apenas a primeira ocorrência de cada chave (mais recente devido ao ORDER BY)
          data.forEach((t) => {
            if (!translations[t.key]) {
              translations[t.key] = t.value;
            }
          });

          console.log(`[DatabaseI18nBackend] ✅ ${Object.keys(translations).length} traduções carregadas para ${namespace}`);

          this.cache[language] = this.cache[language] || {};
          this.cache[language][namespace] = translations;
          this.cacheTimestamp[cacheKey] = now;
          return translations;
        }
      } catch (error: any) {
        // Tratar erros de abort (não são críticos)
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log(`[DatabaseI18nBackend] Requisição abortada (não crítico)`);
          return {};
        }
        console.error(`[DatabaseI18nBackend] Erro ao buscar traduções globais:`, error);
        return {};
      }
    }

    console.warn(`[DatabaseI18nBackend] ⚠️ Nenhuma tradução encontrada para ${namespace} (${language})`);
    return {};
  }

  /**
   * Invalida cache (útil após atualizações)
   * Se language for fornecido, invalida apenas esse idioma
   * Se não, invalida tudo (comportamento anterior)
   */
  invalidateCache(language?: string, namespace?: string) {
    if (language && namespace) {
      // Invalidar apenas um namespace específico de um idioma
      delete this.cache[language]?.[namespace];
      // Limpar timestamp apenas desse namespace
      Object.keys(this.cacheTimestamp).forEach(key => {
        if (key.includes(`:${language}:${namespace}`)) {
          delete this.cacheTimestamp[key];
        }
      });
    } else if (language) {
      // Invalidar apenas um idioma específico
      delete this.cache[language];
      // Limpar timestamps apenas desse idioma
      Object.keys(this.cacheTimestamp).forEach(key => {
        if (key.includes(`:${language}:`)) {
          delete this.cacheTimestamp[key];
        }
      });
    } else {
      // Invalidar tudo (comportamento anterior para compatibilidade)
      this.cache = {};
      this.cacheTimestamp = {};
    }
  }
}

export const databaseI18nBackend = new DatabaseI18nBackend();
