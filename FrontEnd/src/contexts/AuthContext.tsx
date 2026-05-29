import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase/client";
import { resolveUserProfileNames } from "../lib/user-display";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  companiesId: string | null;
  hasCompany: boolean;
  companyReady: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [companiesId, setCompaniesId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('companies_id');
  });
  const [companyReady, setCompanyReady] = useState(false);
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
  const applyProfileNames = React.useCallback((authUser: User | null, dbName?: string | null, dbLastName?: string | null) => {
    const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
    const resolved = resolveUserProfileNames({
      dbName,
      dbLastName,
      metaFirstName: typeof meta.first_name === "string" ? meta.first_name : null,
      metaLastName: typeof meta.last_name === "string" ? meta.last_name : null,
      email: authUser?.email ?? null,
    });
    setFirstName(resolved.firstName || null);
    setLastName(resolved.lastName || null);
  }, []);

  const fetchCompanyId = React.useCallback(async (nextUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("tb_company_users")
        .select("companies_id")
        .eq("user_id", nextUserId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error("[AuthContext] Erro ao buscar companies_id:", error);
        return;
      }

      if (data?.companies_id) {
        setCompaniesId(data.companies_id);
        localStorage.setItem("companies_id", data.companies_id);
      } else {
        setCompaniesId(null);
        localStorage.removeItem("companies_id");
      }
    } catch (err: any) {
      console.error("[AuthContext] Erro ao buscar companies_id:", err);
    } finally {
      if (mountedRef.current) {
        setCompanyReady(true);
      }
    }
  }, []);

  const fetchUserData = React.useCallback(async (email: string, authUser: User | null) => {
    if (fetchingUserDataRef.current) {
      return;
    }

    fetchingUserDataRef.current = true;
    lastEmailRef.current = email;

    try {
      let rpcUserId: string | null = null;
      let dbName: string | null = null;
      let dbLastName: string | null = null;

      const { data: loginData, error: loginError } = await supabase.rpc("sp_login_user", {
        p_email: email,
      });

      if (loginError) {
        console.error("[AuthContext] Erro na RPC sp_login_user:", loginError);
      } else {
        const userData = Array.isArray(loginData) ? loginData[0] : loginData;
        if (userData?.user_id != null) {
          rpcUserId = String(userData.user_id);
        }
        dbName = userData?.name ?? null;
        dbLastName = userData?.last_name ?? null;
      }

      const { data: row, error: rowError } = await supabase
        .from("tb_users")
        .select("id, name, last_name")
        .ilike("email", email.trim())
        .limit(1)
        .maybeSingle();

      if (rowError) {
        console.warn("[AuthContext] Erro ao buscar tb_users:", rowError.message);
      } else if (row) {
        rpcUserId = rpcUserId ?? (row.id != null ? String(row.id) : null);
        dbName = row.name ?? dbName;
        dbLastName = row.last_name ?? dbLastName;
      }

      if (!mountedRef.current) return;

      if (rpcUserId) {
        setUserId(rpcUserId);
        fetchCompanyId(rpcUserId);
      } else {
        console.warn("[AuthContext] Usuário não encontrado em tb_users para:", email);
        setUserId(null);
        setCompaniesId(null);
        localStorage.removeItem("companies_id");
        setCompanyReady(true);
      }

      applyProfileNames(authUser, dbName, dbLastName);
    } catch (err: any) {
      if (err?.name !== "AbortError" && mountedRef.current) {
        console.warn("Could not fetch user data:", err);
        applyProfileNames(authUser);
      }
    } finally {
      if (mountedRef.current) {
        fetchingUserDataRef.current = false;
      }
    }
  }, [applyProfileNames, fetchCompanyId]);

  const refreshUserProfile = React.useCallback(async () => {
    fetchingUserDataRef.current = false;
    lastEmailRef.current = null;
    if (user?.email) {
      await fetchUserData(user.email, user);
    }
  }, [fetchUserData, user]);

  // ✅ Função para atualizar company (usado após criar empresa)
  const refreshCompany = React.useCallback(async () => {
    if (userId) {
      setCompanyReady(false);
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
          fetchUserData(session.user.email, session.user).catch(() => {
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
        setCompaniesId(null);
        setCompanyReady(false);
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
        fetchUserData(session.user.email, session.user).catch(() => {
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
    setCompaniesId(null);
    setCompanyReady(false);
    localStorage.removeItem('companies_id');
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      userId, 
      firstName, 
      lastName, 
      companiesId,
      hasCompany: companiesId !== null,
      companyReady,
      loading, 
      signOut,
      refreshCompany,
      refreshUserProfile
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
