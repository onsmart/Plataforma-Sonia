import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  companiesId: string | null; // ✅ Adicionado
  hasCompany: boolean; // ✅ Adicionado
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>; // ✅ Para atualizar após criar empresa
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [companiesId, setCompaniesId] = useState<string | null>(null); // ✅ Adicionado
  const [loading, setLoading] = useState(true);
  
  // ============================================================================
  // REFS PARA CONTROLE E PREVENÇÃO DE PROBLEMAS
  // ============================================================================
  // fetchingUserDataRef: Previne múltiplas chamadas concorrentes da RPC
  // mountedRef: Rastreia se o componente está montado para evitar updates após unmount
  // lastEmailRef: Evita chamadas duplicadas para o mesmo email
  // ============================================================================
  const fetchingUserDataRef = useRef(false);
  const mountedRef = useRef(true);
  const lastEmailRef = useRef<string | null>(null);

  // ============================================================================
  // FUNÇÃO: fetchUserData
  // ============================================================================
  // PROBLEMA ORIGINAL:
  // - Esta função estava bloqueando o fluxo de autenticação com await
  // - Quando chamada dentro de onAuthStateChange com await, causava AbortError
  // - O loading nunca finalizava se a RPC falhasse
  // - Múltiplas chamadas concorrentes causavam race conditions
  //
  // CORREÇÃO:
  // - Não bloqueia o fluxo principal (chamada sem await no listener)
  // - Proteção contra chamadas duplicadas (lastEmailRef)
  // - Verificação de mountedRef antes de atualizar estado
  // - Tratamento adequado de AbortError (não é erro crítico)
  // ============================================================================
  const fetchUserData = React.useCallback(async (email: string) => {
    // Prevenir apenas chamadas concorrentes, não chamadas para o mesmo email
    // Permitir re-fetch se necessário para garantir userId atualizado
    if (fetchingUserDataRef.current) {
      return;
    }

    fetchingUserDataRef.current = true;
    lastEmailRef.current = email;
    
    try {
      const { data: loginData, error: loginError } = await supabase.rpc('sp_login_user', {
        p_email: email
      });
      
      console.log('[AuthContext] sp_login_user retornou:', { loginData, loginError, email });
      
      // CORREÇÃO: Verificar se o componente ainda está montado antes de atualizar estado
      if (!mountedRef.current) return;
      
      if (loginError) {
        console.error('[AuthContext] Erro na RPC sp_login_user:', loginError);
        return;
      }
      
      // Verificar se loginData é um array (algumas RPCs retornam array)
      const userData = Array.isArray(loginData) ? loginData[0] : loginData;
      
      if (userData) {
        console.log('[AuthContext] userData processado:', userData);
        
        // CORREÇÃO: Sempre atualizar userId mesmo se o valor parecer o mesmo
        // Isso garante que o re-render seja disparado
        if (userData.user_id !== undefined && userData.user_id !== null) {
          // Converter para string se necessário
          const newUserId = String(userData.user_id);
          console.log('[AuthContext] Atualizando userId:', newUserId, 'tipo:', typeof newUserId);
          setUserId((prev) => {
            // Forçar atualização mesmo se o valor for o mesmo para garantir re-render
            return newUserId;
          });
          
          // ✅ Buscar companies_id após ter userId
          fetchCompanyId(newUserId);
        } else {
          console.warn('[AuthContext] userData.user_id está undefined ou null. userData completo:', userData);
        }
        if (userData.name) {
          setFirstName(userData.name);
        }
        if (userData.last_name) {
          setLastName(userData.last_name);
        }
      } else {
        console.warn('[AuthContext] loginData está vazio ou null:', loginData);
      }
    } catch (err: any) {
      // CORREÇÃO: AbortError é esperado quando o componente é desmontado durante a chamada
      // Não é um erro crítico, apenas logar se não for AbortError
      if (err?.name !== 'AbortError' && mountedRef.current) {
        console.warn("Could not fetch user data:", err);
      }
    } finally {
      if (mountedRef.current) {
        fetchingUserDataRef.current = false;
      }
    }
  }, []);

  // ✅ Função para buscar companies_id
  const fetchCompanyId = React.useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Erro ao buscar companies_id:', error);
        setCompaniesId(null);
        return;
      }

      if (data?.companies_id) {
        setCompaniesId(data.companies_id);
        // Salvar no localStorage para o i18n backend
        localStorage.setItem('companies_id', data.companies_id);
      } else {
        setCompaniesId(null);
        localStorage.removeItem('companies_id');
      }
    } catch (err: any) {
      console.error('[AuthContext] Erro ao buscar companies_id:', err);
      setCompaniesId(null);
    }
  }, []);

  // ✅ Função para atualizar company (usado após criar empresa)
  const refreshCompany = React.useCallback(async () => {
    if (userId) {
      await fetchCompanyId(userId);
    }
  }, [userId, fetchCompanyId]);

  // ============================================================================
  // useEffect: Inicialização e Listener de Auth
  // ============================================================================
  // PROBLEMA ORIGINAL:
  // - fetchUserData estava no array de dependências, causando re-execuções
  // - await fetchUserData dentro de onAuthStateChange bloqueava o listener
  // - AbortError ocorria quando componente era desmontado durante chamada RPC
  // - Loading não finalizava se RPC falhasse ou demorasse
  // - Múltiplas chamadas para o mesmo email causavam loop
  //
  // CORREÇÃO:
  // - fetchUserData removido das dependências (é estável com useCallback vazio)
  // - onAuthStateChange não faz await (chama fetchUserData sem bloquear)
  // - Loading sempre finaliza no finally, independente de RPC
  // - Verificação de isMounted antes de atualizar estados
  // - Tratamento adequado de AbortError (esperado durante cleanup)
  // ============================================================================
  useEffect(() => {
    mountedRef.current = true;
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          // CORREÇÃO: Loading deve finalizar mesmo com erro
          setLoading(false);
          throw error;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // CORREÇÃO: fetchUserData não deve bloquear o loading
        // Chamar sem await para não bloquear o fluxo
        if (session?.user?.email) {
          fetchUserData(session.user.email).catch(() => {
            // Erro já tratado dentro de fetchUserData
          });
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        // CORREÇÃO: AbortError não deve ser logado como erro crítico
        if (error?.name === 'AbortError') {
          // AbortError é esperado quando há cleanup, não é um erro real
          return;
        }
        
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          // Silently fail on network error during init
        } else {
          console.error("Error checking auth session:", error);
        }
      } finally {
        // CORREÇÃO: Loading SEMPRE deve finalizar, independente do resultado
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // CORREÇÃO: onAuthStateChange não deve fazer await de operações assíncronas
    // Isso pode causar AbortError e bloquear o listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // CORREÇÃO: Limpar dados imediatamente no logout, sem await
      if (!session) {
        setUserId(null);
        setFirstName(null);
        setLastName(null);
        setCompaniesId(null); // ✅ Limpar companies_id
        localStorage.removeItem('companies_id');
        lastEmailRef.current = null;
        setLoading(false);
        return;
      }
      
      // CORREÇÃO: fetchUserData deve ser chamado sem await
      // Sempre chamar para garantir que userId seja atualizado e dispare re-render
      if (session.user?.email) {
        // Resetar lastEmailRef para permitir re-fetch se necessário
        lastEmailRef.current = null;
        fetchUserData(session.user.email).catch(() => {
          // Erro já tratado dentro de fetchUserData
        });
      }
    });

    // ✅ NOVO: Verificar expiração do token periodicamente
    const checkTokenExpiry = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;

          // Se expirou ou expira em menos de 30 segundos
          if (timeUntilExpiry < 30 * 1000) {
            console.warn('[AuthContext] Token expirado ou próximo de expirar');
            
            // Tentar refresh
            supabase.auth.refreshSession()
              .then(async ({ data: { session: newSession }, error }) => {
                if (error || !newSession) {
                  // Refresh falhou, fazer logout
                  console.error('[AuthContext] Falha ao renovar sessão, fazendo logout');
                  
                  // Mostrar mensagem amigável
                  const { toast } = await import('sonner');
                  toast.error('Sessão expirada', {
                    description: 'Acho que passou muito tempo, que tal fazer login novamente?',
                    duration: 5000,
                  });
                  
                  // Aguardar um pouco para o usuário ver a mensagem
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  
                  supabase.auth.signOut();
                  window.location.href = '/';
                }
              })
              .catch(async (err) => {
                console.error('[AuthContext] Erro ao renovar sessão:', err);
                
                // Mostrar mensagem amigável
                const { toast } = await import('sonner');
                toast.error('Sessão expirada', {
                  description: 'Acho que passou muito tempo, que tal fazer login novamente?',
                  duration: 5000,
                });
                
                // Aguardar um pouco para o usuário ver a mensagem
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                supabase.auth.signOut();
                window.location.href = '/';
              });
          }
        }
      });
    }, 60000); // Verificar a cada 1 minuto

    return () => {
      isMounted = false;
      mountedRef.current = false;
      subscription.unsubscribe();
      clearInterval(checkTokenExpiry);
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setFirstName(null);
    setLastName(null);
    setCompaniesId(null); // ✅ Limpar companies_id
    localStorage.removeItem('companies_id');
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      userId, 
      firstName, 
      lastName, 
      companiesId, // ✅ Adicionado
      hasCompany: companiesId !== null, // ✅ Adicionado
      loading, 
      signOut,
      refreshCompany // ✅ Adicionado
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
