import { useEffect, useState, useCallback } from "react"
import { 
    UploadCloud, 
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
    Circle
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Progress } from "../components/ui/progress"
import { Badge } from "../components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group"
import { AgentService, KnowledgeFile } from "../services/api"
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
    const isDark = resolvedTheme === 'dark' || theme === 'dark'
    
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
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
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

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        
        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length > 0) {
            await processUpload(droppedFiles[0])
        }
    }

    const processUpload = async (file: File) => {
        setIsUploading(true)
        setUploadProgress(10)

        try {
            // Real upload call - passar filePurpose
            await AgentService.uploadFile(file, 'global', filePurpose)
            
            setUploadProgress(100)
            setTimeout(async () => {
                setIsUploading(false)
                setUploadProgress(0)
                await loadFiles()
            }, 500)
            
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("Upload failed", error)
            }
            setIsUploading(false)
            alert(t('upload.error', { message: error.message }))
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

    const storagePercent = usageStats ? Math.min(100, Math.max(0, Number(usageStats.storage_used_percent) || 0)) : 0
    const panelClass = "rounded-[8px] border border-border/70 shadow-sm hover:shadow-sm"

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-foreground">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('header.title')}</h2>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                        {t('header.description')}
                    </p>
                </div>
                {/* Status de Conexão no Header */}
                <div className="flex w-fit items-center gap-2 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                    <div className="relative">
                        <Circle className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                        <div className="absolute inset-0 animate-ping">
                            <Circle className="h-3 w-3 text-emerald-500 opacity-70" />
                        </div>
                    </div>
                    <span className="text-sm font-semibold text-current">{t('header.syncStatus')}</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Upload Area */}
                <Card className={cn("md:col-span-2", panelClass)}>
                    <CardHeader>
                        <CardTitle>{t('upload.title')}</CardTitle>
                        <CardDescription>
                            {t('upload.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Botões Pill para escolher RAG ou Skills */}
                        <div className="flex items-center justify-center mb-6">
                            <ToggleGroup
                                type="single"
                                value={filePurpose}
                                onValueChange={(value) => {
                                    if (value === 'rag' || value === 'skills') {
                                        setFilePurpose(value)
                                    }
                                }}
                                className="rounded-[8px] border border-border bg-muted p-1"
                            >
                                <ToggleGroupItem
                                    value="rag"
                                    aria-label="RAG"
                                    className={cn(
                                        "rounded-[6px] px-5 py-2 font-semibold transition-colors",
                                        filePurpose === 'rag'
                                            ? "bg-teal-700 text-white shadow-sm hover:bg-teal-700 hover:text-white dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-500"
                                            : "text-muted-foreground hover:bg-background hover:text-foreground"
                                    )}
                                >
                                    RAG
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="skills"
                                    aria-label="Skills"
                                    className={cn(
                                        "rounded-[6px] px-5 py-2 font-semibold transition-colors",
                                        filePurpose === 'skills'
                                            ? "bg-teal-700 text-white shadow-sm hover:bg-teal-700 hover:text-white dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-500"
                                            : "text-muted-foreground hover:bg-background hover:text-foreground"
                                    )}
                                >
                                    Skills
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div
                            className={cn(
                                "flex min-h-[18rem] flex-col items-center justify-center rounded-[8px] border p-8 text-center transition-all duration-300 sm:p-12",
                                isDragging
                                    ? "scale-[1.01] border-teal-500 bg-teal-700 text-white shadow-lg shadow-teal-700/25 dark:bg-teal-500 dark:text-zinc-950"
                                    : "border-dashed border-border bg-muted/40 hover:border-teal-500/60 hover:bg-muted/65 dark:hover:border-teal-400/60"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className={cn("mb-6 transition-transform duration-300", isDragging && "scale-105 animate-bounce")}>
                                <div className={cn(
                                    "flex h-20 w-20 items-center justify-center rounded-[8px]",
                                    isDragging
                                        ? "bg-white/20 text-white dark:text-zinc-950"
                                        : "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
                                )}>
                                    <UploadCloud className="h-12 w-12" strokeWidth={2} />
                                </div>
                            </div>
                            <h3 className={cn("mb-2 text-xl font-bold transition-colors", isDragging ? "text-current" : "text-foreground")}>
                                {isUploading ? t('upload.uploading') : t('upload.dragDrop')}
                            </h3>
                            <p className={cn("mb-6 text-sm transition-colors", isDragging ? "text-current opacity-90" : "text-muted-foreground")}>
                                {t('upload.clickToSelect')}
                            </p>
                            
                            {isUploading ? (
                                <div className="w-full max-w-xs space-y-2">
                                    <Progress
                                        value={uploadProgress}
                                        className="h-3 rounded-[8px] bg-background/50"
                                        indicatorClassName="bg-teal-600 dark:bg-teal-400"
                                    />
                                    <p className="text-xs font-medium text-muted-foreground">{t('upload.progress', { percent: uploadProgress })}</p>
                                </div>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    className={cn(
                                        "rounded-[8px]",
                                        isDragging && "border-white bg-white text-teal-700 hover:bg-white/90 dark:border-zinc-950 dark:bg-zinc-950 dark:text-teal-300"
                                    )}
                                >
                                    {t('upload.selectFiles')}
                                    <input 
                                        id="file-upload" 
                                        type="file" 
                                        className="hidden" 
                                        onChange={(e) => e.target.files && processUpload(e.target.files[0])}
                                    />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Stats / Info */}
                <Card className={panelClass}>
                    <CardHeader>
                        <CardTitle>{t('quota.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-semibold text-foreground">{t('quota.storageUsed')}</span>
                                <div className="flex items-center gap-3">
                                    {/* Gauge Circular */}
                                    <div className="relative w-16 h-16">
                                        <svg className="transform -rotate-90 w-16 h-16">
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
                        <div className="grid gap-3">
                            {files.map((file) => {
                                // Determinar ícone e cor baseado na extensão
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
                                                {/* Ícone do arquivo */}
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
                                                
                                                {/* Informações do arquivo */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                                        <h4 className="min-w-0 truncate font-semibold text-foreground">{file.name}</h4>
                                                        {/* Badge de Status com Glow */}
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
                                            
                                            {/* Ações - aparecem no hover */}
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
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
