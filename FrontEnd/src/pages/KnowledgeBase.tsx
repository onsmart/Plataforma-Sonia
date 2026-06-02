import { useEffect, useState, useCallback, useMemo } from "react"
import { 
    FileText, 
    Trash2, 
    Loader2, 
    AlertCircle,
    RefreshCw,
    Image as ImageIcon,
    Shield,
    FileCode,
    FileSpreadsheet,
    FileJson,
    Circle,
    Save,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group"
import { Textarea } from "../components/ui/textarea"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog"
import { AgentService, KnowledgeFile } from "../services/api"
import { usePlanCapabilities } from "../hooks/usePlanCapabilities"
import { useNavigation } from "../contexts/NavigationContext"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"
import { cn } from "../components/ui/utils"

const getFileVisuals = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()

    if (mimeType?.startsWith('image/')) {
        return {
            icon: ImageIcon,
            color: '#be185d',
            lightBg: '#fce7f3',
            darkBg: 'rgba(190, 24, 93, 0.13)',
            lightIconBg: '#fbcfe8',
            darkIconBg: 'rgba(190, 24, 93, 0.22)',
            lightBorder: 'rgba(190, 24, 93, 0.22)',
            darkBorder: 'rgba(244, 114, 182, 0.28)'
        }
    }

    switch (ext) {
        case 'txt':
        case 'md':
            return {
                icon: FileText,
                color: '#0f766e',
                lightBg: '#ccfbf1',
                darkBg: 'rgba(15, 118, 110, 0.14)',
                lightIconBg: '#99f6e4',
                darkIconBg: 'rgba(20, 184, 166, 0.2)',
                lightBorder: 'rgba(15, 118, 110, 0.22)',
                darkBorder: 'rgba(45, 212, 191, 0.26)'
            }
        case 'csv':
        case 'xlsx':
        case 'xls':
            return {
                icon: FileSpreadsheet,
                color: '#15803d',
                lightBg: '#dcfce7',
                darkBg: 'rgba(21, 128, 61, 0.14)',
                lightIconBg: '#bbf7d0',
                darkIconBg: 'rgba(34, 197, 94, 0.2)',
                lightBorder: 'rgba(21, 128, 61, 0.22)',
                darkBorder: 'rgba(74, 222, 128, 0.26)'
            }
        case 'json':
            return {
                icon: FileJson,
                color: '#b45309',
                lightBg: '#fef3c7',
                darkBg: 'rgba(180, 83, 9, 0.15)',
                lightIconBg: '#fde68a',
                darkIconBg: 'rgba(245, 158, 11, 0.2)',
                lightBorder: 'rgba(180, 83, 9, 0.24)',
                darkBorder: 'rgba(251, 191, 36, 0.26)'
            }
        case 'pdf':
            return {
                icon: FileText,
                color: '#b91c1c',
                lightBg: '#fee2e2',
                darkBg: 'rgba(185, 28, 28, 0.13)',
                lightIconBg: '#fecaca',
                darkIconBg: 'rgba(248, 113, 113, 0.18)',
                lightBorder: 'rgba(185, 28, 28, 0.22)',
                darkBorder: 'rgba(248, 113, 113, 0.26)'
            }
        default:
            return {
                icon: FileCode,
                color: '#52525b',
                lightBg: '#f4f4f5',
                darkBg: 'rgba(82, 82, 91, 0.18)',
                lightIconBg: '#e4e4e7',
                darkIconBg: 'rgba(161, 161, 170, 0.18)',
                lightBorder: 'rgba(82, 82, 91, 0.2)',
                darkBorder: 'rgba(161, 161, 170, 0.24)'
            }
    }
}

export function KnowledgeBase() {
    const { theme, resolvedTheme } = useTheme()
    const { t } = useTranslation('knowledgeBase')
    const { navigate } = useNavigation()
    const planCaps = usePlanCapabilities()
    const isDark = resolvedTheme === 'dark' || theme === 'dark'
    const ragLocked = !planCaps.loading && !planCaps.hasRag
    
    // Garantir que as traduções estejam carregadas
    useEffect(() => {
        const checkTranslations = async () => {
            const currentLang = i18n.language || 'pt-BR'
            const knowledgeBaseTranslations = i18n.getResourceBundle(currentLang, 'knowledgeBase')
            
            if (!knowledgeBaseTranslations || Object.keys(knowledgeBaseTranslations).length === 0) {
                console.log('[KnowledgeBase] Traduções não encontradas, carregando...')
                const { loadTranslationsFromDatabase } = await import('../i18n/config')
                const companiesId = localStorage.getItem('companies_id') || undefined
                await loadTranslationsFromDatabase(currentLang, companiesId)
                i18n.emit('loaded')
            }
        }
        
        checkTranslations()
        
        const handleLanguageChanged = () => {
            checkTranslations()
        }
        
        i18n.on('languageChanged', handleLanguageChanged)
        i18n.on('added', checkTranslations)
        
        return () => {
            i18n.off('languageChanged', handleLanguageChanged)
            i18n.off('added', checkTranslations)
        }
    }, [])
    const [files, setFiles] = useState<KnowledgeFile[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [contentText, setContentText] = useState("")
    const [titleDialogOpen, setTitleDialogOpen] = useState(false)
    const [saveTitle, setSaveTitle] = useState("")
    const [usageStats, setUsageStats] = useState<any>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [deletedFiles, setDeletedFiles] = useState<any[]>([])
    const [isCleaning, setIsCleaning] = useState(false)
    const [filePurpose, setFilePurpose] = useState<'rag' | 'skills'>('rag')
    
    // Definir loadFiles antes de usar nos useEffects
    const loadFiles = useCallback(async () => {
        try {
            console.log('[KnowledgeBase] loadFiles chamado, isAdmin:', isAdmin)
            // Buscar arquivos ativos
            const activeFiles = (await AgentService.listFiles()).filter(file => file.status !== 'deleted')
            console.log('[KnowledgeBase] Arquivos ativos encontrados:', activeFiles.length)
            
            if (isAdmin) {
                console.log('[KnowledgeBase] É admin, buscando arquivos deletados...')
                const deletedFilesList = await AgentService.listDeletedFilesForCleanup()
                console.log('[KnowledgeBase] Arquivos deletados encontrados em loadFiles:', deletedFilesList.length)
                setDeletedFiles(deletedFilesList || [])
            } else {
                console.log('[KnowledgeBase] Não é admin, apenas arquivos ativos')
            }

            setFiles(activeFiles)
        } catch (error) {
            console.error('Erro ao carregar arquivos:', error)
            const data = await AgentService.listFiles()
            setFiles(data.filter(file => file.status !== 'deleted'))
        }
    }, [isAdmin])

    const loadUsageStats = async () => {
        const stats = await AgentService.getFileUsageStats()
        setUsageStats(stats)
    }

    const checkAdmin = async () => {
        try {
            const admin = await AgentService.checkUserIsAdmin()
            console.log('[KnowledgeBase] isAdmin:', admin)
            setIsAdmin(admin)
            // Se for admin, carregar arquivos deletados imediatamente
            if (admin) {
                await loadDeletedFiles()
            }
        } catch (error: any) {
            console.error('[KnowledgeBase] Erro ao verificar admin:', error)
            setIsAdmin(false)
        }
    }

    const loadDeletedFiles = async () => {
        try {
            console.log('[KnowledgeBase] Carregando arquivos deletados...')
            const deleted = await AgentService.listDeletedFilesForCleanup()
            console.log('[KnowledgeBase] Arquivos deletados encontrados:', deleted?.length || 0, deleted)
            setDeletedFiles(deleted || [])
        } catch (error: any) {
            console.error("[KnowledgeBase] Erro ao carregar arquivos deletados:", error)
            setDeletedFiles([])
        }
    }

    const handlePermanentDelete = async () => {
        if (deletedFiles.length === 0) {
            toast.error(t('admin.cleanup.noFilesToClean'))
            return
        }

        const confirmMessage = t('admin.cleanup.confirmMultiple', { count: deletedFiles.length })
        
        if (!confirm(confirmMessage)) {
            return
        }

        setIsCleaning(true)
        try {
            const fileIds = deletedFiles.map(f => f.id)
            const result = await AgentService.permanentlyDeleteFiles(fileIds)
            
            if (result?.success) {
                toast.success(result.message || t('admin.cleanup.successMultiple', { count: result.deleted_count }))
                await loadFiles()
                await loadUsageStats()
                await loadDeletedFiles()
            } else {
                throw new Error(result?.message || t('delete.error'))
            }
        } catch (error: any) {
            console.error("Erro ao deletar permanentemente:", error)
            toast.error(error.message || t('admin.cleanup.error'))
        } finally {
            setIsCleaning(false)
        }
    }

    // Carregar arquivos e estatísticas
    useEffect(() => {
        loadUsageStats()
        checkAdmin()
        
        const interval = setInterval(() => {
            loadFiles()
            loadUsageStats()
        }, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [loadFiles])

    // Carregar arquivos quando isAdmin mudar
    useEffect(() => {
        loadFiles()
    }, [isAdmin, loadFiles])

    // Carregar arquivos deletados quando for admin
    useEffect(() => {
        if (isAdmin) {
            loadDeletedFiles()
            const interval = setInterval(() => {
                loadDeletedFiles()
            }, 10000)
            return () => clearInterval(interval)
        }
    }, [isAdmin])

    const handleOpenSaveDialog = () => {
        if (ragLocked) {
            toast.error('Base de conhecimento (RAG) disponível no plano Growth ou superior.')
            return
        }
        if (!contentText.trim()) {
            toast.error(t('create.contentRequired', { defaultValue: 'Escreva o conteúdo antes de salvar.' }))
            return
        }
        setSaveTitle("")
        setTitleDialogOpen(true)
    }

    const handleConfirmSave = async () => {
        const title = saveTitle.trim()
        if (title.length < 3) {
            toast.error(t('create.titleMin', { defaultValue: 'O título deve ter pelo menos 3 caracteres.' }))
            return
        }

        setIsSaving(true)
        try {
            await AgentService.createKnowledgeText({
                title,
                content: contentText.trim(),
                purpose: filePurpose,
            })
            toast.success(t('create.success', { defaultValue: 'Conteúdo salvo. Processamento em andamento…' }))
            setContentText("")
            setSaveTitle("")
            setTitleDialogOpen(false)
            await loadFiles()
            await loadUsageStats()
        } catch (error: any) {
            if (error?.code === 'PLAN_RAG_REQUIRED' || String(error?.message || '').includes('RAG')) {
                toast.error(error.message || 'Faça upgrade para o plano Growth para usar a base de conhecimento.')
            } else {
                toast.error(t('create.error', { message: error.message, defaultValue: `Falha ao salvar: ${error.message}` }))
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        const confirmMessage = t('delete.confirmPermanent', {
            defaultValue: 'Excluir este arquivo definitivamente? Esta acao removera o arquivo da tela, do banco de dados e do Supabase Storage.'
        })

        if (!confirm(confirmMessage)) {
            return
        }

        const previousFiles = files
        setFiles(currentFiles => currentFiles.filter(file => file.id !== id))

        try {
            await AgentService.deleteFile(id)
            toast.success(t('delete.successPermanent', { defaultValue: 'Arquivo deletado definitivamente' }))
            await loadFiles()
            await loadUsageStats()
            if (isAdmin) {
                await loadDeletedFiles()
            }
        } catch (error: any) {
            setFiles(previousFiles)
            console.error("Erro ao deletar arquivo:", error)
            toast.error(error?.message || t('delete.error'))
        }
    }

    const ragFiles = useMemo(
        () => files.filter((f) => f.purpose !== 'skills'),
        [files]
    )
    const skillsFiles = useMemo(
        () => files.filter((f) => f.purpose === 'skills'),
        [files]
    )

    const renderIndexedFileRow = (file: KnowledgeFile) => {
        const fileVisual = getFileVisuals(file.name, file.type)
        const IconComponent = fileVisual.icon
        const isDeleted = file.status === 'deleted'

        return (
            <div
                key={file.id}
                className={cn(
                    "group relative rounded-[8px] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                    isDeleted && "opacity-80"
                )}
                style={{
                    backgroundColor: isDeleted
                        ? (isDark ? 'rgba(39, 39, 42, 0.72)' : '#fafafa')
                        : (isDark ? fileVisual.darkBg : fileVisual.lightBg),
                    borderColor: isDeleted
                        ? (isDark ? 'rgba(161, 161, 170, 0.22)' : 'rgba(82, 82, 91, 0.18)')
                        : (isDark ? fileVisual.darkBorder : fileVisual.lightBorder)
                }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px]"
                            style={{ backgroundColor: isDark ? fileVisual.darkIconBg : fileVisual.lightIconBg }}
                        >
                            <IconComponent
                                className="h-6 w-6"
                                style={{ color: isDeleted ? (isDark ? '#a1a1aa' : '#71717a') : fileVisual.color }}
                                strokeWidth={2.5}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h4 className="min-w-0 truncate font-semibold text-foreground">{file.name}</h4>
                                {file.status === 'active' ? (
                                    <Badge className="gap-1.5 border-emerald-600 bg-emerald-600 px-2.5 py-0.5 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950">
                                        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                                        {t('documents.status.active')}
                                    </Badge>
                                ) : file.status === 'indexing' ? (
                                    <Badge variant="secondary" className="gap-1.5 animate-pulse">
                                        <Loader2 className="h-3 w-3 animate-spin" /> {t('documents.status.indexing')}
                                    </Badge>
                                ) : file.status === 'deleted' ? (
                                    <Badge variant="secondary" className="gap-1.5">
                                        {t('documents.status.deleted')}
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive">{t('documents.status.error')}</Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{file.size}</span>
                                <span>•</span>
                                <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        {file.status === 'deleted' ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        await AgentService.updateFileConfig(file.id, false)
                                        await loadFiles()
                                        await loadUsageStats()
                                    }}
                                    className="rounded-[8px]"
                                >
                                    {t('documents.actions.restore')}
                                </Button>
                                {isAdmin && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={async () => {
                                            if (confirm(t('admin.cleanup.confirmSingle', { name: file.name }))) {
                                                try {
                                                    const result = await AgentService.permanentlyDeleteFiles([file.id])
                                                    if (result?.success) {
                                                        toast.success(t('admin.cleanup.successSingle'))
                                                        await loadFiles()
                                                        await loadUsageStats()
                                                        await loadDeletedFiles()
                                                    } else {
                                                        toast.error(result?.message || t('delete.error'))
                                                    }
                                                } catch (error: any) {
                                                    console.error('Erro ao deletar permanentemente:', error)
                                                    toast.error(error?.message || t('admin.cleanup.error'))
                                                }
                                            }
                                        }}
                                        className="rounded-[8px]"
                                    >
                                        {t('documents.actions.deletePermanently')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-[8px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(file.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const storagePercent = usageStats ? Math.min(100, Math.max(0, Number(usageStats.storage_used_percent) || 0)) : 0
    const panelClass =
        "rounded-xl border border-border/80 bg-card/30 shadow-sm transition-shadow hover:shadow-md"

    const activePurpose = filePurpose === 'rag'
        ? {
            Icon: FileText,
            title: t('modes.rag.title', { defaultValue: 'RAG: consultar documentos durante a conversa' }),
            body: t('modes.rag.body', { defaultValue: 'RAG é o que o agente sabe ao consultar os arquivos: a cada pergunta, o sistema busca trechos parecidos e envia esse texto ao modelo. Use para FAQs, políticas, SLAs e dados que precisam de citação literal do documento.' }),
            bestFor: t('modes.rag.bestFor', { defaultValue: 'Melhor para perguntas como: qual é o SLA, qual é o código, qual política devo seguir?' })
        }
        : {
            Icon: Shield,
            title: t('modes.skills.title', { defaultValue: 'Skills: mostrar capacidades que o agente pode considerar' }),
            body: t('modes.skills.body', { defaultValue: 'Skills é o que o agente sabe fazer e como deve agir: o sistema lê o arquivo, extrai capacidades e regras (lista resumida) e coloca isso no prompt do agente. Não repete busca por trecho a cada mensagem — coloque aqui condutas e políticas que devem valer sempre que fizerem sentido.' }),
            bestFor: t('modes.skills.bestFor', { defaultValue: 'Melhor para orientar comportamento: atender cliente, consultar informações, abrir chamado, enviar e-mail ou seguir um processo.' })
        }
    const ActivePurposeIcon = activePurpose.Icon

    return (
        <div className="mx-auto w-full max-w-7xl animate-in fade-in space-y-6 px-4 py-6 text-foreground duration-500 sm:px-6 lg:space-y-8 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1 pr-0 lg:pr-4">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('header.title')}</h2>
                    <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {t('header.description')}
                    </p>
                </div>
                {/* Status de Conexão no Header */}
                <div className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 sm:w-fit dark:text-emerald-300">
                    <div className="relative">
                        <Circle className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                        <div className="absolute inset-0 animate-ping">
                            <Circle className="h-3 w-3 text-emerald-500 opacity-70" />
                        </div>
                    </div>
                    <span className="text-sm font-semibold text-current">{t('header.syncStatus')}</span>
                </div>
            </div>

            {ragLocked && (
                <Card className="border-amber-500/40 bg-amber-500/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Base de conhecimento — plano Growth</CardTitle>
                        <CardDescription>
                            Seu plano atual não inclui Base de Conhecimento (RAG e Skills). Faça upgrade para consultar
                            conteúdos nos atendimentos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button size="sm" onClick={() => navigate('configuration')}>
                            Ver planos e fazer upgrade
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 xl:gap-8">
                {/* Upload Area */}
                <Card className={cn("xl:col-span-8", panelClass)}>
                    <CardHeader>
                        <CardTitle>{t('upload.title')}</CardTitle>
                        <CardDescription>
                            {t('upload.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 sm:space-y-8">
                        {/* 1) Explicações RAG e Skills — sempre antes do upload; cartões uniformes */}
                        <div className="space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("modes.sectionLabel", {
                                    defaultValue: "Antes de enviar, entenda os modos",
                                })}
                            </p>
                            <div className="grid grid-cols-1 gap-4 sm:gap-4 lg:grid-cols-2">
                                <div
                                    className={cn(
                                        "flex h-full flex-col rounded-xl border p-4 sm:p-5",
                                        "border-border bg-muted/30",
                                    )}
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-sm font-bold leading-snug text-foreground">
                                            {t("modes.compare.rag.title", {
                                                defaultValue: "RAG — o que o agente sabe ao consultar os arquivos",
                                            })}
                                        </h3>
                                    </div>
                                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                                        {t("modes.compare.rag.body", {
                                            defaultValue:
                                                "Em cada mensagem, o sistema procura trechos do documento parecidos com a pergunta e o agente responde com base nesses trechos. Ideal para base de conhecimento, FAQ e fatos que precisam vir do arquivo.",
                                        })}
                                    </p>
                                    <p
                                        className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold leading-relaxed"
                                        style={{
                                            backgroundColor: isDark ? 'rgba(45, 212, 191, 0.1)' : '#f0fdfa',
                                            borderColor: isDark ? 'rgba(45, 212, 191, 0.22)' : 'rgba(15, 118, 110, 0.28)',
                                            color: isDark ? '#ccfbf1' : '#1f2937',
                                        }}
                                    >
                                        {t("modes.rag.bestFor", {
                                            defaultValue:
                                                "Melhor para perguntas como: qual é o SLA, qual é o código, qual política devo seguir?",
                                        })}
                                    </p>
                                </div>
                                <div
                                    className={cn(
                                        "flex h-full flex-col rounded-xl border p-4 sm:p-5",
                                        "border-border bg-muted/30",
                                    )}
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white dark:bg-teal-500 dark:text-zinc-950">
                                            <Shield className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-sm font-bold leading-snug text-foreground">
                                            {t("modes.compare.skills.title", {
                                                defaultValue: "Skills — o que o agente sabe fazer e como deve agir",
                                            })}
                                        </h3>
                                    </div>
                                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                                        {t("modes.compare.skills.body", {
                                            defaultValue:
                                                "O sistema extrai do arquivo uma lista de capacidades e regras de conduta e envia isso ao agente em toda conversa. Não substitui o RAG para fatos pontuais do documento; use os dois modos se precisar de busca por trecho e de comportamento fixo.",
                                        })}
                                    </p>
                                    <p
                                        className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold leading-relaxed"
                                        style={{
                                            backgroundColor: isDark ? 'rgba(45, 212, 191, 0.1)' : '#f0fdfa',
                                            borderColor: isDark ? 'rgba(45, 212, 191, 0.22)' : 'rgba(15, 118, 110, 0.28)',
                                            color: isDark ? '#ccfbf1' : '#1f2937',
                                        }}
                                    >
                                        {t("modes.skills.bestFor", {
                                            defaultValue:
                                                "Melhor para orientar comportamento: atender cliente, consultar informações, abrir chamado, enviar e-mail ou seguir um processo.",
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
                                <h3 className="mb-2 text-sm font-bold text-foreground">
                                    {t("modes.link.title", { defaultValue: "Para afetar um agente" })}
                                </h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {t("modes.link.body", {
                                        defaultValue:
                                            "Depois do upload, vincule este arquivo ao agente nas configurações. Arquivos não vinculados ficam guardados, mas não entram nas respostas.",
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* 2) Modo do próximo upload */}
                        <div className="space-y-3 border-t border-border/70 pt-6 sm:pt-8">
                            <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("modes.uploadModeLabel", {
                                    defaultValue: "Modo do próximo envio",
                                })}
                            </p>
                            <div className="flex justify-center">
                                <ToggleGroup
                                    type="single"
                                    value={filePurpose}
                                    onValueChange={(value) => {
                                        if (value === "rag" || value === "skills") {
                                            setFilePurpose(value)
                                        }
                                    }}
                                    className="w-full max-w-md rounded-xl border border-border bg-muted/80 p-1 sm:w-auto"
                                >
                                    <ToggleGroupItem
                                        value="rag"
                                        aria-label="RAG"
                                        className={cn(
                                            "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5",
                                            filePurpose === "rag"
                                                ? "bg-teal-700 text-white shadow-sm hover:bg-teal-700 hover:text-white dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-500"
                                                : "text-muted-foreground hover:bg-background hover:text-foreground",
                                        )}
                                    >
                                        RAG
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="skills"
                                        aria-label="Skills"
                                        className={cn(
                                            "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5",
                                            filePurpose === "skills"
                                                ? "bg-teal-700 text-white shadow-sm hover:bg-teal-700 hover:text-white dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-500"
                                                : "text-muted-foreground hover:bg-background hover:text-foreground",
                                        )}
                                    >
                                        Skills
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                            <div className="flex justify-center">
                                <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-teal-600/25 bg-teal-600/10 px-3 py-2 text-xs text-teal-900 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-100 sm:text-sm">
                                    <ActivePurposeIcon className="h-4 w-4 shrink-0" />
                                    <span className="text-left font-medium leading-snug">{activePurpose.title}</span>
                                </div>
                            </div>
                        </div>

                        {/* 3) Editor de texto */}
                        <div className="border-t border-border/70 pt-6 sm:pt-8 space-y-4">
                            <div>
                                <Label htmlFor="kb-content" className="text-sm font-semibold text-foreground">
                                    {t('create.contentLabel', { defaultValue: 'Conteúdo' })}
                                </Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {filePurpose === 'rag'
                                        ? t('create.contentHintRag', { defaultValue: 'Descreva fatos, políticas, FAQ e informações que o agente deve consultar nas respostas.' })
                                        : t('create.contentHintSkills', { defaultValue: 'Descreva regras de comportamento: o que pode, o que não pode e como agir em situações específicas.' })}
                                </p>
                            </div>
                            <Textarea
                                id="kb-content"
                                value={contentText}
                                onChange={(e) => setContentText(e.target.value)}
                                placeholder={
                                    filePurpose === 'rag'
                                        ? t('create.placeholderRag', { defaultValue: 'Ex.: Horário de atendimento, política de trocas, valores dos planos…' })
                                        : t('create.placeholderSkills', { defaultValue: 'Ex.: Nunca prometer desconto. Sempre pedir CPF antes de consultar pedido…' })
                                }
                                className="min-h-[220px] resize-y rounded-xl border-border/80 text-sm leading-relaxed"
                                disabled={ragLocked || isSaving}
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-muted-foreground">
                                    {t('create.minLengthHint', { defaultValue: 'Mínimo recomendado: 200 caracteres (RAG) ou 120 (Skills).' })}
                                </p>
                                <Button
                                    type="button"
                                    onClick={handleOpenSaveDialog}
                                    disabled={ragLocked || isSaving || !contentText.trim()}
                                    className="gap-2 rounded-lg"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {t('create.saveButton', { defaultValue: 'Salvar na minha conta' })}
                                </Button>
                            </div>
                        </div>

                        <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
                            <DialogContent className="sm:max-w-md rounded-xl">
                                <DialogHeader>
                                    <DialogTitle>{t('create.titleDialog', { defaultValue: 'Título do conteúdo' })}</DialogTitle>
                                    <DialogDescription>
                                        {t('create.titleDialogHint', {
                                            defaultValue: 'Este título aparece na sua conta e nas configurações dos agentes.',
                                        })}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 py-2">
                                    <Label htmlFor="kb-title">{t('create.titleLabel', { defaultValue: 'Título' })}</Label>
                                    <Input
                                        id="kb-title"
                                        value={saveTitle}
                                        onChange={(e) => setSaveTitle(e.target.value)}
                                        placeholder={t('create.titlePlaceholder', { defaultValue: 'Ex.: FAQ Atendimento ou Regras de vendas' })}
                                        maxLength={120}
                                        autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {filePurpose === 'rag' ? 'RAG' : 'Skills'} · {contentText.trim().length} caracteres
                                    </p>
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button type="button" variant="outline" onClick={() => setTitleDialogOpen(false)} disabled={isSaving}>
                                        {t('create.cancel', { defaultValue: 'Cancelar' })}
                                    </Button>
                                    <Button type="button" onClick={handleConfirmSave} disabled={isSaving || saveTitle.trim().length < 3}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {t('create.confirm', { defaultValue: 'Salvar' })}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>

                {/* Stats / Info */}
                <Card className={cn("xl:col-span-4", panelClass)}>
                    <CardHeader>
                        <CardTitle>{t('quota.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <span className="text-sm font-semibold text-foreground">{t('quota.storageUsed')}</span>
                                <div className="flex items-center justify-center gap-3 sm:justify-end">
                                    {/* Gauge Circular */}
                                    <div className="relative h-16 w-16 shrink-0">
                                        <svg
                                            viewBox="0 0 64 64"
                                            className="h-16 w-16 -rotate-90 transform"
                                            aria-hidden
                                        >
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke={isDark ? 'rgba(161, 161, 170, 0.24)' : 'rgba(113, 113, 122, 0.24)'}
                                                strokeWidth="6"
                                                fill="none"
                                            />
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="url(#knowledge-storage-gradient)"
                                                strokeWidth="6"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 28}`}
                                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - storagePercent / 100)}`}
                                                className="transition-all duration-500"
                                            />
                                            <defs>
                                                <linearGradient id="knowledge-storage-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#0f766e" />
                                                    <stop offset="65%" stopColor="#16a34a" />
                                                    <stop offset="100%" stopColor="#d97706" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xs font-bold text-foreground">
                                                {Math.round(storagePercent)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{t('quota.used')}</span>
                                    <span className="font-semibold text-foreground">
                                        {usageStats ? `${usageStats.storage_used_mb} MB` : '0 MB'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{t('quota.limit')}</span>
                                    <span className="font-semibold text-foreground">
                                        {usageStats ? `${usageStats.storage_limit_mb} MB` : '0 MB'}
                                    </span>
                                </div>
                            </div>
                            {/* Barra de Progresso com Gradiente */}
                            <div className="relative h-3 overflow-hidden rounded-[8px] bg-muted">
                                <div 
                                    className="h-full rounded-[8px] transition-all duration-500"
                                    style={{
                                        width: `${storagePercent}%`,
                                        background: 'linear-gradient(90deg, #0f766e 0%, #16a34a 65%, #d97706 100%)',
                                        boxShadow: isDark ? '0 0 12px rgba(45, 212, 191, 0.24)' : '0 2px 8px rgba(15, 118, 110, 0.22)'
                                    }}
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('quota.totalFiles')}</span>
                                <span className="font-medium text-foreground">
                                    {usageStats ? `${usageStats.total_files} ${t('quota.files')}` : '0'}
                                </span>
                            </div>
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('quota.deletedFiles')}</span>
                                <span className="font-medium text-muted-foreground">
                                    {usageStats ? `${usageStats.deleted_files}` : '0'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-[8px] border border-border bg-muted/45 p-3 text-xs text-muted-foreground">
                            <AlertCircle className="h-4 w-4 text-teal-600 dark:text-teal-300 shrink-0 mt-0.5" />
                            <p>
                                {t('quota.info')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Files List */}
            <Card className={panelClass}>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>{t('documents.title')}</CardTitle>
                        <CardDescription>{t('documents.description')}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && (
                            <>
                                {deletedFiles.length > 0 ? (
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={handlePermanentDelete}
                                        disabled={isCleaning}
                                        className="gap-2 rounded-[8px]"
                                    >
                                        {isCleaning ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t('admin.cleanup.cleaning')}
                                            </>
                                        ) : (
                                            <>
                                                <Shield className="h-4 w-4" />
                                                {t('admin.cleanup.button', { count: deletedFiles.length })}
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        {t('admin.cleanup.noFiles')}
                                    </span>
                                )}
                            </>
                        )}
                        <Button variant="ghost" size="icon" onClick={loadFiles} className="rounded-[8px]">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {files.length === 0 ? (
                        <div className="flex h-24 items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                            {t('documents.empty')}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {t('documents.ragSectionTitle', { defaultValue: 'RAG — consulta durante a conversa' })}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {t('documents.ragSectionHint', { defaultValue: 'Estes documentos entram na busca por trechos (embeddings).' })}
                                    </p>
                                </div>
                                {ragFiles.length === 0 ? (
                                    <div className="flex h-20 items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/25 text-xs text-muted-foreground">
                                        {t('documents.ragEmpty', { defaultValue: 'Nenhum documento RAG indexado.' })}
                                    </div>
                                ) : (
                                    <div className="grid gap-3">{ragFiles.map(renderIndexedFileRow)}</div>
                                )}
                            </div>

                            <div className="border-t border-border/70 pt-8 space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {t('documents.skillsSectionTitle', { defaultValue: 'Skills — comportamento e capacidades' })}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {t('documents.skillsSectionHint', { defaultValue: 'Estes arquivos alimentam as skills extraídas para o prompt do agente.' })}
                                    </p>
                                </div>
                                {skillsFiles.length === 0 ? (
                                    <div className="flex h-20 items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/25 text-xs text-muted-foreground">
                                        {t('documents.skillsEmpty', { defaultValue: 'Nenhum arquivo de Skills indexado.' })}
                                    </div>
                                ) : (
                                    <div className="grid gap-3">{skillsFiles.map(renderIndexedFileRow)}</div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
