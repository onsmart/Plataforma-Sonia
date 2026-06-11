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
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "motion/react";

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

/* ── Keyframes globais do copilot (injetados uma vez) ── */
const COPILOT_KEYFRAMES = `
@keyframes copilot-dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
@keyframes copilot-ring-spin{to{transform:rotate(360deg)}}
@keyframes copilot-breathe{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(1.22);opacity:.12}}
@keyframes copilot-sparkle{0%,100%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.12) rotate(8deg)}60%{transform:scale(.96) rotate(-6deg)}}
@keyframes copilot-status-ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}
`;

/* ── Markdown leve (negrito, código inline, listas) ── */
type MdBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseMdBlocks(text: string): MdBlock[] {
  const lines = text.split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) { blocks.push({ type: "p", text: para.join("\n") }); para = []; }
  };
  for (const line of lines) {
    const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ulMatch) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "ul") prev.items.push(ulMatch[1]);
      else blocks.push({ type: "ul", items: [ulMatch[1]] });
    } else if (olMatch) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "ol") prev.items.push(olMatch[1]);
      else blocks.push({ type: "ol", items: [olMatch[1]] });
    } else {
      para.push(line);
    }
  }
  flushPara();
  return blocks;
}

function renderInlineMd(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={k++} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(
        <code key={k++} className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownLite({ text }: { text: string }) {
  const blocks = useMemo(() => parseMdBlocks(text), [text]);
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="ml-1 space-y-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                  <span>{renderInlineMd(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="ml-1 space-y-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 text-[0.85em] font-semibold opacity-60">{j + 1}.</span>
                  <span>{renderInlineMd(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">{renderInlineMd(b.text)}</p>
        );
      })}
    </div>
  );
}

/* ── Avatar da Sonia ── */
function SoniaAvatar({ size = "sm", speaking = false }: { size?: "sm" | "md"; speaking?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full shadow-sm",
        size === "sm" ? "h-7 w-7" : "h-10 w-10"
      )}
      style={{ background: "linear-gradient(135deg,#2563eb 0%,#7c3aed 60%,#db2777 130%)" }}
    >
      <Sparkles className={cn("text-white", size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5", speaking && "animate-pulse")} strokeWidth={2.2} />
    </div>
  );
}

/* ── Typing indicator ── */
function TypingIndicator() {
  const { t } = useTranslation("copilot");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2"
    >
      <SoniaAvatar />
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200/70 bg-white px-3.5 py-2.5 text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-400">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-1.5 w-1.5 rounded-full bg-current opacity-60"
              style={{ animation: `copilot-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <span className="text-[11px] font-medium">{t("thinking")}</span>
      </div>
    </motion.div>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ══════════════════════════════════════════════════════════
   CONTROLLER DO CHAT — vive no nível do provider (sempre
   montado), então requests em andamento sobrevivem ao
   fechamento do modal e à troca de aba.
   ══════════════════════════════════════════════════════════ */
type ChatController = {
  messages: CopilotMessage[];
  isLoading: boolean;
  unread: number;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
  markRead: () => void;
  /** Registrado pelo ChatTab enquanto montado; usado para TTS da resposta. */
  speakRef: React.MutableRefObject<((text: string) => void) | null>;
};

function useCopilotChat({
  actions,
  currentRoute,
  speechLang,
  isOpenRef,
}: {
  actions: any[];
  currentRoute: string;
  speechLang: string;
  isOpenRef: React.MutableRefObject<boolean>;
}): ChatController {
  const { t } = useTranslation("copilot");
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    const s = loadSessionMessages();
    return s.length > 0 ? s : [{ role: "assistant", content: t("welcome"), timestamp: Date.now() }];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const speakRef = useRef<((text: string) => void) | null>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; saveSessionMessages(messages); }, [messages]);
  const isLoadingRef = useRef(false);

  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  const routeRef = useRef(currentRoute);
  useEffect(() => { routeRef.current = currentRoute; }, [currentRoute]);

  const pushAssistant = useCallback((content: string) => {
    setMessages((p) => [...p, { role: "assistant", content, timestamp: Date.now() }]);
    if (!isOpenRef.current) setUnread((u) => u + 1);
  }, [isOpenRef]);

  const sendMessage = useCallback(async (raw: string) => {
    const userMsg = raw.trim();
    if (!userMsg || isLoadingRef.current) return;
    const um: CopilotMessage = { role: "user", content: userMsg, timestamp: Date.now() };
    setMessages((p) => [...p, um]);
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const history = [...messagesRef.current, um].slice(-12);
      const resp = await AgentService.chatWithCopilot(history, { channel: "webchat", currentRoute: routeRef.current, language: speechLang });
      let content = resp.content || "";
      const nav = content.match(/\[NAVIGATE:\s*(.*?)\]/);
      if (nav?.[1]) {
        const page = nav[1].trim();
        const action = actionsRef.current.find((a: any) => a.name === "navigateToPage");
        if (action) {
          action.handler({ page });
          content = content.replace(/\[NAVIGATE:\s*.*?\]/, "").trim();
          if (!content) content = t("navigatingTo", { page });
        }
      }
      pushAssistant(content);
      speakRef.current?.(content);
    } catch {
      toast.error(t("connectionError"));
      pushAssistant(t("connectionError"));
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [speechLang, t, pushAssistant]);

  const clearMessages = useCallback(() => {
    const fresh: CopilotMessage[] = [{ role: "assistant", content: t("welcome"), timestamp: Date.now() }];
    setMessages(fresh);
    saveSessionMessages(fresh);
    setUnread(0);
  }, [t]);

  const markRead = useCallback(() => setUnread(0), []);

  return { messages, isLoading, unread, sendMessage, clearMessages, markRead, speakRef };
}

/* ══════════════════════════════════════════════════════════
   ABA CHAT — apenas apresentação; estado vem do controller
   ══════════════════════════════════════════════════════════ */
function ChatTab({ chat, currentRoute, speechLang }: { chat: ChatController; currentRoute: string; speechLang: string }) {
  const { t } = useTranslation("copilot");
  const { messages, isLoading, sendMessage, clearMessages } = chat;

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    // Primeiro scroll instantâneo (reabertura), depois suave
    const firstPaint = Date.now() - mountedAtRef.current < 400;
    scrollRef.current?.scrollIntoView({ behavior: firstPaint ? "auto" : "smooth" });
  }, [messages, isLoading]);
  useEffect(() => { inputRef.current?.focus(); }, []);
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

  // Registra o TTS no controller enquanto a aba está montada
  useEffect(() => {
    chat.speakRef.current = speak;
    return () => { chat.speakRef.current = null; };
  }, [chat.speakRef, speak]);

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

  const handleSend = (text?: string) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg || isLoading) return;
    setInput("");
    sendMessage(userMsg);
  };

  const handleClear = () => {
    stopAudio();
    clearMessages();
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
          title={t("chat.clearTitle")} onClick={handleClear}>
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
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <motion.div
              key={`${m.timestamp}-${i}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 30, delay: Math.min(i * 0.025, 0.25) }}
              className={cn("group flex items-end gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              {m.role === "assistant" && <div className="mb-5"><SoniaAvatar speaking={isSpeaking && i === messages.length - 1} /></div>}
              <div className={cn("flex max-w-[82%] flex-col gap-0.5", m.role === "user" && "items-end")}>
                {m.role === "user" ? (
                  <div
                    className="rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed text-white shadow-sm whitespace-pre-wrap"
                    style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-bl-md border border-slate-200/70 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200">
                    <MarkdownLite text={m.content} />
                  </div>
                )}
                <span className="px-1 text-[10px] text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground/60">
                  {formatTime(m.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
          <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>
          <div ref={scrollRef} />
        </div>

        {showSuggestions && (
          <div className="mt-2 space-y-2">
            <p className="px-1 text-[11px] font-medium text-muted-foreground">{t("chat.suggestions")}</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSend(s)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition-colors hover:border-blue-300/60 hover:bg-blue-50 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-300"
                >
                  <Sparkles className="h-3 w-3 opacity-50" />
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3" style={{ borderColor: "hsl(var(--border)/0.4)" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className={cn(
            "flex items-center gap-1 rounded-2xl border bg-slate-50/70 p-1.5 transition-all duration-200 focus-within:border-blue-300/70 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] dark:bg-white/[0.04] dark:focus-within:border-blue-400/40 dark:focus-within:bg-white/[0.06]",
            isListening ? "border-red-300/70 dark:border-red-400/30" : "border-slate-200 dark:border-white/10"
          )}
        >
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? t("chat.recordStop") : t("chat.recordStart")}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
              isListening
                ? "animate-pulse bg-red-50 text-red-500 dark:bg-red-400/10 dark:text-red-300"
                : "text-muted-foreground hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-400/10 dark:hover:text-blue-300"
            )}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <input
            ref={inputRef}
            placeholder={isListening ? t("chat.listeningPlaceholder") : t("chat.placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <motion.button
            type="submit"
            disabled={isLoading || !input.trim()}
            whileHover={input.trim() && !isLoading ? { scale: 1.06 } : undefined}
            whileTap={input.trim() && !isLoading ? { scale: 0.92 } : undefined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-all",
              isLoading || !input.trim() ? "cursor-not-allowed bg-slate-300 dark:bg-white/10" : "shadow-md"
            )}
            style={!isLoading && input.trim() ? { background: "linear-gradient(135deg,#2563eb,#7c3aed)" } : undefined}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </motion.button>
        </form>
        {isListening && <p className="mt-1.5 text-center text-[11px] text-red-500 dark:text-red-300">{t("voice.status.listening")}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ABA VOZ — ElevenLabs Conversational AI
   ══════════════════════════════════════════════════════════ */
function VoiceTabInner() {
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

function VoiceTab() {
  return (
    <ConversationProvider>
      <VoiceTabInner />
    </ConversationProvider>
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
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const isOpenRef = useRef(false);

  const speechLang = useMemo(() => normalizeAgentLanguageCode(i18n.language), [i18n.language]);

  const chat = useCopilotChat({ actions, currentRoute, speechLang, isOpenRef });
  const { unread, markRead, isLoading } = chat;

  const handleOpenChange = useCallback((open: boolean) => {
    isOpenRef.current = open;
    setIsOpen(open);
    if (open) markRead();
  }, [markRead]);

  useEffect(() => {
    if (isOpen) { setBubbleVisible(false); return; }
    let tid: ReturnType<typeof setTimeout>;
    let idx = 0;
    const showBubble = () => {
      setBubbleIdx(idx);
      setBubbleVisible(true);
      tid = setTimeout(() => {
        setBubbleVisible(false);
        idx = (idx + 1) % 4;
        tid = setTimeout(showBubble, 12000);
      }, 5000);
    };
    tid = setTimeout(showBubble, 4000);
    return () => clearTimeout(tid);
  }, [isOpen]);

  if (!session) return null;

  const hasAttention = unread > 0 && !isOpen;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <style>{COPILOT_KEYFRAMES}</style>

      {/* Hint bubble animada */}
      <AnimatePresence>
        {!isOpen && bubbleVisible && !hasAttention && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, x: 14, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="pointer-events-none fixed bottom-8 z-[49]"
            style={{ right: "88px" }}
          >
            <div
              className="relative max-w-[190px] rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] font-medium leading-snug text-white shadow-lg"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", filter: "drop-shadow(0 4px 16px rgba(37,99,235,0.3))" }}
            >
              {t(`bubble.${bubbleIdx}`)}
              <span
                className="absolute bottom-2 border-[7px] border-transparent"
                style={{ right: "-13px", borderLeftColor: "#7c3aed" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante */}
      <SheetTrigger asChild>
        <motion.button
          type="button"
          aria-label={t("headerTitle")}
          initial={{ scale: 0, opacity: 0, y: 24 }}
          animate={
            hasAttention
              ? { scale: [1, 1.1, 1], opacity: 1, y: 0, rotate: [0, -5, 5, -3, 0], transition: { duration: 0.7, repeat: Infinity, repeatDelay: 2.2 } }
              : { scale: 1, opacity: 1, y: 0, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
          }
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 outline-none"
        >
          {/* Anel cônico girando (halo) */}
          <span
            aria-hidden="true"
            className="absolute -inset-[5px] rounded-full opacity-70"
            style={{
              background: "conic-gradient(from 0deg,#2563eb,#7c3aed,#db2777,#2563eb)",
              animation: "copilot-ring-spin 5s linear infinite",
              filter: "blur(7px)",
            }}
          />
          {/* Glow respirando */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(135deg,#2563eb,#7c3aed)",
              animation: hasAttention ? "copilot-breathe 1.6s ease-in-out infinite" : "copilot-breathe 3.2s ease-in-out infinite",
            }}
          />
          {/* Núcleo */}
          <span
            className="relative z-10 flex h-full w-full items-center justify-center rounded-full shadow-xl"
            style={{
              background: "linear-gradient(135deg,#2563eb,#7c3aed)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.38), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            {isLoading && !isOpen ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Sparkles
                className="h-6 w-6 text-white"
                style={{ animation: "copilot-sparkle 4s ease-in-out infinite" }}
              />
            )}
          </span>
          {/* Badge de não lidas */}
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="absolute -right-1 -top-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-md ring-2 ring-background"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </SheetTrigger>

      <SheetContent side="right"
        className="flex w-[min(92vw,580px)] max-w-full flex-col gap-0 p-0 sm:w-[580px] sm:max-w-[580px]"
        style={{ borderLeft: "1px solid hsl(var(--border)/0.6)" }}>

        {/* Header */}
        <SheetHeader className="relative shrink-0 overflow-hidden border-b px-5 py-4" style={{ borderColor: "hsl(var(--border)/0.5)" }}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
            style={{ background: "radial-gradient(ellipse 60% 120% at 12% 0%,#2563eb 0%,transparent 55%), radial-gradient(ellipse 50% 120% at 55% 0%,#7c3aed 0%,transparent 50%)" }}
          />
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <SoniaAvatar size="md" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="absolute h-full w-full rounded-full bg-emerald-400"
                  style={{ animation: "copilot-status-ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
                />
                <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </span>
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
          {(["chat", "voice"] as CopilotTab[]).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors duration-200",
                activeTab === tab
                  ? tab === "chat" ? "text-blue-600 dark:text-blue-300" : "text-violet-600 dark:text-violet-300"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {activeTab === tab && (
                <motion.span
                  layoutId="copilot-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className={cn(
                    "absolute inset-0 rounded-xl bg-white shadow-sm ring-1 dark:bg-white/10",
                    tab === "chat" ? "ring-blue-100/80 dark:ring-blue-400/20" : "ring-violet-100/80 dark:ring-violet-400/20"
                  )}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab === "chat" ? <MessageSquare className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                {t(`tab.${tab}`)}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "chat"
          ? <ChatTab chat={chat} currentRoute={currentRoute} speechLang={speechLang} />
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
