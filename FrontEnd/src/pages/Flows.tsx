import React, { useCallback, useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import ReactFlow, {
  addEdge,
  Background,
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
} from "reactflow"
import "reactflow/dist/style.css"

import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { GitBranch, Plus, X, Trash2, Play, Workflow, Bot, Eraser, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase/client"
import { useTheme } from "next-themes"
import { BlocksDrawer } from "../components/flows/BlocksDrawer"
import { AgentsDrawer } from "../components/flows/AgentsDrawer"
import { AnimatedEdge } from "../components/flows/AnimatedEdge"
import { EditNodeDialog } from "../components/flows/EditNodeDialog"
import {
  StartNode,
  StopNode,
  IfElseNode,
  LoopNode,
  CommentNode,
  DelayNode,
  AgentNode,
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
}

const edgeTypes = {
  animated: AnimatedEdge,
  default: AnimatedEdge,
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

interface AvailableTemplate {
  id: string
  name: string
  description: string | null
}

export function Flows() {
  const { theme } = useTheme()
  const { user, userId } = useAuth()
  const { t, i18n } = useTranslation('flows')
  const [translationsReady, setTranslationsReady] = useState(false)
  const [openAgentDrawer, setOpenAgentDrawer] = useState(false)
  const [openSaveDialog, setOpenSaveDialog] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [flows, setFlows] = useState<any[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<AvailableTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

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
  }, [])

  // Função para lidar com menu de contexto (botão direito) nos nodes
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node && ['loop', 'if-else', 'delay', 'comment', 'agent'].includes(node.type || '')) {
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

  // Normaliza nodes: garante que IDs sejam sequenciais (node-1, node-2, etc.)
  const normalizeNodes = useCallback((nodes: Node[]): Node[] => {
    if (!nodes || nodes.length === 0) return []
    
    // Cria um mapa de IDs antigos para novos
    const idMap = new Map<string, string>()
    let nodeCounter = 1
    
    // Primeiro passo: mapeia todos os nodes para novos IDs sequenciais
    nodes.forEach((node) => {
      const newId = `node-${nodeCounter}`
      idMap.set(node.id, newId)
      nodeCounter++
    })
    
    // Segundo passo: atualiza os nodes com novos IDs e normaliza agentId
    return nodes.map((node, index) => {
      const newId = idMap.get(node.id) || `node-${index + 1}`
      
      return {
        ...node,
        id: newId,
        data: {
          ...node.data,
          // Garante que agentId existe e está correto
          executionMode: node.data?.executionMode || (node.data?.templateId && !node.data?.agentId ? 'template' : 'agent'),
          agentId: node.data?.agentId || null,
          agentName: node.data?.agentName || null,
          templateId: node.data?.templateId || null,
          templateName: node.data?.templateName || null,
          additionalInstructions: node.data?.additionalInstructions || '',
        }
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

      toast.success(t('success.flowLoaded'))
    } catch (err) {
      console.error('Erro ao carregar flow:', err)
      toast.error(t('errors.loadFlow'))
    }
  }, [user?.email, setNodes, setEdges, normalizeNodes, normalizeEdges, t])

  // Deleta um flow do banco de dados
  const deleteFlow = useCallback(async (flowId: string) => {
    if (!user?.email) return

    // Confirmação antes de deletar
    if (!confirm(t('confirm.deleteFlow'))) {
      return
    }

    try {
      // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      
      const response = await fetch(`${BASE_URL}/flows/${flowId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          email: user.email
        })
      })

      if (!response.ok) {
        let errorMessage = t('errors.deleteFlow')
        
        try {
          const error = await response.json()
          console.error('[deleteFlow] Erro ao deletar flow:', error)
          
          // Mensagem específica para não-admin
          if (response.status === 403) {
            errorMessage = error.error || error.details || 'Você não tem permissão para deletar flows. Apenas administradores podem realizar esta ação.'
          } else {
            errorMessage = error.error || error.details || error.message || t('errors.deleteFlow')
          }
        } catch (parseError) {
          // Se não conseguir parsear o JSON, usar mensagem padrão
          if (response.status === 403) {
            errorMessage = 'Você não tem permissão para deletar flows. Apenas administradores podem realizar esta ação.'
          }
        }
        
        toast.error(errorMessage, {
          duration: 5000
        })
        return
      }

      toast.success(t('success.flowDeleted'))
      
      // Recarrega a lista de flows
      await loadFlows()
      
      // Se o flow deletado estava selecionado, limpa a seleção
      if (selectedFlowId === flowId) {
        setSelectedFlowId("")
      }
    } catch (err) {
      console.error('Erro ao deletar flow:', err)
      toast.error(t('errors.deleteFlow'), {
        duration: 5000
      })
    }
  }, [user?.email, loadFlows, selectedFlowId, t])

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

  const loadTemplates = useCallback(async () => {
    if (!user?.email) return

    setLoadingTemplates(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import('../services/api')
      const response = await fetch(`${BASE_URL}/templates?email=${encodeURIComponent(user.email)}`, {
        method: 'GET',
        headers: await getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        console.error('Erro ao carregar templates:', error)
        setAvailableTemplates([])
        return
      }

      const rows = await response.json()
      const mappedTemplates: AvailableTemplate[] = (Array.isArray(rows) ? rows : []).map((template: any) => ({
        id: template.id,
        name: template.name || '',
        description: template.description || null
      }))

      setAvailableTemplates(mappedTemplates)
    } catch (err) {
      console.error('Erro ao carregar templates:', err)
      setAvailableTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }, [user?.email])

  // Carrega flows e agentes ao montar o componente
  useEffect(() => {
    loadFlows()
    loadAgents()
    loadTemplates()
  }, [loadFlows, loadAgents, loadTemplates])


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
        // Deleta edges selecionados primeiro
        const selectedEdges = edges.filter((edge) => edge.selected)
        if (selectedEdges.length > 0) {
          setEdges((eds) => eds.filter((edge) => !edge.selected))
          toast.success(t('success.connectionsDeleted', { count: selectedEdges.length }))
          return
        }

        // Deleta nós selecionados
        const selectedNodes = nodes.filter((node) => node.selected)
        if (selectedNodes.length > 0) {
          const nodeIds = selectedNodes.map((node) => node.id)
          setNodes((nds) => nds.filter((node) => !node.selected))
          // Remove também as edges conectadas aos nós deletados
          setEdges((eds) => 
            eds.filter(
              (edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
            )
          )
          toast.success(t('success.nodesDeleted', { count: selectedNodes.length }))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, setNodes, setEdges, isEditDialogOpen])

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
      position: nodeConfig.position || { 
        x: centerX || Math.random() * 500 + 100, 
        y: centerY || Math.random() * 300 + 100 
      },
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

  function addTemplateNode(template: AvailableTemplate) {
    const nodeId = addNodeAtCenter({
      type: 'agent',
      data: {
        label: template.name,
        executionMode: 'template',
        templateId: template.id,
        templateName: template.name,
        additionalInstructions: '',
        bio: template.description,
      },
    })

    if (nodeId) {
      toast.success(`Template "${template.name}" adicionado ao fluxo`)
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
      'agent': {
        type: 'agent',
        data: {
          label: 'Agente IA',
          executionMode: 'template',
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
        'agent': 'Agente IA',
      }
      toast.success(t('success.blockAdded', { name: blockLabels[blockType] }))
      setDrawerOpen(false)

      if (blockType === 'agent') {
        openNodeEditor(nodeId)
      }
    }
  }, [addNodeAtCenter, openNodeEditor])

  function handleSaveClick() {
    setFlowName("")
    setOpenSaveDialog(true)
  }

  function handleClearCanvas() {
    if (nodes.length === 0 && edges.length === 0) {
      toast.info(t('info.canvasAlreadyEmpty'))
      return
    }

    if (confirm(t('confirm.clearCanvas'))) {
      setNodes([])
      setEdges([])
      setSelectedFlowId("")
      toast.success(t('success.canvasCleared'))
    }
  }


  async function saveFlow() {
    if (!flowName.trim()) {
      toast.error(t('errors.nameRequired'))
      return
    }

    if (!user?.email) {
      toast.error(t('errors.userNotAuthenticated'))
      return
    }

    // Busca o node de tipo "start"
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      toast.error(t('errors.startBlockRequired'))
      return
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
        return
      }

      toast.success(t('success.flowSaved'))
      setOpenSaveDialog(false)
      setFlowName("")
      setSelectedFlowId("") // Limpa seleção após salvar
      await loadFlows() // Recarrega a lista de flows
    } catch (err) {
      console.error('Erro ao salvar flow:', err)
      toast.error(t('errors.saveFlow'), {
        duration: 5000
      })
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <Select 
          value={selectedFlowId} 
          onValueChange={(value) => {
            setSelectedFlowId(value)
            if (value) {
              loadFlow(value)
            }
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={loadingFlows ? t('loading.loading') : t('select.flow')} />
          </SelectTrigger>
          <SelectContent>
            {flows.length === 0 ? (
              <SelectItem value="none" disabled>
                {t('empty.noFlows')}
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
        
        <div className="flex gap-2 items-center">
          {selectedFlowId && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => deleteFlow(selectedFlowId)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title={t('button.deleteFlow')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            <Workflow className="mr-2 h-4 w-4" /> {t('button.blocks')}
          </Button>
          <Button variant="outline" onClick={() => setOpenAgentDrawer(true)}>
            <Bot className="mr-2 h-4 w-4" /> {t('button.agents')}
          </Button>
          <Button variant="outline" onClick={handleClearCanvas}>
            <Eraser className="mr-2 h-4 w-4" /> {t('button.clearCanvas')}
          </Button>
          <Button 
            onClick={handleSaveClick} 
            className="text-white shadow-lg transition-all hover:shadow-xl"
            style={{ 
              background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
              color: 'white',
              boxShadow: theme === 'dark' 
                ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' 
                : '0 8px 20px rgba(8, 145, 178, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = theme === 'dark'
                ? '0 0 30px rgba(34, 211, 238, 0.6), 0 12px 30px rgba(8, 145, 178, 0.4)'
                : '0 12px 30px rgba(8, 145, 178, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = theme === 'dark'
                ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)'
                : '0 8px 20px rgba(8, 145, 178, 0.4)'
            }}
          >
            <GitBranch className="mr-2 h-4 w-4" style={{ color: 'white' }} /> {t('button.saveFlow')}
          </Button>
        </div>
      </div>

      {/* Drawer de blocos */}
      <BlocksDrawer 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        onAddBlock={addBlockNode}
      />

      {/* Drawer de agentes */}
      <AgentsDrawer
        isOpen={openAgentDrawer}
        onClose={() => setOpenAgentDrawer(false)}
        onAddAgent={addAgentNode}
        onAddTemplate={addTemplateNode}
        agents={availableAgents}
        templates={availableTemplates}
        loading={loadingAgents}
        loadingTemplates={loadingTemplates}
      />

      {/* Dialog para salvar flow */}
      <Dialog open={openSaveDialog} onOpenChange={setOpenSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.saveFlow.title')}</DialogTitle>
            <DialogDescription>
              {t('dialog.saveFlow.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">{t('dialog.saveFlow.nameLabel')}</Label>
              <Input
                id="flow-name"
                placeholder={t('dialog.saveFlow.namePlaceholder')}
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveFlow()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSaveDialog(false)}>
              {t('button.cancel')}
            </Button>
            <Button onClick={saveFlow} disabled={!flowName.trim()}>
              {t('button.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
              <CardDescription className="text-slate-600">
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onNodeContextMenu={(event, node) => {
              event.preventDefault()
              event.stopPropagation()
              if (node && node.id && ['loop', 'if-else', 'delay', 'comment', 'agent'].includes(node.type || '')) {
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
            className="bg-background"
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
              const templateId = event.dataTransfer.getData('templateId')
              const templateName = event.dataTransfer.getData('templateName')
              
              if (blockType) {
                addBlockNode(blockType)
              } else if (agentId && agentName) {
                const agent = availableAgents.find(a => a.id === agentId)
                if (agent) {
                  addAgentNode(agent)
                }
              } else if (templateId && templateName) {
                const template = availableTemplates.find(t => t.id === templateId)
                if (template) {
                  addTemplateNode(template)
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
                return '#94a3b8'
              }}
              maskColor="rgba(0, 0, 0, 0.15)"
              className="!bg-slate-900/80 !rounded-xl !border !border-slate-700/50"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderRadius: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.2)'
              }}
            />
            <Controls 
              className="!bg-white/90 !backdrop-blur-sm !rounded-xl !border !border-slate-200/50 !shadow-lg"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '0.75rem',
                border: '1px solid rgba(226, 232, 240, 0.5)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Background gap={20} size={1} color="#e2e8f0" />
          </ReactFlow>
        </div>
      </Card>

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
          availableTemplates={availableTemplates}
          availableFlows={flows.map(f => ({ id: f.id, name: f.name }))}
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
