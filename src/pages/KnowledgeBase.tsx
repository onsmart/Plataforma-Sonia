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
    Image as ImageIcon
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { AgentService, KnowledgeFile } from "../services/api"

const NAMESPACES = [
    { id: 'global', name: 'Global (All Agents)', color: 'bg-slate-500' },
    { id: 'sales', name: 'Sales & Marketing', color: 'bg-blue-500' },
    { id: 'support', name: 'Customer Support', color: 'bg-emerald-500' },
    { id: 'legal', name: 'Legal & HR', color: 'bg-rose-500' },
    { id: 'tech', name: 'Engineering', color: 'bg-purple-500' }
]

export function KnowledgeBase() {
    const [files, setFiles] = useState<KnowledgeFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [selectedNamespace, setSelectedNamespace] = useState("global")
    
    // Simulation of status polling
    useEffect(() => {
        loadFiles()
        const interval = setInterval(loadFiles, 5000) // Poll every 5s to check indexing status
        return () => clearInterval(interval)
    }, [])

    const loadFiles = async () => {
        const data = await AgentService.listFiles()
        setFiles(data)
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
            await AgentService.uploadFile(file, selectedNamespace)
            
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
        if (confirm("Remove this file from the knowledge base?")) {
            await AgentService.deleteFile(id)
            loadFiles()
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
                        <div className="flex justify-center mb-6">
                             <div className="flex items-center gap-3 w-full max-w-xs">
                                <Label className="whitespace-nowrap">Target Namespace:</Label>
                                <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {NAMESPACES.map(ns => (
                                            <SelectItem key={ns.id} value={ns.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${ns.color}`} />
                                                    {ns.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

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
                                <span className="font-medium">12.5 MB / 1 GB</span>
                            </div>
                            <Progress value={12} className="h-2" />
                        </div>
                        
                        <div className="space-y-2">
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Vector Indices</span>
                                <span className="font-medium">845 / 5,000</span>
                            </div>
                             <Progress value={16} className="h-2 bg-muted" indicatorClassName="bg-blue-500" />
                        </div>

                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <p>
                                Files are automatically chunked and indexed every 5 minutes. Agents will cite sources when answering.
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
                    <Button variant="ghost" size="icon" onClick={loadFiles}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Namespace</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Uploaded</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {files.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                                        <TableCell>
                                            {(() => {
                                                const ns = NAMESPACES.find(n => n.id === (file.namespace || 'global')) || NAMESPACES[0]
                                                return (
                                                    <Badge variant="secondary" className="font-normal text-xs gap-1.5 bg-muted">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${ns.color}`} />
                                                        {ns.id === 'global' ? 'Global' : ns.name}
                                                    </Badge>
                                                )
                                            })()}
                                        </TableCell>
                                        <TableCell>{file.size}</TableCell>
                                        <TableCell>
                                            {file.status === 'indexing' ? (
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
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                onClick={() => handleDelete(file.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
