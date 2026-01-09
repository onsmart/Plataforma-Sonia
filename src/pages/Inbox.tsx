import { useEffect, useState, useRef } from "react"
import { 
    MessageSquare, 
    MessageCircle, 
    Phone, 
    Search,
    User,
    Clock,
    Send,
    Bot,
    PauseCircle,
    PlayCircle,
    Loader2
} from "lucide-react"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { AgentService, Conversation, ChatMessage } from "../services/api"
import { toast } from "sonner@2.0.3"

export function Inbox() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [replyText, setReplyText] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Polling for real-time updates (simulated)
    useEffect(() => {
        loadConversations()
        const interval = setInterval(loadConversations, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

    useEffect(() => {
        if (selectedId) {
            loadMessages(selectedId)
            // Poll messages for the active chat faster
            const interval = setInterval(() => loadMessages(selectedId), 3000)
            return () => clearInterval(interval)
        }
    }, [selectedId])

    const loadConversations = async () => {
        const data = await AgentService.listConversations()
        setConversations(data)
    }

    const loadMessages = async (id: string) => {
        const msgs = await AgentService.getConversationMessages(id)
        setMessages(msgs)
    }

    const handleToggleStatus = async () => {
        if (!selectedId) return
        const current = conversations.find(c => c.id === selectedId)
        if (!current) return

        const newStatus = current.status === 'active' ? 'human_takeover' : 'active'
        
        // Optimistic update
        setConversations(prev => prev.map(c => 
            c.id === selectedId ? { ...c, status: newStatus } : c
        ))

        try {
            await AgentService.toggleHandoff(selectedId, newStatus)
            toast.success(newStatus === 'human_takeover' ? "AI Paused. You are in control." : "AI Resumed.")
        } catch (e) {
            toast.error("Failed to update status")
            loadConversations() // Revert
        }
    }

    const handleSend = async () => {
        if (!selectedId || !replyText.trim()) return
        
        setIsSending(true)
        try {
            await AgentService.sendHumanMessage(selectedId, replyText)
            setReplyText("")
            loadMessages(selectedId) // Refresh immediately
        } catch (e) {
            toast.error("Failed to send message")
        } finally {
            setIsSending(false)
        }
    }

    const getChannelIcon = (platform: string) => {
        switch(platform) {
            case 'whatsapp': return <MessageCircle className="h-4 w-4 text-emerald-500" />
            case 'voice': return <Phone className="h-4 w-4 text-purple-500" />
            default: return <MessageSquare className="h-4 w-4 text-blue-500" />
        }
    }

    const formatTime = (iso: string) => {
        if (!iso) return ""
        const date = new Date(iso)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const selectedConversation = conversations.find(c => c.id === selectedId)

    return (
        <div className="flex h-[calc(100vh-2rem)] border rounded-lg overflow-hidden bg-background shadow-sm">
            {/* Sidebar List */}
            <div className="w-80 border-r bg-muted/10 flex flex-col">
                <div className="p-4 border-b space-y-3">
                    <h2 className="font-semibold text-lg">Inbox</h2>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search conversations..." className="pl-8 bg-background" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                        {conversations.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No active conversations found.
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedId(conv.id)}
                                    className={`flex items-start gap-3 p-4 text-left border-b transition-colors hover:bg-muted/50 ${
                                        selectedId === conv.id ? "bg-muted" : ""
                                    }`}
                                >
                                    <Avatar>
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            <User className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium truncate">{conv.userId}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatTime(conv.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mb-1">
                                            {getChannelIcon(conv.platform)}
                                            <span className="capitalize">{conv.platform}</span>
                                            {conv.status === 'human_takeover' && (
                                                <Badge variant="destructive" className="h-4 px-1 ml-1 text-[10px]">
                                                    Paused
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {conv.lastMessage || "No messages"}
                                        </p>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-background">
                {selectedId && selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 border-b flex items-center justify-between px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm">{selectedConversation.userId}</h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className={`flex h-1.5 w-1.5 rounded-full ${selectedConversation.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        {selectedConversation.status === 'active' ? 'AI Active' : 'Human Control'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant={selectedConversation.status === 'active' ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={handleToggleStatus}
                                    className="gap-2"
                                >
                                    {selectedConversation.status === 'active' ? (
                                        <>
                                            <PauseCircle className="h-4 w-4" /> Take Over
                                        </>
                                    ) : (
                                        <>
                                            <PlayCircle className="h-4 w-4" /> Resume AI
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Messages List */}
                        <ScrollArea className="flex-1 p-4 bg-muted/5">
                            <div className="space-y-4 max-w-3xl mx-auto">
                                {messages.map((msg, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        {msg.role === 'user' && (
                                            <Avatar className="h-8 w-8 mt-1">
                                                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-start' : 'items-end'}`}>
                                            <div className={`px-4 py-2.5 rounded-lg text-sm shadow-sm ${
                                                msg.role === 'user' 
                                                    ? 'bg-white border text-slate-800' 
                                                    : 'bg-primary text-primary-foreground'
                                            }`}>
                                                {msg.content}
                                            </div>
                                            {msg.meta?.isHuman && (
                                                <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1">
                                                    Human Agent
                                                </Badge>
                                            )}
                                        </div>
                                        {msg.role !== 'user' && (
                                            <Avatar className="h-8 w-8 mt-1 border bg-muted">
                                                <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 border-t bg-background">
                            <div className="max-w-3xl mx-auto flex gap-2">
                                <Input 
                                    placeholder={selectedConversation.status === 'active' ? "Pause AI to send a message..." : "Type your reply..."}
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    disabled={selectedConversation.status === 'active' || isSending}
                                />
                                <Button 
                                    onClick={handleSend} 
                                    disabled={selectedConversation.status === 'active' || isSending || !replyText.trim()}
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                            {selectedConversation.status === 'active' && (
                                <p className="text-center text-xs text-muted-foreground mt-2">
                                    AI is currently handling this conversation. Click "Take Over" to reply manually.
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Select a conversation to start monitoring.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
