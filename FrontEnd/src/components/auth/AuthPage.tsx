import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  Building2,
  User,
  MessageSquare,
  Bot,
  GitBranch,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  ACCOUNT_TYPE_OPTIONS,
  type AccountType,
  validateDocument,
  digitsOnly,
  formatDocument,
} from "../../lib/account-types";
import LineWaves from "./LineWaves";
import { AUTH_LINE_WAVES_PROPS } from "./auth-theme";
import "./WelcomeSplash.css";

async function encryptPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const inputClass =
  "h-9 rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 text-sm text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-zinc-500 transition-all duration-200 focus-visible:border-blue-500/50 focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-blue-500/15";

const primaryButtonClass =
  "h-9 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-blue-900/25 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-900/35 disabled:opacity-60";

const socialButtonClass =
  "h-9 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 text-sm text-zinc-200 shadow-none transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80";

const formPanelClass =
  "rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-3.5";

const tabTriggerClass =
  "min-w-0 rounded-md px-2.5 py-1.5 text-xs font-semibold leading-none text-zinc-400 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-900/30";

const formFieldClass = "space-y-1.5";
const formStackClass = "space-y-3";

const BRAND_FEATURE_KEYS = [
  { icon: MessageSquare, titleKey: "brand.feature.omnichannel.title", descKey: "brand.feature.omnichannel.desc" },
  { icon: Bot, titleKey: "brand.feature.agents.title", descKey: "brand.feature.agents.desc" },
  { icon: GitBranch, titleKey: "brand.feature.orchestration.title", descKey: "brand.feature.orchestration.desc" },
] as const;

function mapDocumentError(message: string | null, t: (key: string) => string): string | null {
  if (!message) return null;
  const map: Record<string, string> = {
    "CPF é obrigatório": t("errors.cpfRequired"),
    "CNPJ é obrigatório": t("errors.cnpjRequired"),
    "CPF deve ter 11 dígitos": t("errors.cpfDigits"),
    "CNPJ deve ter 14 dígitos": t("errors.cnpjDigits"),
    "CPF inválido": t("errors.cpfInvalid"),
    "CNPJ inválido": t("errors.cnpjInvalid"),
  };
  return map[message] ?? message;
}

function AuthFormHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400/90">
        {eyebrow}
      </p>
      <h4 className="mt-1 text-base font-semibold leading-snug text-zinc-50">{title}</h4>
      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{description}</p>
    </div>
  );
}

function AuthFieldLabel({
  htmlFor,
  icon: Icon,
  children,
}: {
  htmlFor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-xs font-medium text-zinc-200 sm:text-sm"
    >
      {Icon ? <Icon className="h-4 w-4 text-blue-400" /> : null}
      {children}
    </Label>
  );
}

export function AuthPage({
  entering = false,
  onEnterAnimationEnd,
}: {
  entering?: boolean;
  onEnterAnimationEnd?: () => void;
}) {
  const { t } = useTranslation("auth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [document, setDocument] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  React.useEffect(() => {
    if (!entering) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onEnterAnimationEnd?.();
    }
  }, [entering, onEnterAnimationEnd]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authError) {
        throw authError;
      }

      toast.success(t("toast.welcomeBack"));
      setIsTransitioning(true);
      setShowGlow(true);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name !== "TypeError" && error.message !== "Failed to fetch") {
        console.error("Login error:", error);
      }

      let message = t("errors.loginGeneric");

      if (
        error.message?.includes("Invalid login credentials") ||
        error.message?.includes("credenciais inv")
      ) {
        message = t("errors.invalidCredentials");
      } else if (
        error.message?.includes("Email not confirmed") ||
        error.message?.includes("email not confirmed")
      ) {
        message = t("errors.emailNotConfirmed");
      } else if (
        error.message?.includes("Email address not authorized") ||
        error.message?.includes("not authorized")
      ) {
        message = t("errors.emailNotAuthorized");
      } else if (error.message?.includes("Too many requests")) {
        message = t("errors.tooManyRequests");
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
        throw new Error(t("errors.firstNameRequired"));
      }
      if (!lastName.trim()) {
        throw new Error(t("errors.lastNameRequired"));
      }
      if (registerPassword.length < 6) {
        throw new Error(t("errors.passwordMin"));
      }
      if (accountType === "company" && !companyName.trim()) {
        throw new Error(t("errors.companyRequired"));
      }
      const docError = mapDocumentError(validateDocument(accountType, document), t);
      if (docError) {
        throw new Error(docError);
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
            last_name: lastName.trim(),
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error(t("errors.authUserFailed"));
      }

      const encryptedPassword = await encryptPassword(registerPassword);

      const workspaceName =
        accountType === "company"
          ? companyName.trim()
          : companyName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();

      const { data, error: rpcError } = await supabase.rpc("sp_create_user_with_company", {
        p_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: registerEmail.trim(),
        p_password: encryptedPassword,
        p_company_name: workspaceName || null,
        p_account_type: accountType,
        p_document: digitsOnly(document) || null,
      });

      if (rpcError) {
        console.error("Erro ao criar usuario na base de dados:", rpcError);
        throw rpcError;
      }

      if (data && typeof data === "object" && data.success === false) {
        throw new Error(data.error || t("errors.workspaceFailed"));
      }

      if (data && data.success !== false) {
        if (!authData.session) {
          toast.success(t("toast.accountCreatedConfirm"));
          setFirstName("");
          setLastName("");
          setRegisterEmail("");
          setRegisterPassword("");
          setCompanyName("");
          setDocument("");
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: registerEmail.trim(),
          password: registerPassword,
        });

        if (signInError) {
          console.warn("Usuario criado mas login automatico falhou:", signInError);
          toast.success(t("toast.accountCreatedLogin"));
          setFirstName("");
          setLastName("");
          setRegisterEmail("");
          setRegisterPassword("");
          setCompanyName("");
        } else {
          toast.success(t("toast.accountCreated"));
          setIsTransitioning(true);
          setShowGlow(true);
        }
      } else {
        throw new Error(data?.message || "Falha ao criar usuario na base de dados");
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name !== "TypeError" && error.message !== "Failed to fetch") {
        console.error("Register error:", error);
      }

      let message = error.message || t("errors.registerGeneric");

      if (
        message.includes("User already registered") ||
        message.includes("ja cadastrado") ||
        message.includes("ja existe") ||
        message.includes("already registered")
      ) {
        message = t("errors.emailAlreadyRegistered");
      } else if (message.includes("Password should be at least") || message.includes("minimo 6")) {
        message = t("errors.passwordMin");
      } else if (
        message.includes("valid email") ||
        message.includes("e-mail valido") ||
        message.includes("Invalid email")
      ) {
        message = t("errors.invalidEmail");
      }

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`auth-page-container relative min-h-[100dvh] overflow-x-hidden bg-zinc-950 text-zinc-50 ${
        isTransitioning ? "pointer-events-none" : ""
      } ${entering ? "auth-page-enter" : ""}`}
      onAnimationEnd={(event) => {
        if (entering && event.animationName === "authPageEnter") {
          onEnterAnimationEnd?.();
        }
      }}
    >
      <style>{`
        .auth-page-container {
          background-color: #09090b;
        }

        .auth-glow-expand {
          animation: glowExpand 0.8s ease-out forwards;
        }

        @keyframes glowExpand {
          0% { width: 0; height: 0; opacity: 1; }
          50% { opacity: 0.7; }
          100% { width: 200vw; height: 200vh; opacity: 0; }
        }

        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: 0.8s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }

        .auth-headline {
          line-height: 1.35;
          overflow: visible;
          padding-block: 0.06em 0.1em;
          letter-spacing: -0.01em;
        }

        .auth-headline-gradient {
          display: block;
          margin-top: 0.15em;
          padding-block: 0.12em 0.18em;
          line-height: 1.4;
          overflow: visible;
          background-image: linear-gradient(to right, #60a5fa, #818cf8);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
      `}</style>

      <LineWaves {...AUTH_LINE_WAVES_PROPS} />

      {showGlow && (
        <div
          className="auth-glow-expand pointer-events-none fixed left-1/2 top-1/2 z-[60] h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.22) 42%, transparent 72%)",
          }}
        />
      )}

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl items-center px-3 py-4 sm:px-5 sm:py-5 lg:px-8"
        style={{
          transition: "opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1), transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "scale(0.99) translateY(-10px)" : "scale(1) translateY(0)",
        }}
      >
        <div className="grid w-full items-center gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
          <aside className="hidden lg:block">
            <div className="space-y-6 pr-2 xl:pr-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                {t("brand.badge")}
              </div>

              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-900/30">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
                    {t("brand.eyebrow")}
                  </p>
                  <h1 className="auth-headline text-3xl font-bold !tracking-normal leading-[1.35] text-zinc-50 xl:text-4xl">
                    {t("brand.headline")}
                    <span className="auth-headline-gradient">{t("brand.headlineAccent")}</span>
                  </h1>
                  <p className="max-w-md text-base leading-relaxed text-zinc-400">
                    {t("brand.description")}
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {BRAND_FEATURE_KEYS.map(({ icon: Icon, titleKey, descKey }) => (
                  <li
                    key={titleKey}
                    className="flex gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/75 p-3 backdrop-blur-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950/90 text-blue-400 ring-1 ring-zinc-800">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-snug text-zinc-100">{t(titleKey)}</p>
                      <p className="mt-0.5 text-xs leading-snug text-zinc-500">{t(descKey)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[400px] lg:mx-0 lg:max-w-none">
            <div className="auth-main-card relative overflow-hidden rounded-[1.25rem] border border-zinc-800/90 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl sm:rounded-[1.5rem]">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"
                aria-hidden
              />

              <div className="p-3.5 sm:p-4">
                <div className="mb-3 flex flex-col items-center gap-2 text-center lg:hidden">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-900/30">
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      {t("brand.mobileTitle")}
                    </p>
                    <h2 className="mt-0.5 text-xl font-bold tracking-[0.1em] text-zinc-50">SONIA</h2>
                  </div>
                </div>

                <div className="mb-3 hidden text-center lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {t("access.eyebrow")}
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold leading-snug text-zinc-50">
                    {t("access.title")}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {t("access.description")}
                  </p>
                </div>

                {error && (
                  <div className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 p-2.5 text-red-100">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">{t("error.title")}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-red-100/90">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid h-9 w-full grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-0.5">
                    <TabsTrigger value="login" className={tabTriggerClass}>
                      {t("tabs.login")}
                    </TabsTrigger>
                    <TabsTrigger value="register" className={tabTriggerClass}>
                      {t("tabs.register")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-3 focus-visible:outline-none">
                    <div className={formPanelClass}>
                      <AuthFormHeader
                        eyebrow={t("login.eyebrow")}
                        title={t("login.title")}
                        description={t("login.description")}
                      />

                      <form onSubmit={handleLogin} autoComplete="off" className={formStackClass}>
                        <div className={formFieldClass}>
                          <AuthFieldLabel htmlFor="email" icon={Mail}>
                            {t("login.email")}
                          </AuthFieldLabel>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t("login.emailPlaceholder")}
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

                        <div className={formFieldClass}>
                          <AuthFieldLabel htmlFor="password" icon={Lock}>
                            {t("login.password")}
                          </AuthFieldLabel>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder={t("login.passwordPlaceholder")}
                              required
                              name="login_password"
                              autoComplete="new-password"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              className={`${inputClass} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200"
                              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        <Button type="submit" disabled={loading} className={primaryButtonClass}>
                          {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          {loading ? t("login.submitting") : t("login.submit")}
                        </Button>
                      </form>

                      <div className="my-3 flex items-center gap-2">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                          {t("login.orContinue")}
                        </span>
                        <div className="h-px flex-1 bg-zinc-800" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={socialButtonClass}
                          onClick={() => toast.info(t("oauth.googleSoon"))}
                        >
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          {t("oauth.google")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={socialButtonClass}
                          onClick={() => toast.info(t("oauth.microsoftSoon"))}
                        >
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23" fill="none" aria-hidden>
                            <path fill="#F25022" d="M0 0h11v11H0z" />
                            <path fill="#00A4EF" d="M12 0h11v11H12z" />
                            <path fill="#7FBA00" d="M0 12h11v11H0z" />
                            <path fill="#FFB900" d="M12 12h11v11H12z" />
                          </svg>
                          {t("oauth.microsoft")}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="register" className="mt-3 focus-visible:outline-none">
                    <div className={`${formPanelClass} max-h-[min(62vh,560px)] overflow-y-auto sm:max-h-[min(68vh,600px)]`}>
                      <AuthFormHeader
                        eyebrow={t("register.eyebrow")}
                        title={t("register.title")}
                        description={t("register.description")}
                      />

                      <form onSubmit={handleRegister} autoComplete="off" className={formStackClass}>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div className={formFieldClass}>
                            <AuthFieldLabel htmlFor="register-firstname">Nome</AuthFieldLabel>
                            <Input
                              id="register-firstname"
                              type="text"
                              placeholder="João"
                              required
                              name="register_first_name"
                              autoComplete="off"
                              autoCapitalize="words"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div className={formFieldClass}>
                            <AuthFieldLabel htmlFor="register-lastname">Sobrenome</AuthFieldLabel>
                            <Input
                              id="register-lastname"
                              type="text"
                              placeholder="Silva"
                              required
                              name="register_last_name"
                              autoComplete="off"
                              autoCapitalize="words"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className={formFieldClass}>
                          <AuthFieldLabel htmlFor="register-email" icon={Mail}>
                            E-mail
                          </AuthFieldLabel>
                          <Input
                            id="register-email"
                            type="email"
                            placeholder="nome@empresa.com"
                            required
                            name="register_email"
                            autoComplete="off"
                            autoCapitalize="none"
                            value={registerEmail}
                            onChange={(e) => setRegisterEmail(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        <div className={formFieldClass}>
                          <AuthFieldLabel>Tipo de conta</AuthFieldLabel>
                          <RadioGroup
                            value={accountType}
                            onValueChange={(v) => {
                              const next = v as AccountType;
                              setAccountType(next);
                              setDocument((prev) => formatDocument(next, prev));
                            }}
                            className="grid gap-2 sm:grid-cols-2"
                          >
                            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                              <label
                                key={opt.value}
                                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-left transition-all ${
                                  accountType === opt.value
                                    ? "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20"
                                    : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700"
                                }`}
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                  className="mt-0.5 border-zinc-600 text-blue-500"
                                />
                                <span>
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-100 sm:text-sm">
                                    {opt.value === "individual" ? (
                                      <User className="h-3.5 w-3.5 text-blue-400" />
                                    ) : (
                                      <Building2 className="h-3.5 w-3.5 text-blue-400" />
                                    )}
                                    {opt.label}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                                    {opt.description}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </RadioGroup>
                        </div>

                        {accountType === "company" && (
                          <div className={formFieldClass}>
                            <AuthFieldLabel htmlFor="register-company" icon={Building2}>
                              Nome da empresa
                            </AuthFieldLabel>
                            <Input
                              id="register-company"
                              type="text"
                              placeholder="Razão social ou nome fantasia"
                              required
                              name="register_company"
                              autoComplete="organization"
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        )}

                        <div className={formFieldClass}>
                          <AuthFieldLabel htmlFor="register-document">
                            {accountType === "individual" ? "CPF" : "CNPJ"}
                          </AuthFieldLabel>
                          <Input
                            id="register-document"
                            type="text"
                            inputMode="numeric"
                            required
                            placeholder={
                              accountType === "individual" ? "000.000.000-00" : "00.000.000/0000-00"
                            }
                            name="register_document"
                            maxLength={accountType === "individual" ? 14 : 18}
                            value={document}
                            onChange={(e) =>
                              setDocument(formatDocument(accountType, e.target.value))
                            }
                            className={inputClass}
                          />
                        </div>

                        <div className={formFieldClass}>
                          <AuthFieldLabel htmlFor="register-password" icon={Lock}>
                            Senha
                          </AuthFieldLabel>
                          <div className="relative">
                            <Input
                              id="register-password"
                              type={showRegisterPassword ? "text" : "password"}
                              placeholder="Mínimo de 6 caracteres"
                              required
                              minLength={6}
                              name="register_password"
                              autoComplete="new-password"
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              className={`${inputClass} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200"
                              aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        <Button type="submit" disabled={loading} className={primaryButtonClass}>
                          {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Criar conta
                        </Button>
                      </form>
                    </div>
                  </TabsContent>
                </Tabs>

                <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-500 sm:text-[11px]">
                  Ao continuar, você concorda com nossos{" "}
                  <a
                    href="#"
                    className="font-medium text-zinc-300 underline underline-offset-4 transition-colors hover:text-zinc-100"
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
                    className="font-medium text-zinc-300 underline underline-offset-4 transition-colors hover:text-zinc-100"
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
          </section>
        </div>
      </div>
    </div>
  );
}
