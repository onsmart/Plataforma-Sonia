import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userId: number | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setUserId: (userId: number | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Se houver sessão, buscar o user_id do banco de dados
        if (session?.user?.email) {
          try {
            const { data: loginData, error: loginError } = await supabase.rpc('sp_login_user', {
              p_email: session.user.email
            });
            
            if (!loginError && loginData?.user_id) {
              setUserId(loginData.user_id);
            }
          } catch (err) {
            // Silently fail - user_id será obtido no próximo login
            console.warn("Could not fetch user_id on init:", err);
          }
        }
      } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            // Silently fail on network error during init
        } else {
            console.error("Error checking auth session:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Se o usuário fez logout, limpar o user_id
      if (!session) {
        setUserId(null);
      } else if (session.user?.email) {
        // Se houver sessão, buscar o user_id
        try {
          const { data: loginData, error: loginError } = await supabase.rpc('sp_login_user', {
            p_email: session.user.email
          });
          
          if (!loginError && loginData?.user_id) {
            setUserId(loginData.user_id);
          }
        } catch (err) {
          console.warn("Could not fetch user_id on auth change:", err);
        }
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, userId, loading, signOut, setUserId }}>
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
