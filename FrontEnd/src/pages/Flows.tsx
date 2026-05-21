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
import { GitBranch, X, Trash2, Workflow, Eraser, HelpCircle, Sparkles, LayoutGrid, Loader2, MoreHorizontal, Pencil, Rocket } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase/client"
import { useTheme } from "next-themes"
import { cn } from "../components/ui/utils"
import { filterFamilySubflows, filterMainFlows } from "../lib/flow-kind"
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
  SwitchNode,
  LoopNode,
  SubflowNode,
  CommentNode,
  DelayNode,
  ScheduleNode,
  DebugNode,
  AgentNode,
  WaTemplateNode,
  HubSpotWhatsAppCampaignNode,
  CrmContactNode,
  AppointmentNode,
  DocumentIntakeNode,
  HumanHandoffNode,
  WaSessionWindowNode,
  WhatsAppMessageNode,
  EmailSendNode,
  EmailReadNode,
} from "../components/flows/FlowNodes"

// Criar nodeTypes fora do componente para evitar recriação a cada render
const nodeTypes = {
  agent: AgentNode,
  start: StartNode,
  stop: StopNode,
  'if-else': IfElseNode,
  switch: SwitchNode,
  loop: LoopNode,
  subflow: SubflowNode,
  comment: CommentNode,
  delay: DelayNode,
  schedule: ScheduleNode,
  debug: DebugNode,
  wa_template: WaTemplateNode,
  hubspot_whatsapp_campaign: HubSpotWhatsAppCampaignNode,
  crm_contact: CrmContactNode,
  appointment: AppointmentNode,
  document_intake: DocumentIntakeNode,
  human_handoff: HumanHandoffNode,
  wa_session_window: WaSessionWindowNode,
  whatsapp_message: WhatsAppMessageNode,
  email_send: EmailSendNode,
  email_read: EmailReadNode,
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

type FlowListItem = {
  id: string
  name?: string
  created_at?: string
  companies_id?: string | null
  flowKind?: 'main' | 'subflow'
  parentFlowId?: string | null
  parentFlowName?: string | null
  subflowKey?: string | null
  subflowOrder?: number | null
  referencedByNodeId?: string | null
  referencedByNodeLabel?: string | null
  subflowRefs?: Array<{
    flowId: string
    flowName?: string
    nodeId?: string
    nodeLabel?: string
    connected?: boolean
  }>
}

type SubflowReference = {
  flowId: string
  flowName?: string
  nodeId?: string
  nodeLabel?: string
  connected?: boolean
  parentFlowId?: string
  parentFlowName?: string
}

type FlowFamilyPart = {
  id: string
  name: string
  kind: 'main' | 'subflow' | 'missing'
  order: number
  orderLabel: string
  connected: boolean
  active: boolean
  sourceLabel?: string
}

function normalizeFlowTitle(value?: string | null): string {
  return String(value || '').trim()
}

function parseOrderFromFlowName(name?: string | null): number | null {
  const match = normalizeFlowTitle(name).match(/-\s*(\d{1,3})\b/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function resolveSubflowOrder(flow?: FlowListItem | null, fallback = 999): number {
  if (typeof flow?.subflowOrder === 'number' && Number.isFinite(flow.subflowOrder)) {
    return flow.subflowOrder
  }
  return parseOrderFromFlowName(flow?.name) ?? fallback
}

function shortFlowPartName(name: string, rootName?: string | null): string {
  let label = normalizeFlowTitle(name)
  const root = normalizeFlowTitle(rootName)
  if (root && label.toLowerCase().startsWith(root.toLowerCase())) {
    label = label.slice(root.length).replace(/^\s*-\s*/, '').trim()
  }
  return label || name
}

function resolveFamilyRootFlowId(selectedFlow: FlowListItem | null, flows: FlowListItem[]): string {
  if (!selectedFlow) return ''
  if (selectedFlow.flowKind !== 'subflow') return selectedFlow.id

  const mainByParentName = normalizeFlowTitle(selectedFlow.parentFlowName)
    ? flows.find(
        (flow) =>
          flow.flowKind !== 'subflow' &&
          normalizeFlowTitle(flow.name).toLowerCase() ===
            normalizeFlowTitle(selectedFlow.parentFlowName).toLowerCase()
      )
    : null
  if (mainByParentName) return mainByParentName.id

  const visited = new Set<string>()
  let cursorId = String(selectedFlow.parentFlowId || '').trim()
  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId)
    const cursor = flows.find((flow) => flow.id === cursorId)
    if (!cursor) break
    if (cursor.flowKind !== 'subflow') return cursor.id

    const parentByName = normalizeFlowTitle(cursor.parentFlowName)
      ? flows.find(
          (flow) =>
            flow.flowKind !== 'subflow' &&
            normalizeFlowTitle(flow.name).toLowerCase() ===
              normalizeFlowTitle(cursor.parentFlowName).toLowerCase()
        )
      : null
    if (parentByName) return parentByName.id
    cursorId = String(cursor.parentFlowId || '').trim()
  }

  return String(selectedFlow.parentFlowId || selectedFlow.id || '').trim()
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
  const { resolvedTheme } = useTheme()
  const isDarkFlow = resolvedTheme === 'dark'
  const { user, userId, companiesId } = useAuth()
  const { navigate, registerNavigationBlocker } = useNavigation()
  const { t, i18n } = useTranslation('flows')
  const [translationsReady, setTranslationsReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openGenerateAiDialog, setOpenGenerateAiDialog] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [flows, setFlows] = useState<FlowListItem[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [bulkFlowsOpen, setBulkFlowsOpen] = useState(false)
  const [flowDeletionBlockers, setFlowDeletionBlockers] = useState<FlowDeletionBlockers | null>(null)
  const [bulkFlowsFetchBusy, setBulkFlowsFetchBusy] = useState(false)
  const [bulkFlowDeleteRunning, setBulkFlowDeleteRunning] = useState(false)
  const [clearCanvasDialogOpen, setClearCanvasDialogOpen] = useState(false)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    nodeId: string
    nodeLabel: string
    x: number
    y: number
  } | null>(null)
  const [baselineSig, setBaselineSig] = useState(() => flowSignature([], [], "", ""))
  const [unsavedLeaveOpen, setUnsavedLeaveOpen] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<PendingFlowLeave | null>(null)
  const [leaveSaveBusy, setLeaveSaveBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [flowPublishInfo, setFlowPublishInfo] = useState<{
    hasUnpublishedChanges: boolean
    draftVersion: number | null
    publishedVersion: number | null
    publishedAt: string | null
  } | null>(null)
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

  const canEditNode = useCallback((nodeType?: string | null) => {
    return [
      'if-else',
      'switch',
      'loop',
      'subflow',
      'delay',
      'schedule',
      'comment',
      'debug',
      'agent',
      'wa_template',
      'hubspot_whatsapp_campaign',
      'crm_contact',
      'appointment',
      'document_intake',
      'human_handoff',
      'wa_session_window',
      'whatsapp_message',
      'email_send',
      'email_read',
    ].includes(nodeType || '')
  }, [])

  const currentSig = useMemo(
    () => flowSignature(nodes, edges, flowName, selectedFlowId),
    [nodes, edges, flowName, selectedFlowId]
  )
  const isDirty = currentSig !== baselineSig
  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedFlowId) || null,
    [flows, selectedFlowId]
  )
  const mainFlows = useMemo(() => filterMainFlows(flows), [flows])
  const selectedMainFlowId = useMemo(
    () => resolveFamilyRootFlowId(selectedFlow, flows),
    [flows, selectedFlow]
  )
  const selectedMainFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedMainFlowId) || null,
    [flows, selectedMainFlowId]
  )
  const connectedSubflowRefs = useMemo<SubflowReference[]>(() => {
    return nodes
      .filter((node) => node.type === 'subflow')
      .map((node) => {
        const data = (node.data || {}) as Record<string, unknown>
        const flowId = String(data.subflowId || data.flowId || '').trim()
        const target = flows.find((flow) => flow.id === flowId) || null
        return {
          flowId,
          flowName:
            String(data.subflowName || data.flowName || '').trim() ||
            target?.name ||
            'Subfluxo sem nome',
          nodeId: node.id,
          nodeLabel: String(data.label || 'Subfluxo').trim(),
          connected: Boolean(flowId && target),
          parentFlowId: selectedFlowId,
          parentFlowName: selectedFlow?.name || flowName,
        }
      })
  }, [flows, flowName, nodes, selectedFlow?.name, selectedFlowId])

  const flowFamilyParts = useMemo<FlowFamilyPart[]>(() => {
    if (!selectedFlowId) return []

    const rootFlow = selectedMainFlow || selectedFlow
    if (!rootFlow) return []

    const rootId = rootFlow.id
    const rootName = normalizeFlowTitle(rootFlow.name)
    const refsByFlowId = new Map<string, SubflowReference>()
    const candidateIds = new Set<string>()
    const missingRefs: SubflowReference[] = []

    const addRef = (ref: SubflowReference, parentFlow?: FlowListItem | null) => {
      const flowId = String(ref.flowId || '').trim()
      if (!flowId) return
      const target = flows.find((flow) => flow.id === flowId) || null
      const enrichedRef: SubflowReference = {
        ...ref,
        flowName: ref.flowName || target?.name || 'Subfluxo sem nome',
        parentFlowId: ref.parentFlowId || parentFlow?.id,
        parentFlowName: ref.parentFlowName || parentFlow?.name,
        connected: Boolean(target),
      }
      refsByFlowId.set(flowId, enrichedRef)
      if (target) candidateIds.add(flowId)
      else missingRefs.push(enrichedRef)
    }

    const addFlowRefs = (flow: FlowListItem | null | undefined) => {
      if (!flow) return
      for (const ref of flow.subflowRefs || []) {
        addRef(ref, flow)
      }
    }

    addFlowRefs(rootFlow)
    if (selectedFlowId === rootId) {
      for (const ref of connectedSubflowRefs) addRef(ref, rootFlow)
    }

    for (const flow of flows) {
      const parentIdMatches = normalizeFlowTitle(flow.parentFlowId) === rootId
      const parentNameMatches =
        Boolean(rootName) &&
        normalizeFlowTitle(flow.parentFlowName).toLowerCase() === rootName.toLowerCase()
      if (flow.id !== rootId && (parentIdMatches || parentNameMatches)) {
        candidateIds.add(flow.id)
      }
    }

    let expanded = true
    while (expanded) {
      expanded = false
      for (const flowId of Array.from(candidateIds)) {
        const flow = flows.find((item) => item.id === flowId)
        const before = candidateIds.size
        addFlowRefs(flow)
        if (selectedFlowId === flowId) {
          for (const ref of connectedSubflowRefs) addRef(ref, flow)
        }
        if (candidateIds.size > before) expanded = true
      }
    }

    if (selectedFlow?.flowKind === 'subflow') {
      candidateIds.add(selectedFlow.id)
    }

    const parts: FlowFamilyPart[] = [
      {
        id: rootId,
        name: rootFlow.name || 'Fluxo principal',
        kind: 'main',
        order: 0,
        orderLabel: 'Principal',
        connected: true,
        active: rootId === selectedFlowId,
      },
    ]

    Array.from(candidateIds)
      .map((flowId, index) => ({ flow: flows.find((item) => item.id === flowId) || null, index }))
      .filter(({ flow }) => Boolean(flow && flow.id !== rootId))
      .sort((a, b) => {
        const orderA = resolveSubflowOrder(a.flow, a.index + 100)
        const orderB = resolveSubflowOrder(b.flow, b.index + 100)
        if (orderA !== orderB) return orderA - orderB
        return normalizeFlowTitle(a.flow?.name).localeCompare(normalizeFlowTitle(b.flow?.name))
      })
      .forEach(({ flow }, index) => {
        if (!flow) return
        const order = resolveSubflowOrder(flow, index + 1)
        const ref = refsByFlowId.get(flow.id)
        parts.push({
          id: flow.id,
          name: shortFlowPartName(flow.name || flow.id, rootName),
          kind: 'subflow',
          order,
          orderLabel: String(order).padStart(2, '0'),
          connected: true,
          active: flow.id === selectedFlowId,
          sourceLabel: ref?.nodeLabel,
        })
      })

    missingRefs.forEach((ref, index) => {
      const order = 900 + index
      parts.push({
        id: ref.flowId,
        name: shortFlowPartName(ref.flowName || ref.flowId, rootName),
        kind: 'missing',
        order,
        orderLabel: '!',
        connected: false,
        active: false,
        sourceLabel: ref.nodeLabel,
      })
    })

    return parts
  }, [connectedSubflowRefs, flows, selectedFlow, selectedFlowId, selectedMainFlow])

  const nextSubflowOrder = useMemo(() => {
    const orders = flowFamilyParts
      .filter((part) => part.kind === 'subflow')
      .map((part) => part.order)
      .filter((order) => Number.isFinite(order) && order < 900)
    return Math.max(0, ...orders) + 1
  }, [flowFamilyParts])

  /** Picker do nó subfluxo/loop: só módulos da família do fluxo raiz (não todos os fluxos da empresa). */
  const familySubflowsForPicker = useMemo(() => {
    const rootId = selectedMainFlowId || ''
    const rootName = selectedMainFlow?.name || flowName || selectedFlow?.parentFlowName
    return filterFamilySubflows(flows, rootId, rootName)
      .filter((flow) => flow.id !== selectedFlowId)
      .map((flow) => ({
        id: flow.id,
        name: flow.name || flow.id,
      }))
  }, [
    flows,
    selectedMainFlowId,
    selectedMainFlow?.name,
    flowName,
    selectedFlow?.parentFlowName,
    selectedFlowId,
  ])

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
    if (node && canEditNode(node.type)) {
      setEditingNode(node)
      setIsEditDialogOpen(true)
    }
  }, [canEditNode, nodes])

  // Função para salvar edição do node
  const handleSaveNodeEdit = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          // Se for loop/subfluxo e tiver flowId, buscar o nome do flow
          if (node.type === 'loop' && newData.flowId) {
            const flow = flows.find(f => f.id === newData.flowId)
            if (flow) {
              newData.flowName = flow.name
            }
          }
          if (node.type === 'subflow' && newData.subflowId) {
            const flow = flows.find(f => f.id === newData.subflowId)
            if (flow) {
              newData.subflowName = flow.name
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
      // Lista completa (main + subfluxos) — necessário para editor de família e pickers de módulo
      const { fetchFlowsList } = await import('../services/flows-api')
      const data = await fetchFlowsList(user.email)
      setFlows(data as FlowListItem[])
    } catch (err) {
      console.error('Erro ao carregar flows:', err)
      toast.error(t('errors.loadFlows'))
      setFlows([])
    } finally {
      setLoadingFlows(false)
    }
  }, [user?.email])

  // Normaliza nodes: preserva IDs estáveis vindos do banco (para edges/sourceHandle continuarem válidos).
  // Só gera node-{i} quando o id vier vazio; evita colisão com sufixo aleatório.
  const normalizeNodes = useCallback((nodes: Node[], ownerFlowKind: 'main' | 'subflow' = 'main'): Node[] => {
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

      const normalizedData = node.type === 'agent'
        ? baseData
        : {
            ...node.data,
            additionalInstructions: node.data?.additionalInstructions || '',
          }

      const withStopScope = node.type === 'stop'
        ? (() => {
            const stopScope =
              String((normalizedData as Record<string, unknown>).stopScope || '').trim() ||
              (ownerFlowKind === 'subflow' ? 'subflow' : 'flow')
            const stopLabels: Record<string, string> = {
              subflow: 'Saída do subfluxo',
              flow: 'Fim',
              step: 'Próximo passo',
            }
            const currentLabel = String((normalizedData as Record<string, unknown>).label || '').trim()
            const legacyStopLabels = new Set([
              'fim',
              'fim do fluxo',
              'fim do subfluxo',
              'saida do subfluxo',
              'saída do subfluxo',
              'retornar ao fluxo principal',
              'encerrar atendimento',
              'encerra este fluxo por completo',
            ])
            const label =
              !currentLabel || legacyStopLabels.has(currentLabel.toLowerCase())
                ? stopLabels[stopScope] || stopLabels.flow
                : currentLabel

            return {
              ...normalizedData,
              stopScope,
              label,
            }
          })()
        : normalizedData

      return {
        ...node,
        id,
        position: clampFlowPosition(node.position),
        data: withStopScope,
      }
    })
  }, [])

  const normalizeHandleId = (value: unknown): string | null => {
    const normalized = String(value ?? '').trim()
    if (!normalized) return null

    const lower = normalized.toLowerCase()
    if (lower === 'null' || lower === 'undefined' || lower === 'none') return null

    return normalized
  }

  const normalizeSwitchCaseToken = (value: unknown): string => {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  const getSwitchCaseHandleId = (item: any, index: number): string => {
    const id = normalizeHandleId(item?.id)
    return `case:${id || index}`
  }

  const getSwitchCaseTokens = (item: any, index: number): string[] => {
    const rawValues = [item?.id, item?.value, item?.label, index]
    const tokens = rawValues.flatMap((value) => String(value ?? '').split(/[,\n;/|]+/))
    return tokens.map(normalizeSwitchCaseToken).filter(Boolean)
  }

  const resolveSourceHandle = (sourceNode: Node | undefined, rawHandle: string | null): string | null => {
    if (!rawHandle) return null
    if (sourceNode?.type !== 'switch') return rawHandle

    const cases = Array.isArray(sourceNode.data?.switchCases) ? sourceNode.data.switchCases : []
    const renderedHandles = new Set<string>([
      ...cases.slice(0, 6).map((item: any, index: number) => getSwitchCaseHandleId(item, index)),
      'default',
    ])

    if (renderedHandles.has(rawHandle)) return rawHandle
    if (!rawHandle.startsWith('case:')) return rawHandle

    const wantedToken = normalizeSwitchCaseToken(rawHandle.slice('case:'.length))
    const matchedIndex = cases.slice(0, 6).findIndex((item: any, index: number) =>
      getSwitchCaseTokens(item, index).includes(wantedToken)
    )

    if (matchedIndex >= 0) {
      return getSwitchCaseHandleId(cases[matchedIndex], matchedIndex)
    }

    return null
  }

  // Normaliza edges: garante que source/target referenciem node.id, não agentId
  // PRESERVA sourceHandle para if-else/switch, mas remove handles inválidos do JSON legado
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
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    
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

      const rawSourceHandle = normalizeHandleId(edge.sourceHandle)
      const sourceHandle = resolveSourceHandle(nodeById.get(source), rawSourceHandle)
      const targetHandle = normalizeHandleId(edge.targetHandle)

      if (nodeById.get(source)?.type === 'switch' && rawSourceHandle?.startsWith('case:') && !sourceHandle) {
        console.warn(`Edge de switch ignorada por handle inexistente: ${source}:${rawSourceHandle} -> ${target}`)
        return
      }
      
      const normalizedEdge: Edge = {
        id: edge.id || `edge-${index}`,
        source,
        target,
        type: (edge.type || 'animated') as string,
        animated: true,
      }

      if (sourceHandle) {
        normalizedEdge.sourceHandle = sourceHandle
      }

      if (targetHandle) {
        normalizedEdge.targetHandle = targetHandle
      }
      
      normalized.push(normalizedEdge)
    })
    
    return normalized
  }, [])

  // Carrega um flow específico
  const loadFlow = useCallback(async (flowId: string) => {
    if (!user?.email) return

    try {
      // IMPORTANTE: usar a API do backend (inclui flows globais + da empresa)
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
      const publishPayload = data?.publish
      if (publishPayload && typeof publishPayload === 'object') {
        setFlowPublishInfo({
          hasUnpublishedChanges: !!publishPayload.hasUnpublishedChanges,
          draftVersion:
            typeof publishPayload.draftVersion === 'number' ? publishPayload.draftVersion : null,
          publishedVersion:
            typeof publishPayload.publishedVersion === 'number'
              ? publishPayload.publishedVersion
              : null,
          publishedAt:
            typeof publishPayload.publishedAt === 'string' ? publishPayload.publishedAt : null,
        })
      } else {
        setFlowPublishInfo(null)
      }

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
      
      const flowEntry = flows.find((fl) => fl.id === flowId)
      const ownerFlowKind = flowEntry?.flowKind === 'subflow' ? 'subflow' : 'main'

      // Normaliza nodes primeiro
      let normalizedNodes: Node[] = []
      if (flowData?.nodes && Array.isArray(flowData.nodes)) {
        normalizedNodes = normalizeNodes(flowData.nodes, ownerFlowKind)
      }
      
      setNodes(normalizedNodes)
      
      // Normaliza edges após normalizar nodes
      let normalizedEdges: Edge[] = []
      if (flowData?.edges && Array.isArray(flowData.edges)) {
        normalizedEdges = normalizeEdges(flowData.edges, normalizedNodes)
      }
      
      setEdges(normalizedEdges)

      const pickedName = typeof flowEntry?.name === "string" ? flowEntry.name : ""
      setFlowName(pickedName)
      setBaselineSig(flowSignature(normalizedNodes, normalizedEdges, pickedName.trim(), flowId))

      requestAnimationFrame(() => {
        reactFlowInstance.current?.fitView({
          padding: 0.12,
          duration: 350,
          includeHiddenNodes: false,
        })
      })

      toast.success(t('success.flowLoaded'))
    } catch (err) {
      console.error('Erro ao carregar flow:', err)
      toast.error(t('errors.loadFlow'))
    }
  }, [user?.email, flows, setNodes, setEdges, normalizeNodes, normalizeEdges, t])

  const requestFlowSelection = useCallback((flowId: string) => {
    if (flowId === selectedFlowId) return
    const run = () => {
      setSelectedFlowId(flowId)
      if (flowId) {
        void loadFlow(flowId)
      } else {
        setFlowName("")
        setNodes([])
        setEdges([])
        setBaselineSig(flowSignature([], [], "", ""))
      }
    }
    if (isDirty) {
      setPendingLeave({ kind: "selectFlow", targetFlowId: flowId })
      setUnsavedLeaveOpen(true)
      return
    }
    run()
  }, [isDirty, loadFlow, selectedFlowId, setEdges, setNodes])

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
      if (isGlobal) blockReason = 'Fluxo global da plataforma não pode ser excluído.'
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
            `${fail} exclusões falharam (fluxo global, integração vinculada ou permissão).`
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
        setFlowPublishInfo(null)
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

  const getNodeDisplayName = useCallback((node: Node) => {
    const dataLabel = typeof node.data?.label === 'string' ? node.data.label.trim() : ''
    if (dataLabel) return dataLabel

    const labels: Record<string, string> = {
      start: t('blocks.start', { defaultValue: 'Início' }),
      stop: t('blocks.stop', { defaultValue: 'Fim' }),
      'if-else': t('blocks.ifElse', { defaultValue: 'Condicional' }),
      switch: t('blocks.switch', { defaultValue: 'Múltiplas opções' }),
      loop: t('blocks.loop', { defaultValue: 'Loop' }),
      subflow: t('blocks.subflow', { defaultValue: 'Subfluxo' }),
      comment: t('blocks.comment', { defaultValue: 'Comentário' }),
      delay: t('blocks.delay', { defaultValue: 'Aguardar' }),
      schedule: t('blocks.schedule', { defaultValue: 'Agendar data e hora' }),
      debug: t('blocks.debug', { defaultValue: 'Debug' }),
      agent: 'Agente IA',
      wa_template: t('blocks.waTemplate', { defaultValue: 'Template WhatsApp' }),
      hubspot_whatsapp_campaign: t('blocks.hubspotWhatsappCampaign', { defaultValue: 'Audiência HubSpot' }),
      crm_contact: t('blocks.crmContact', { defaultValue: 'Contato CRM' }),
      appointment: t('blocks.appointment', { defaultValue: 'Ação de agenda' }),
      document_intake: t('blocks.documentIntake', { defaultValue: 'Document Intake' }),
      human_handoff: t('blocks.humanHandoff', { defaultValue: 'Handoff Humano' }),
      wa_session_window: t('blocks.waSession', { defaultValue: 'Janela 24h' }),
      whatsapp_message: t('blocks.whatsappMessage', { defaultValue: 'Mensagem WhatsApp 24h' }),
      email_send: t('blocks.emailSend', { defaultValue: 'Enviar email' }),
      email_read: t('blocks.emailRead', { defaultValue: 'Ler inbox email' }),
    }

    return labels[node.type || ''] || t('button.deleteSelectedBlock', { defaultValue: 'Bloco' })
  }, [t])

  const removeNodeById = useCallback((nodeId: string) => {
    const targetNode = nodes.find((node) => node.id === nodeId)
    if (!targetNode) {
      setNodeContextMenu(null)
      return
    }

    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setNodeContextMenu(null)
    toast.success(
      t('success.nodesDeleted', {
        count: 1,
        defaultValue: 'Bloco removido do fluxo.',
      })
    )
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
    const isSubflowCanvas = selectedFlow?.flowKind === 'subflow'
    const blockConfigs: Record<string, Partial<Node>> = {
      'start': {
        type: 'start',
        data: { label: t('blocks.start') },
      },
      'stop': {
        type: 'stop',
        data: {
          label: isSubflowCanvas ? 'Saída do subfluxo' : 'Fim',
          stopScope: isSubflowCanvas ? 'subflow' : 'flow',
        },
      },
      'step': {
        type: 'stop',
        data: {
          label: 'Próximo passo',
          stopScope: 'step',
        },
      },
      'if-else': {
        type: 'if-else',
        data: {
          label: t('blocks.ifElse', { defaultValue: 'Condicional' }),
          branchField: 'message',
          ifValue: 'sim, 1',
          elseLabel: 'não, 2',
          condition: 'if (message) = {sim, 1}\nelse = {não, 2}',
        },
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
      'schedule': {
        type: 'schedule',
        data: {
          label: t('blocks.schedule', { defaultValue: 'Agendar data e hora' }),
          scheduleAt: '',
          scheduleTimezone: 'America/Sao_Paulo',
        },
      },
      'debug': {
        type: 'debug',
        data: { label: t('blocks.debug'), debugKeys: '', debugMessage: '' },
      },
      'switch': {
        type: 'switch',
        data: {
          label: t('blocks.switch', { defaultValue: 'Múltiplas opções' }),
          branchField: 'option',
          switchDefaultLabel: 'Outros',
          switchCases: [
            { id: 'opcao_1', label: 'Opção 1', value: '1' },
            { id: 'opcao_2', label: 'Opção 2', value: '2' },
          ],
          condition: 'switch (option) {\nOpção 1 = {1}\nOpção 2 = {2}\ndefault = {Outros}\n}',
        },
      },
      'subflow': {
        type: 'subflow',
        data: {
          label: t('blocks.subflow', { defaultValue: 'Executar subfluxo' }),
          subflowId: '',
          subflowName: '',
          subflowResultKey: 'subflow_result',
          subflowFailOnError: true,
        },
      },
      'wa_template': {
        type: 'wa_template',
        data: {
          label: t('blocks.waTemplate', { defaultValue: 'Template WhatsApp' }),
          waTemplateName: '',
          waTemplateLanguage: 'pt_BR',
          waTemplateComponentsJson: '',
          waIntegrationId: '',
        },
      },
      'hubspot_whatsapp_campaign': {
        type: 'hubspot_whatsapp_campaign',
        data: {
          label: t('blocks.hubspotWhatsappCampaign', { defaultValue: 'Audiência HubSpot' }),
          crmIntegrationId: '',
          crmFilterField: 'tag',
          crmFilterOperator: 'equals',
          crmFilterValue: '',
          crmPhoneField: 'phone',
          crmResultLimit: '50',
        },
      },
      'crm_contact': {
        type: 'crm_contact',
        data: {
          label: t('blocks.crmContact', { defaultValue: 'Contato CRM' }),
          crmOperation: 'lookup',
          crmIntegrationId: '',
          lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
          requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
          originTag: 'Atendimento IA Clínica',
          allowMissingDob: true,
        },
      },
      'appointment': {
        type: 'appointment',
        data: {
          label: t('blocks.appointment', { defaultValue: 'Ação de agenda' }),
          appointmentOperation: 'availability',
          appointmentProvider: 'calendly',
          appointmentIntegrationId: '',
          specialtyField: 'appointment_resource',
          doctorField: 'appointment_owner',
          consultationTypeField: 'appointment_kind',
          unitField: 'appointment_location',
          periodField: 'appointment_time_preference',
          preferredDateField: 'appointment_date',
        },
      },
      'document_intake': {
        type: 'document_intake',
        data: {
          label: t('blocks.documentIntake', { defaultValue: 'Document Intake' }),
          documentKinds: ['exam', 'pedido_medico', 'document'],
          notifyTeam: true,
          acceptWithoutFile: false,
        },
      },
      'human_handoff': {
        type: 'human_handoff',
        data: {
          label: t('blocks.humanHandoff', { defaultValue: 'Handoff Humano' }),
          handoffReasonField: 'handoff_reason',
          handoffPriority: 'medium',
          notifyEmail: '',
          notifyWhatsApp: '',
          patientMessage: 'Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve.',
        },
      },
      'wa_session_window': {
        type: 'wa_session_window',
        data: {
          label: t('blocks.waSession', { defaultValue: 'Janela 24h' }),
        },
      },
      'whatsapp_message': {
        type: 'whatsapp_message',
        data: {
          label: t('blocks.whatsappMessage', { defaultValue: 'Mensagem WhatsApp 24h' }),
          waWindowMode: 'session_only',
          waMessageType: 'text',
          waMessageText: '',
          waButtons: [],
          waLinkUrl: '',
          waReminderAt: '',
          waIntegrationId: '',
        },
      },
      'email_send': {
        type: 'email_send',
        data: {
          label: t('blocks.emailSend', { defaultValue: 'Enviar email' }),
          emailIntegrationId: '',
          emailTo: '{{email}}',
          emailSubject: '',
          emailText: '',
        },
      },
      'email_read': {
        type: 'email_read',
        data: {
          label: t('blocks.emailRead', { defaultValue: 'Ler inbox email' }),
          emailIntegrationId: '',
          emailReadLimit: '5',
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
        'stop': t('blocks.stop', { defaultValue: 'Fim' }),
        'step': t('blocks.step', { defaultValue: 'Próximo passo' }),
        'if-else': t('blocks.ifElse'),
        'switch': t('blocks.switch', { defaultValue: 'Múltiplas opções' }),
        'loop': t('blocks.loop'),
        'comment': t('blocks.comment'),
        'delay': t('blocks.delay'),
        'schedule': t('blocks.schedule', { defaultValue: 'Agendar data e hora' }),
        'debug': t('blocks.debug'),
        'wa_template': t('blocks.waTemplate', { defaultValue: 'Template WhatsApp' }),
        'hubspot_whatsapp_campaign': t('blocks.hubspotWhatsappCampaign', { defaultValue: 'Audiência HubSpot' }),
        'crm_contact': t('blocks.crmContact', { defaultValue: 'Contato CRM' }),
        'appointment': t('blocks.appointment', { defaultValue: 'Ação de agenda' }),
        'document_intake': t('blocks.documentIntake', { defaultValue: 'Document Intake' }),
        'human_handoff': t('blocks.humanHandoff', { defaultValue: 'Handoff Humano' }),
        'wa_session_window': t('blocks.waSession', { defaultValue: 'Janela 24h' }),
        'whatsapp_message': t('blocks.whatsappMessage', { defaultValue: 'Mensagem WhatsApp 24h' }),
        'email_send': t('blocks.emailSend', { defaultValue: 'Enviar email' }),
        'email_read': t('blocks.emailRead', { defaultValue: 'Ler inbox email' }),
        'agent': 'Agente IA',
      }
      toast.success(t('success.blockAdded', { name: blockLabels[blockType] }))
      setDrawerOpen(false)

      if (
        blockType === 'agent' ||
        blockType === 'if-else' ||
        blockType === 'switch' ||
        blockType === 'subflow' ||
        blockType === 'schedule' ||
        blockType === 'wa_template' ||
        blockType === 'hubspot_whatsapp_campaign' ||
        blockType === 'crm_contact' ||
        blockType === 'appointment' ||
        blockType === 'document_intake' ||
        blockType === 'human_handoff' ||
        blockType === 'email_send' ||
        blockType === 'email_read'
      ) {
        openNodeEditor(nodeId)
      }
    }
  }, [addNodeAtCenter, openNodeEditor, selectedFlow?.flowKind, t])

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


  async function saveFlow(): Promise<string | null> {
    if (!flowName.trim()) {
      toast.error(t('errors.nameRequired'))
      return null
    }

    if (!user?.email) {
      toast.error(t('errors.userNotAuthenticated'))
      return null
    }

    // Busca o node de tipo "start"
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      toast.error(t('errors.startBlockRequired'))
      return null
    }

    const strictErrors: string[] = []
    const metaWarnings: string[] = []
    for (const n of nodes) {
      if (n.type === 'wa_template') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.waTemplateName || '').trim()) {
          metaWarnings.push('Template WhatsApp: sincronize e escolha um template da Meta antes de ir à produção.')
        }
        if (!String(d.waTemplateLanguage || '').trim()) {
          metaWarnings.push('Template WhatsApp: o idioma vem do template sincronizado da Meta.')
        }
      }
      if (n.type === 'email_send') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.emailIntegrationId || '').trim()) strictErrors.push('Enviar email: selecione uma integração (modo estrito).')
        if (!String(d.emailSubject || '').trim()) strictErrors.push('Enviar email: assunto obrigatório (modo estrito).')
        if (!String(d.emailText || '').trim()) strictErrors.push('Enviar email: corpo obrigatório (modo estrito).')
      }
      if (n.type === 'email_read') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.emailIntegrationId || '').trim()) strictErrors.push('Ler inbox email: selecione uma integração (modo estrito).')
      }
      if (n.type === 'whatsapp_message') {
        metaWarnings.push('Mensagem WhatsApp: use esse bloco para conversas com janela de 24h aberta.')
      }
      if (n.type === 'schedule') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.scheduleAt || '').trim()) strictErrors.push('Agendar data e hora: informe a data e o horário (modo estrito).')
      }
      if (n.type === 'crm_contact') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.crmIntegrationId || '').trim()) strictErrors.push('Contato CRM: selecione a integração HubSpot (modo estrito).')
      }
    }
    for (const n of nodes) {
      if (n.type === 'email_send') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.emailIntegrationId || '').trim()) metaWarnings.push('Enviar email: selecione uma integração de email.')
        if (!String(d.emailTo || '').trim()) metaWarnings.push('Enviar email: informe o destinatário ou use uma audiência HubSpot anterior.')
        if (!String(d.emailSubject || '').trim()) metaWarnings.push('Enviar email: preencha o assunto.')
        if (!String(d.emailText || '').trim()) metaWarnings.push('Enviar email: preencha o corpo da mensagem.')
      }
      if (n.type === 'email_read') {
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.emailIntegrationId || '').trim()) metaWarnings.push('Ler inbox email: selecione uma integração de email.')
      }
    }

    for (const n of nodes) {
      if (n.type !== 'hubspot_whatsapp_campaign') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (!String(d.crmIntegrationId || '').trim()) metaWarnings.push('Audiência HubSpot: selecione a integração HubSpot.')
      if (!String(d.crmFilterValue || '').trim()) metaWarnings.push('Audiência HubSpot: informe a tag que será buscada.')
    }

    for (const n of nodes) {
      if (n.type !== 'crm_contact') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (!String(d.crmIntegrationId || '').trim()) metaWarnings.push('Contato CRM: selecione a integração HubSpot.')
    }

    for (const n of nodes) {
      if (n.type !== 'appointment') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (String(d.appointmentProvider || 'calendly').trim() !== 'calendly') metaWarnings.push('Appointment: o provider deve ser Calendly.')
      if (!String(d.appointmentIntegrationId || '').trim()) metaWarnings.push('Appointment: selecione uma integração Calendly real.')
    }

    for (const n of nodes) {
      if (n.type !== 'human_handoff') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (!String(d.notifyEmail || '').trim()) metaWarnings.push('Handoff humano: informe um email interno para notificação quando possível.')
    }

    for (const n of nodes) {
      if (n.type !== 'schedule') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (!String(d.scheduleAt || '').trim()) metaWarnings.push('Agendar data e hora: defina quando o próximo envio deve acontecer.')
    }

    for (const n of nodes) {
      if (n.type !== 'subflow') continue
      const d = (n.data as Record<string, unknown>) || {}
      if (!String(d.subflowId || d.flowId || '').trim()) metaWarnings.push('Subfluxo: selecione o fluxo que será executado.')
    }

    if (nodes.some((n) => n.type === 'wa_session_window')) {
      metaWarnings.push('Janela 24h: use o ramo "Fora" com Template WhatsApp quando não houver sessão aberta.')
    }
    const uniqueWarnings = Array.from(new Set(metaWarnings))
    for (const msg of uniqueWarnings) {
      toast.warning(msg, { duration: 6500 })
    }

    if (import.meta.env.VITE_FLOW_VALIDATE_META_STRICT === 'true') {
      strictErrors.length = 0
      for (const n of nodes) {
        if (n.type === 'wa_template') {
          const d = (n.data as Record<string, unknown>) || {}
          if (!String(d.waTemplateName || '').trim()) strictErrors.push('Template WhatsApp: escolha um template sincronizado (modo estrito).')
          if (!String(d.waTemplateLanguage || '').trim()) strictErrors.push('Template WhatsApp: idioma ausente no template sincronizado (modo estrito).')
        }
      }
      for (const n of nodes) {
        if (n.type === 'email_send') {
          const d = (n.data as Record<string, unknown>) || {}
          if (!String(d.emailIntegrationId || '').trim()) strictErrors.push('Enviar email: selecione uma integração (modo estrito).')
          if (!String(d.emailSubject || '').trim()) strictErrors.push('Enviar email: assunto obrigatório (modo estrito).')
          if (!String(d.emailText || '').trim()) strictErrors.push('Enviar email: corpo obrigatório (modo estrito).')
        }
        if (n.type === 'email_read') {
          const d = (n.data as Record<string, unknown>) || {}
          if (!String(d.emailIntegrationId || '').trim()) strictErrors.push('Ler inbox email: selecione uma integração (modo estrito).')
        }
      }

      for (const n of nodes) {
        if (n.type !== 'hubspot_whatsapp_campaign') continue
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.crmIntegrationId || '').trim()) strictErrors.push('Audiência HubSpot: selecione a integração HubSpot (modo estrito).')
        if (!String(d.crmFilterValue || '').trim()) strictErrors.push('Audiência HubSpot: tag obrigatória (modo estrito).')
      }

      for (const n of nodes) {
        if (n.type !== 'crm_contact') continue
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.crmIntegrationId || '').trim()) strictErrors.push('Contato CRM: integração HubSpot obrigatória (modo estrito).')
      }

      for (const n of nodes) {
        if (n.type !== 'schedule') continue
        const d = (n.data as Record<string, unknown>) || {}
        if (!String(d.scheduleAt || '').trim()) strictErrors.push('Agendar data e hora: defina a data e o horário (modo estrito).')
      }

      if (strictErrors.length > 0) {
        toast.error(strictErrors[0], { duration: 8000 })
        return null
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

      // IMPORTANTE: usar a API do backend ao invés de Supabase direto (protege com requireAdmin)
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
        return null
      }

      toast.success(
        t('success.flowDraftSaved', {
          defaultValue: 'Rascunho salvo. Use Publicar para aplicar no WhatsApp vinculado.',
        })
      )

      const body = await response.json().catch(() => ({}))
      if (body?.publish && typeof body.publish === 'object') {
        setFlowPublishInfo({
          hasUnpublishedChanges: !!body.publish.hasUnpublishedChanges,
          draftVersion:
            typeof body.publish.draftVersion === 'number' ? body.publish.draftVersion : null,
          publishedVersion:
            typeof body.publish.publishedVersion === 'number'
              ? body.publish.publishedVersion
              : null,
          publishedAt:
            typeof body.publish.publishedAt === 'string' ? body.publish.publishedAt : null,
        })
      } else if (selectedFlowId || body?.flow?.id) {
        setFlowPublishInfo((prev) => ({
          hasUnpublishedChanges: true,
          draftVersion: (prev?.draftVersion ?? 0) + 1,
          publishedVersion: prev?.publishedVersion ?? null,
          publishedAt: prev?.publishedAt ?? null,
        }))
      }
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
      return finalId || null
    } catch (err) {
      console.error('Erro ao salvar flow:', err)
      toast.error(t('errors.saveFlow'), {
        duration: 5000
      })
      return null
    }
  }

  async function publishFlow(): Promise<boolean> {
    if (!selectedFlowId || !user?.email) {
      toast.error(
        t('errors.publishFlowNeedsSave', {
          defaultValue: 'Salve o fluxo antes de publicar.',
        })
      )
      return false
    }

    setPublishBusy(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      const response = await fetch(`${BASE_URL}/flows/${selectedFlowId}/publish`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ email: user.email }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        toast.error(
          error.error ||
            error.details ||
            t('errors.publishFlow', { defaultValue: 'Erro ao publicar fluxo.' })
        )
        return false
      }

      const body = await response.json().catch(() => ({}))
      if (body?.publish && typeof body.publish === 'object') {
        setFlowPublishInfo({
          hasUnpublishedChanges: !!body.publish.hasUnpublishedChanges,
          draftVersion:
            typeof body.publish.draftVersion === 'number' ? body.publish.draftVersion : null,
          publishedVersion:
            typeof body.publish.publishedVersion === 'number'
              ? body.publish.publishedVersion
              : null,
          publishedAt:
            typeof body.publish.publishedAt === 'string' ? body.publish.publishedAt : null,
        })
      } else {
        setFlowPublishInfo((prev) => ({
          hasUnpublishedChanges: false,
          draftVersion: prev?.draftVersion ?? null,
          publishedVersion: body?.publishedVersion ?? prev?.publishedVersion ?? null,
          publishedAt: new Date().toISOString(),
        }))
      }

      toast.success(
        t('success.flowPublished', {
          defaultValue: 'Fluxo publicado. O atendimento no WhatsApp usará esta versão.',
        })
      )
      setPublishDialogOpen(false)
      return true
    } catch (err) {
      console.error('[publishFlow] Erro:', err)
      toast.error(t('errors.publishFlow', { defaultValue: 'Erro ao publicar fluxo.' }))
      return false
    } finally {
      setPublishBusy(false)
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
  const toolbarButtonBase =
    "h-9 shrink-0 rounded-lg border px-3.5 text-sm font-semibold shadow-sm transition-colors"
  const toolbarBlocksButtonClass = cn(
    toolbarButtonBase,
    isDarkFlow
      ? "border-zinc-600 bg-zinc-800 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
      : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
  )
  const toolbarIconButtonClass = cn(
    "size-9 shrink-0 rounded-lg border shadow-sm transition-colors",
    isDarkFlow
      ? "border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-500 hover:bg-slate-700 hover:text-white"
      : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
  )
  const saveFlowButtonClass = cn(
    "h-9 shrink-0 rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors",
    isDarkFlow
      ? "border-zinc-100 bg-zinc-100 text-zinc-950 hover:border-white hover:bg-white disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
      : "border-slate-900 bg-slate-900 text-white hover:border-black hover:bg-black"
  )
  const publishFlowButtonClass = cn(
    "h-9 shrink-0 rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors",
    isDarkFlow
      ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-100 hover:border-emerald-400 hover:bg-emerald-900/60 disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
      : "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700"
  )
  const showPublishBadge =
    !!selectedFlowId && (flowPublishInfo?.hasUnpublishedChanges ?? false)

  return (
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col gap-2 overflow-hidden px-0 pb-2 pt-0">
      <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden lg:flex-row lg:items-end lg:justify-between lg:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2">
          <Select
            value={selectedFlow?.flowKind === 'subflow' && selectedMainFlowId ? selectedMainFlowId : selectedFlowId}
            onValueChange={requestFlowSelection}
          >
            <SelectTrigger className="w-full min-w-[200px] max-w-[240px] shrink-0 sm:w-[220px]">
              <SelectValue placeholder={loadingFlows ? t("loading.loading") : t("select.flow")} />
            </SelectTrigger>
            <SelectContent>
              {mainFlows.length === 0 ? (
                <SelectItem value="none" disabled>
                  {t("empty.noFlows")}
                </SelectItem>
              ) : (
                mainFlows.map((flow) => (
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

        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
          <Button variant="outline" className={toolbarBlocksButtonClass} onClick={() => setDrawerOpen(true)}>
            <Workflow className="mr-2 h-4 w-4" /> {t("button.blocks")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={toolbarIconButtonClass}
                aria-label={t("toolbar.moreActions", { defaultValue: "Mais ações" })}
                title={t("toolbar.moreActions", { defaultValue: "Mais ações" })}
              >
              <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                disabled={nodes.length === 0}
                onClick={handleOrganizeFlow}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                {t("button.organizeFlow", { defaultValue: "Organizar fluxo" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenGenerateAiDialog(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("button.createWithAi", { defaultValue: "Criar com IA" })}
              </DropdownMenuItem>
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
            className={saveFlowButtonClass}
          >
            <GitBranch className="mr-2 h-4 w-4" />{" "}
            {t("button.saveFlowDraft", { defaultValue: "Salvar rascunho" })}
          </Button>
          <Button
            onClick={() => setPublishDialogOpen(true)}
            disabled={!selectedFlowId || publishBusy}
            className={publishFlowButtonClass}
            title={t("button.publishFlowHint", {
              defaultValue: "Aplica o rascunho salvo no atendimento WhatsApp vinculado a este fluxo.",
            })}
          >
            {publishBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {t("button.publishFlow", { defaultValue: "Publicar" })}
          </Button>
        </div>
      </div>

      {showPublishBadge ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            isDarkFlow
              ? "border-amber-500/40 bg-amber-950/30 text-amber-100"
              : "border-amber-300 bg-amber-50 text-amber-900"
          )}
        >
          <Badge variant="outline" className="rounded-full border-amber-500/50 text-[11px]">
            {t("flows.publish.unpublishedBadge", { defaultValue: "Rascunho não publicado" })}
          </Badge>
          <span>
            {t("flows.publish.unpublishedHint", {
              defaultValue:
                "O WhatsApp continua na versão publicada anterior. Clique em Publicar para atualizar o atendimento.",
            })}
          </span>
          {flowPublishInfo?.publishedVersion != null ? (
            <span className="text-[11px] opacity-80">
              {t("flows.publish.versions", {
                defaultValue: "Produção: v{{published}} · Rascunho: v{{draft}}",
                published: flowPublishInfo.publishedVersion,
                draft: flowPublishInfo.draftVersion ?? "—",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {selectedFlowId && (flowFamilyParts.length > 1 || selectedFlow?.flowKind === 'subflow') ? (
        <div
          className={cn(
            "flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-xs shadow-sm",
            isDarkFlow
              ? "border-slate-800 bg-slate-950/80 text-slate-200"
              : "border-slate-200 bg-white text-slate-700"
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-semibold uppercase tracking-[0.18em] text-slate-500">
                Partes do fluxo
              </span>
              <Badge variant="secondary" className="rounded-full">
                {flowFamilyParts.filter((part) => part.kind !== 'missing').length} etapas
              </Badge>
            </div>
            <span className="min-w-0 max-w-full truncate text-slate-500 sm:max-w-[42vw]">
              {selectedMainFlow?.name || selectedFlow?.parentFlowName || selectedFlow?.name || flowName || 'Fluxo atual'}
            </span>
          </div>

          <div
            className={cn(
              "block min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2",
              "[scrollbar-width:thin]",
              isDarkFlow
                ? "[scrollbar-color:rgba(148,163,184,0.45)_transparent]"
                : "[scrollbar-color:rgba(100,116,139,0.45)_transparent]"
            )}
          >
            <div className="inline-flex w-max max-w-none gap-2 pr-8">
            {flowFamilyParts.map((part) => {
              const isActive = part.active
              const isMissing = part.kind === 'missing'
              return (
                <Button
                  key={`${part.kind}-${part.id}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!part.connected}
                  className={cn(
                    "h-8 w-[clamp(150px,13vw,245px)] shrink-0 justify-start rounded-full px-3 text-xs",
                    isActive
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-200"
                      : part.connected
                        ? "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        : "border-amber-500/50 text-amber-700 dark:text-amber-300"
                  )}
                  title={
                    part.connected
                      ? part.sourceLabel
                        ? `Conectado pelo bloco "${part.sourceLabel}". Clique para abrir.`
                        : 'Clique para abrir esta parte do fluxo.'
                      : `O bloco "${part.sourceLabel || 'Subfluxo'}" aponta para um fluxo inexistente ou removido.`
                  }
                  onClick={() => part.connected && requestFlowSelection(part.id)}
                >
                  <span
                    className={cn(
                      "mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : isMissing
                          ? "bg-amber-500 text-white"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                    )}
                  >
                    {part.orderLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{part.name}</span>
                </Button>
              )
            })}
            </div>
          </div>
        </div>
      ) : null}

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
        canvasFlowKind={selectedFlow?.flowKind === 'subflow' ? 'subflow' : 'main'}
      />

      <Card
        className={cn(
          "flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-0 overflow-hidden rounded-lg border shadow-sm",
          isDarkFlow
            ? "border-zinc-800 bg-[#111111]"
            : "border-[#E0E4E8] bg-[rgba(255,255,255,0.62)] supports-[backdrop-filter:blur(0px)]:backdrop-blur-xl"
        )}
      >
        <CardHeader
          className={cn(
            "flex-shrink-0 space-y-0.5 border-b !px-4 !pb-2 !pt-3 md:!px-5",
            isDarkFlow
              ? "border-zinc-800 bg-[#111111]"
              : "border-[#E0E4E8] bg-[rgba(255,255,255,0.58)]"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle style={{ color: isDarkFlow ? '#e2e8f0' : '#1A202C' }}>{t('editor.title')}</CardTitle>
                <div 
                  className="cursor-help"
                  title={t('editor.tooltip')}
                >
                  <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
                </div>
              </div>
              <CardDescription className="text-[#4A5568] dark:text-slate-400">
                {t('editor.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center space-y-4">
                <div 
                  className="mx-auto w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-2"
                  style={{
                    backgroundColor: isDarkFlow ? '#1f2937' : '#ffffff',
                    borderColor: isDarkFlow ? '#475569' : '#dbeafe',
                    boxShadow: '0 10px 40px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)'
                  }}
                >
                  <GitBranch className="h-12 w-12" style={{ color: isDarkFlow ? '#d4d4d8' : '#475569', strokeWidth: 2 }} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold" style={{ color: isDarkFlow ? '#f1f5f9' : '#1e293b' }}>{t('empty.startCreating')}</h3>
                  <p className="text-sm max-w-md" style={{ color: isDarkFlow ? '#cbd5e1' : '#475569' }}>
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
            onNodeDoubleClick={(_, node) => {
              const subflowId = String(node.data?.subflowId || node.data?.flowId || '').trim()
              if (node.type === 'subflow' && subflowId) {
                requestFlowSelection(subflowId)
                return
              }
              handleNodeDoubleClick(node.id)
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault()
              event.stopPropagation()
              setNodeContextMenu({
                nodeId: node.id,
                nodeLabel: getNodeDisplayName(node),
                x: Math.min(event.clientX, window.innerWidth - 232),
                y: Math.min(event.clientY, window.innerHeight - 92),
              })
              setNodes((nds) =>
                nds.map((currentNode) => ({
                  ...currentNode,
                  selected: currentNode.id === node.id,
                }))
              )
            }}
            onPaneClick={() => setNodeContextMenu(null)}
            onMoveStart={() => setNodeContextMenu(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'animated',
              animated: true,
            }}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            className={cn(
              "h-full w-full max-w-full min-h-[max(360px,48dvh)] overflow-hidden",
              isDarkFlow
                ? "bg-[#050505] text-slate-100"
                : "bg-[#F7F8FA] text-[#1A202C]"
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
                if (node.type === 'agent') return '#3B7663'
                if (node.type === 'start') return '#4A5B83'
                if (node.type === 'stop') return '#8C3B4A'
                if (node.type === 'if-else') return '#B7794F'
                if (node.type === 'switch') return '#6B668D'
                if (node.type === 'loop') return '#6B668D'
                if (node.type === 'subflow') return '#6B668D'
                if (node.type === 'comment') return '#9E7A4D'
                if (node.type === 'delay') return '#567786'
                if (node.type === 'schedule') return '#5A7C97'
                if (node.type === 'debug') return '#9A5162'
                if (node.type === 'wa_template') return '#6B668D'
                if (node.type === 'hubspot_whatsapp_campaign') return '#4C7B76'
                if (node.type === 'crm_contact') return '#4C7B76'
                if (node.type === 'appointment') return '#5A7C97'
                if (node.type === 'document_intake') return '#9E7A4D'
                if (node.type === 'human_handoff') return '#9A5162'
                if (node.type === 'wa_session_window') return '#5A7C97'
                if (node.type === 'whatsapp_message') return '#3B7663'
                if (node.type === 'email_send') return '#9E7A4D'
                if (node.type === 'email_read') return '#9A5162'
                return '#94A3B8'
              }}
              maskColor={isDarkFlow ? 'rgba(0, 0, 0, 0.25)' : 'rgba(247, 248, 250, 0.56)'}
              className={
                isDarkFlow
                  ? '!rounded-xl !border !border-slate-500/45 !shadow-md'
                  : '!rounded-xl !border !border-[#E0E4E8] !shadow-md'
              }
              style={{
                backgroundColor: isDarkFlow ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.74)',
                borderRadius: '0.75rem',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            />
            <Controls 
              className={
                isDarkFlow
                  ? '!rounded-xl !border !border-slate-500/45 !shadow-md [&_svg]:text-slate-200 [&_button]:border-slate-600/50'
                  : '!rounded-xl !border !border-[#E0E4E8] !shadow-md [&_svg]:text-[#4A5568] [&_button]:border-[#E0E4E8]'
              }
              style={{
                backgroundColor: isDarkFlow ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.72)',
                borderRadius: '0.75rem',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            />
            <Background
              id="sonia-flow-dots"
              variant={BackgroundVariant.Dots}
              gap={18}
              size={isDarkFlow ? 2.25 : 2.55}
              color={isDarkFlow ? 'rgba(226, 232, 240, 0.38)' : 'rgba(74, 85, 104, 0.14)'}
            />
          </ReactFlow>
          {nodeContextMenu ? (
            <div
              className={cn(
                "fixed z-50 w-56 overflow-hidden rounded-lg border p-1 shadow-xl",
                isDarkFlow
                  ? "border-slate-700 bg-slate-950 text-slate-100 shadow-black/40"
                  : "border-slate-200 bg-white text-slate-900 shadow-slate-900/12"
              )}
              style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div
                className={cn(
                  "truncate px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  isDarkFlow ? "text-slate-400" : "text-slate-500"
                )}
                title={nodeContextMenu.nodeLabel}
              >
                {nodeContextMenu.nodeLabel}
              </div>
              {(() => {
                const contextNode = nodes.find((node) => node.id === nodeContextMenu.nodeId)
                if (!contextNode || !canEditNode(contextNode.type)) return null

                return (
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition-colors",
                      isDarkFlow
                        ? "text-sky-200 hover:bg-sky-950/60 hover:text-sky-50"
                        : "text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                    )}
                    onClick={() => {
                      handleNodeDoubleClick(nodeContextMenu.nodeId)
                      setNodeContextMenu(null)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("dialog.edit", { defaultValue: "Editar" })}
                  </button>
                )
              })()}
              <button
                type="button"
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition-colors",
                  isDarkFlow
                    ? "text-rose-300 hover:bg-rose-950/60 hover:text-rose-100"
                    : "text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                )}
                onClick={() => removeNodeById(nodeContextMenu.nodeId)}
              >
                <Trash2 className="h-4 w-4" />
                {t("button.deleteSelectedBlock", { defaultValue: "Remover Bloco" })}
              </button>
            </div>
          ) : null}
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

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dialog.publishFlow.title', { defaultValue: 'Publicar fluxo?' })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {t('dialog.publishFlow.description', {
                    defaultValue:
                      'A versão publicada passa a valer no WhatsApp (e em qualquer canal) que usa este fluxo via integração. O rascunho continua disponível para novas edições.',
                  })}
                </p>
                {isDirty ? (
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {t('dialog.publishFlow.unsavedWarning', {
                      defaultValue:
                        'Há alterações na tela que ainda não foram salvas no rascunho. Salve antes de publicar para não perder mudanças.',
                    })}
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishBusy}>
              {t('dialog.cancel', { defaultValue: 'Cancelar' })}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={publishBusy || isDirty}
              className={publishFlowButtonClass}
              onClick={() => void publishFlow()}
            >
              {publishBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              {t('button.publishFlowConfirm', { defaultValue: 'Publicar agora' })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          availableFlows={familySubflowsForPicker}
          currentFlowId={selectedMainFlowId || selectedFlowId || null}
          currentFlowName={selectedMainFlow?.name || selectedFlow?.parentFlowName || flowName || selectedFlow?.name || null}
          currentFlowKind={selectedFlow?.flowKind === 'subflow' ? 'subflow' : 'main'}
          nextSubflowOrder={nextSubflowOrder}
          onFlowCreated={(flow) => {
            setFlows((current) => [
              {
                ...flow,
                flowKind: 'subflow',
                parentFlowId: selectedMainFlowId || selectedFlowId || null,
                parentFlowName: selectedMainFlow?.name || selectedFlow?.parentFlowName || flowName || selectedFlow?.name || null,
                subflowOrder: nextSubflowOrder,
              },
              ...current,
            ])
          }}
          agentsOnly
          userEmail={user?.email ?? undefined}
          companiesId={companiesId}
          currentUserId={userId}
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

