import React, { useState } from "react";
import { supabase } from "../../utils/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";

/**
 * Criptografa a senha usando SHA-256 antes de enviar ao servidor
 */
async function encryptPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const { navigate } = useNavigation();
  const { session } = useAuth();
  
  // Quando a session é criada, iniciar transição
  React.useEffect(() => {
    if (session && !isTransitioning) {
      setIsTransitioning(true);
      setShowGlow(true);
      setTimeout(() => {
        setShouldRender(false);
        navigate("cockpit");
      }, 1500);
    }
  }, [session, isTransitioning, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Fazer login no Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      // O AuthContext irá automaticamente buscar os dados do usuário via onAuthStateChange
      toast.success("Bem-vindo de volta!");
      
      // Forçar re-render e iniciar transição
      setLoading(false);
      setIsTransitioning(true);
      setShowGlow(true);
      
      // Aguardar animação antes de navegar - tempo maior para garantir visibilidade
      setTimeout(() => {
        navigate("cockpit");
      }, 1500);

      
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error("Login error:", error);
      }
      let message = "Ocorreu um erro ao fazer login.";
      
      // Tradução amigável dos erros
      if (error.message?.includes("Invalid login credentials") || error.message?.includes("credenciais inválidas") || error.message?.includes("usuário não encontrado")) {
        message = "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";
      } else if (error.message?.includes("Email not confirmed")) {
        message = "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
      } else if (error.message?.includes("Too many requests")) {
        message = "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
      } else if (error.message) {
        message = error.message;
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Validar campos obrigatórios
      if (!firstName.trim()) {
        throw new Error("O nome é obrigatório.");
      }
      if (!lastName.trim()) {
        throw new Error("O sobrenome é obrigatório.");
      }
      // ✅ Empresa agora é opcional
      if (password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      // PASSO 1: Criar usuário no Supabase Auth primeiro
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: undefined,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim()
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Falha ao criar usuário no sistema de autenticação.");
      }

      // PASSO 2: Criptografar senha e criar registro na base de dados usando a stored procedure
      const encryptedPassword = await encryptPassword(password);
      
      const { data, error } = await supabase.rpc('sp_create_user_with_company', {
        p_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim(),
        p_password: encryptedPassword,
        p_company_name: companyName.trim() || null // ✅ Passa null se vazio
      });

      if (error) {
        // Se falhar ao criar na base de dados, tentar remover o usuário do Auth
        // (opcional - pode deixar para limpeza manual)
        console.error("Erro ao criar usuário na base de dados:", error);
        throw error;
      }

      // Se tudo deu certo, fazer login automático
      if (data && data.success !== false) {
        // Fazer login para obter a sessão
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        
        if (signInError) {
          console.warn("Usuário criado mas login automático falhou:", signInError);
          toast.success("Conta criada com sucesso! Por favor, faça login.");
          // Reset form
          setFirstName("");
          setLastName("");
          setEmail("");
          setPassword("");
          setCompanyName("");
        } else {
          // O AuthContext irá automaticamente buscar os dados do usuário via onAuthStateChange
          toast.success("Conta criada com sucesso!");
          
          // Usar View Transitions API para transição suave
          if (typeof document !== 'undefined' && document.startViewTransition) {
            setIsTransitioning(true);
            setShowGlow(true);
            
            const transition = document.startViewTransition(() => {
              navigate("cockpit");
            });
            
            transition.ready.then(() => {
              // Anima o card saindo
              const card = document.querySelector('.login-card-exit') || document.querySelector('[class*="rounded-[5rem]"]');
              if (card) {
                (card as HTMLElement).animate(
                  [
                    { transform: 'scale(1)', opacity: 1 },
                    { transform: 'scale(0.95)', opacity: 0 }
                  ],
                  {
                    duration: 600,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    pseudoElement: '::view-transition-old(root)'
                  }
                );
              }
            });
          } else {
            // Fallback para navegadores sem suporte
            setIsTransitioning(true);
            setShowGlow(true);
            setTimeout(() => {
              navigate("cockpit");
            }, 800);
          }
        }
      } else {
        throw new Error(data?.message || "Falha ao criar usuário na base de dados");
      }
      
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error("Register error:", error);
      }
      let message = error.message || "Erro ao registrar.";
      
      // Tradução amigável dos erros
      if (message.includes("User already registered") || message.includes("já cadastrado") || message.includes("já existe") || message.includes("already registered")) {
          message = "Este e-mail já está cadastrado. Tente fazer login.";
      } else if (message.includes("Password should be at least") || message.includes("mínimo 6")) {
          message = "A senha deve ter no mínimo 6 caracteres.";
      } else if (message.includes("valid email") || message.includes("e-mail válido") || message.includes("Invalid email")) {
          message = "Por favor, insira um e-mail válido.";
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div 
      className={`auth-page-container flex min-h-screen w-full items-center justify-center p-4 relative overflow-hidden ${isTransitioning ? 'transitioning' : ''}`}
      style={{
        background: `
          radial-gradient(at 0% 0%, rgba(30, 58, 138, 0.4) 0%, transparent 50%),
          radial-gradient(at 100% 0%, rgba(79, 70, 229, 0.3) 0%, transparent 50%),
          radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.3) 0%, transparent 50%),
          radial-gradient(at 0% 100%, rgba(30, 58, 138, 0.4) 0%, transparent 50%),
          linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c4a6e 100%)
        `,
        pointerEvents: isTransitioning ? 'none' : 'auto',
        backgroundColor: '#0f172a'
      }}
    >
      {/* Efeito de Glow que expande */}
      {showGlow && (
        <div 
          className="sonia-glow-expand"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            width: '0',
            height: '0',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, rgba(34, 211, 238, 0.4) 50%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'glowExpand 0.8s ease-out forwards'
          }}
        />
      )}
      <div 
        className="w-full max-w-md space-y-6 relative z-10"
        style={{
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'scale(0.95) translateY(-20px)' : 'scale(1) translateY(0)',
          pointerEvents: isTransitioning ? 'none' : 'auto'
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div 
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-2xl relative"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)',
              boxShadow: '0 0 40px rgba(6, 182, 212, 0.5), 0 0 80px rgba(59, 130, 246, 0.3)'
            }}
          >
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 
            className="text-7xl font-black sonia-glow relative inline-block sonia-title" 
            style={{ 
              fontWeight: '900', 
              fontSize: '4.5rem',
              letterSpacing: '0.15em',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              color: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
              textShadow: '0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)'
            }}
          >
            <span className="relative z-10" style={{ color: '#ffffff' }}>SONIA</span>
            <span 
              className="sonia-shine"
              style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 1), rgba(6, 182, 212, 0.8), transparent)',
                animation: 'shine 3s linear infinite',
                mixBlendMode: 'screen',
                pointerEvents: 'none',
                zIndex: 1
              }}
            />
          </h1>
          <p className="text-sm text-slate-300 font-medium">
            Plataforma de Orquestração de Agentes IA
          </p>
        </div>

        {error && (
            <div 
              className="rounded-2xl p-4 backdrop-blur-xl border border-red-500/30 shadow-xl"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.2)'
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-red-300 mb-1">Erro de Autenticação</h4>
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              </div>
            </div>
        )}

        <style>{`
          /* Forçar tema escuro sempre no AuthPage - sobrescreve qualquer tema */
          .auth-page-container,
          .auth-page-container * {
            color: inherit !important;
          }
          
          .auth-page-container input[type="email"],
          .auth-page-container input[type="text"],
          .auth-page-container input[type="password"],
          .auth-page-container textarea {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important;
            border-color: rgba(6, 182, 212, 0.3) !important;
          }
          
          .auth-page-container input::placeholder,
          .auth-page-container textarea::placeholder {
            color: #94a3b8 !important;
            opacity: 1 !important;
          }
          
          .auth-page-container label {
            color: #ffffff !important;
          }
          
          /* Garantir que botões tenham texto branco */
          .auth-page-container button[type="submit"],
          .auth-page-container button[type="submit"] * {
            color: #ffffff !important;
          }
          
          .auth-page-container button {
            color: #ffffff !important;
          }
          
          /* Garantir que o texto do separador seja branco e sem fundo */
          .auth-page-container .separator-container .separator-text {
            color: #ffffff !important;
            background-color: transparent !important;
            z-index: 1 !important;
            position: relative !important;
          }
          
          .auth-page-container h1,
          .auth-page-container h2,
          .auth-page-container h3,
          .auth-page-container p,
          .auth-page-container span {
            color: inherit !important;
          }
          
          .auth-page-container .text-white {
            color: #ffffff !important;
          }
          
          .auth-page-container .text-slate-300 {
            color: #cbd5e1 !important;
          }
          
          .auth-page-container .text-slate-400 {
            color: #94a3b8 !important;
          }
          
          @keyframes shine {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
          
          @keyframes glowExpand {
            0% {
              width: 0;
              height: 0;
              opacity: 1;
            }
            50% {
              opacity: 0.8;
            }
            100% {
              width: 200vw;
              height: 200vh;
              opacity: 0;
            }
          }
          
          /* View Transitions API - Estilos para transição */
          ::view-transition-old(root),
          ::view-transition-new(root) {
            animation-duration: 0.8s;
            animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          ::view-transition-old(root) {
            z-index: 1;
          }
          
          ::view-transition-new(root) {
            z-index: 9999;
            animation-name: slideInFromBottom;
          }
          
          @keyframes slideInFromBottom {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          .auth-exit {
            opacity: 0 !important;
            transform: scale(0.95) translateY(-20px) !important;
            pointer-events: none;
          }
          
          .sonia-title {
            position: relative;
            overflow: hidden;
          }
          
          .sonia-title span {
            color: #ffffff !important;
          }
          
          .sonia-shine {
            animation: shine 3s linear infinite !important;
            -webkit-animation: shine 3s linear infinite !important;
          }
          
          .sonia-glow {
            text-shadow: 0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2) !important;
          }
          
          .sonia-glow span {
            color: #ffffff !important;
          }
          
          .auth-page-container .sonia-title,
          .auth-page-container .sonia-title span,
          .auth-page-container .sonia-glow,
          .auth-page-container .sonia-glow span {
            color: #ffffff !important;
          }
          
          h1.sonia-title,
          h1.sonia-title span {
            color: #ffffff !important;
          }
          
          .login-card-exit {
            transition: transform 0.6s ease-out, opacity 0.6s ease-out;
          }
          
          [data-state="active"][data-slot="tabs-trigger"] {
            background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4) !important;
          }
          
          /* Ajustar tamanho do TabsList para ficar proporcional aos botões */
          .auth-page-container [data-slot="tabs-list"] {
            height: auto !important;
            min-height: auto !important;
            padding: 0.25rem !important;
          }
          
          .auth-page-container [data-slot="tabs-trigger"] {
            height: auto !important;
            min-height: auto !important;
            padding: 0.5rem 1rem !important;
          }
        `}</style>
        <Tabs defaultValue="login" className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-2 rounded-full backdrop-blur-sm border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)', marginBottom: '1.5rem', padding: '0.25rem', height: 'auto', minHeight: 'auto' }}>
            <TabsTrigger 
              value="login"
              className="rounded-full font-semibold transition-all"
              style={{
                transition: 'all 0.3s ease',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '0.5rem 1rem',
                height: 'auto',
                minHeight: 'auto'
              }}
            >
              Login
            </TabsTrigger>
            <TabsTrigger 
              value="register"
              className="rounded-full font-semibold transition-all"
              style={{
                transition: 'all 0.3s ease',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '0.5rem 1rem',
                height: 'auto',
                minHeight: 'auto'
              }}
            >
              Cadastro
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <div 
              className={`rounded-[5rem] p-8 backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-500 ${isTransitioning ? 'login-card-exit' : ''}`}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                borderRadius: '5rem'
              }}
            >
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-white mb-2">Acessar Plataforma</h2>
                  <p className="text-sm text-slate-300">
                    Entre com seu e-mail corporativo para continuar.
                  </p>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold flex items-center gap-2" style={{ color: '#ffffff !important' }}>
                      <Mail className="h-5 w-5" style={{ color: '#94a3b8 !important' }} />
                      E-mail
                    </Label>
                    <div className="relative">
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="nome@empresa.com" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 border-cyan-500/30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.1) !important',
                          borderColor: 'rgba(6, 182, 212, 0.3) !important',
                          borderRadius: '1.5rem',
                          color: '#ffffff !important'
                        }}
                        placeholderStyle={{ color: '#94a3b8 !important' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mt-6">
                    <Label htmlFor="password" className="text-white font-semibold flex items-center gap-2">
                      <Lock className="h-5 w-5 text-slate-400" />
                      Senha
                    </Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"}
                        placeholder="******"
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-12 h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-16 text-base font-bold shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl mt-8" 
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                      boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
                      borderRadius: '1.5rem',
                      height: '4.5rem',
                      marginTop: '2.5rem',
                      color: '#ffffff !important'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 15px 40px rgba(59, 130, 246, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.4)';
                    }}
                  >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Entrar
                  </Button>
                </form>
                
                <div className="relative my-6 separator-container flex items-center">
                  <div className="flex-1 border-t" style={{ borderColor: 'rgba(6, 182, 212, 0.4)' }}></div>
                  <span className="px-3 separator-text text-xs uppercase" style={{ color: '#ffffff', position: 'relative', zIndex: 1 }}>Ou continue com</span>
                  <div className="flex-1 border-t" style={{ borderColor: 'rgba(6, 182, 212, 0.4)' }}></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 bg-white/10 border-white/20 text-white backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                    onClick={() => toast.info("Login com Google em breve")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <div className="absolute inset-0 bg-white/10 hover:bg-white/5 transition-colors duration-300" />
                    <div className="relative z-10 flex items-center">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Google</span>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 bg-white/10 border-white/20 text-white backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                    onClick={() => toast.info("Login com Microsoft em breve")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <div className="absolute inset-0 bg-white/10 hover:bg-white/5 transition-colors duration-300" />
                    <div className="relative z-10 flex items-center">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 23 23" fill="none">
                        <path fill="#F25022" d="M0 0h11v11H0z"/>
                        <path fill="#00A4EF" d="M12 0h11v11H12z"/>
                        <path fill="#7FBA00" d="M0 12h11v11H0z"/>
                        <path fill="#FFB900" d="M12 12h11v11H12z"/>
                      </svg>
                      <span>Microsoft</span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="register">
            <div 
              className={`rounded-[5rem] p-8 backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-500 ${isTransitioning ? 'login-card-exit' : ''}`}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                borderRadius: '5rem'
              }}
            >
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-white mb-2">Nova Conta</h2>
                  <p className="text-sm text-slate-300">
                    Crie sua conta Enterprise para começar.
                  </p>
                </div>
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstname" className="text-white font-semibold">Nome</Label>
                      <Input 
                        id="register-firstname" 
                        type="text" 
                        placeholder="João" 
                        required 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-lastname" className="text-white font-semibold">Sobrenome</Label>
                      <Input 
                        id="register-lastname" 
                        type="text" 
                        placeholder="Silva" 
                        required 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2" style={{ marginTop: '1.5rem' }}>
                    <Label htmlFor="register-email" className="text-white font-semibold flex items-center gap-2">
                      <Mail className="h-5 w-5 text-slate-400" />
                      E-mail
                    </Label>
                    <div className="relative">
                      <Input 
                        id="register-email" 
                        type="email" 
                        placeholder="nome@empresa.com" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2" style={{ marginTop: '1.5rem' }}>
                    <Label htmlFor="register-company" className="text-white font-semibold">Nome da Empresa (Opcional)</Label>
                    <Input 
                      id="register-company" 
                      type="text" 
                      placeholder="Minha Empresa LTDA (opcional)" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                      style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#22d3ee';
                        e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="space-y-2 mt-6">
                    <Label htmlFor="register-password" className="text-white font-semibold flex items-center gap-2">
                      <Lock className="h-5 w-5 text-slate-400" />
                      Senha
                    </Label>
                    <div className="relative">
                      <Input 
                        id="register-password" 
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="******"
                        required 
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-12 h-14 bg-white/10 border-cyan-500/30 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all rounded-2xl"
                        style={{ borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '1.5rem' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-16 text-base font-bold shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl mt-8" 
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                      boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
                      borderRadius: '1.5rem',
                      height: '4.5rem',
                      marginTop: '2.5rem',
                      color: '#ffffff !important'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 15px 40px rgba(59, 130, 246, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.4)';
                    }}
                  >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Criar Conta
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <p className="px-8 text-center text-xs text-slate-300">
          Ao continuar, você concorda com nossos{" "}
          <a 
            href="#" 
            className="underline underline-offset-4 hover:text-cyan-400 transition-colors text-cyan-300 font-medium"
            onClick={(e) => {
              e.preventDefault();
              toast.info("Termos de Serviço em breve");
            }}
          >
            Termos de Serviço
          </a>{" "}
          e{" "}
          <a 
            href="#" 
            className="underline underline-offset-4 hover:text-cyan-400 transition-colors text-cyan-300 font-medium"
            onClick={(e) => {
              e.preventDefault();
              toast.info("Política de Privacidade em breve");
            }}
          >
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
