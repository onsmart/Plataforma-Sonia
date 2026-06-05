import React, {
  useState,
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";

import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "../ui/sheet";
import {
  Bot,
  Send,
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  VolumeX,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { AgentService } from "../../services/api";
import { normalizeAgentLanguageCode } from "../../lib/agent-language";
import { cn } from "../ui/utils";

/* ── Rotas válidas ── */
const VALID_COPILOT_ROUTES = [
  "home", "cockpit", "inbox", "devices", "agents", "playground", "flows",
  "knowledge", "governance", "insights", "configuration", "integrations",
  "profile", "agent-config",
] as const;

type ValidRoute = typeof VALID_COPILOT_ROUTES[number];
type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

/* ── Sugestões contextuais por rota ── */
const ROUTE_SUGGESTIONS: Partial<Record<ValidRoute, string[]>> = {
  home: [
    "O que é a plataforma Sonia?",
    "Como criar meu primeiro agente?",
    "Ir para Hub de Agentes",
  ],
  cockpit: [
    "Como interpreto os KPIs?",
    "O que é a taxa de sucesso?",
    "Ir para Caixa de Entrada",
  ],
  inbox: [
    "Como aprovar uma mensagem?",
    "Como fazer handoff para humano?",
    "Ir para Cabine de Operações",
  ],
  agents: [
    "Diferença entre FAQ e Receptivo?",
    "Como criar agente com IA?",
    "O que é um template?",
  ],
  flows: [
    "Como criar um fluxo visual?",
    "O que é um bloco de decisão?",
    "Como conectar Calendly em um fluxo?",
  ],
  knowledge: [
    "O que é RAG?",
    "Como criar uma base de conhecimento?",
    "Diferença entre RAG e Skills?",
  ],
  configuration: [
    "Como configurar meu perfil?",
    "Ir para Integrações",
  ],
  integrations: [
    "Como conectar WhatsApp?",
    "Como configurar Calendly?",
    "Como integrar HubSpot?",
  ],
  insights: [
    "Como interpretar os dados?",
    "O que é custo por interação?",
  ],
  playground: [
    "Como testar o agente?",
    "O que é o laboratório?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "O que posso fazer aqui?",
  "Ir para Hub de Agentes",
  "Como criar um agente?",
];

/* ── SessionStorage ── */
const SESSION_KEY = "sonia-copilot-messages";

function loadSessionMessages(): CopilotMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CopilotMessage[];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

function saveSessionMessages(messages: CopilotMessage[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-40)));
  } catch { /* ignore */ }
}

/* ── Context ── */
const CopilotContext = createContext<{
  actions: any[];
  registerAction: (a: any) => void;
} | null>(null);

export const useCopilotReadable = (_config: unknown) => {
  useEffect(() => {}, []);
};

export const useCopilotAction = (config: any) => {
  const ctx = useContext(CopilotContext);
  useEffect(() => {
    if (ctx?.registerAction) ctx.registerAction(config);
  }, [config, ctx]);
};

/* ── Actions registradas ── */
const SoniaCopilotActions = () => {
  const { navigate, currentRoute } = useNavigation();
  const { session } = useAuth();

  useCopilotReadable({
    description: "Estado atual da aplicação",
    value: {
      currentRoute,
      user: session?.user?.email,
      availableRoutes: VALID_COPILOT_ROUTES,
    },
  });

  useCopilotAction({
    name: "navigateToPage",
    description: "Navigate to a specific page.",
    parameters: [
      {
        name: "page",
        type: "string",
        description: "The page ID (cockpit, inbox, agents...)",
        required: true,
      },
    ],
    handler: ({ page }: { page: string }) => {
      navigate(page);
      return `Navegando para ${page}.`;
    },
  });

  return null;
};

/* ── Typing indicator ── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-current opacity-60"
          style={{
            animation: `copilot-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes copilot-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Formatação simples de tempo ── */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── UI principal ── */
const SoniaCopilotUI = () => {
  const { t, i18n } = useTranslation("copilot");
  const { session } = useAuth();
  const { currentRoute } = useNavigation();
  const { actions } = useContext(CopilotContext)!;

  const speechLang = useMemo(
    () => normalizeAgentLanguageCode(i18n.language),
    [i18n.language]
  );

  const welcomeMsg: CopilotMessage = useMemo(
    () => ({
      role: "assistant",
      content: t("welcome"),
      timestamp: Date.now(),
    }),
    [t]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    const saved = loadSessionMessages();
    return saved.length > 0 ? saved : [welcomeMsg];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* Salvar mensagens na sessão */
  useEffect(() => {
    saveSessionMessages(messages);
  }, [messages]);

  /* Scroll automático */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* Sincronizar idioma do reconhecimento */
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = speechLang;
  }, [speechLang]);

  /* Cleanup ao desmontar */
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  /* Parar áudio ElevenLabs + síntese web */
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  /* Fallback: Web Speech API nativa */
  const fallbackSpeak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        text.replace(/\*\*/g, "").replace(/\[.*?\]/g, "").trim()
      );
      utterance.lang = speechLang;
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [speechLang]
  );

  /* Falar resposta — ElevenLabs (Fernanda) com fallback para Web Speech */
  const speak = useCallback(
    async (text: string) => {
      if (!voiceOutput) return;
      stopAudio();

      const clean = text
        .replace(/\[.*?\]/g, "")
        .replace(/\*\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .trim();
      if (!clean) return;

      try {
        const { BASE_URL, getAuthHeaders } = await import("../../services/api");
        const res = await fetch(`${BASE_URL}/copilot/tts`, {
          method: "POST",
          headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean }),
        });

        if (!res.ok) {
          // Backend não configurado ou erro → fallback
          fallbackSpeak(clean);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setIsSpeaking(false);
          fallbackSpeak(clean);
        };

        await audio.play();
      } catch {
        // Rede ou outro erro → fallback
        fallbackSpeak(clean);
      }
    },
    [voiceOutput, stopAudio, fallbackSpeak]
  );

  /* Toggle voz de entrada (microfone) */
  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t("voiceUnsupported"));
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (!recognitionRef.current) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = speechLang;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
          if (event.error === "not-allowed") {
            setIsListening(false);
            recognitionRef.current = null;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: t("voiceBlocked"), timestamp: Date.now() },
            ]);
            return;
          }
          if (event.error !== "no-speech") toast.error(t("voiceError", { error: event.error }));
          setIsListening(false);
          recognitionRef.current = null;
        };
        recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) setInput(transcript);
        };
        recognitionRef.current = recognition;
      } catch { return; }
    } else {
      recognitionRef.current.lang = speechLang;
    }

    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  };

  /* Enviar mensagem */
  const handleSend = async (text?: string) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg || isLoading) return;
    setInput("");

    const userMessage: CopilotMessage = { role: "user", content: userMsg, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = [...messages, userMessage].slice(-12);
      const response = await AgentService.chatWithCopilot(history, {
        channel: "webchat",
        currentRoute,
        language: speechLang,
      });

      let content = response.content || "";

      const navMatch = content.match(/\[NAVIGATE:\s*(.*?)\]/);
      if (navMatch?.[1]) {
        const page = navMatch[1].trim();
        const navAction = actions.find((a: any) => a.name === "navigateToPage");
        if (navAction) {
          navAction.handler({ page });
          content = content.replace(/\[NAVIGATE:\s*.*?\]/, "").trim();
          if (!content) content = t("navigatingTo", { page });
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content, timestamp: Date.now() },
      ]);
      speak(content);
    } catch {
      toast.error(t("connectionError"));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("connectionError"), timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /* Limpar conversa */
  const clearMessages = () => {
    stopAudio();
    const fresh: CopilotMessage[] = [{ role: "assistant", content: t("welcome"), timestamp: Date.now() }];
    setMessages(fresh);
    saveSessionMessages(fresh);
  };

  /* Sugestões da rota atual */
  const suggestions = useMemo(() => {
    const route = currentRoute as ValidRoute;
    return ROUTE_SUGGESTIONS[route] ?? DEFAULT_SUGGESTIONS;
  }, [currentRoute]);

  const showSuggestions = messages.length <= 1 && !isLoading;

  if (!session) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          aria-label={t("title")}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-xl transition-all duration-300 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            boxShadow: "0 8px 24px rgba(37,99,235,0.38), 0 0 20px rgba(124,58,237,0.25)",
          }}
        >
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-[400px] flex-col gap-0 p-0 sm:w-[480px]"
        style={{ borderLeft: "1px solid hsl(var(--border)/0.6)" }}
      >
        {/* ── Header ── */}
        <SheetHeader className="shrink-0 border-b px-5 py-4" style={{ borderColor: "hsl(var(--border)/0.5)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}
              >
                <Bot className="h-4.5 w-4.5 text-white" strokeWidth={2} />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-tight">
                  {t("title")}
                </SheetTitle>
                <SheetDescription className="mt-0 text-[11px] leading-tight text-muted-foreground">
                  {t("subtitle")}
                </SheetDescription>
              </div>
            </div>
            {/* Controles do header */}
            <div className="flex items-center gap-1">
              {/* Toggle voz de saída (Fernanda / ElevenLabs) */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg text-muted-foreground transition-colors",
                  voiceOutput && !isSpeaking && "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
                  isSpeaking && "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"
                )}
                title={voiceOutput ? "Desativar voz da Fernanda" : "Ativar voz da Fernanda (ElevenLabs)"}
                onClick={() => {
                  const next = !voiceOutput;
                  setVoiceOutput(next);
                  if (!next) stopAudio();
                  toast.info(next ? "Voz da Fernanda ativada" : "Voz desativada");
                }}
              >
                {isSpeaking ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : voiceOutput ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              {/* Limpar conversa */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                title="Limpar conversa"
                onClick={clearMessages}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {/* Indicador de voz ativa / falando */}
          {voiceOutput && (
            <div
              className={cn(
                "mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-300",
                isSpeaking
                  ? "bg-violet-50 dark:bg-violet-400/10"
                  : "bg-blue-50 dark:bg-blue-400/10"
              )}
            >
              {isSpeaking ? (
                <>
                  <Volume2 className="h-3 w-3 animate-pulse text-violet-500 dark:text-violet-300" />
                  <span className="text-[11px] font-medium text-violet-600 dark:text-violet-300">
                    Fernanda está falando…
                  </span>
                  <button
                    type="button"
                    onClick={stopAudio}
                    className="ml-auto text-[10px] font-semibold text-violet-500 hover:text-violet-700 dark:text-violet-300"
                  >
                    Parar
                  </button>
                </>
              ) : (
                <>
                  <Volume2 className="h-3 w-3 text-blue-500 dark:text-blue-300" />
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-300">
                    Voz da Fernanda (ElevenLabs) ativada
                  </span>
                </>
              )}
            </div>
          )}
        </SheetHeader>

        {/* ── Mensagens ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" id="copilot-scroll-container">
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-end gap-2.5",
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar da assistente */}
                {m.role === "assistant" && (
                  <div
                    className="mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}
                  >
                    <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                  </div>
                )}

                <div className={cn("flex max-w-[82%] flex-col gap-1", m.role === "user" && "items-end")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "rounded-br-sm bg-blue-600 text-white dark:bg-blue-500"
                        : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-white/[0.07] dark:text-zinc-200"
                    )}
                  >
                    {m.content}
                  </div>
                  <span className="px-1 text-[10px] text-muted-foreground/60">
                    {formatTime(m.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2.5">
                <div
                  className="mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}
                >
                  <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-slate-500 dark:bg-white/[0.07] dark:text-zinc-400">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* ── Sugestões contextuais ── */}
          {showSuggestions && (
            <div className="mt-5 space-y-2">
              <p className="px-1 text-[11px] font-medium text-muted-foreground">
                Sugestões para esta página
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-blue-400/25 dark:hover:bg-blue-400/8 dark:hover:text-blue-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div
          className="shrink-0 border-t p-4"
          style={{ borderColor: "hsl(var(--border)/0.5)" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Microfone (voz de entrada) */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleListening}
              aria-pressed={isListening}
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl transition-all duration-200",
                isListening
                  ? "animate-pulse border-red-200 bg-red-50 text-red-500 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
                  : "text-muted-foreground hover:border-blue-200 hover:bg-blue-50 hover:text-blue-500 dark:hover:border-blue-400/20 dark:hover:bg-blue-400/8 dark:hover:text-blue-300"
              )}
              title={isListening ? "Parar gravação" : "Falar mensagem"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            <Input
              placeholder={
                isListening
                  ? "Ouvindo..."
                  : "Digite 'Ir para Inbox'..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-10 flex-1 rounded-xl border-slate-200 bg-slate-50/60 text-sm placeholder:text-muted-foreground/60 focus-visible:border-blue-300 focus-visible:ring-blue-200/50 dark:border-white/[0.08] dark:bg-white/[0.04]"
              disabled={isLoading}
            />

            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl"
              style={
                !isLoading && input.trim()
                  ? { background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }
                  : undefined
              }
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Indicador de estado */}
          {isListening && (
            <p className="mt-2 text-center text-[11px] text-red-500 dark:text-red-300">
              Gravando... Fale sua mensagem
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ── Provider ── */
export const SoniaCopilotProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [actions, setActions] = useState<any[]>([]);

  const registerAction = useCallback((action: any) => {
    setActions((prev) => {
      if (prev.find((a) => a.name === action.name)) return prev;
      return [...prev, action];
    });
  }, []);

  return (
    <CopilotContext.Provider value={{ actions, registerAction }}>
      <SoniaCopilotActions />
      {children}
      <SoniaCopilotUI />
    </CopilotContext.Provider>
  );
};
