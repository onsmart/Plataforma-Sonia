import React, { useState } from "react";
import { supabase } from "../../utils/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Building2
} from "lucide-react";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";

async function encryptPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

const inputClass =
  "h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-sm text-white placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 focus-visible:border-blue-300/60 focus-visible:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-blue-300/15";

const socialButtonClass =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] text-slate-100 shadow-none transition-all duration-200 hover:border-white/16 hover:bg-white/[0.07]";

export function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (authError) {
        throw authError;
      }

      toast.success("Bem-vindo de volta!");
      setLoading(false);
      setIsTransitioning(true);
      setShowGlow(true);

      setTimeout(() => {
        navigate("cockpit");
      }, 1500);
    } catch (error: any) {
      if (error.name !== "TypeError" && error.message !== "Failed to fetch") {
        console.error("Login error:", error);
      }

      let message = "Ocorreu um erro ao fazer login.";

      if (
        error.message?.includes("Invalid login credentials") ||
        error.message?.includes("credenciais inv")
      ) {
        message = "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";
      } else if (
        error.message?.includes("Email not confirmed") ||
        error.message?.includes("email not confirmed")
      ) {
        message =
          "Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada e o spam.";
      } else if (
        error.message?.includes("Email address not authorized") ||
        error.message?.includes("not authorized")
      ) {
        message =
          "O Supabase não enviou o e-mail: configure SMTP customizado no painel (Resend) ou use um e-mail da equipe do projeto.";
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
      if (!firstName.trim()) {
        throw new Error("O nome e obrigatorio.");
      }
      if (!lastName.trim()) {
        throw new Error("O sobrenome e obrigatorio.");
      }
      if (registerPassword.length < 6) {
        throw new Error("A senha deve ter no minimo 6 caracteres.");
      }

      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        options: {
          emailRedirectTo,
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
        throw new Error("Falha ao criar usuario no sistema de autenticacao.");
      }

      const encryptedPassword = await encryptPassword(registerPassword);

      const { data, error } = await supabase.rpc("sp_create_user_with_company", {
        p_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: registerEmail.trim(),
        p_password: encryptedPassword,
        p_company_name: companyName.trim() || null
      });

      if (error) {
        console.error("Erro ao criar usuario na base de dados:", error);
        throw error;
      }

      if (data && data.success !== false) {
        if (!authData.session) {
          toast.success(
            "Conta criada! Enviamos um e-mail de confirmação. Abra o link na mensagem e depois faça login."
          );
          setFirstName("");
          setLastName("");
          setRegisterEmail("");
          setRegisterPassword("");
          setCompanyName("");
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: registerEmail.trim(),
          password: registerPassword
        });

        if (signInError) {
          console.warn("Usuario criado mas login automatico falhou:", signInError);
          toast.success("Conta criada com sucesso! Por favor, faca login.");
          setFirstName("");
          setLastName("");
          setRegisterEmail("");
          setRegisterPassword("");
          setCompanyName("");
        } else {
          toast.success("Conta criada com sucesso!");

          if (typeof document !== "undefined" && document.startViewTransition) {
            setIsTransitioning(true);
            setShowGlow(true);

            const transition = document.startViewTransition(() => {
              navigate("cockpit");
            });

            transition.ready.then(() => {
              const card = document.querySelector(".auth-main-card");
              if (card) {
                (card as HTMLElement).animate(
                  [
                    { transform: "scale(1)", opacity: 1 },
                    { transform: "scale(0.97)", opacity: 0 }
                  ],
                  {
                    duration: 600,
                    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                    pseudoElement: "::view-transition-old(root)"
                  }
                );
              }
            });
          } else {
            setIsTransitioning(true);
            setShowGlow(true);
            setTimeout(() => {
              navigate("cockpit");
            }, 800);
          }
        }
      } else {
        throw new Error(data?.message || "Falha ao criar usuario na base de dados");
      }
    } catch (error: any) {
      if (error.name !== "TypeError" && error.message !== "Failed to fetch") {
        console.error("Register error:", error);
      }

      let message = error.message || "Erro ao registrar.";

      if (
        message.includes("User already registered") ||
        message.includes("ja cadastrado") ||
        message.includes("ja existe") ||
        message.includes("already registered")
      ) {
        message = "Este e-mail ja esta cadastrado. Tente fazer login.";
      } else if (message.includes("Password should be at least") || message.includes("minimo 6")) {
        message = "A senha deve ter no minimo 6 caracteres.";
      } else if (
        message.includes("valid email") ||
        message.includes("e-mail valido") ||
        message.includes("Invalid email")
      ) {
        message = "Por favor, insira um e-mail valido.";
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
      className={`auth-page-container relative min-h-[100dvh] overflow-hidden bg-[#081120] text-white ${
        isTransitioning ? "pointer-events-none" : ""
      }`}
    >
      <style>{`
        .auth-page-container {
          background:
            radial-gradient(circle at 18% 20%, rgba(37, 99, 235, 0.16), transparent 24%),
            radial-gradient(circle at 82% 18%, rgba(14, 165, 233, 0.1), transparent 20%),
            radial-gradient(circle at 82% 78%, rgba(8, 145, 178, 0.14), transparent 24%),
            linear-gradient(140deg, #07101b 0%, #0d1830 54%, #0a2b42 100%);
        }

        .auth-grid-fade {
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at center, black 38%, transparent 78%);
          opacity: 0.22;
        }

        .auth-orb {
          animation: authFloat 14s ease-in-out infinite;
        }

        .auth-orb-delay {
          animation-delay: -5s;
        }

        .auth-glow-expand {
          animation: glowExpand 0.8s ease-out forwards;
        }

        @keyframes authFloat {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -12px, 0) scale(1.02);
          }
        }

        @keyframes glowExpand {
          0% {
            width: 0;
            height: 0;
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            width: 200vw;
            height: 200vh;
            opacity: 0;
          }
        }

        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: 0.8s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <div className="auth-grid-fade absolute inset-0" aria-hidden />
      <div className="auth-orb absolute -left-16 top-12 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" aria-hidden />
      <div className="auth-orb auth-orb-delay absolute bottom-[-3rem] right-[8%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden />

      {showGlow && (
        <div
          className="auth-glow-expand pointer-events-none fixed left-1/2 top-1/2 z-[60] h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(14,165,233,0.25) 42%, transparent 72%)"
          }}
        />
      )}

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl items-center justify-center px-4 py-1.5 sm:px-6 sm:py-2"
        style={{
          transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "scale(0.985) translateY(-12px)" : "scale(1) translateY(0)"
        }}
      >
        <section className="w-full max-w-[432px]">
          <div className="auth-main-card relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,17,31,0.92),rgba(15,28,48,0.9))] p-3 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.82)] backdrop-blur-xl sm:p-3.5">
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" aria-hidden />

            <div className="relative space-y-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                  Plataforma SONIA
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(135deg,#38bdf8,#2563eb)] shadow-[0_12px_28px_-18px_rgba(37,99,235,0.8)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Orquestracao inteligente
                  </p>
                  <h1 className="text-[1.8rem] font-black tracking-[0.2em] text-white sm:text-[2rem]">
                    SONIA
                  </h1>
                  <p className="mx-auto max-w-[22rem] text-[13px] leading-5 text-slate-300">
                    Entre com seu e-mail corporativo para continuar na plataforma.
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-[1.05rem] border border-red-400/20 bg-red-500/10 p-3 text-red-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-300" />
                    <div>
                      <p className="text-sm font-semibold text-red-100">Erro de autenticacao</p>
                      <p className="mt-0.5 text-sm leading-5 text-red-100/90">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid h-10 w-full grid-cols-2 items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] p-0.5">
                  <TabsTrigger
                    value="login"
                    className="min-w-0 rounded-[10px] px-3 text-sm font-semibold leading-none data-[state=active]:bg-[linear-gradient(135deg,#38bdf8,#2563eb)] data-[state=active]:text-white data-[state=active]:shadow-[0_8px_20px_-14px_rgba(37,99,235,0.9)]"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="min-w-0 rounded-[10px] px-3 text-sm font-semibold leading-none data-[state=active]:bg-[linear-gradient(135deg,#38bdf8,#2563eb)] data-[state=active]:text-white data-[state=active]:shadow-[0_8px_20px_-14px_rgba(37,99,235,0.9)]"
                  >
                    Cadastro
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-2.5">
                  <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-3.5">
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/85">
                        Login seguro
                      </p>
                      <h4 className="mt-1 text-[1.05rem] font-semibold text-white">Acesse sua conta</h4>
                      <p className="mt-0.5 text-sm leading-5 text-slate-300">
                        Use suas credenciais para entrar.
                      </p>
                    </div>

                    <form onSubmit={handleLogin} autoComplete="off" className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium text-slate-100">
                          <Mail className="h-4 w-4 text-blue-300" />
                          E-mail
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="nome@empresa.com"
                          required
                          name="login_email"
                          autoComplete="off"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-sm font-medium text-slate-100">
                          <Lock className="h-4 w-4 text-blue-300" />
                          Senha
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite sua senha"
                            required
                            name="login_password"
                            autoComplete="new-password"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className={`${inputClass} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="h-10 w-full rounded-xl bg-[linear-gradient(135deg,#38bdf8,#2563eb)] text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.9)] transition-all duration-200 hover:brightness-110"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-4.5 w-4.5" />
                        )}
                        Entrar
                      </Button>
                    </form>

                    <div className="my-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/5" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
                        ou continue com
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/5 via-white/15 to-transparent" />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={socialButtonClass}
                        onClick={() => toast.info("Login com Google em breve")}
                      >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={socialButtonClass}
                        onClick={() => toast.info("Login com Microsoft em breve")}
                      >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23" fill="none">
                          <path fill="#F25022" d="M0 0h11v11H0z" />
                          <path fill="#00A4EF" d="M12 0h11v11H12z" />
                          <path fill="#7FBA00" d="M0 12h11v11H0z" />
                          <path fill="#FFB900" d="M12 12h11v11H12z" />
                        </svg>
                        Microsoft
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="register" className="mt-2.5">
                  <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-3.5">
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/85">
                        Nova conta
                      </p>
                      <h4 className="mt-1 text-[1.05rem] font-semibold text-white">Criar acesso</h4>
                      <p className="mt-0.5 text-sm leading-5 text-slate-300">
                        Cadastre seus dados para entrar na plataforma.
                      </p>
                    </div>

                    <form onSubmit={handleRegister} autoComplete="off" className="space-y-3">
                      <div className="grid gap-2.5 min-[420px]:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="register-firstname" className="text-sm font-medium text-slate-100">
                            Nome
                          </Label>
                          <Input
                            id="register-firstname"
                            type="text"
                            placeholder="Joao"
                            required
                            name="register_first_name"
                            autoComplete="off"
                            autoCapitalize="words"
                            autoCorrect="off"
                            spellCheck={false}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="register-lastname" className="text-sm font-medium text-slate-100">
                            Sobrenome
                          </Label>
                          <Input
                            id="register-lastname"
                            type="text"
                            placeholder="Silva"
                            required
                            name="register_last_name"
                            autoComplete="off"
                            autoCapitalize="words"
                            autoCorrect="off"
                            spellCheck={false}
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2.5 min-[420px]:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="register-email" className="text-sm font-medium text-slate-100">
                            <Mail className="h-4 w-4 text-blue-300" />
                            E-mail
                          </Label>
                          <Input
                            id="register-email"
                            type="email"
                            placeholder="nome@empresa.com"
                            required
                            name="register_email"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={registerEmail}
                            onChange={(e) => setRegisterEmail(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="register-company" className="text-sm font-medium text-slate-100">
                            <Building2 className="h-4 w-4 text-blue-300" />
                            Empresa
                          </Label>
                          <Input
                            id="register-company"
                            type="text"
                            placeholder="Empresa (opcional)"
                            name="register_company"
                            autoComplete="off"
                            autoCapitalize="words"
                            autoCorrect="off"
                            spellCheck={false}
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="register-password" className="text-sm font-medium text-slate-100">
                          <Lock className="h-4 w-4 text-blue-300" />
                          Senha
                        </Label>
                        <div className="relative">
                          <Input
                            id="register-password"
                            type={showRegisterPassword ? "text" : "password"}
                            placeholder="Minimo de 6 caracteres"
                            required
                            minLength={6}
                            name="register_password"
                            autoComplete="new-password"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={registerPassword}
                            onChange={(e) => setRegisterPassword(e.target.value)}
                            className={`${inputClass} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                            aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showRegisterPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="h-10 w-full rounded-xl bg-[linear-gradient(135deg,#38bdf8,#2563eb)] text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.9)] transition-all duration-200 hover:brightness-110"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4.5 w-4.5" />
                        )}
                        Criar conta
                      </Button>
                    </form>
                  </div>
                </TabsContent>
              </Tabs>

              <p className="px-1 pt-0.5 text-center text-[10px] leading-4 text-slate-400">
                Ao continuar, voce concorda com nossos{" "}
                <a
                  href="#"
                  className="font-medium text-slate-200 underline underline-offset-4 transition-colors hover:text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Termos de Servico em breve");
                  }}
                >
                  Termos de Servico
                </a>{" "}
                e{" "}
                <a
                  href="#"
                  className="font-medium text-slate-200 underline underline-offset-4 transition-colors hover:text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Politica de Privacidade em breve");
                  }}
                >
                  Politica de Privacidade
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
