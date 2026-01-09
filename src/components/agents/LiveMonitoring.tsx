import { useState } from "react"
import { 
    Search, 
    Filter, 
    MoreHorizontal, 
    MessageSquare, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Smartphone, 
    Mail, 
    Globe,
    Eye,
    Hand,
    Bot
} from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

// Mock Data for UI Development
const MOCK_SESSIONS = [
    {
        id: "sess_1",
        customer: "Alice Freeman",
        customerInitial: "AF",
        agent: "Sonia Support",
        agentAvatar: "S",
        channel: "whatsapp",
        status: "active",
        duration: "4m 20s",
        sentiment: "positive",
        lastMessage: "That completely solved my issue, thanks!",
        topic: "Login Issue"
    },
    {
        id: "sess_2",
        customer: "TechCorp Inc.",
        customerInitial: "T",
        agent: "Marcus Sales",
        agentAvatar: "M",
        channel: "email",
        status: "waiting_user",
        duration: "2h 15m",
        sentiment: "neutral",
        lastMessage: "Sent proposal PDF. Awaiting confirmation.",
        topic: "Enterprise Plan"
    },
    {
        id: "sess_3",
        customer: "John Doe",
        customerInitial: "JD",
        agent: "Sonia Support",
        agentAvatar: "S",
        channel: "webchat",
        status: "active",
        duration: "12m 05s",
        sentiment: "negative",
        lastMessage: "I've been waiting for 10 minutes...",
        topic: "Billing Dispute"
    },
    {
        id: "sess_4",
        customer: "+55 11 9999...",
        customerInitial: "#",
        agent: "Voice Concierge",
        agentAvatar: "V",
        channel: "phone",
        status: "active",
        duration: "45s",
        sentiment: "neutral",
        lastMessage: "[Voice Transcribing...]",
        topic: "Inbound Call"
    },
    {
        id: "sess_5",
        customer: "Sarah Connor",
        customerInitial: "SC",
        agent: "Marcus Sales",
        agentAvatar: "M",
        channel: "linkedin",
        status: "completed",
        duration: "15m",
        sentiment: "positive",
        lastMessage: "Meeting scheduled for Tuesday.",
        topic: "Demo Request"
    }
]

export function LiveMonitoring() {
    const [searchTerm, setSearchTerm] = useState("")

    const getChannelIcon = (channel: string) => {
        switch(channel) {
            case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-500" />;
            case 'webchat': return <Globe className="h-4 w-4 text-blue-500" />;
            case 'email': return <Mail className="h-4 w-4 text-yellow-500" />;
            case 'linkedin': return <Smartphone className="h-4 w-4 text-blue-700" />;
            case 'phone': return <Smartphone className="h-4 w-4 text-red-500" />;
            default: return <Bot className="h-4 w-4" />;
        }
    }

    const getSentimentBadge = (sentiment: string) => {
        switch(sentiment) {
            case 'positive': 
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Positive</Badge>;
            case 'negative': 
                return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">Negative</Badge>;
            default: 
                return <Badge variant="secondary">Neutral</Badge>;
        }
    }

    return (
        <div className="space-y-6">
            {/* Real-time Headers */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                        <MessageSquare className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">
                            4 agents currently engaged
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">24s</div>
                        <p className="text-xs text-muted-foreground">
                            Within SLA (&lt; 1m)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical Sentiment</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">1</div>
                        <p className="text-xs text-muted-foreground">
                            Requires attention
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">94%</div>
                        <p className="text-xs text-muted-foreground">
                            Last hour
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by customer, agent or topic..." 
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filter
                    </Button>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Topic</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sentiment</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {MOCK_SESSIONS.map((session) => (
                            <TableRow key={session.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{session.customerInitial}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span>{session.customer}</span>
                                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">
                                                {session.lastMessage}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2" title={session.channel}>
                                        {getChannelIcon(session.channel)}
                                        <span className="capitalize text-xs text-muted-foreground hidden md:inline-block">{session.channel}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                {session.agentAvatar}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{session.agent}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-normal">
                                        {session.topic}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {session.status === 'active' && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Active" />}
                                    {session.status === 'waiting_user' && <span className="flex h-2 w-2 rounded-full bg-yellow-500" title="Waiting User" />}
                                    {session.status === 'completed' && <span className="flex h-2 w-2 rounded-full bg-muted-foreground" title="Completed" />}
                                </TableCell>
                                <TableCell>
                                    {getSentimentBadge(session.sentiment)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground font-mono">
                                    {session.duration}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Live Peek
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-orange-600">
                                                <Hand className="mr-2 h-4 w-4" />
                                                Human Takeover
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">
                                                Force End Session
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
