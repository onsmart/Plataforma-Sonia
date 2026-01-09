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

export function Governance() {
    const [config, setConfig] = useState<GovernanceConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [auditLogs, setAuditLogs] = useState<any[]>([])

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

    if (loading || !config) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Governance & Security</h2>
                    <p className="text-muted-foreground">
                        Manage AI guardrails, data protection policies, and compliance logs.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Card className="flex items-center p-2 px-4 gap-3 bg-muted/40 border-none">
                        <Shield className="h-5 w-5 text-emerald-500" />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Safety Score</p>
                            <p className="text-lg font-bold leading-none text-emerald-500">A+</p>
                        </div>
                    </Card>
                </div>
            </div>

            <Tabs defaultValue="guardrails" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="guardrails">AI Guardrails</TabsTrigger>
                    <TabsTrigger value="privacy">Data Privacy (DLP)</TabsTrigger>
                    <TabsTrigger value="audit">Audit Logs</TabsTrigger>
                </TabsList>

                {/* ---------------- GUARDRAILS TAB ---------------- */}
                <TabsContent value="guardrails" className="space-y-4">
                    <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Global Policy Active</AlertTitle>
                        <AlertDescription>
                            These settings apply to all agents. Specific agent overrides can be configured in the Agents Hub.
                        </AlertDescription>
                    </Alert>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Content Moderation */}
                        <Card className="col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Siren className="h-5 w-5 text-primary" />
                                    Content Moderation Filters
                                </CardTitle>
                                <CardDescription>
                                    Configure sensitivity thresholds for blocking harmful or inappropriate content.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Hate Speech & Harassment</Label>
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                                                {config.safetyThresholds.hateSpeech > 80 ? 'Strict' : 'Standard'}
                                            </Badge>
                                        </div>
                                        <Slider 
                                            value={[config.safetyThresholds.hateSpeech]} 
                                            onValueChange={(v) => updateThreshold('hateSpeech', v)}
                                            max={100} step={1} 
                                        />
                                        <p className="text-[10px] text-muted-foreground">Blocks any content that could be construed as offensive or discriminatory.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Sexual Content</Label>
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                                                {config.safetyThresholds.sexualContent > 90 ? 'Zero Tolerance' : 'Standard'}
                                            </Badge>
                                        </div>
                                        <Slider 
                                            value={[config.safetyThresholds.sexualContent]} 
                                            onValueChange={(v) => updateThreshold('sexualContent', v)}
                                            max={100} step={1} 
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Self-Harm & Violence</Label>
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                                                 {config.safetyThresholds.dangerousContent > 85 ? 'Strict' : 'Standard'}
                                            </Badge>
                                        </div>
                                        <Slider 
                                            value={[config.safetyThresholds.dangerousContent]} 
                                            onValueChange={(v) => updateThreshold('dangerousContent', v)}
                                            max={100} step={1} 
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Business Rules */}
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Business Logic</CardTitle>
                                <CardDescription>Operational boundaries.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between space-x-2">
                                    <Label htmlFor="competitor-blocking" className="flex flex-col gap-1">
                                        <span>Competitor Blocking</span>
                                        <span className="font-normal text-xs text-muted-foreground">Deflects mentions of rivals</span>
                                    </Label>
                                    <Switch 
                                        id="competitor-blocking" 
                                        checked={config.filters.competitorBlocking}
                                        onCheckedChange={(v) => updateFilter('competitorBlocking', v)}
                                    />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between space-x-2">
                                    <Label htmlFor="hallucination" className="flex flex-col gap-1">
                                        <span>Anti-Hallucination</span>
                                        <span className="font-normal text-xs text-muted-foreground">Strict RAG adherence</span>
                                    </Label>
                                    <Switch 
                                        id="hallucination" 
                                        checked={config.filters.antiHallucination}
                                        onCheckedChange={(v) => updateFilter('antiHallucination', v)}
                                    />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between space-x-2">
                                    <Label htmlFor="jailbreak" className="flex flex-col gap-1">
                                        <span>Jailbreak Protection</span>
                                        <span className="font-normal text-xs text-muted-foreground">Detects prompt injection</span>
                                    </Label>
                                    <Switch 
                                        id="jailbreak" 
                                        checked={config.filters.jailbreakProtection}
                                        onCheckedChange={(v) => updateFilter('jailbreakProtection', v)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" variant="outline" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                        </>
                                    ) : "Update Rules"}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                {/* ---------------- PRIVACY TAB ---------------- */}
                <TabsContent value="privacy" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <EyeOff className="h-5 w-5 text-primary" />
                                    PII Redaction (DLP)
                                </CardTitle>
                                <CardDescription>
                                    Automatically detect and mask sensitive information in logs and analytics.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {[
                                        { id: "creditCard", label: "Credit Card Numbers", desc: "Masks PAN sequences (VISA, MC, AMEX)" },
                                        { id: "ssn", label: "National IDs (CPF/SSN)", desc: "Masks government identification numbers" },
                                        { id: "email", label: "Email Addresses", desc: "Masks email formats in conversation logs" },
                                        { id: "phone", label: "Phone Numbers", desc: "Masks detected phone numbers" },
                                    ].map((item) => (
                                        <div key={item.id} className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                            <div className="flex gap-3 items-center">
                                                <div className="bg-muted p-2 rounded-full">
                                                    <Fingerprint className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <Label htmlFor={item.id} className="flex flex-col gap-1 cursor-pointer">
                                                    <span className="font-medium">{item.label}</span>
                                                    <span className="font-normal text-xs text-muted-foreground">{item.desc}</span>
                                                </Label>
                                            </div>
                                            <Switch 
                                                id={item.id} 
                                                checked={config.dlp[item.id as keyof GovernanceConfig['dlp']]} 
                                                onCheckedChange={(v) => updateDlp(item.id as keyof GovernanceConfig['dlp'], v)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/20 border-t p-4 flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Changes apply immediately to new sessions.</span>
                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Retention</CardTitle>
                                <CardDescription>Compliance policies</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Chat Logs Retention</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue={90} className="w-20" />
                                        <span className="text-sm text-muted-foreground">Days</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Voice Recordings</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" defaultValue={30} className="w-20" />
                                        <span className="text-sm text-muted-foreground">Days</span>
                                    </div>
                                </div>
                                <Separator />
                                <Alert variant="destructive" className="py-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-bold">Purge Policy</AlertTitle>
                                    <AlertDescription className="text-[10px]">
                                        Deleted data is unrecoverable after 24h grace period.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ---------------- AUDIT TAB ---------------- */}
                <TabsContent value="audit" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    System Activity Log
                                </CardTitle>
                                <CardDescription>
                                    Immutable record of all configuration changes and critical events.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={loadLogs}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Refresh
                                </Button>
                                <Button variant="outline" size="sm">
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>User/System</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Resource</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLogs.map((log) => (
                                        <TableRow key={log.id} className={log.user === 'Sentinel One' ? 'bg-purple-500/5' : ''}>
                                            <TableCell className="font-mono text-xs">{log.time}</TableCell>
                                            <TableCell className="font-medium text-xs">
                                                {log.user === 'Sentinel One' ? (
                                                    <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                                                        <Shield className="h-3 w-3" /> Sentinel One
                                                    </span>
                                                ) : log.user}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {log.action === 'Visual Audit' && <Camera className="h-3 w-3 text-muted-foreground" />}
                                                    {log.action === 'IoT Control' && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                    {log.action === 'Anomaly Detect' && <Siren className="h-3 w-3 text-red-500" />}
                                                    
                                                    <Badge variant="outline" className="font-normal">
                                                        {log.action}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{log.resource}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm truncate max-w-[300px]">{log.details}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge 
                                                    variant={
                                                        log.status === 'success' ? 'default' : 
                                                        log.status === 'danger' ? 'destructive' : 'secondary'
                                                    }
                                                    className={
                                                        log.status === 'success' ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' : 
                                                        log.status === 'warning' ? 'bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25' :
                                                        log.status === 'danger' ? '' : ''
                                                    }
                                                >
                                                    {log.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter className="border-t p-4">
                            <p className="text-xs text-muted-foreground w-full text-center">
                                Showing last 5 of 2,401 events. Logs are retained for 1 year.
                            </p>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
