import React, { useState, createContext, useContext, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "../ui/sheet";
import { Bot, Send, Sparkles, Mic, MicOff, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { AgentService } from "../../services/api";
import { normalizeAgentLanguageCode } from "../../lib/agent-language";

const VALID_COPILOT_ROUTES = [
  "home", "cockpit", "inbox", "devices", "agents", "playground", "flows",
  "knowledge", "governance", "insights", "configuration", "integrations",
  "profile", "agent-config",
] as const;

type CopilotMessage = { role: "user" | "assistant"; content: string };

const CopilotContext = createContext<{ actions: any[]; registerAction: (a: any) => void } | null>(null);

export const useCopilotReadable = (_config: unknown) => {
  useEffect(() => {}, []);
};

export const useCopilotAction = (config: any) => {
  const ctx = useContext(CopilotContext);
  useEffect(() => {
    if (ctx?.registerAction) {
      ctx.registerAction(config);
    }
  }, [config, ctx]);
};

const SoniaCopilotActions = () => {
  const { navigate, currentRoute } = useNavigation();
  const { session } = useAuth();

  useCopilotReadable({
    description: "The current state of the application",
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
      return `Navigated to ${page} successfully.`;
    },
  });

  return null;
};

const SoniaCopilotUI = () => {
  const { t, i18n } = useTranslation("copilot");
  const { session } = useAuth();
  const { currentRoute } = useNavigation();
  const { actions } = useContext(CopilotContext)!;

  const speechLang = useMemo(
    () => normalizeAgentLanguageCode(i18n.language),
    [i18n.language]
  );

  const welcomeMessage = t("welcome");

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const recognitionRef = React.useRef<any>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: welcomeMessage }]);
  }, [welcomeMessage]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechLang;
    }
  }, [speechLang]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceMode || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        text.replace(/\*\*/g, "").replace(/\[.*?\]/g, "").trim()
      );
      utterance.lang = speechLang;
      window.speechSynthesis.speak(utterance);
    },
    [voiceMode, speechLang]
  );

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
              { role: "assistant", content: t("voiceBlocked") },
            ]);
            return;
          }
          if (event.error !== "no-speech") {
            toast.error(t("voiceError", { error: event.error }));
          }
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) setInput(transcript);
        };

        recognitionRef.current = recognition;
      } catch {
        return;
      }
    } else {
      recognitionRef.current.lang = speechLang;
    }

    try {
      setVoiceMode(true);
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, { role: "user" as const, content: userMsg }].slice(-12);
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

      setMessages((prev) => [...prev, { role: "assistant", content }]);
      speak(content);
    } catch (error) {
      console.error("Copilot Error:", error);
      toast.error(t("connectionError"));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("connectionError") },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          aria-label={t("title")}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 p-0 transition-all duration-300 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
            boxShadow:
              "0 8px 20px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)",
          }}
        >
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6" id="copilot-scroll-container">
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-lg px-4 py-3 text-sm animate-pulse flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("thinking")}
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <div className="p-4 border-t mt-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleListening}
              aria-pressed={isListening}
              className={
                isListening ? "bg-red-100 text-red-600 animate-pulse border-red-200" : ""
              }
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            <Input
              placeholder={isListening ? t("listening") : t("placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const SoniaCopilotProvider = ({ children }: { children: React.ReactNode }) => {
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
