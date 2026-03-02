import { useEffect, useState, useRef, useCallback } from "react"
import { 
    UploadCloud, 
    FileText, 
    Trash2, 
    Search, 
    Database, 
    CheckCircle2, 
    Loader2, 
    AlertCircle,
    File,
    RefreshCw,
    Image as ImageIcon,
    Shield,
    AlertTriangle,
    FileCode,
    FileSpreadsheet,
    FileJson,
    Circle
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Progress } from "../components/ui/progress"
import { Badge } from "../components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { AgentService, KnowledgeFile } from "../services/api"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"


export function KnowledgeBase() {
    const { theme } = useTheme()
    const { t } = useTranslation('knowledgeBase')
    
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
    
    // Definir loadFiles antes de usar nos useEffects
    const loadFiles = useCallback(async () => {
        try {
            console.log('[KnowledgeBase] loadFiles chamado, isAdmin:', isAdmin)
            // Buscar arquivos ativos
            const activeFiles = await AgentService.listFiles()
            console.log('[KnowledgeBase] Arquivos ativos encontrados:', activeFiles.length)
            
            // Se for admin, buscar também arquivos deletados e combinar
            if (isAdmin) {
                console.log('[KnowledgeBase] É admin, buscando arquivos deletados...')
                const deletedFilesList = await AgentService.listDeletedFilesForCleanup()
                console.log('[KnowledgeBase] Arquivos deletados encontrados em loadFiles:', deletedFilesList.length)
                
                // Converter arquivos deletados para o formato KnowledgeFile
                const deletedFilesFormatted = deletedFilesList.map((file: any) => ({
                    id: file.id,
                    name: file.original_name,
                    size: file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '0 KB',
                    type: 'unknown',
                    namespace: '',
                    status: 'deleted' as const,
                    uploadedAt: file.created_at
                }))
                
                // Combinar arquivos ativos e deletados
                const allFiles = [...activeFiles, ...deletedFilesFormatted]
                console.log('[KnowledgeBase] Total de arquivos (ativos + deletados):', allFiles.length)
                setFiles(allFiles)
            } else {
                console.log('[KnowledgeBase] Não é admin, apenas arquivos ativos')
                setFiles(activeFiles)
            }
        } catch (error) {
            console.error('Erro ao carregar arquivos:', error)
            const data = await AgentService.listFiles()
            setFiles(data)
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
            // Real upload call
            await AgentService.uploadFile(file)
            
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
        if (confirm(t('delete.confirmSoft'))) {
            try {
                await AgentService.deleteFile(id)
                await loadFiles()
                await loadUsageStats()
            } catch (error: any) {
                console.error("Erro ao deletar arquivo:", error)
                toast.error(t('delete.error'))
            }
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('header.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('header.description')}
                    </p>
                </div>
                {/* Status de Conexão no Header */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="relative">
                        <Circle className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                        <div className="absolute inset-0 animate-ping">
                            <Circle className="h-3 w-3 text-emerald-500 opacity-75" />
                        </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">{t('header.syncStatus')}</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Upload Area */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('upload.title')}</CardTitle>
                        <CardDescription>
                            {t('upload.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className={`rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all duration-300 ${
                                isDragging 
                                    ? "bg-gradient-to-br from-blue-400 to-blue-600 border-4 border-blue-500 shadow-2xl shadow-blue-500/50 scale-[1.02]" 
                                    : "border-2 hover:shadow-lg"
                            }`}
                            style={{
                                backgroundColor: isDragging 
                                    ? undefined 
                                    : theme === 'dark' 
                                        ? 'rgba(59, 130, 246, 0.15)' 
                                        : 'rgba(191, 219, 254, 0.4)',
                                borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(147, 197, 253, 0.5)'
                            }}
                            onMouseEnter={(e) => {
                                if (!isDragging) {
                                    e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(147, 197, 253, 0.7)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isDragging) {
                                    e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(147, 197, 253, 0.5)'
                                }
                            }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className={`mb-6 transition-transform duration-300 ${isDragging ? 'animate-bounce scale-110' : ''}`}>
                                <div className={`h-20 w-20 rounded-2xl flex items-center justify-center ${
                                    isDragging ? 'bg-white/20' : 'bg-blue-100'
                                }`}>
                                    <UploadCloud className={`h-12 w-12 transition-colors ${
                                        isDragging ? 'text-white' : 'text-blue-600'
                                    }`} strokeWidth={2} />
                                </div>
                            </div>
                            <h3 
                                className="font-bold text-xl mb-2 transition-colors"
                                style={{
                                    color: isDragging 
                                        ? '#ffffff' 
                                        : theme === 'dark' 
                                            ? '#f1f5f9' 
                                            : '#1e293b'
                                }}
                            >
                                {isUploading ? t('upload.uploading') : t('upload.dragDrop')}
                            </h3>
                            <p 
                                className="text-sm mb-6 transition-colors"
                                style={{
                                    color: isDragging ? '#dbeafe' : (theme === 'dark' ? '#e2e8f0' : '#475569')
                                }}>
                                {t('upload.clickToSelect')}
                            </p>
                            
                            {isUploading ? (
                                <div className="w-full max-w-xs space-y-2">
                                    <Progress value={uploadProgress} className="h-3 rounded-full" />
                                    <p className="text-xs text-slate-600 font-medium">{t('upload.progress', { percent: uploadProgress })}</p>
                                </div>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    className={`rounded-xl ${
                                        isDragging ? 'bg-white text-blue-600 border-white hover:bg-blue-50' : ''
                                    }`}
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
                <Card>
                    <CardHeader>
                        <CardTitle>{t('quota.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-700">{t('quota.storageUsed')}</span>
                                <div className="flex items-center gap-3">
                                    {/* Gauge Circular */}
                                    <div className="relative w-16 h-16">
                                        <svg className="transform -rotate-90 w-16 h-16">
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="#e2e8f0"
                                                strokeWidth="6"
                                                fill="none"
                                            />
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="url(#gradient)"
                                                strokeWidth="6"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 28}`}
                                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - (usageStats ? usageStats.storage_used_percent : 0) / 100)}`}
                                                className="transition-all duration-500"
                                            />
                                            <defs>
                                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#3b82f6" />
                                                    <stop offset="100%" stopColor="#9333ea" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xs font-bold text-slate-700">
                                                {usageStats ? Math.round(usageStats.storage_used_percent) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">{t('quota.used')}</span>
                                    <span className="font-semibold text-slate-700">
                                        {usageStats ? `${usageStats.storage_used_mb} MB` : '0 MB'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">{t('quota.limit')}</span>
                                    <span className="font-semibold text-slate-700">
                                        {usageStats ? `${usageStats.storage_limit_mb} MB` : '0 MB'}
                                    </span>
                                </div>
                            </div>
                            {/* Barra de Progresso com Gradiente */}
                            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${usageStats ? usageStats.storage_used_percent : 0}%`,
                                        background: 'linear-gradient(90deg, #3b82f6 0%, #9333ea 100%)',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
                                    }}
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('quota.totalFiles')}</span>
                                <span className="font-medium">
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

                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <p>
                                {t('quota.info')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Files List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('documents.title')}</CardTitle>
                        <CardDescription>{t('documents.description')}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <>
                                {deletedFiles.length > 0 ? (
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={handlePermanentDelete}
                                        disabled={isCleaning}
                                        className="gap-2"
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
                        <Button variant="ghost" size="icon" onClick={loadFiles}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {files.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-muted-foreground">
                            {t('documents.empty')}
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {files.map((file) => {
                                // Determinar ícone e cor baseado na extensão
                                const getFileIcon = (fileName: string, mimeType?: string) => {
                                    const ext = fileName.split('.').pop()?.toLowerCase()
                                    if (mimeType?.startsWith('image/')) {
                                        return { icon: ImageIcon, color: '#a855f7', bg: '#f3e8ff' }
                                    }
                                    switch (ext) {
                                        case 'txt':
                                        case 'md':
                                            return { icon: FileText, color: '#3b82f6', bg: '#dbeafe' }
                                        case 'csv':
                                        case 'xlsx':
                                        case 'xls':
                                            return { icon: FileSpreadsheet, color: '#10b981', bg: '#d1fae5' }
                                        case 'json':
                                            return { icon: FileJson, color: '#f59e0b', bg: '#fef3c7' }
                                        case 'pdf':
                                            return { icon: FileText, color: '#ef4444', bg: '#fee2e2' }
                                        default:
                                            return { icon: FileCode, color: '#64748b', bg: '#f1f5f9' }
                                    }
                                }
                                
                                const fileIcon = getFileIcon(file.name, file.type)
                                const IconComponent = fileIcon.icon
                                
                                return (
                                    <div
                                        key={file.id}
                                        className="group relative p-4 rounded-xl border-2 transition-all cursor-pointer"
                                        style={{
                                            backgroundColor: fileIcon.bg,
                                            borderColor: fileIcon.color + '40', // 40 = 25% opacity em hex
                                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = `0 8px 16px ${fileIcon.color}30, 0 0 0 1px ${fileIcon.color}40`
                                            e.currentTarget.style.borderColor = fileIcon.color + '60' // 60 = 40% opacity
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                                            e.currentTarget.style.borderColor = fileIcon.color + '40'
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {/* Ícone do arquivo */}
                                                <div 
                                                    className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ backgroundColor: fileIcon.bg }}
                                                >
                                                    <IconComponent 
                                                        className="h-6 w-6" 
                                                        style={{ color: fileIcon.color }}
                                                        strokeWidth={2.5}
                                                    />
                                                </div>
                                                
                                                {/* Informações do arquivo */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h4 className="font-semibold text-slate-800 truncate">{file.name}</h4>
                                                        {/* Badge de Status com Glow */}
                                                        {file.status === 'active' ? (
                                                            <Badge 
                                                                className="bg-emerald-500 text-white border-emerald-600 gap-1.5 px-2.5 py-0.5 shadow-lg shadow-emerald-500/30"
                                                                style={{
                                                                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                                                }}
                                                            >
                                                                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
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
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span>{file.size}</span>
                                                        <span>•</span>
                                                        <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Ações - aparecem no hover */}
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {file.status === 'deleted' ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={async () => {
                                                                await AgentService.updateFileConfig(file.id, false)
                                                                await loadFiles()
                                                                await loadUsageStats()
                                                            }}
                                                            className="rounded-lg"
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
                                                                className="rounded-lg"
                                                            >
                                                                {t('documents.actions.deletePermanently')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
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
