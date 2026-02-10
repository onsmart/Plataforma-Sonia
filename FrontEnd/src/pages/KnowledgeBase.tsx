import { useEffect, useState, useRef } from "react"
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
    AlertTriangle
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


export function KnowledgeBase() {
    const [files, setFiles] = useState<KnowledgeFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [usageStats, setUsageStats] = useState<any>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [deletedFiles, setDeletedFiles] = useState<any[]>([])
    const [isCleaning, setIsCleaning] = useState(false)
    
    // Carregar arquivos e estatísticas
    useEffect(() => {
        loadFiles()
        loadUsageStats()
        checkAdmin()
        
        const interval = setInterval(() => {
            loadFiles()
            loadUsageStats()
        }, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [])

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

    const loadFiles = async () => {
        const data = await AgentService.listFiles()
        setFiles(data)
    }

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
            toast.error("Nenhum arquivo deletado para limpar")
            return
        }

        const confirmMessage = `Tem certeza que deseja deletar permanentemente ${deletedFiles.length} arquivo(s)?\n\nEsta ação não pode ser desfeita e os arquivos serão removidos do storage.`
        
        if (!confirm(confirmMessage)) {
            return
        }

        setIsCleaning(true)
        try {
            const fileIds = deletedFiles.map(f => f.id)
            const result = await AgentService.permanentlyDeleteFiles(fileIds)
            
            if (result?.success) {
                toast.success(result.message || `${result.deleted_count} arquivo(s) deletado(s) permanentemente`)
                await loadFiles()
                await loadUsageStats()
                await loadDeletedFiles()
            } else {
                throw new Error(result?.message || "Erro ao deletar arquivos")
            }
        } catch (error: any) {
            console.error("Erro ao deletar permanentemente:", error)
            toast.error(error.message || "Erro ao deletar arquivos permanentemente")
        } finally {
            setIsCleaning(false)
        }
    }

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
            alert("Upload failed: " + error.message)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Marcar este arquivo como deletado? (soft delete)")) {
            try {
                await AgentService.deleteFile(id)
                await loadFiles()
                await loadUsageStats()
            } catch (error: any) {
                console.error("Erro ao deletar arquivo:", error)
            }
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Knowledge Base (RAG)</h2>
                    <p className="text-muted-foreground">
                        Upload documents to train your agents on company-specific knowledge.
                    </p>
                </div>
                 <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                        <Database className="h-3 w-3" />
                        Vector DB Connected
                    </Badge>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Upload Area */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Document & Image Upload</CardTitle>
                        <CardDescription>
                            Supported formats: TXT, MD, CSV, JSON, PNG, JPG (Max 10MB)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center transition-colors ${
                                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
                                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">
                                {isUploading ? "Uploading..." : "Drag & drop files here"}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                or click to select from computer
                            </p>
                            
                            {isUploading ? (
                                <div className="w-full max-w-xs space-y-2">
                                    <Progress value={uploadProgress} className="h-2" />
                                    <p className="text-xs text-muted-foreground">{uploadProgress}% completed</p>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                                    Select Files
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
                        <CardTitle>Usage Quota</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Storage Used</span>
                                <span className="font-medium">
                                    {usageStats ? `${usageStats.storage_used_mb} MB / ${usageStats.storage_limit_mb} MB` : 'Carregando...'}
                                </span>
                            </div>
                            <Progress 
                                value={usageStats ? usageStats.storage_used_percent : 0} 
                                className="h-2" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Total Files</span>
                                <span className="font-medium">
                                    {usageStats ? `${usageStats.total_files} arquivos` : '0'}
                                </span>
                            </div>
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Deleted Files</span>
                                <span className="font-medium text-muted-foreground">
                                    {usageStats ? `${usageStats.deleted_files}` : '0'}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <p>
                                Arquivos são armazenados na pasta da sua empresa no bucket. Arquivos deletados são marcados como soft delete.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Files List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Indexed Documents</CardTitle>
                        <CardDescription>Manage files available to your agents.</CardDescription>
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
                                                Limpando...
                                            </>
                                        ) : (
                                            <>
                                                <Shield className="h-4 w-4" />
                                                Limpar {deletedFiles.length} deletado(s)
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        (Admin - Nenhum arquivo deletado para limpar)
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Uploaded</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {files.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No documents uploaded yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                files.map((file) => (
                                    <TableRow key={file.id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {file.type?.startsWith('image/') ? (
                                                <ImageIcon className="h-4 w-4 text-purple-500" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-blue-500" />
                                            )}
                                            {file.name}
                                        </TableCell>
                                        <TableCell>{file.size}</TableCell>
                                        <TableCell>
                                            {file.status === 'deleted' ? (
                                                <Badge variant="secondary" className="gap-1">
                                                    Deletado
                                                </Badge>
                                            ) : file.status === 'indexing' ? (
                                                <Badge variant="secondary" className="gap-1 animate-pulse">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Indexing
                                                </Badge>
                                            ) : file.status === 'active' ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">Error</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(file.uploadedAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {file.status === 'deleted' ? (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={async () => {
                                                            await AgentService.updateFileConfig(file.id, false)
                                                            await loadFiles()
                                                        }}
                                                    >
                                                        Restaurar
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                        onClick={() => handleDelete(file.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
