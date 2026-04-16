import React, { useCallback, useMemo, useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  Handle,
  Position,
  type NodeChange,
} from "reactflow"

import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import { BulkDeleteResourcesDialog } from "../components/resources/BulkDeleteResourcesDialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { GitBranch, X, Trash2, Play, Workflow, Eraser, HelpCircle, Sparkles, LayoutGrid, Loader2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase/client"
import { useTheme } from "next-themes"
import { cn } from "../components/ui/utils"
import { coerceToSupportedAgentLanguage } from "../lib/agent-language"
import { autoLayoutFlowNodes } from "../lib/flow-auto-layout"
import { BlocksDrawer } from "../components/flows/BlocksDrawer"
import { AnimatedEdge } from "../components/flows/AnimatedEdge"
import { EditNodeDialog } from "../components/flows/EditNodeDialog"
import { GenerateFlowAiDialog } from "../components/flows/GenerateFlowAiDialog"
import { useNavigation } from "../contexts/NavigationContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import {
  StartNode,
  StopNode,
  IfElseNode,
  LoopNode,
  CommentNode,
  DelayNode,
  DebugNode,
  AgentNode,
  WaTemplateNode,
  WaSessionWindowNode,
} from "../components/flows/FlowNodes"

// Criar nodeTypes fora do componente para evitar recriação a cada render
const nodeTypes = {
  agent: AgentNode,
  start: StartNode,
  stop: StopNode,
  'if-else': IfElseNode,
  loop: LoopNode,
  comment: CommentNode,
  delay: DelayNode,
  debug: DebugNode,
  wa_template: WaTemplateNode,
  wa_session_window: WaSessionWindowNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
  default: AnimatedEdge,
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

/** Evita coordenadas absurdas (ou NaN) que travam o canvas, o MiniMap e o pan. */
const FLOW_COORD_LIMIT = 80_000

const flowPaneExtent: [[number, number], [number, number]] = [
  [-FLOW_COORD_LIMIT, -FLOW_COORD_LIMIT],
  [FLOW_COORD_LIMIT, FLOW_COORD_LIMIT],
]

function flowSignature(nodes: Node[], edges: Edge[], flowName: string, flowId: string): string {
  return JSON.stringify({
    n: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    e: edges.map((ed) => ({
      id: ed.id,
      source: ed.source,
      target: ed.target,
      sourceHandle: ed.sourceHandle ?? null,
      targetHandle: ed.targetHandle ?? null,
      type: ed.type,
    })),
    name: flowName.trim(),
    flowId,
  })
}

function clampFlowScalar(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(FLOW_COORD_LIMIT, Math.max(-FLOW_COORD_LIMIT, n))
}

function clampFlowPosition(
  pos: { x?: number; y?: number } | null | undefined
): { x: number; y: number } {
  return {
    x: clampFlowScalar(Number(pos?.x)),
    y: clampFlowScalar(Number(pos?.y)),
  }
}

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

type FlowDeletionBlockers = {
  agentsInFlows: Record<string, string[]>
  templatesUsedByAgents: Record<string, Array<{ id: string; name: string; statusId?: number | null }>>
  flowsLinkedInIntegrations: Record<string, string[]>
}

type PendingFlowLeave =
  | { kind: "route"; path: string }
  | { kind: "selectFlow"; targetFlowId: string }

export function Flows() {
  const { theme, resolvedTheme } = useTheme()
  const isDarkFlow = resolvedTheme === 'dark'
  const { user, userId } = useAuth()
  const { navigate, registerNavigationBlocker } = useNavigation()
  const { t, i18n } = useTranslation('flows')
  const [translationsReady, setTranslationsReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openGenerateAiDialog, setOpenGenerateAiDialog] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [flows, setFlows] = useState<any[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [bulkFlowsOpen, setBulkFlowsOpen] = useState(false)
  const [flowDeletionBlockers, setFlowDeletionBlockers] = useState<FlowDeletionBlockers | null>(null)
  const [bulkFlowsFetchBusy, setBulkFlowsFetchBusy] = useState(false)
  const [bulkFlowDeleteRunning, setBulkFlowDeleteRunning] = useState(false)
  const [clearCanvasDialogOpen, setClearCanvasDialogOpen] = useState(false)
  const [baselineSig, setBaselineSig] = useState(() => flowSignature([], [], "", ""))
  const [unsavedLeaveOpen, setUnsavedLeaveOpen] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<PendingFlowLeave | null>(null)
  const [leaveSaveBusy, setLeaveSaveBusy] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const onNodesChangeClamped = useCallback(
    (changes: NodeChange[]) => {
      const mapped = changes.map((ch) => {
        if (ch.type === 'position' && ch.position != null) {
          return { ...ch, position: clampFlowPosition(ch.position) }
        }
        return ch
      })
      onNodesChange(mapped)
    },
    [onNodesChange]
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const currentSig = useMemo(
    () => flowSignature(nodes, edges, flowName, selectedFlowId),
    [nodes, edges, flowName, selectedFlowId]
  )
  const isDirty = currentSig !== baselineSig

  // Garantir que as traduções estejam carregadas
  useEffect(() => {
    const checkTranslations = async () => {
      const currentLang = i18n.language || 'pt-BR'
      const flowsTranslations = i18n.getResourceBundle(currentLang, 'flows')
      
      if (flowsTranslations && Object.keys(flowsTranslations).length > 0) {
        console.log('[Flows] Traduções já disponíveis:', Object.keys(flowsTranslations).length, 'chaves')
        setTranslationsReady(true)
      } else {
        // Se não houver traduções, tentar carregar
        console.log('[Flows] Traduções não encontradas, carregando...')
        const { loadTranslationsFromDatabase } = await import('../i18n/config')
        const companiesId = localStorage.getItem('companies_id') || undefined
        await loadTranslationsFromDatabase(currentLang, companiesId)
        
        // Forçar atualização do i18n para notificar componentes
        i18n.emit('loaded')
        setTranslationsReady(true)
      }
    }
    
    checkTranslations()
    
    // Escutar mudanças no i18n
    const handleLanguageChanged = () => {
      checkTranslations()
    }
    
    const handleLoaded = () => {
      const currentLang = i18n.language || 'pt-BR'
      const flowsTranslations = i18n.getResourceBundle(currentLang, 'flows')
      if (flowsTranslations && Object.keys(flowsTranslations).length > 0) {
        setTranslationsReady(true)
      }
    }
    
    i18n.on('languageChanged', handleLanguageChanged)
    i18n.on('loaded', handleLoaded)
    i18n.on('added', handleLoaded)
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
      i18n.off('loaded', handleLoaded)
      i18n.off('added', handleLoaded)
    }
  }, [i18n])

  // Buscar node "start" para verificar se existe
  const startNode = nodes.find(n => n.type === 'start')

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Valida que source e target são strings válidas
      if (!params.source || !params.target) {
        console.warn('Tentativa de conectar com source/target inválidos:', params)
        toast.error(t('errors.connectInvalidNodes'))
        return
      }
      
      // Valida que source e target são node.id válidos
      const sourceNode = nodes.find(n => n.id === params.source)
      const targetNode = nodes.find(n => n.id === params.target)
      
      if (!sourceNode || !targetNode) {
        console.warn('Tentativa de conectar nodes inválidos:', params)
        toast.error(t('errors.connectNodesNotFound'))
        return
      }
      
      // Se o source é um node de comentário, permite a conexão mas apenas visual
      // (não afeta a execução do fluxo)
      if (sourceNode.type === 'comment') {
        // Permite criar a edge visualmente, mas ela não será executada
        const normalizedConnection: Connection = {
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle || null,
          targetHandle: params.targetHandle || null,
        }
        setEdges((eds) => addEdge(normalizedConnection, eds))
        return
      }
      
      // Garante que a edge usa node.id, não agentId
      const normalizedConnection: Connection = {
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || null,
        targetHandle: params.targetHandle || null,
      }
      
      setEdges((eds) => addEdge(normalizedConnection, eds))
    },
    [setEdges, nodes]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
    const vp = instance.getViewport()
    if (
      !Number.isFinite(vp.x) ||
      !Number.isFinite(vp.y) ||
      !Number.isFinite(vp.zoom) ||
      vp.zoom <= 0
    ) {
      instance.setViewport({ x: 0, y: 0, zoom: 1 })
    }
  }, [])

  // Função para lidar com menu de contexto (botão direito) nos nodes
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (
      node &&
      ['loop', 'if-else', 'delay', 'comment', 'debug', 'agent', 'wa_template', 'wa_session_window'].includes(
        node.type || ''
      )
    ) {
      setEditingNode(node)
      setIsEditDialogOpen(true)
    }
  }, [nodes])

  // Função para salvar edição do node
  const handleSaveNodeEdit = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          // Se for loop e tiver flowId, buscar o nome do flow
          if (node.type === 'loop' && newData.flowId) {
            const flow = flows.find(f => f.id === newData.flowId)
            if (flow) {
              newData.flowName = flow.name
            }
          }
          return { ...node, data: { ...node.data, ...newData } }
        }
        return node
      })
    )
    toast.success(t('success.nodeUpdated'))
  }, [setNodes, flows])

  // Carrega flows do banco de dados (filtrado por companies_id + globais)
  const loadFlows = useCallback(async () => {
    if (!user?.email) return

    setLoadingFlows(true)
    try {
      // ✅ USAR API DO BACKEND (inclui flows globais + da empresa)
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      
      const response = await fetch(`${BASE_URL}/flows?email=${encodeURIComponent(user.email)}`, {
        method: 'GET',
        headers: await getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        console.error('Erro ao carregar flows:', error)
        if (response.status !== 404) {
          toast.error(t('errors.loadFlows'))
        }
        setFlows([])
        return
      }

      const data = await response.json()
      setFlows(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar flows:', err)
      setFlows([])
    } finally {
      setLoadingFlows(false)
    }
  }, [user?.email])

  // Normaliza nodes: preserva IDs estáveis vindos do banco (para edges/sourceHandle continuarem válidos).
  // Só gera node-{i} quando o id vier vazio; evita colisão com sufixo aleatório.
  const normalizeNodes = useCallback((nodes: Node[]): Node[] => {
    if (!nodes || nodes.length === 0) return []

    const used = new Set<string>()

    return nodes.map((node, index) => {
      let id =
        node.id != null && String(node.id).trim() !== ''
          ? String(node.id).trim()
          : `node-${index + 1}`

      if (used.has(id)) {
        id = `${id}-${index}-${Math.random().toString(36).slice(2, 7)}`
      }
      used.add(id)

      const d = node.data || {}
      const rawAgentId = d.agentId != null && String(d.agentId).trim() !== '' ? String(d.agentId).trim() : ''
      const rawTemplateId = d.templateId != null && String(d.templateId).trim() !== '' ? String(d.templateId).trim() : ''
      const inferredTemplate =
        d.executionMode === 'template' || (rawTemplateId !== '' && rawAgentId === '')

      const baseData = inferredTemplate
        ? {
            ...d,
            executionMode: 'template' as const,
            templateId: rawTemplateId,
            templateName: d.templateName || '',
            agentId: d.agentId ?? '',
            agentName: d.agentName ?? '',
            additionalInstructions: d.additionalInstructions || '',
            skipReplyConfidence: d.skipReplyConfidence === true,
            bio: d.bio ?? null,
          }
        : {
            ...d,
            executionMode: 'agent' as const,
            agentId: rawAgentId || null,
            agentName: d.agentName || null,
            templateId: '',
            templateName: '',
            additionalInstructions: d.additionalInstructions || '',
            skipReplyConfidence: d.skipReplyConfidence === true,
            bio: d.bio ?? null,
          }

      return {
        ...node,
        id,
        position: clampFlowPosition(node.position),
        data: node.type === 'agent' ? baseData : {
          ...node.data,
          additionalInstructions: node.data?.additionalInstructions || '',
        },
      }
    })
  }, [])

  // Normaliza edges: garante que source/target referenciem node.id, não agentId
  // PRESERVA sourceHandle para if-else (true/false)
  const normalizeEdges = useCallback((edges: Edge[] | any[], nodes: Node[]): Edge[] => {
    if (!edges || edges.length === 0) return []
    if (!nodes || nodes.length === 0) return []
    
    // Cria um mapa de agentId -> node.id para correção
    const agentIdToNodeId = new Map<string, string>()
    nodes.forEach((node) => {
      if (node.data?.agentId) {
        agentIdToNodeId.set(node.data.agentId, node.id)
      }
    })
    
    // Normaliza edges
    const normalized: Edge[] = []
    edges.forEach((edge, index) => {
      let source = edge.source || ''
      let target = edge.target || ''
      
      // Se source/target apontam para agentId, corrige para node.id
      // Verifica se é um formato antigo (agent-{uuid})
      if (source.startsWith('agent-')) {
        const agentId = source.replace('agent-', '')
        source = agentIdToNodeId.get(agentId) || source
      }
      
      if (target.startsWith('agent-')) {
        const agentId = target.replace('agent-', '')
        target = agentIdToNodeId.get(agentId) || target
      }
      
      // Valida se source e target existem nos nodes
      const sourceExists = nodes.some(n => n.id === source)
      const targetExists = nodes.some(n => n.id === target)
      
      if (!sourceExists || !targetExists || !source || !target) {
        console.warn(`Edge inválida ignorada: ${source} -> ${target}`)
        return
      }
      
      // PRESERVA sourceHandle e targetHandle do JSON
      const normalizedEdge: Edge = {
        id: edge.id || `edge-${index}`,
        source,
        target,
        type: (edge.type || 'animated') as string,
        animated: true,
        // CRÍTICO: Preserva sourceHandle para if-else (true/false)
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
      }
      
      normalized.push(normalizedEdge)
    })
    
    return normalized
  }, [])

  // Carrega um flow específico
  const loadFlow = useCallback(async (flowId: string) => {
    if (!user?.email) return

    try {
      // ✅ USAR API DO BACKEND (inclui flows globais + da empresa)
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      
      const response = await fetch(`${BASE_URL}/flows/${flowId}?email=${encodeURIComponent(user.email)}`, {
        method: 'GET',
        headers: await getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        console.error('Erro ao carregar flow:', error)
        toast.error(error.error || t('errors.loadFlow'))
        return
      }

      const data = await response.json()

      // GET /flows/:id retorna o FlowData na raiz ({ startNodeId, nodes, edges }).
      // Formato legado: objeto com propriedade .nodes contendo o mesmo FlowData.
      const isFlowData = (d: unknown): d is { startNodeId: string; nodes: Node[]; edges: Edge[] | any[] } => {
        if (!d || typeof d !== 'object') return false
        const o = d as Record<string, unknown>
        return typeof o.startNodeId === 'string' && Array.isArray(o.nodes)
      }
      let flowData: { nodes?: Node[]; edges?: any[] } = {}
      if (isFlowData(data)) {
        flowData = data
      } else if (isFlowData(data?.nodes)) {
        flowData = data.nodes
      } else if (data?.nodes && Array.isArray(data.nodes)) {
        // Resposta mal formatada: só array de nodes no campo nodes
        flowData = { nodes: data.nodes as Node[], edges: Array.isArray(data.edges) ? data.edges : [] }
      }
      
      // Normaliza nodes primeiro
      let normalizedNodes: Node[] = []
      if (flowData?.nodes && Array.isArray(flowData.nodes)) {
        normalizedNodes = normalizeNodes(flowData.nodes)
      }
      
      setNodes(normalizedNodes)
      
      // Normaliza edges após normalizar nodes
      let normalizedEdges: Edge[] = []
      if (flowData?.edges && Array.isArray(flowData.edges)) {
        normalizedEdges = normalizeEdges(flowData.edges, normalizedNodes)
      }
      
      setEdges(normalizedEdges)

      const flowEntry = flows.find((fl) => fl.id === flowId)
      const pickedName = typeof flowEntry?.name === "string" ? flowEntry.name : ""
      setFlowName(pickedName)
      setBaselineSig(flowSignature(normalizedNodes, normalizedEdges, pickedName.trim(), flowId))

      toast.success(t('success.flowLoaded'))
    } catch (err) {
      console.error('Erro ao carregar flow:', err)
      toast.error(t('errors.loadFlow'))
    }
  }, [user?.email, flows, setNodes, setEdges, normalizeNodes, normalizeEdges, t])

  const openBulkFlowsModal = useCallback(async () => {
    if (!user?.email) return
    setBulkFlowsFetchBusy(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      const r = await fetch(`${BASE_URL}/deletion-blockers`, { headers: await getAuthHeaders() })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        toast.error(err?.details || err?.error || 'Não foi possível carregar dependências.')
        return
      }
      setFlowDeletionBlockers(await r.json())
      setBulkFlowsOpen(true)
    } catch {
      toast.error('Erro de rede ao carregar dependências.')
    } finally {
      setBulkFlowsFetchBusy(false)
    }
  }, [user?.email])

  const bulkFlowDeleteItems = useMemo(() => {
    return flows.map((f: { id: string; name?: string; companies_id?: string | null }) => {
      const isGlobal = f.companies_id == null || f.companies_id === ''
      const linked = flowDeletionBlockers?.flowsLinkedInIntegrations?.[f.id]
      const blocked = isGlobal || Boolean(linked?.length)
      let blockReason: string | undefined
      if (isGlobal) blockReason = 'Fluxo global da plataforma — não pode ser excluído.'
      else if (linked?.length) blockReason = `Vinculado a: ${linked.join('; ')}`
      return {
        id: f.id,
        label: typeof f.name === 'string' ? f.name : f.id,
        blocked,
        blockReason,
      }
    })
  }, [flows, flowDeletionBlockers])

  const runBulkDeleteFlows = useCallback(
    async (ids: string[]) => {
      if (!user?.email || ids.length === 0) return
      setBulkFlowDeleteRunning(true)
      let ok = 0
      let fail = 0
      try {
        const { BASE_URL, getAuthHeaders } = await import('../services/api')
        const headers = await getAuthHeaders()
        for (const flowId of ids) {
          try {
            const response = await fetch(`${BASE_URL}/flows/${flowId}`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ email: user.email }),
            })
            if (response.ok) ok++
            else fail++
          } catch {
            fail++
          }
        }
        if (ok) toast.success(`${ok} fluxo(s) excluído(s).`)
        if (fail) {
          toast.error(
            `${fail} exclusão(ões) falharam (fluxo global, integração vinculada ou permissão).`
          )
        }
        await loadFlows()
        if (selectedFlowId && ids.includes(selectedFlowId)) {
          setSelectedFlowId('')
          setFlowName('')
        }
        setBulkFlowsOpen(false)
        setFlowDeletionBlockers(null)
      } finally {
        setBulkFlowDeleteRunning(false)
      }
    },
    [user?.email, loadFlows, selectedFlowId]
  )

  // Carrega agentes disponíveis do banco de dados
  const loadAgents = useCallback(async () => {
    if (!user?.email) return

    setLoadingAgents(true)
    try {
      const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
        p_email: user.email
      })

      if (error) {
        console.error('Erro ao carregar agentes:', error)
        toast.error(t('errors.loadAgents'))
        setAvailableAgents([])
        return
      }

      const rows = Array.isArray(data) ? data : (data ? [data] : [])
      
      const mappedAgents: AvailableAgent[] = rows.map((agent: any) => ({
        id: agent.id,
        name: agent.nome || '',
        bio: agent.bio || null
      }))

      setAvailableAgents(mappedAgents)
    } catch (err) {
      console.error('Erro ao carregar agentes:', err)
      setAvailableAgents([])
    } finally {
      setLoadingAgents(false)
    }
  }, [user?.email])

  // Carrega flows e agentes ao montar o componente
  useEffect(() => {
    loadFlows()
    loadAgents()
  }, [loadFlows, loadAgents])

  useEffect(() => {
    return registerNavigationBlocker((targetPath: string) => {
      const routeOnly = targetPath.split("?")[0]
      if (routeOnly === "flows") return true
      if (!isDirty) return true
      setPendingLeave({ kind: "route", path: targetPath })
      setUnsavedLeaveOpen(true)
      return false
    })
  }, [registerNavigationBlocker, isDirty])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  const applyFlowSelection = useCallback(
    async (targetFlowId: string) => {
      setSelectedFlowId(targetFlowId)
      if (targetFlowId) {
        await loadFlow(targetFlowId)
      } else {
        setFlowName("")
        setNodes([])
        setEdges([])
        setBaselineSig(flowSignature([], [], "", ""))
      }
    },
    [loadFlow, setNodes, setEdges]
  )

  const applyAiGeneratedFlow = useCallback(
    (payload: {
      flow: {
        startNodeId: string
        nodes: Node[]
        edges: { source: string; target: string; sourceHandle?: string }[]
      }
      flowNameDraft: string
    }) => {
      const rawNodes = payload.flow.nodes || []
      const normalizedNodes = normalizeNodes(rawNodes)
      const normalizedEdges = normalizeEdges(payload.flow.edges || [], normalizedNodes)
      setNodes(normalizedNodes)
      setEdges(normalizedEdges)
      setSelectedFlowId("")
      if (payload.flowNameDraft.trim()) {
        setFlowName(payload.flowNameDraft.trim())
      }
    },
    [normalizeNodes, normalizeEdges, setNodes, setEdges, setSelectedFlowId, setFlowName, loadAgents]
  )

  const removeSelectedEdges = useCallback(() => {
    const selectedEdges = edges.filter((edge) => edge.selected)
    if (selectedEdges.length === 0) {
      return false
    }

    setEdges((eds) => eds.filter((edge) => !edge.selected))
    toast.success(t('success.connectionsDeleted', { count: selectedEdges.length }))
    return true
  }, [edges, setEdges, t])

  const removeSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    if (selectedNodes.length === 0) {
      return false
    }

    const nodeIds = selectedNodes.map((node) => node.id)
    setNodes((nds) => nds.filter((node) => !nodeIds.includes(node.id)))
    setEdges((eds) =>
      eds.filter(
        (edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
      )
    )
    toast.success(t('success.nodesDeleted', { count: selectedNodes.length }))
    return true
  }, [nodes, setNodes, setEdges, t])

  const handleOrganizeFlow = useCallback(() => {
    setNodes((nds) => {
      if (nds.length === 0) return nds
      const laidOut = autoLayoutFlowNodes(nds, edges)
      return laidOut.map((node) => ({
        ...node,
        position: clampFlowPosition(node.position),
      }))
    })
    toast.success(
      t('success.flowOrganized', { defaultValue: 'Fluxo reorganizado no canvas.' })
    )
    setTimeout(() => {
      reactFlowInstance.current?.fitView({
        padding: 0.25,
        includeHiddenNodes: false,
        duration: 350,
      })
    }, 80)
  }, [edges, setNodes, t])

  // Handler para deletar nós e edges selecionados com Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora Delete/Backspace se o usuário estiver digitando em um input, textarea ou select
      const target = event.target as HTMLElement
      const isInputElement = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.tagName === 'SELECT' ||
                            target.isContentEditable ||
                            target.closest('input, textarea, select, [contenteditable="true"]')
      
      // Ignora se o dialog de edição estiver aberto
      if (isEditDialogOpen || isInputElement) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (removeSelectedEdges()) {
          return
        }

        removeSelectedNodes()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditDialogOpen, removeSelectedEdges, removeSelectedNodes])

  // Função genérica para adicionar qualquer tipo de node
  const addNodeAtCenter = useCallback((nodeConfig: Partial<Node>) => {
    if (!reactFlowInstance.current) {
      toast.error(t('errors.addNode'))
      return
    }

    const viewport = reactFlowInstance.current.getViewport()
    const centerX = -viewport.x / viewport.zoom + (window.innerWidth * 0.4) / viewport.zoom
    const centerY = -viewport.y / viewport.zoom + (window.innerHeight * 0.3) / viewport.zoom

    const existingNodeIds = nodes.map(n => n.id)
    let nodeNumber = 1
    while (existingNodeIds.includes(`node-${nodeNumber}`)) {
      nodeNumber++
    }
    const nodeId = `node-${nodeNumber}`

    const newNode: Node = {
      id: nodeId,
      type: nodeConfig.type || "agent",
      position: clampFlowPosition(
        nodeConfig.position ?? {
          x: Number.isFinite(centerX) ? centerX : Math.random() * 500 + 100,
          y: Number.isFinite(centerY) ? centerY : Math.random() * 300 + 100,
        }
      ),
      data: nodeConfig.data || {},
      draggable: true,
    }

    setNodes((nds) => [...nds, newNode])
    
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ 
          padding: 0.3,
          includeHiddenNodes: false,
          duration: 300
        })
      }
    }, 150)

    return nodeId
  }, [nodes, setNodes])

  const openNodeEditor = useCallback((nodeId: string) => {
    setTimeout(() => {
      setNodes((currentNodes) => {
        const targetNode = currentNodes.find(node => node.id === nodeId) || null
        if (targetNode) {
          setEditingNode(targetNode)
          setIsEditDialogOpen(true)
        }
        return currentNodes
      })
    }, 0)
  }, [setNodes])

  function addAgentNode(agent: AvailableAgent) {
    const nodeId = addNodeAtCenter({
      type: "agent",
      data: { 
        label: agent.name,
        executionMode: 'agent',
        agentId: agent.id,
        agentName: agent.name,
        bio: agent.bio,
      },
    })

    if (nodeId) {
      toast.success(t('success.agentAdded', { name: agent.name }))
    }
  }

  // Função para adicionar blocos do drawer
  const addBlockNode = useCallback((blockType: string) => {
    const blockConfigs: Record<string, Partial<Node>> = {
      'start': {
        type: 'start',
        data: { label: t('blocks.start') },
      },
      'stop': {
        type: 'stop',
        data: { label: t('blocks.stop') },
      },
      'if-else': {
        type: 'if-else',
        data: { label: t('blocks.ifElse'), condition: '{{condição}}' },
      },
      'loop': {
        type: 'loop',
        data: { label: t('blocks.loop'), iterations: '10' },
      },
      'comment': {
        type: 'comment',
        data: { label: t('blocks.comment'), comment: '' },
      },
      'delay': {
        type: 'delay',
        data: { label: t('blocks.delay'), duration: t('blocks.delayDuration') },
      },
      'debug': {
        type: 'debug',
        data: { label: t('blocks.debug'), debugKeys: '', debugMessage: '' },
      },
      'wa_template': {
        type: 'wa_template',
        data: {
          label: t('blocks.waTemplate', { defaultValue: 'Template Meta' }),
          waTemplateName: '',
          waTemplateLanguage: 'pt_BR',
          waTemplateComponentsJson: '',
          waIntegrationId: '',
        },
      },
      'wa_session_window': {
        type: 'wa_session_window',
        data: {
          label: t('blocks.waSession', { defaultValue: 'Janela 24h' }),
        },
      },
      'agent': {
        type: 'agent',
        data: {
          label: 'Agente IA',
          executionMode: 'agent',
          templateId: '',
          templateName: '',
          agentId: '',
          agentName: '',
          additionalInstructions: '',
          bio: null,
        },
      },
    }

    const config = blockConfigs[blockType]
    if (!config) {
      toast.error(t('errors.blockTypeNotFound', { type: blockType }))
      return
    }

    const nodeId = addNodeAtCenter(config)
    if (nodeId) {
      const blockLabels: Record<string, string> = {
        'start': t('blocks.start'),
        'stop': t('blocks.stop'),
        'if-else': t('blocks.ifElse'),
        'loop': t('blocks.loop'),
        'comment': t('blocks.comment'),
        'delay': t('blocks.delay'),
        'debug': t('blocks.debug'),
        'wa_template': t('blocks.waTemplate', { defaultValue: 'Template Meta' }),
        'wa_session_window': t('blocks.waSession', { defaultValue: 'Janela 24h' }),
        'agent': 'Agente IA',
      }
      toast.success(t('success.blockAdded', { name: blockLabels[blockType] }))
      setDrawerOpen(false)

      if (blockType === 'agent' || blockType === 'wa_template') {
        openNodeEditor(nodeId)
      }
    }
  }, [addNodeAtCenter, openNodeEditor, t])

  function handleClearCanvas() {
    if (nodes.length === 0 && edges.length === 0) {
      toast.info(t('info.canvasAlreadyEmpty'))
      return
    }

    setClearCanvasDialogOpen(true)
  }

  function confirmClearCanvas() {
    setNodes([])
    setEdges([])
    setSelectedFlowId("")
    setFlowName("")
    setBaselineSig(flowSignature([], [], "", ""))
    toast.success(t('success.canvasCleared'))
    setClearCanvasDialogOpen(false)
  }


  async function saveFlow(): Promise<boolean> {
    if (!flowName.trim()) {
      toast.error(t('errors.nameRequired'))
      return false
    }

    if (!user?.email) {
      toast.error(t('errors.userNotAuthenticated'))
      return false
    }

    // Busca o node de tipo "start"
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      toast.error(t('errors.startBlockRequired'))
      return false
    }

    const metaWarnings: string[] = []
    for (const n of nodes) {
      if (n.type === 'wa_template') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.waTemplateName || '').trim()) {
          metaWarnings.push('Template Meta: preencha o nome do template no bloco antes de ir a produção.')
        }
        if (!String(d.waTemplateLanguage || '').trim()) {
          metaWarnings.push('Template Meta: defina o idioma (ex.: pt_BR).')
        }
      }
    }
    if (nodes.some((n) => n.type === 'wa_session_window')) {
      metaWarnings.push('Janela 24h: use o ramo "Fora" com template Meta quando não houver sessão aberta.')
    }
    const uniqueWarnings = Array.from(new Set(metaWarnings))
    for (const msg of uniqueWarnings) {
      toast.warning(msg, { duration: 6500 })
    }

    if (import.meta.env.VITE_FLOW_VALIDATE_META_STRICT === 'true') {
      const strictErrors: string[] = []
      for (const n of nodes) {
        if (n.type === 'wa_template') {
          const d = (n.data as Record<string, unknown>) || {}
          if (!String(d.waTemplateName || '').trim()) strictErrors.push('Template Meta: nome obrigatório (modo estrito).')
          if (!String(d.waTemplateLanguage || '').trim()) strictErrors.push('Template Meta: idioma obrigatório (modo estrito).')
        }
      }
      if (strictErrors.length > 0) {
        toast.error(strictErrors[0], { duration: 8000 })
        return false
      }
    }

    try {
      // Formata edges incluindo sourceHandle (para if-else)
      const formattedEdges = edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined // Inclui sourceHandle se existir
      }))

      // Estrutura do JSON conforme modelo fornecido
      const flowData = {
        startNodeId: startNode.id,
        nodes: nodes,
        edges: formattedEdges, // Array simples sem id
      }

      // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      
      const payload = {
        email: user.email,
        name: flowName.trim(),
        nodes: flowData, // JSON completo com startNodeId, nodes e edges
        user_email: user.email // Mantém para compatibilidade/auditoria
      }

      // Se já existe um flow selecionado, atualiza. Senão, cria novo
      const method = selectedFlowId ? 'PUT' : 'POST'
      const url = selectedFlowId 
        ? `${BASE_URL}/flows/${selectedFlowId}`
        : `${BASE_URL}/flows`

      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let errorMessage = t('errors.saveFlow')
        
        try {
          const error = await response.json()
          console.error('[saveFlow] Erro ao salvar flow:', error)
          
          // Mensagem específica para não-admin
          if (response.status === 403) {
            errorMessage = error.error || error.details || 'Você não tem permissão para criar/editar flows. Apenas administradores podem realizar esta ação.'
          } else {
            errorMessage = error.error || error.details || error.message || t('errors.saveFlow')
          }
        } catch (parseError) {
          // Se não conseguir parsear o JSON, usar mensagem padrão
          if (response.status === 403) {
            errorMessage = 'Você não tem permissão para criar/editar flows. Apenas administradores podem realizar esta ação.'
          }
        }
        
        toast.error(errorMessage, {
          duration: 5000
        })
        return false
      }

      toast.success(t('success.flowSaved'))

      const body = await response.json().catch(() => ({}))
      let finalId = selectedFlowId
      let finalName = flowName.trim()
      if (method === 'POST' && body?.flow?.id) {
        setSelectedFlowId(body.flow.id)
        finalId = body.flow.id
      }
      if (typeof body.flow?.name === 'string' && body.flow.name.trim()) {
        finalName = body.flow.name.trim()
        setFlowName(finalName)
      }

      await loadFlows()
      setBaselineSig(flowSignature(nodes, edges, finalName, finalId))
      return true
    } catch (err) {
      console.error('Erro ao salvar flow:', err)
      toast.error(t('errors.saveFlow'), {
        duration: 5000
      })
      return false
    }
  }

  async function handleUnsavedSaveAndContinue() {
    const pending = pendingLeave
    if (!pending) return
    setLeaveSaveBusy(true)
    try {
      const ok = await saveFlow()
      if (!ok) return
      setUnsavedLeaveOpen(false)
      setPendingLeave(null)
      if (pending.kind === "route") {
        navigate(pending.path, { bypassBlockers: true })
      } else {
        await applyFlowSelection(pending.targetFlowId)
      }
    } finally {
      setLeaveSaveBusy(false)
    }
  }

  function handleUnsavedDiscardAndContinue() {
    const pending = pendingLeave
    if (!pending) return
    setUnsavedLeaveOpen(false)
    setPendingLeave(null)
    if (pending.kind === "route") {
      navigate(pending.path, { bypassBlockers: true })
    } else {
      void applyFlowSelection(pending.targetFlowId)
    }
  }

  const hasSelectedNodes = nodes.some((node) => node.selected)
  const showFlowNameHint = nodes.length > 0 && !flowName.trim()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2">
          <Select
            value={selectedFlowId}
            onValueChange={(value) => {
              if (value === selectedFlowId) return
              const run = () => {
                setSelectedFlowId(value)
                if (value) {
                  void loadFlow(value)
                } else {
                  setFlowName("")
                  setNodes([])
                  setEdges([])
                  setBaselineSig(flowSignature([], [], "", ""))
                }
              }
              if (isDirty) {
                setPendingLeave({ kind: "selectFlow", targetFlowId: value })
                setUnsavedLeaveOpen(true)
                return
              }
              run()
            }}
          >
            <SelectTrigger className="w-full min-w-[200px] max-w-[240px] shrink-0 sm:w-[220px]">
              <SelectValue placeholder={loadingFlows ? t("loading.loading") : t("select.flow")} />
            </SelectTrigger>
            <SelectContent>
              {flows.length === 0 ? (
                <SelectItem value="none" disabled>
                  {t("empty.noFlows")}
                </SelectItem>
              ) : (
                flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[200px] sm:max-w-md">
            <Label
              htmlFor="flow-name-inline"
              className="text-sm text-muted-foreground shrink-0 whitespace-nowrap"
            >
              {t("dialog.saveFlow.nameLabel")}
            </Label>
            <Input
              id="flow-name-inline"
              className={cn(
                "h-9 min-w-0",
                showFlowNameHint &&
                  "border-amber-500/80 ring-1 ring-amber-500/50 focus-visible:ring-amber-500/70"
              )}
              placeholder={t("dialog.saveFlow.namePlaceholder")}
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              aria-invalid={showFlowNameHint}
              aria-label={t("dialog.saveFlow.nameLabel")}
            />
            {showFlowNameHint ? (
              <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
                {t("warnings.nameRequiredVisible", {
                  defaultValue: "Dê um nome ao fluxo para poder salvá-lo.",
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          <Button variant="outline" className="shrink-0" onClick={() => setDrawerOpen(true)}>
            <Workflow className="mr-2 h-4 w-4" /> {t("button.blocks")}
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={handleOrganizeFlow}
            disabled={nodes.length === 0}
            title={t("button.organizeFlowTooltip", {
              defaultValue:
                "Redistribui os blocos em colunas conforme as ligações, para facilitar a leitura.",
            })}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />{" "}
            {t("button.organizeFlow", { defaultValue: "Organizar fluxo" })}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("toolbar.moreActions", { defaultValue: "Mais ações" })}
                title={t("toolbar.moreActions", { defaultValue: "Mais ações" })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                disabled={bulkFlowsFetchBusy || flows.length === 0}
                className="text-destructive focus:text-destructive"
                onClick={() => void openBulkFlowsModal()}
              >
                {bulkFlowsFetchBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir em lote
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenGenerateAiDialog(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Criar com IA
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasSelectedNodes}
                className="text-destructive focus:text-destructive"
                onClick={removeSelectedNodes}
              >
                <Trash2 className="mr-2 h-4 w-4" />{" "}
                {t("button.deleteSelectedBlock", { defaultValue: "Remover Bloco" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearCanvas}>
                <Eraser className="mr-2 h-4 w-4" /> {t("button.clearCanvas")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => void saveFlow()}
            disabled={!flowName.trim()}
            title={
              !flowName.trim()
                ? t("warnings.nameRequiredVisible", {
                    defaultValue: "Dê um nome ao fluxo para poder salvá-lo.",
                  })
                : undefined
            }
            className="shrink-0 text-white shadow-lg transition-all hover:shadow-xl"
            style={{
              background: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
              color: "white",
              boxShadow:
                theme === "dark"
                  ? "0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)"
                  : "0 8px 20px rgba(8, 145, 178, 0.4)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                theme === "dark"
                  ? "0 0 30px rgba(34, 211, 238, 0.6), 0 12px 30px rgba(8, 145, 178, 0.4)"
                  : "0 12px 30px rgba(8, 145, 178, 0.5)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow =
                theme === "dark"
                  ? "0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)"
                  : "0 8px 20px rgba(8, 145, 178, 0.4)"
            }}
          >
            <GitBranch className="mr-2 h-4 w-4" style={{ color: "white" }} /> {t("button.saveFlow")}
          </Button>
        </div>
      </div>

      <Dialog
        open={unsavedLeaveOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUnsavedLeaveOpen(false)
            setPendingLeave(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("unsaved.title", { defaultValue: "Alterações não salvas" })}
            </DialogTitle>
            <DialogDescription>
              {t("unsaved.description", {
                defaultValue:
                  "Você fez alterações neste fluxo. Deseja salvar antes de sair ou trocar de fluxo?",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnsavedLeaveOpen(false)
                setPendingLeave(null)
              }}
            >
              {t("unsaved.cancel", { defaultValue: "Cancelar" })}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={leaveSaveBusy}
              onClick={() => handleUnsavedDiscardAndContinue()}
            >
              {t("unsaved.discard", { defaultValue: "Não salvar" })}
            </Button>
            <Button type="button" disabled={leaveSaveBusy} onClick={() => void handleUnsavedSaveAndContinue()}>
              {leaveSaveBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("unsaved.save", { defaultValue: "Salvar" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerateFlowAiDialog
        open={openGenerateAiDialog}
        onOpenChange={setOpenGenerateAiDialog}
        initialFlowName={flowName}
        defaultAgentLanguage={coerceToSupportedAgentLanguage(i18n.language || "pt-BR", "pt-BR")}
        onApplied={(payload) => {
          applyAiGeneratedFlow({
            flow: payload.flow,
            flowNameDraft: payload.flowNameDraft,
          })
          void loadAgents()
        }}
      />

      {/* Drawer de blocos */}
      <BlocksDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        onAddBlock={addBlockNode}
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('editor.title')}</CardTitle>
                <div 
                  className="cursor-help"
                  title={t('editor.tooltip')}
                >
                  <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
                </div>
              </div>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {t('editor.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="flex-1 min-h-0 relative">
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center space-y-4">
                <div 
                  className="mx-auto w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    borderColor: theme === 'dark' ? '#334155' : '#dbeafe',
                    boxShadow: '0 10px 40px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)'
                  }}
                >
                  <GitBranch className="h-12 w-12" style={{ color: '#60a5fa', strokeWidth: 2 }} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>{t('empty.startCreating')}</h3>
                  <p className="text-sm max-w-md" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                    {t('empty.startCreatingDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeClamped}
            onEdgesChange={onEdgesChange}
            nodeExtent={flowPaneExtent}
            translateExtent={flowPaneExtent}
            onConnect={onConnect}
            onInit={onInit}
            onNodeContextMenu={(event, node) => {
              event.preventDefault()
              event.stopPropagation()
              if (node && node.id && ['loop', 'if-else', 'delay', 'comment', 'debug', 'agent'].includes(node.type || '')) {
                handleNodeDoubleClick(node.id)
              }
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'animated',
              animated: true,
            }}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            className={cn(
              "min-h-[320px] w-full max-w-full",
              /* Canvas: contraste com cartões brancos (claro) e leitura no escuro */
              isDarkFlow
                ? "bg-[#070b10] text-slate-100"
                : "bg-[#cfd9e4] text-slate-900"
            )}
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode={['Meta', 'Control']}
            selectionOnDrag
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            onDrop={(event) => {
              event.preventDefault()
              const blockType = event.dataTransfer.getData('blockType')
              const agentId = event.dataTransfer.getData('agentId')
              const agentName = event.dataTransfer.getData('agentName')
              if (blockType) {
                addBlockNode(blockType)
              } else if (agentId && agentName) {
                const agent = availableAgents.find(a => a.id === agentId)
                if (agent) {
                  addAgentNode(agent)
                }
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
          >
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'agent') return '#22c55e'
                if (node.type === 'start') return '#3b82f6'
                if (node.type === 'stop') return '#a855f7'
                if (node.type === 'if-else') return '#f97316'
                if (node.type === 'loop') return '#6366f1'
                if (node.type === 'comment') return '#64748b'
                if (node.type === 'delay') return '#06b6d4'
                if (node.type === 'debug') return '#9333ea'
                return '#94a3b8'
              }}
              maskColor={isDarkFlow ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.5)'}
              className={
                isDarkFlow
                  ? '!rounded-xl !border !border-slate-500/45 !shadow-md'
                  : '!rounded-xl !border !border-slate-400/50 !shadow-md'
              }
              style={{
                backgroundColor: isDarkFlow ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.97)',
                borderRadius: '0.75rem',
              }}
            />
            <Controls 
              className={
                isDarkFlow
                  ? '!rounded-xl !border !border-slate-500/45 !shadow-md [&_svg]:text-slate-200 [&_button]:border-slate-600/50'
                  : '!rounded-xl !border !border-slate-400/55 !shadow-md [&_svg]:text-slate-700 [&_button]:border-slate-300/90'
              }
              style={{
                backgroundColor: isDarkFlow ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.98)',
                borderRadius: '0.75rem',
              }}
            />
            <Background
              id="sonia-flow-dots"
              variant={BackgroundVariant.Dots}
              gap={18}
              size={2.25}
              color={isDarkFlow ? 'rgba(226, 232, 240, 0.38)' : 'rgba(51, 65, 85, 0.45)'}
            />
          </ReactFlow>
        </div>
      </Card>

      <BulkDeleteResourcesDialog
        open={bulkFlowsOpen}
        onOpenChange={(o) => {
          setBulkFlowsOpen(o)
          if (!o) setFlowDeletionBlockers(null)
        }}
        title="Excluir fluxos em lote"
        description="Marque os fluxos da sua empresa que deseja remover. Fluxos globais ou vinculados a integrações (ex.: WhatsApp) ficam bloqueados. Esta ação não pode ser desfeita."
        items={bulkFlowDeleteItems}
        loading={false}
        confirmBusy={bulkFlowDeleteRunning}
        onConfirm={runBulkDeleteFlows}
      />

      <AlertDialog open={clearCanvasDialogOpen} onOpenChange={setClearCanvasDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('clearCanvasModal.title', { defaultValue: 'Limpar o canvas?' })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {t('confirm.clearCanvas', {
                    defaultValue:
                      'Tem certeza de que deseja limpar o canvas? Todos os blocos e ligações serão removidos da tela; o fluxo salvo no banco só muda quando você salvar de novo.',
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t('clearCanvasModal.hint', {
                    defaultValue:
                      'Se este fluxo já estiver salvo, você pode selecioná-lo de novo na lista para recarregar a versão do banco.',
                  })}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmClearCanvas}>
              <Eraser className="mr-2 h-4 w-4" />
              {t('button.clearCanvas', { defaultValue: 'Limpar canvas' })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edição de nodes */}
      {isEditDialogOpen && editingNode && (
        <EditNodeDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false)
            setEditingNode(null)
          }}
          node={editingNode}
          onSave={handleSaveNodeEdit}
          availableAgents={availableAgents}
          availableFlows={flows.map(f => ({ id: f.id, name: f.name }))}
          agentsOnly
          userEmail={user?.email ?? undefined}
        />
      )}
      
      {/* DIV INVISÍVEL PARA FORÇAR O CARREGAMENTO DAS CORES DOS FLUXOS */}
      <div className="hidden 
        bg-blue-50 bg-red-50 bg-orange-50 bg-purple-50 bg-emerald-50 bg-cyan-50
        text-blue-600 text-red-600 text-orange-600 text-purple-600 text-emerald-600 text-cyan-600
        border-blue-200 border-red-200 border-orange-200 border-purple-200 border-emerald-200 border-cyan-200" 
      />
    </div>
  )
}
