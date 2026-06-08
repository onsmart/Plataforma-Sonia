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
import { useConversation } from "@11labs/react";

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
  MessageSquare,
  Phone,
  PhoneOff,
  Radio,
} from "lucide-react";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { AgentService } from "../../services/api";
import { normalizeAgentLanguageCode } from "../../lib/agent-language";
import { cn } from "../ui/utils";
import Orb from "./Orb";

/* ── Rotas válidas ── */
const VALID_COPILOT_ROUTES = [
  "home", "cockpit", "inbox", "devices", "agents", "playground", "flows",
  "knowledge", "governance", "insights", "configuration", "integrations",
  "profile", "agent-config",
] as const;

type ValidRoute = typeof VALID_COPILOT_ROUTES[number];
type CopilotMessage = { role: "user" | "assistant"; content: string; timestamp: number };
type CopilotTab = "chat" | "voice";

/* ── Sugestões contextuais (chaves i18n copilot) ── */
const ROUTE_SUGGESTION_ROUTES: Partial<Record<ValidRoute, string>> = {
  home: "suggestions.routes.home",
  cockpit: "suggestions.routes.cockpit",
  inbox: "suggestions.routes.inbox",
  agents: "suggestions.routes.agents",
  flows: "suggestions.routes.flows",
  knowledge: "suggestions.routes.knowledge",
  configuration: "suggestions.routes.configuration",
  integrations: "suggestions.routes.integrations",
  insights: "suggestions.routes.insights",
  playground: "suggestions.routes.playground",
};

function getCopilotSuggestions(route: string, t: (key: string) => string): string[] {
  const prefix = ROUTE_SUGGESTION_ROUTES[route as ValidRoute];
  if (prefix) {
    return [0, 1, 2].map((i) => t(`${prefix}.${i}`));
  }
  return [0, 1, 2].map((i) => t(`suggestions.default.${i}`));
}

/* ── Session storage ── */
const SESSION_KEY = "sonia-copilot-messages";
function loadSessionMessages(): CopilotMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CopilotMessage[];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch { return []; }
}
function saveSessionMessages(msgs: CopilotMessage[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
}

/* ── Context ── */
const CopilotContext = createContext<{ actions: any[]; registerAction: (a: any) => void } | null>(null);

export const useCopilotReadable = (_c: unknown) => { useEffect(() => {}, []); };
export const useCopilotAction = (config: any) => {
  const ctx = useContext(CopilotContext);
  useEffect(() => { if (ctx?.registerAction) ctx.registerAction(config); }, [config, ctx]);
};

const SoniaCopilotActions = () => {
  const { navigate, currentRoute } = useNavigation();
  const { session } = useAuth();
  useCopilotReadable({ description: "Estado atual", value: { currentRoute, user: session?.user?.email, availableRoutes: VALID_COPILOT_ROUTES } });
  useCopilotAction({
    name: "navigateToPage",
    description: "Navigate to a specific page.",
    parameters: [{ name: "page", type: "string", description: "Page ID", required: true }],
    handler: ({ page }: { page: string }) => { navigate(page); return `Navegando para ${page}.`; },
  });
  return null;
};

/* ── Typing dots ── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="block h-1.5 w-1.5 rounded-full bg-current opacity-60"
          style={{ animation: `copilot-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes copilot-dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ══════════════════════════════════════════════════════════
   ABA CHAT
   ══════════════════════════════════════════════════════════ */
function ChatTab({ actions, currentRoute, speechLang }: { actions: any[]; currentRoute: string; speechLang: string }) {
  const { t } = useTranslation("copilot");
  const welcomeMsg: CopilotMessage = useMemo(() => ({ role: "assistant", content: t("welcome"), timestamp: Date.now() }), [t]);

  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    const s = loadSessionMessages();
    return s.length > 0 ? s : [welcomeMsg];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { saveSessionMessages(messages); }, [messages]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { if (recognitionRef.current) recognitionRef.current.lang = speechLang; }, [speechLang]);
  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const fallbackSpeak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/\[.*?\]/g, "").trim());
    u.lang = speechLang; u.rate = 0.95;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [speechLang]);

  const speak = useCallback(async (text: string) => {
    if (!voiceOutput) return;
    stopAudio();
    const clean = text.replace(/\[.*?\]/g, "").replace(/\*\*/g, "").replace(/#{1,6}\s/g, "").trim();
    if (!clean) return;
    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api");
      const res = await fetch(`${BASE_URL}/copilot/tts`, {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) { fallbackSpeak(clean); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); fallbackSpeak(clean); };
      await audio.play();
    } catch { fallbackSpeak(clean); }
  }, [voiceOutput, stopAudio, fallbackSpeak]);

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error(t("voiceUnsupported")); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    if (!recognitionRef.current) {
      try {
        const r = new SR();
        r.continuous = false; r.interimResults = false; r.lang = speechLang;
        r.onstart = () => setIsListening(true);
        r.onend = () => setIsListening(false);
        r.onerror = (e: any) => {
          if (e.error === "not-allowed") { setIsListening(false); recognitionRef.current = null; return; }
          setIsListening(false); recognitionRef.current = null;
        };
        r.onresult = (e: any) => { const t = e.results[0]?.[0]?.transcript; if (t) setInput(t); };
        recognitionRef.current = r;
      } catch { return; }
    } else { recognitionRef.current.lang = speechLang; }
    try { recognitionRef.current.start(); } catch { setIsListening(false); }
  };

  const handleSend = async (text?: string) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg || isLoading) return;
    setInput("");
    const um: CopilotMessage = { role: "user", content: userMsg, timestamp: Date.now() };
    setMessages((p) => [...p, um]);
    setIsLoading(true);
    try {
      const history = [...messages, um].slice(-12);
      const resp = await AgentService.chatWithCopilot(history, { channel: "webchat", currentRoute, language: speechLang });
      let content = resp.content || "";
      const nav = content.match(/\[NAVIGATE:\s*(.*?)\]/);
      if (nav?.[1]) {
        const page = nav[1].trim();
        const action = actions.find((a: any) => a.name === "navigateToPage");
        if (action) { action.handler({ page }); content = content.replace(/\[NAVIGATE:\s*.*?\]/, "").trim(); if (!content) content = t("navigatingTo", { page }); }
      }
      setMessages((p) => [...p, { role: "assistant", content, timestamp: Date.now() }]);
      speak(content);
    } catch {
      toast.error(t("connectionError"));
      setMessages((p) => [...p, { role: "assistant", content: t("connectionError"), timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  const clearMessages = () => {
    stopAudio();
    const fresh = [{ role: "assistant" as const, content: t("welcome"), timestamp: Date.now() }];
    setMessages(fresh); saveSessionMessages(fresh);
  };

  const suggestions = useMemo(() => getCopilotSuggestions(currentRoute, t), [currentRoute, t]);
  const showSuggestions = messages.length <= 1 && !isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-end gap-1 border-b px-4 py-2" style={{ borderColor: "hsl(var(--border)/0.4)" }}>
        <Button type="button" variant="ghost" size="icon"
          className={cn("h-7 w-7 rounded-lg text-muted-foreground transition-colors",
            voiceOutput && !isSpeaking && "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
            isSpeaking && "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300")}
          title={voiceOutput ? t("chat.voiceOff") : t("chat.voiceOn")}
          onClick={() => { const n = !voiceOutput; setVoiceOutput(n); if (!n) stopAudio(); toast.info(n ? t("chat.voiceActivated") : t("chat.voiceDeactivated")); }}>
          {isSpeaking ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : voiceOutput ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" variant="ghost" size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
          title={t("chat.clearTitle")} onClick={clearMessages}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Voice output indicator */}
      {voiceOutput && (
        <div className={cn("mx-4 mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
          isSpeaking ? "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300" : "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300")}>
          <Volume2 className={cn("h-3 w-3", isSpeaking && "animate-pulse")} />
          {isSpeaking ? (
            <><span className="flex-1">{t("chat.speaking")}</span>
              <button type="button" onClick={stopAudio} className="font-semibold opacity-70 hover:opacity-100">{t("chat.stop")}</button></>
          ) : <span>{t("chat.voiceActiveLabel")}</span>}
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex items-end gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {m.role === "assistant" && (
                <div className="mb-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                  <Bot className="h-3 w-3 text-white" strokeWidth={2} />
                </div>
              )}
              <div className={cn("flex max-w-[80%] flex-col gap-0.5", m.role === "user" && "items-end")}>
                <div className={cn("rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "rounded-br-sm bg-blue-600 text-white dark:bg-blue-500"
                    : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-white/8 dark:text-zinc-200")}>
                  {m.content}
                </div>
                <span className="px-1 text-[10px] text-muted-foreground/50">{formatTime(m.timestamp)}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end gap-2">
              <div className="mb-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                <Bot className="h-3 w-3 text-white" strokeWidth={2} />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-slate-500 dark:bg-white/8 dark:text-zinc-400">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {showSuggestions && (
          <div className="mt-4 space-y-2">
            <p className="px-1 text-[11px] font-medium text-muted-foreground">{t("chat.suggestions")}</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => handleSend(s)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-white/8 dark:bg-white/4 dark:text-zinc-300 dark:hover:border-blue-400/25 dark:hover:bg-blue-400/8 dark:hover:text-blue-300">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3" style={{ borderColor: "hsl(var(--border)/0.4)" }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon"
            className={cn("h-9 w-9 shrink-0 rounded-xl transition-all",
              isListening ? "animate-pulse border-red-200 bg-red-50 text-red-500 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300" : "text-muted-foreground hover:border-blue-200 hover:bg-blue-50 hover:text-blue-500")}
            onClick={toggleListening} title={isListening ? t("chat.recordStop") : t("chat.recordStart")}>
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>
          <Input placeholder={isListening ? t("chat.listeningPlaceholder") : t("chat.placeholder")}
            value={input} onChange={(e) => setInput(e.target.value)}
            className="h-9 flex-1 rounded-xl border-slate-200 bg-slate-50/60 text-sm placeholder:text-muted-foreground/50 focus-visible:border-blue-300 focus-visible:ring-blue-200/50 dark:border-white/8 dark:bg-white/4"
            disabled={isLoading} />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-xl"
            style={!isLoading && input.trim() ? { background: "linear-gradient(135deg,#2563eb,#7c3aed)" } : undefined}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
        {isListening && <p className="mt-1.5 text-center text-[11px] text-red-500 dark:text-red-300">Gravando… Fale sua mensagem</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ABA VOZ — ElevenLabs Conversational AI
   ══════════════════════════════════════════════════════════ */
function VoiceTab() {
  const { t } = useTranslation("copilot");
  const [sessionState, setSessionState] = useState<"idle" | "connecting" | "active" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const activityRef = useRef(0);

  const conversation = useConversation({
    onConnect: () => setSessionState("active"),
    onDisconnect: () => setSessionState("idle"),
    onError: (err: any) => {
      console.error("[ElevenLabs voice]", err);
      setSessionState("error");
      setErrorMsg(typeof err === "string" ? err : err?.message || t("voice.errorConnection"));
    },
  });

  useEffect(() => {
    if (sessionState === "idle" || sessionState === "error") {
      activityRef.current = 0;
      return;
    }

    let rafId = 0;
    const tick = (t: number) => {
      let raw = 0;

      if (sessionState === "connecting") {
        raw = 0.18 + Math.sin(t * 0.004) * 0.12;
      } else if (sessionState === "active") {
        const conv = conversation as {
          getInputVolume?: () => number;
          getOutputVolume?: () => number;
          isSpeaking?: boolean;
        };
        const input = typeof conv.getInputVolume === "function" ? conv.getInputVolume() : 0;
        const output = typeof conv.getOutputVolume === "function" ? conv.getOutputVolume() : 0;
        raw = Math.max(input, output);

        if (raw < 0.05) {
          raw = conv.isSpeaking
            ? 0.55 + Math.sin(t * 0.012) * 0.25
            : 0.2 + Math.sin(t * 0.008) * 0.15;
        } else {
          raw = Math.min(1, raw * 1.4);
        }
      }

      activityRef.current += (raw - activityRef.current) * 0.14;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sessionState, conversation]);

  const startSession = async () => {
    setSessionState("connecting");
    setErrorMsg("");
    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api");
      const res = await fetch(`${BASE_URL}/copilot/voice-session`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error(t("voice.errorStartSession"));
      const { signedUrl } = await res.json();
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ signedUrl });
    } catch (e: any) {
      setSessionState("error");
      setErrorMsg(e?.message || t("voice.errorStart"));
    }
  };

  const endSession = async () => {
    await conversation.endSession();
    setSessionState("idle");
  };

  const isActive = sessionState === "active";
  const isConnecting = sessionState === "connecting";
  const isAgentSpeaking = conversation.isSpeaking;

  const statusLabel = isConnecting
    ? t("voice.status.connecting")
    : isActive
      ? isAgentSpeaking
        ? t("voice.status.speaking")
        : t("voice.status.listening")
      : t("voice.status.idle");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6">
        <div className="relative h-[min(52vw,280px)] w-[min(52vw,280px)] max-h-[280px] max-w-[280px]">
          <Orb
            hue={0}
            activityRef={activityRef}
            hoverIntensity={0.85}
            rotateOnHover={sessionState !== "idle"}
            backgroundColor="transparent"
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-foreground">{t("voice.title")}</p>
          <p className={cn(
            "mt-1.5 text-xs font-medium transition-colors",
            isActive && isAgentSpeaking
              ? "text-violet-600 dark:text-violet-300"
              : isActive
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-muted-foreground",
          )}>
            {statusLabel}
          </p>
        </div>
      </div>

      {/* Error */}
      {sessionState === "error" && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
          {errorMsg || t("voice.errorSession")}
        </div>
      )}

      {/* Controls */}
      <div className="shrink-0 border-t p-4" style={{ borderColor: "hsl(var(--border)/0.4)" }}>
        {!isActive ? (
          <button type="button" onClick={startSession} disabled={isConnecting}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
            style={{ background: isConnecting ? "linear-gradient(135deg,#6b7280,#9ca3af)" : "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            {isConnecting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("voice.status.connecting")}</>
              : <><Phone className="h-4 w-4" /> {t("voice.start")}</>}
          </button>
        ) : (
          <button type="button" onClick={endSession}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/15">
            <PhoneOff className="h-4 w-4" /> {t("voice.end")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   UI PRINCIPAL
   ══════════════════════════════════════════════════════════ */
const SoniaCopilotUI = () => {
  const { t, i18n } = useTranslation("copilot");
  const { session } = useAuth();
  const { currentRoute } = useNavigation();
  const { actions } = useContext(CopilotContext)!;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CopilotTab>("chat");

  const speechLang = useMemo(() => normalizeAgentLanguageCode(i18n.language), [i18n.language]);

  if (!session) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button type="button" aria-label={t("headerTitle")}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-xl transition-all duration-300 hover:scale-105"
          style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 8px 24px rgba(37,99,235,0.38),0 0 20px rgba(124,58,237,0.25)" }}>
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right"
        className="flex w-[min(92vw,580px)] flex-col gap-0 p-0 sm:w-[580px]"
        style={{ borderLeft: "1px solid hsl(var(--border)/0.6)" }}>

        {/* Header */}
        <SheetHeader className="shrink-0 border-b px-5 py-4" style={{ borderColor: "hsl(var(--border)/0.5)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
              <Bot className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold leading-tight">{t("headerTitle")}</SheetTitle>
              <SheetDescription className="mt-0 text-[11px] leading-tight text-muted-foreground">
                {t("headerSubtitle")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Tab switcher */}
        <div className="flex shrink-0 items-center gap-1 border-b bg-slate-50/60 px-4 py-2.5 dark:bg-white/[0.02]"
          style={{ borderColor: "hsl(var(--border)/0.4)" }}>
          <button type="button" onClick={() => setActiveTab("chat")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all duration-200",
              activeTab === "chat"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100/80 dark:bg-white/10 dark:text-blue-300 dark:ring-blue-400/20"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <MessageSquare className="h-3.5 w-3.5" />
            {t("tab.chat")}
          </button>
          <button type="button" onClick={() => setActiveTab("voice")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all duration-200",
              activeTab === "voice"
                ? "bg-white text-violet-600 shadow-sm ring-1 ring-violet-100/80 dark:bg-white/10 dark:text-violet-300 dark:ring-violet-400/20"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <Radio className="h-3.5 w-3.5" />
            {t("tab.voice")}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "chat"
          ? <ChatTab actions={actions} currentRoute={currentRoute} speechLang={speechLang} />
          : <VoiceTab />}
      </SheetContent>
    </Sheet>
  );
};

/* ── Provider ── */
export const SoniaCopilotProvider = ({ children }: { children: React.ReactNode }) => {
  const [actions, setActions] = useState<any[]>([]);
  const registerAction = useCallback((action: any) => {
    setActions((p) => p.find((a) => a.name === action.name) ? p : [...p, action]);
  }, []);
  return (
    <CopilotContext.Provider value={{ actions, registerAction }}>
      <SoniaCopilotActions />
      {children}
      <SoniaCopilotUI />
    </CopilotContext.Provider>
  );
};
