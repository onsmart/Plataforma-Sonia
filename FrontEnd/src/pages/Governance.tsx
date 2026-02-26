import { useState, useEffect } from "react"
import { 
    Shield, 
    Lock, 
    EyeOff, 
    FileText, 
    AlertTriangle, 
    Activity, 
    CheckCircle2, 
    Siren,
    History,
    Fingerprint,
    Save,
    RotateCcw,
    Loader2,
    Camera,
    Zap
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Switch } from "../components/ui/switch"
import { Label } from "../components/ui/label"
import { Slider } from "../components/ui/slider"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Separator } from "../components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { AgentService, GovernanceConfig } from "../services/api"
import { useTheme } from "next-themes"
import { CreditCard, Mail, Phone, User, Clock, Lock as LockIcon, Unlock } from "lucide-react"
import { Textarea } from "../components/ui/textarea"

export function Governance() {
    const { theme } = useTheme()
    const [config, setConfig] = useState<GovernanceConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [auditLogs, setAuditLogs] = useState<any[]>([])
    const [testInputs, setTestInputs] = useState<{[key: string]: string}>({})
    const [testResults, setTestResults] = useState<{[key: string]: boolean}>({})
    const [chatLogsRetention, setChatLogsRetention] = useState(90)
    const [voiceRetention, setVoiceRetention] = useState(30)
    const [previewMessage, setPreviewMessage] = useState("Olá, meu cartão é 4444 5555 6666 7777, email: teste@exemplo.com, telefone: (11) 98765-4321 e CPF: 123.456.789-00")

    useEffect(() => {
        loadConfig()
        loadLogs()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        const data = await AgentService.getGovernanceConfig()
        setConfig(data)
        setLoading(false)
    }

    const loadLogs = async () => {
        const data = await AgentService.getDashboardStats()
        if (data?.activityFeed) {
             // Map backend logs to UI format
             const mapped = data.activityFeed.map((log: any) => ({
                 id: log.id || Math.random().toString(),
                 user: log.agent || 'System',
                 action: log.platform === 'IoT' ? 'IoT Action' : 'System Event',
                 resource: log.platform, 
                 details: log.action,
                 time: new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                 status: log.type === 'warning' ? 'warning' : log.type === 'error' ? 'danger' : 'success'
             }))
             setAuditLogs(mapped)
        }
    }

    const handleSave = async () => {
        if (!config) return
        setIsSaving(true)
        try {
            await AgentService.updateGovernanceConfig(config)
            // Simulate audit log update visual feedback
        } catch (error) {
            console.error("Failed to save", error)
        } finally {
            setIsSaving(false)
        }
    }

    const updateThreshold = (key: keyof GovernanceConfig['safetyThresholds'], value: number[]) => {
        if (!config) return
        setConfig({
            ...config,
            safetyThresholds: { ...config.safetyThresholds, [key]: value[0] }
        })
    }

    const updateFilter = (key: keyof GovernanceConfig['filters'], value: boolean) => {
        if (!config) return
        setConfig({
            ...config,
            filters: { ...config.filters, [key]: value }
        })
    }

    const updateDlp = (key: keyof GovernanceConfig['dlp'], value: boolean) => {
        if (!config) return
        setConfig({
            ...config,
            dlp: { ...config.dlp, [key]: value }
        })
    }

    // Calcular Safety Score em tempo real
    const calculateSafetyScore = () => {
        if (!config) return { score: 0, grade: 'F', color: '#ef4444', percentage: 0 }
        
        let totalScore = 0
        let maxScore = 0
        
        // Sliders (0-100, cada um vale 25 pontos)
        const thresholds = config.safetyThresholds
        totalScore += (thresholds.hateSpeech / 100) * 25
        totalScore += (thresholds.sexualContent / 100) * 25
        totalScore += (thresholds.dangerousContent / 100) * 25
        maxScore += 75
        
        // Filters (cada um vale 8.33 pontos)
        if (config.filters.competitorBlocking) totalScore += 8.33
        if (config.filters.antiHallucination) totalScore += 8.33
        if (config.filters.jailbreakProtection) totalScore += 8.33
        maxScore += 25
        
        const percentage = (totalScore / maxScore) * 100
        
        let grade = 'F'
        let color = '#ef4444'
        
        if (percentage >= 95) { grade = 'A+'; color = '#10b981' }
        else if (percentage >= 90) { grade = 'A'; color = '#10b981' }
        else if (percentage >= 85) { grade = 'A-'; color = '#84cc16' }
        else if (percentage >= 80) { grade = 'B+'; color = '#84cc16' }
        else if (percentage >= 75) { grade = 'B'; color = '#eab308' }
        else if (percentage >= 70) { grade = 'B-'; color = '#eab308' }
        else if (percentage >= 65) { grade = 'C+'; color = '#f59e0b' }
        else if (percentage >= 60) { grade = 'C'; color = '#f59e0b' }
        else if (percentage >= 55) { grade = 'C-'; color = '#f97316' }
        else if (percentage >= 50) { grade = 'D'; color = '#f97316' }
        else { grade = 'F'; color = '#ef4444' }
        
        return { score: totalScore, grade, color, percentage }
    }

    // Função para obter label do slider baseado no valor
    const getSliderLabel = (value: number) => {
        if (value < 30) return { label: 'Permissivo', color: '#10b981' }
        if (value < 60) return { label: 'Padrão', color: '#eab308' }
        if (value < 85) return { label: 'Rigoroso', color: '#f59e0b' }
        return { label: 'Bloqueio Total', color: '#ef4444' }
    }

    // Função para testar regras
    const testRule = (ruleKey: string, input: string) => {
        if (!input.trim()) {
            setTestResults({ ...testResults, [ruleKey]: false })
            return
        }
        
        const lowerInput = input.toLowerCase()
        let blocked = false
        
        if (ruleKey === 'competitorBlocking') {
            blocked = /concorrente|competidor|rival|adversário/i.test(lowerInput)
        } else if (ruleKey === 'antiHallucination') {
            blocked = /informação não encontrada|não sei|não tenho essa informação/i.test(lowerInput)
        } else if (ruleKey === 'jailbreakProtection') {
            blocked = /ignore|forget|system|prompt|override/i.test(lowerInput)
        }
        
        setTestResults({ ...testResults, [ruleKey]: blocked })
    }

    // Contar dados protegidos
    const getProtectedDataCount = () => {
        if (!config) return 0
        return Object.values(config.dlp).filter(Boolean).length
    }

    // Simular redaction no preview
    const getRedactedMessage = (message: string) => {
        if (!config) return message
        
        let redacted = message
        
        // Credit Card - padrões mais flexíveis
        if (config.dlp.creditCard) {
            // Detecta números de cartão com ou sem espaços/hífens
            redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '**** **** **** 7777')
            // Também detecta sequências de 13-19 dígitos (cartões variados)
            redacted = redacted.replace(/\b\d{13,19}\b/g, (match) => {
                if (match.length >= 13 && match.length <= 19) {
                    return '**** **** **** ' + match.slice(-4)
                }
                return match
            })
        }
        
        // Email
        if (config.dlp.email) {
            redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL PROTEGIDO]')
        }
        
        // Phone - padrões brasileiros e internacionais
        if (config.dlp.phone) {
            // Formato brasileiro: (XX) XXXXX-XXXX ou XX XXXXXXXX
            redacted = redacted.replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[\s-]?\d{4}\b/g, '[TELEFONE PROTEGIDO]')
            // Formato internacional genérico
            redacted = redacted.replace(/\b\+?\d{1,3}[\s-]?\d{2,4}[\s-]?\d{4,9}\b/g, '[TELEFONE PROTEGIDO]')
        }
        
        // SSN/CPF - formato brasileiro
        if (config.dlp.ssn) {
            // CPF: XXX.XXX.XXX-XX ou XXXXXXXXXXX
            redacted = redacted.replace(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/g, '[CPF PROTEGIDO]')
            // SSN americano: XXX-XX-XXXX
            redacted = redacted.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, '[SSN PROTEGIDO]')
        }
        
        return redacted
    }

    const safetyScore = calculateSafetyScore()
    const protectedCount = getProtectedDataCount()
    const allProtected = protectedCount === 4
    const noneProtected = protectedCount === 0

    if (loading || !config) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#F8FAFC',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <style>{`
                [data-state="active"][data-slot="tabs-trigger"] {
                    background: linear-gradient(135deg, #0891b2 0%, #22d3ee 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 8px 20px rgba(8, 145, 178, 0.4) !important;
                }
                
                @keyframes pulse-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.6));
                    }
                    50% {
                        filter: drop-shadow(0 0 20px rgba(16, 185, 129, 1));
                    }
                }
                
                @keyframes pulse-critical {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                    }
                    50% {
                        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
                    }
                }
                
                /* Sliders ciano */
                [data-slot="slider-range"] {
                    background: linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%) !important;
                }
                
                [data-slot="slider-thumb"] {
                    border-color: #06b6d4 !important;
                    background: #ffffff !important;
                    box-shadow: 0 0 0 2px #06b6d4, 0 2px 8px rgba(6, 182, 212, 0.3) !important;
                }
                
                [data-slot="slider-thumb"]:hover {
                    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.2), 0 4px 12px rgba(6, 182, 212, 0.4) !important;
                }
                
                [data-slot="slider-thumb"]:focus-visible {
                    ring-color: #06b6d4 !important;
                    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.3), 0 4px 12px rgba(6, 182, 212, 0.5) !important;
                }
            `}</style>
            {/* Header com Safety Score Gauge */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-3xl font-black tracking-tight" style={{
                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                    }}>Governance & Security</h2>
                    <p className="text-muted-foreground mt-2">
                        Manage AI guardrails, data protection policies, and compliance logs.
                    </p>
                </div>
                
                {/* Safety Score Gauge Circular */}
                <Card className="relative overflow-visible border-2" style={{
                    borderRadius: '3rem',
                    borderColor: safetyScore.color + '40',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    padding: '2rem',
                    minWidth: '200px',
                    boxShadow: `0 0 30px ${safetyScore.color}30, 0 20px 40px rgba(0,0,0,0.1)`
                }}>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-32 h-32">
                            <svg className="transform -rotate-90 w-32 h-32">
                                {/* Background circle */}
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    fill="none"
                                    stroke={theme === 'dark' ? '#334155' : '#e2e8f0'}
                                    strokeWidth="12"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    fill="none"
                                    stroke={safetyScore.color}
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 56}`}
                                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - safetyScore.percentage / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'all 0.5s ease' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="text-4xl font-black" style={{ color: safetyScore.color }}>
                                    {safetyScore.grade}
                                </div>
                                <div className="text-xs font-bold text-muted-foreground mt-1">
                                    {safetyScore.percentage.toFixed(0)}%
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Safety Score</p>
                            <div className="flex items-center gap-2 mt-1 justify-center">
                                <Shield className="h-4 w-4" style={{ color: safetyScore.color }} />
                                <span className="text-sm font-bold" style={{ color: safetyScore.color }}>
                                    {safetyScore.grade === 'A+' ? 'Excelente' : 
                                     safetyScore.grade.startsWith('A') ? 'Muito Bom' :
                                     safetyScore.grade.startsWith('B') ? 'Bom' :
                                     safetyScore.grade.startsWith('C') ? 'Atenção' : 'Crítico'}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Tabs defaultValue="guardrails" className="space-y-4">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full">
                    <TabsTrigger 
                        value="guardrails"
                        className="rounded-full font-black text-xs uppercase tracking-wider px-6 h-10 transition-all"
                        style={{
                            backgroundColor: 'transparent',
                            color: theme === 'dark' ? '#94a3b8' : '#64748b'
                        }}
                    >
                        AI Guardrails
                    </TabsTrigger>
                    <TabsTrigger 
                        value="privacy"
                        className="rounded-full font-black text-xs uppercase tracking-wider px-6 h-10 transition-all"
                        style={{
                            backgroundColor: 'transparent',
                            color: theme === 'dark' ? '#94a3b8' : '#64748b'
                        }}
                    >
                        Data Privacy (DLP)
                    </TabsTrigger>
                </TabsList>

                {/* ---------------- GUARDRAILS TAB ---------------- */}
                <TabsContent value="guardrails" className="space-y-4">
                    <Alert style={{
                        borderRadius: '2rem',
                        backgroundColor: theme === 'dark' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.05)',
                        borderColor: 'rgba(6, 182, 212, 0.3)',
                        borderWidth: '2px'
                    }}>
                        <Shield className="h-4 w-4" style={{ color: '#06b6d4' }} />
                        <AlertTitle className="font-black" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                            Global Policy Active
                        </AlertTitle>
                        <AlertDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                            These settings apply to all agents. Specific agent overrides can be configured in the Agents Hub.
                        </AlertDescription>
                    </Alert>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Content Moderation */}
                        <Card className="col-span-2" style={{
                            borderRadius: '3rem',
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                            border: `2px solid ${theme === 'dark' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`,
                            boxShadow: theme === 'dark' ? '0 0 20px rgba(6, 182, 212, 0.1)' : '0 10px 25px rgba(0,0,0,0.05)'
                        }}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-black" style={{
                                    color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                }}>
                                    <Siren className="h-5 w-5" style={{ color: '#06b6d4' }} />
                                    Content Moderation Filters
                                </CardTitle>
                                <CardDescription>
                                    Configure sensitivity thresholds for blocking harmful or inappropriate content.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-6">
                                    {[
                                        { key: 'hateSpeech', label: 'Hate Speech & Harassment', desc: 'Blocks any content that could be construed as offensive or discriminatory.', icon: AlertTriangle },
                                        { key: 'sexualContent', label: 'Sexual Content', desc: 'Filters inappropriate sexual content and explicit material.', icon: EyeOff },
                                        { key: 'dangerousContent', label: 'Self-Harm & Violence', desc: 'Detects and blocks content promoting self-harm or violence.', icon: Siren }
                                    ].map((item) => {
                                        const value = config.safetyThresholds[item.key as keyof typeof config.safetyThresholds]
                                        const sliderInfo = getSliderLabel(value)
                                        const Icon = item.icon
                                        
                                        return (
                                            <div key={item.key} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Icon 
                                                            className="h-5 w-5" 
                                                            style={{ color: sliderInfo.color }}
                                                        />
                                                        <Label className="font-bold">{item.label}</Label>
                                                    </div>
                                                    <Badge 
                                                        variant="outline" 
                                                        style={{
                                                            color: sliderInfo.color,
                                                            borderColor: sliderInfo.color + '40',
                                                            backgroundColor: sliderInfo.color + '10'
                                                        }}
                                                    >
                                                        {sliderInfo.label}
                                                    </Badge>
                                                </div>
                                                <div className="relative">
                                                    {/* Gradiente de risco no fundo */}
                                                    <div 
                                                        className="absolute h-2 rounded-full w-full"
                                                        style={{
                                                            background: 'linear-gradient(to right, #10b981 0%, #eab308 30%, #f59e0b 60%, #ef4444 100%)',
                                                            opacity: 0.2
                                                        }}
                                                    />
                                                    <Slider 
                                                        value={[value]} 
                                                        onValueChange={(v) => updateThreshold(item.key as keyof GovernanceConfig['safetyThresholds'], v)}
                                                        max={100} 
                                                        step={1}
                                                        className="relative z-10"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Business Rules - Cards de Proteção */}
                        <div className="col-span-1 space-y-4">
                            {[
                                { 
                                    key: 'competitorBlocking', 
                                    title: 'Competitor Blocking', 
                                    desc: 'Deflects mentions of rivals',
                                    icon: Shield,
                                    testPlaceholder: 'Ex: "Me fale do concorrente X"'
                                },
                                { 
                                    key: 'antiHallucination', 
                                    title: 'Anti-Hallucination', 
                                    desc: 'Strict RAG adherence',
                                    icon: FileText,
                                    testPlaceholder: 'Ex: "Informação não encontrada"'
                                },
                                { 
                                    key: 'jailbreakProtection', 
                                    title: 'Jailbreak Protection', 
                                    desc: 'Detects prompt injection',
                                    icon: Lock,
                                    testPlaceholder: 'Ex: "Ignore previous instructions"'
                                }
                            ].map((rule) => {
                                const isActive = config.filters[rule.key as keyof typeof config.filters]
                                const Icon = rule.icon
                                const testResult = testResults[rule.key]
                                
                                return (
                                    <Card 
                                        key={rule.key}
                                        className="cursor-pointer transition-all"
                                        style={{
                                            borderRadius: '2.5rem',
                                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                            border: `2px solid ${isActive ? (theme === 'dark' ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.3)') : 'rgba(148, 163, 184, 0.2)'}`,
                                            boxShadow: isActive 
                                                ? `0 0 30px ${theme === 'dark' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}, 0 10px 25px rgba(0,0,0,0.1)`
                                                : '0 4px 12px rgba(0,0,0,0.05)',
                                            transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                                        }}
                                        onClick={() => updateFilter(rule.key as keyof GovernanceConfig['filters'], !isActive)}
                                    >
                                        <CardContent className="p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="p-3 rounded-2xl flex items-center justify-center"
                                                        style={{
                                                            backgroundColor: isActive 
                                                                ? (theme === 'dark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)')
                                                                : (theme === 'dark' ? '#334155' : '#f1f5f9')
                                                        }}
                                                    >
                                                        <Icon 
                                                            className="h-5 w-5" 
                                                            style={{ 
                                                                color: isActive ? '#06b6d4' : (theme === 'dark' ? '#64748b' : '#94a3b8')
                                                            }} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-sm" style={{
                                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                                        }}>{rule.title}</h4>
                                                        <p className="text-xs text-muted-foreground">{rule.desc}</p>
                                                    </div>
                                                </div>
                                                <Switch 
                                                    checked={isActive}
                                                    onCheckedChange={(v) => updateFilter(rule.key as keyof GovernanceConfig['filters'], v)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            
                                            {/* Campo de Teste */}
                                            {isActive && (
                                                <div className="space-y-2 pt-2 border-t">
                                                    <Label className="text-xs font-bold">Testar Regra</Label>
                                                    <Textarea
                                                        placeholder={rule.testPlaceholder}
                                                        value={testInputs[rule.key] || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            setTestInputs({ ...testInputs, [rule.key]: value })
                                                            testRule(rule.key, value)
                                                        }}
                                                        className="text-xs min-h-[60px]"
                                                        style={{
                                                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                                            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                                                        }}
                                                    />
                                                    {testInputs[rule.key] && (
                                                        <div className={`p-2 rounded-xl text-xs font-bold ${
                                                            testResult 
                                                                ? 'bg-red-500/10 text-red-600 border border-red-500/20' 
                                                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                        }`}>
                                                            {testResult 
                                                                ? '⚠️ Regra de Bloqueio Ativada!' 
                                                                : '✓ Mensagem permitida'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                            
                            <Button 
                                className="w-full" 
                                style={{
                                    background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                    color: '#ffffff',
                                    borderRadius: '2rem',
                                    border: 'none',
                                    boxShadow: '0 8px 20px rgba(8, 145, 178, 0.4)'
                                }}
                                onClick={handleSave} 
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" /> Salvar Políticas
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* ---------------- PRIVACY TAB ---------------- */}
                <TabsContent value="privacy" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="md:col-span-2" style={{
                            borderRadius: '3rem',
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                            border: `2px solid ${theme === 'dark' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`,
                            boxShadow: theme === 'dark' ? '0 0 20px rgba(6, 182, 212, 0.1)' : '0 10px 25px rgba(0,0,0,0.05)'
                        }}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 font-black" style={{
                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                        }}>
                                            <Lock className="h-5 w-5" style={{ color: '#06b6d4' }} />
                                            PII Redaction (DLP)
                                        </CardTitle>
                                        <CardDescription className="mt-2">
                                            Automatically detect and mask sensitive information in logs and analytics.
                                        </CardDescription>
                                    </div>
                                    
                                    {/* Visual "Cofre" - Contador com Glow Dinâmico */}
                                    <Card className="p-4 border-2 relative overflow-visible" style={{
                                        borderRadius: '2rem',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                        borderColor: allProtected ? '#10b981' : (noneProtected ? '#64748b' : '#06b6d4'),
                                        boxShadow: allProtected 
                                            ? `0 0 40px rgba(16, 185, 129, 0.5), inset 0 0 20px rgba(16, 185, 129, 0.2)`
                                            : (noneProtected 
                                                ? 'none'
                                                : `0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.1)`)
                                    }}>
                                        <div className="flex flex-col items-center gap-2">
                                            {noneProtected ? (
                                                <Unlock 
                                                    className="h-8 w-8 transition-all" 
                                                    style={{ 
                                                        color: '#64748b',
                                                        opacity: 0.6
                                                    }} 
                                                />
                                            ) : (
                                                <Lock 
                                                    className="h-8 w-8 transition-all" 
                                                    style={{ 
                                                        color: allProtected ? '#10b981' : '#06b6d4',
                                                        filter: allProtected 
                                                            ? 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.8))'
                                                            : 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.6))',
                                                        animation: allProtected ? 'pulse-glow 2s ease-in-out infinite' : 'none'
                                                    }} 
                                                />
                                            )}
                                            <div className="text-center">
                                                <div className="text-2xl font-black transition-colors" style={{ 
                                                    color: allProtected ? '#10b981' : (noneProtected ? '#64748b' : '#06b6d4')
                                                }}>
                                                    {protectedCount}
                                                </div>
                                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    Protegidos
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {[
                                        { id: "creditCard", label: "Credit Card Numbers", desc: "Masks PAN sequences (VISA, MC, AMEX)", icon: CreditCard, color: '#10b981' },
                                        { id: "ssn", label: "National IDs (CPF/SSN)", desc: "Masks government identification numbers", icon: User, color: '#10b981' },
                                        { id: "email", label: "Email Addresses", desc: "Masks email formats in conversation logs", icon: Mail, color: '#10b981' },
                                        { id: "phone", label: "Phone Numbers", desc: "Masks detected phone numbers", icon: Phone, color: '#10b981' },
                                    ].map((item) => {
                                        const isActive = config.dlp[item.id as keyof GovernanceConfig['dlp']]
                                        const Icon = item.icon
                                        
                                        return (
                                            <div 
                                                key={item.id} 
                                                className="flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer"
                                                style={{
                                                    backgroundColor: isActive 
                                                        ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)')
                                                        : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                                                    border: `2px solid ${isActive ? item.color + '40' : 'rgba(148, 163, 184, 0.2)'}`,
                                                    boxShadow: isActive ? `0 0 15px ${item.color}20` : 'none'
                                                }}
                                                onClick={() => updateDlp(item.id as keyof GovernanceConfig['dlp'], !isActive)}
                                            >
                                                <div className="flex gap-3 items-center flex-1">
                                                    <div 
                                                        className="p-3 rounded-xl flex items-center justify-center"
                                                        style={{
                                                            backgroundColor: isActive ? item.color + '20' : (theme === 'dark' ? '#334155' : '#f1f5f9')
                                                        }}
                                                    >
                                                        <Icon 
                                                            className="h-5 w-5" 
                                                            style={{ 
                                                                color: isActive ? item.color : (theme === 'dark' ? '#64748b' : '#94a3b8'),
                                                                filter: isActive ? 'drop-shadow(0 0 8px ' + item.color + '60)' : 'none',
                                                                transition: 'all 0.3s'
                                                            }} 
                                                        />
                                                    </div>
                                                    <Label htmlFor={item.id} className="flex flex-col gap-1 cursor-pointer flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold" style={{
                                                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                                            }}>{item.label}</span>
                                                            {isActive && (
                                                                <Badge 
                                                                    className="text-[9px] px-2 py-0.5"
                                                                    style={{
                                                                        backgroundColor: item.color + '20',
                                                                        color: item.color,
                                                                        borderColor: item.color + '40',
                                                                        borderRadius: '1rem'
                                                                    }}
                                                                >
                                                                    Ativo
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="font-normal text-xs text-muted-foreground">{item.desc}</span>
                                                    </Label>
                                                </div>
                                                <Switch 
                                                    id={item.id} 
                                                    checked={isActive} 
                                                    onCheckedChange={(v) => updateDlp(item.id as keyof GovernanceConfig['dlp'], v)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                                
                                {/* Simulador de Redaction - Preview */}
                                <Card className="mt-6" style={{
                                    borderRadius: '2rem',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                    border: `2px solid ${theme === 'dark' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`
                                }}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-black flex items-center gap-2" style={{
                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                        }}>
                                            <EyeOff className="h-4 w-4" style={{ color: '#06b6d4' }} />
                                            Preview de Proteção
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Veja como os dados sensíveis são protegidos em tempo real
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="p-4 rounded-xl" style={{
                                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`
                                        }}>
                                            <div className="flex items-start gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    U
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium mb-1" style={{
                                                        color: theme === 'dark' ? '#cbd5e1' : '#475569'
                                                    }}>Usuário</p>
                                                    <Input
                                                        value={previewMessage}
                                                        onChange={(e) => setPreviewMessage(e.target.value)}
                                                        placeholder="Digite uma mensagem com dados sensíveis..."
                                                        className="text-sm"
                                                        style={{
                                                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                                            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                                                            borderRadius: '1rem'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 rounded-xl" style={{
                                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`
                                        }}>
                                            <div className="flex items-start gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white shrink-0">
                                                    <Shield className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium mb-1 flex items-center gap-2" style={{
                                                        color: theme === 'dark' ? '#cbd5e1' : '#475569'
                                                    }}>
                                                        Sonia AI
                                                        {protectedCount > 0 && (
                                                            <Badge className="text-[9px] px-2 py-0.5" style={{
                                                                backgroundColor: '#10b981' + '20',
                                                                color: '#10b981',
                                                                borderColor: '#10b981' + '40',
                                                                borderRadius: '1rem'
                                                            }}>
                                                                Protegendo
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-sm" style={{
                                                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        {getRedactedMessage(previewMessage)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </CardContent>
                            <CardFooter className="bg-muted/20 border-t p-4 flex justify-between items-center" style={{
                                borderRadius: '0 0 3rem 3rem'
                            }}>
                                <span className="text-xs text-muted-foreground">Changes apply immediately to new sessions.</span>
                                <Button 
                                    size="sm" 
                                    onClick={handleSave} 
                                    disabled={isSaving}
                                    style={{
                                        background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                        color: '#ffffff',
                                        border: 'none'
                                    }}
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isSaving ? "Salvando..." : "Salvar Políticas"}
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card className="relative overflow-hidden" style={{
                            borderRadius: '3rem',
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                            border: `2px solid ${theme === 'dark' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}`,
                            boxShadow: theme === 'dark' ? '0 0 20px rgba(6, 182, 212, 0.1)' : '0 10px 25px rgba(0,0,0,0.05)',
                            backgroundImage: theme === 'dark' 
                                ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(15, 23, 42, 1) 100%), repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(6, 182, 212, 0.03) 20px, rgba(6, 182, 212, 0.03) 21px)'
                                : 'linear-gradient(135deg, rgba(6, 182, 212, 0.02) 0%, rgba(255, 255, 255, 1) 100%), repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(6, 182, 212, 0.02) 20px, rgba(6, 182, 212, 0.02) 21px)'
                        }}>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-xl" style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)'
                                    }}>
                                        <Clock className="h-5 w-5" style={{ color: '#06b6d4' }} />
                                    </div>
                                    <div>
                                        <CardTitle className="font-black" style={{
                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                        }}>Data Retention</CardTitle>
                                        <CardDescription>Compliance policies</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="font-bold flex items-center gap-2">
                                            <LockIcon className="h-4 w-4" style={{ color: '#06b6d4' }} />
                                            Chat Logs Retention
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                value={chatLogsRetention === 9999 ? '' : chatLogsRetention}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 9999 : Number(e.target.value)
                                                    setChatLogsRetention(val)
                                                }}
                                                placeholder={chatLogsRetention === 9999 ? 'Eterno' : undefined}
                                                className="w-20"
                                                style={{
                                                    borderRadius: '1rem',
                                                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                                                }}
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {chatLogsRetention === 9999 ? 'Eterno' : 'Days'}
                                            </span>
                                        </div>
                                        {/* Atalhos de Compliance */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {[
                                                { days: 7, label: '7 dias' },
                                                { days: 30, label: '30 dias' },
                                                { days: 90, label: '90 dias' },
                                                { days: 365, label: '1 ano' },
                                                { days: 9999, label: 'Eterno' }
                                            ].map((item) => (
                                                <Button
                                                    key={item.days}
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs h-7 px-3"
                                                    style={{
                                                        borderRadius: '1rem',
                                                        backgroundColor: chatLogsRetention === item.days 
                                                            ? (theme === 'dark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)')
                                                            : 'transparent',
                                                        borderColor: chatLogsRetention === item.days 
                                                            ? '#06b6d4' 
                                                            : (theme === 'dark' ? '#334155' : '#e2e8f0'),
                                                        color: chatLogsRetention === item.days 
                                                            ? '#06b6d4' 
                                                            : (theme === 'dark' ? '#cbd5e1' : '#64748b')
                                                    }}
                                                    onClick={() => setChatLogsRetention(item.days)}
                                                >
                                                    {item.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="font-bold flex items-center gap-2">
                                            <LockIcon className="h-4 w-4" style={{ color: '#06b6d4' }} />
                                            Voice Recordings
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                value={voiceRetention === 9999 ? '' : voiceRetention}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 9999 : Number(e.target.value)
                                                    setVoiceRetention(val)
                                                }}
                                                placeholder={voiceRetention === 9999 ? 'Eterno' : undefined}
                                                className="w-20"
                                                style={{
                                                    borderRadius: '1rem',
                                                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                                                }}
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {voiceRetention === 9999 ? 'Eterno' : 'Days'}
                                            </span>
                                        </div>
                                        {/* Atalhos de Compliance */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {[
                                                { days: 7, label: '7 dias' },
                                                { days: 30, label: '30 dias' },
                                                { days: 90, label: '90 dias' },
                                                { days: 365, label: '1 ano' },
                                                { days: 9999, label: 'Eterno' }
                                            ].map((item) => (
                                                <Button
                                                    key={item.days}
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs h-7 px-3"
                                                    style={{
                                                        borderRadius: '1rem',
                                                        backgroundColor: voiceRetention === item.days 
                                                            ? (theme === 'dark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)')
                                                            : 'transparent',
                                                        borderColor: voiceRetention === item.days 
                                                            ? '#06b6d4' 
                                                            : (theme === 'dark' ? '#334155' : '#e2e8f0'),
                                                        color: voiceRetention === item.days 
                                                            ? '#06b6d4' 
                                                            : (theme === 'dark' ? '#cbd5e1' : '#64748b')
                                                    }}
                                                    onClick={() => setVoiceRetention(item.days)}
                                                >
                                                    {item.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <Separator />
                                
                                <Alert 
                                    variant="destructive" 
                                    className="py-2 relative overflow-hidden" 
                                    style={{ 
                                        borderRadius: '1.5rem',
                                        animation: 'pulse-critical 2s ease-in-out infinite'
                                    }}
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-black">Purge Policy</AlertTitle>
                                    <AlertDescription className="text-[10px]">
                                        Deleted data is unrecoverable after 24h grace period.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    )
}
