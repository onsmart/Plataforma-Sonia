import React, { useState, createContext, useContext, useEffect } from "react";
// REMOVED ALL EXTERNAL COPILOTKIT IMPORTS TO FIX BUILD
// The environment cannot build the font dependencies of the real package.
// We are implementing a lightweight internal version.

import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "../ui/sheet";
import { Bot, Send, Sparkles, Mic, MicOff } from "lucide-react";
import { Input } from "../ui/input";
import { toast } from "sonner";
// import { ScrollArea } from "../ui/scroll-area"; // Replaced with native scroll for reliability
import { AgentService } from "../../services/api";

// --- MOCK CONTEXT & HOOKS (To replace external library) ---
const CopilotContext = createContext<any>(null);

export const useCopilotReadable = (config: any) => {
    // In a real implementation, this would send data to the AI context.
    // Here we just log it for debugging purposes.
    useEffect(() => {
        // console.log("[SoniaCopilot] Reading context:", config);
    }, [config]);
};

export const useCopilotAction = (config: any) => {
    const { registerAction } = useContext(CopilotContext);
    useEffect(() => {
        if (registerAction) {
            registerAction(config);
        }
    }, [config, registerAction]);
};

// --- ACTIONS LAYER ---
const SoniaCopilotActions = () => {
  const { navigate, currentRoute } = useNavigation();
  const { session } = useAuth();

  useCopilotReadable({
    description: "The current state of the application",
    value: {
      currentRoute,
      user: session?.user?.email,
      availableRoutes: [
        "cockpit", "inbox", "devices", "agents", "playground", 
        "knowledge", "governance", "insights", "configuration", "integrations", "profile"
      ]
    },
  });

  useCopilotAction({
    name: "navigateToPage",
    description: "Navigate to a specific page.",
    parameters: [
      {
        name: "page",
        type: "string",
        description: "The page ID (cockpit, devices, inbox...)",
        required: true,
      },
    ],
    handler: ({ page }: { page: string }) => {
      console.log(`[Copilot] Navigating to ${page}`);
      navigate(page);
      return `Navigated to ${page} successfully.`;
    },
  });

  return null;
};

// --- UI COMPONENT ---
const SoniaCopilotUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([
    { role: 'assistant', content: 'Hello! I am Sonia Copilot. I can help you navigate the platform or analyze data on this screen.' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const recognitionRef = React.useRef<any>(null);
  
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { actions } = useContext(CopilotContext);

  // Initialize Speech Recognition - REMOVED from useEffect to avoid permission issues
  // We will initialize lazily on first user interaction.

  // Cleanup effect
  useEffect(() => {
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };
  }, []);

  const toggleListening = () => {
      // 1. Check browser support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          toast.error("Navegador incompatível com voz.");
          return;
      }

      // 2. Stop if currently listening
      if (isListening) {
          if (recognitionRef.current) recognitionRef.current.stop();
          return;
      }

      // 3. Initialize Recognition if needed (Lazy)
      if (!recognitionRef.current) {
          try {
              const recognition = new SpeechRecognition();
              recognition.continuous = false; // Stop after one sentence for command-like feel
              recognition.interimResults = false;
              recognition.lang = 'pt-BR'; 

              recognition.onstart = () => setIsListening(true);
              recognition.onend = () => setIsListening(false);
              
              recognition.onerror = async (event: any) => {
                  // Handle "not-allowed" gracefully without spamming console errors
                  if (event.error === 'not-allowed') {
                      console.log("Mic access blocked (Sandbox/Permission). Fallback to text.");
                      setIsListening(false);
                      recognitionRef.current = null;
                      
                      // Notify user via chat only, no error toast
                      setMessages(prev => [...prev, { 
                          role: 'assistant', 
                          content: "🔇 **Modo Silencioso Ativo**\n\nO acesso ao microfone está bloqueado neste ambiente (Preview). A conversa continuará via texto." 
                      }]);
                      return;
                  }

                  console.warn("Speech Recognition Error:", event.error);

                  if (event.error === 'no-speech') {
                      // Ignore silence
                      return;
                  } else {
                      toast.error(`Erro de Voz: ${event.error}`);
                  }
                  
                  setIsListening(false);
                  // Force cleanup to ensure fresh instance next time
                  recognitionRef.current = null;
              };

              recognition.onresult = (event: any) => {
                  const transcript = event.results[0][0].transcript;
                  if (transcript) {
                      setInput(transcript);
                  }
              };
              recognitionRef.current = recognition;
          } catch (e) {
              console.error("Init error", e);
              return;
          }
      }

      // 4. Start Recognition
      try {
          setVoiceMode(true); 
          recognitionRef.current.start();
      } catch (err) {
          // If already started or other race condition
          setIsListening(false);
      }
  };

  const speak = (text: string) => {
      if (!voiceMode) return;
      
      const utterance = new SpeechSynthesisUtterance(text);
      // Clean up text (remove markdown like **bold**)
      utterance.text = text.replace(/\*\*/g, '').replace(/\[.*?\]/g, ''); 
      window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
        // Send to Backend LLM (Sonia Copilot Agent)
        const response = await AgentService.chatWithCopilot([
            ...messages.slice(-5), // Keep limited context
            { role: 'user', content: userMsg }
        ], { channel: 'webchat' });

        let content = response.content;

        // Check for Navigation Command [NAVIGATE: page_id]
        const navMatch = content.match(/\[NAVIGATE: (.*?)\]/);
        if (navMatch && navMatch[1]) {
            const page = navMatch[1].trim();
            const navAction = actions.find((a: any) => a.name === "navigateToPage");
            
            if (navAction) {
                navAction.handler({ page });
                // Clean the message for the user
                content = content.replace(/\[NAVIGATE: .*?\]/, "").trim();
                if (!content) content = `Navigating to ${page}...`;
            }
        }

        setMessages(prev => [...prev, { role: 'assistant', content }]);
        speak(content); // Speak response if voice mode is active
    } catch (error) {
        console.error("Copilot Error:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the server. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 p-0 transition-all duration-300 hover:scale-105"
            style={{
                background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                boxShadow: '0 8px 20px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(8, 145, 178, 0.6), 0 0 30px rgba(34, 211, 238, 0.5)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
            }}
        >
            <Sparkles className="h-6 w-6 text-white" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Sonia AI Copilot
          </SheetTitle>
          <SheetDescription>
            Your AI assistant for navigating and managing the SONIA platform.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6" id="copilot-scroll-container">
            <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                            m.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted text-muted-foreground rounded-lg px-4 py-3 text-sm animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>
        </div>

        <div className="p-4 border-t mt-auto">
            <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
            >
                <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleListening}
                    className={isListening ? "bg-red-100 text-red-600 animate-pulse border-red-200" : ""}
                >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                
                <Input 
                    placeholder={isListening ? "Ouvindo..." : "Digite 'Ir para Inbox'..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isLoading}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// --- MAIN PROVIDER ---
export const SoniaCopilotProvider = ({ children }: { children: React.ReactNode }) => {
  const [actions, setActions] = useState<any[]>([]);

  const registerAction = (action: any) => {
      setActions(prev => {
          // Avoid duplicates
          if (prev.find(a => a.name === action.name)) return prev;
          return [...prev, action];
      });
  };

  return (
    <CopilotContext.Provider value={{ actions, registerAction }}>
      <SoniaCopilotActions />
      {children}
      <SoniaCopilotUI />
    </CopilotContext.Provider>
  );
};
