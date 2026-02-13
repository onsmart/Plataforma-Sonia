import React, { useCallback, useState, useRef, useEffect } from "react"
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
import { GitBranch, Plus, X, Trash2, Play, Workflow, Bot, Eraser } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase/client"
import { BlocksDrawer } from "../components/flows/BlocksDrawer"
import { AgentsDrawer } from "../components/flows/AgentsDrawer"
import { AnimatedEdge } from "../components/flows/AnimatedEdge"
import { EditNodeDialog } from "../components/flows/EditNodeDialog"
import {
  StartNode,
  StopNode,
  IfElseNode,
  LoopNode,
  CodeNode,
  DelayNode,
} from "../components/flows/FlowNodes"

// Nó simples de agente com handles de conexão
function AgentNode({ data, selected, id }: any) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm min-w-[160px] relative transition-all ${
      selected 
        ? 'bg-primary/10 border-primary border-2 shadow-lg' 
        : 'bg-background border-border'
    }`}>
      {/* Handle de entrada (fêmea) - parte superior */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-2 !border-primary-foreground !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <p className={`text-sm font-semibold ${selected ? 'text-primary' : ''}`}>
        {data.label}
      </p>
      <p className="text-xs text-muted-foreground">Agente</p>
      
      {/* Handle de saída (macho) - parte inferior */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !border-2 !border-primary-foreground !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  )
}

// Criar nodeTypes
const createNodeTypes = () => ({
  agent: AgentNode,
  start: StartNode,
  stop: StopNode,
  'if-else': IfElseNode,
  loop: LoopNode,
  code: CodeNode,
  delay: DelayNode,
})

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

export function Flows() {
  const { user, userId } = useAuth()
  const [openAgentDrawer, setOpenAgentDrawer] = useState(false)
  const [openSaveDialog, setOpenSaveDialog] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [flows, setFlows] = useState<any[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  // Buscar node "start" para verificar se existe
  const startNode = nodes.find(n => n.type === 'start')

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Valida que source e target são strings válidas
      if (!params.source || !params.target) {
        console.warn('Tentativa de conectar com source/target inválidos:', params)
        toast.error('Erro ao conectar: nodes inválidos')
        return
      }
      
      // Valida que source e target são node.id válidos
      const sourceNode = nodes.find(n => n.id === params.source)
      const targetNode = nodes.find(n => n.id === params.target)
      
      if (!sourceNode || !targetNode) {
        console.warn('Tentativa de conectar nodes inválidos:', params)
        toast.error('Erro ao conectar: nodes não encontrados')
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
    if (node && ['loop', 'if-else', 'delay', 'code'].includes(node.type || '')) {
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
    toast.success('Node atualizado com sucesso!')
  }, [setNodes, flows])

  // Carrega flows do banco de dados (filtrado por companies_id)
  const loadFlows = useCallback(async () => {
    if (!user?.email || !userId) return

    setLoadingFlows(true)
    try {
      // 1. Buscar companies_id a partir do user_id
      const { data: companyUser, error: companyError } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyError || !companyUser?.companies_id) {
        console.error('Erro ao buscar companies_id:', companyError)
        setFlows([])
        return
      }

      const companiesId = companyUser.companies_id

      // 2. Filtrar por companies_id
      const { data, error } = await supabase
        .from('tb_flows')
        .select('id, name, created_at')
        .eq('companies_id', companiesId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar flows:', error)
        // Se a tabela não existir, apenas loga o erro
        if (error.code !== 'PGRST116') {
          toast.error('Erro ao carregar flows')
        }
        setFlows([])
        return
      }

      setFlows(data || [])
    } catch (err) {
      console.error('Erro ao carregar flows:', err)
      setFlows([])
    } finally {
      setLoadingFlows(false)
    }
  }, [user?.email, userId])

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
          agentId: node.data?.agentId || node.data?.agentId || null,
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
    if (!user?.email || !userId) return

    try {
      // 1. Buscar companies_id a partir do user_id
      const { data: companyUser, error: companyError } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyError || !companyUser?.companies_id) {
        console.error('Erro ao buscar companies_id:', companyError)
        toast.error('Erro ao carregar flow: empresa não encontrada')
        return
      }

      const companiesId = companyUser.companies_id

      // 2. Buscar flow por id e companies_id
      const { data, error } = await supabase
        .from('tb_flows')
        .select('nodes')
        .eq('id', flowId)
        .eq('companies_id', companiesId)
        .single()

      if (error) {
        console.error('Erro ao carregar flow:', error)
        toast.error('Erro ao carregar flow')
        return
      }

      // Extrai os dados do JSON (que está salvo no campo nodes)
      const flowData = data?.nodes || {}
      
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

      toast.success('Flow carregado e normalizado com sucesso!')
    } catch (err) {
      console.error('Erro ao carregar flow:', err)
      toast.error('Erro ao carregar flow')
    }
  }, [user?.email, userId, setNodes, setEdges, normalizeNodes, normalizeEdges])

  // Deleta um flow do banco de dados
  const deleteFlow = useCallback(async (flowId: string) => {
    if (!user?.email || !userId) return

    // Confirmação antes de deletar
    if (!confirm('Tem certeza que deseja deletar este flow? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      // 1. Buscar companies_id a partir do user_id
      const { data: companyUser, error: companyError } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyError || !companyUser?.companies_id) {
        console.error('Erro ao buscar companies_id:', companyError)
        toast.error('Erro ao deletar flow: empresa não encontrada')
        return
      }

      const companiesId = companyUser.companies_id

      // 2. Deletar flow por id e companies_id
      const { error } = await supabase
        .from('tb_flows')
        .delete()
        .eq('id', flowId)
        .eq('companies_id', companiesId)

      if (error) {
        console.error('Erro ao deletar flow:', error)
        toast.error('Erro ao deletar flow')
        return
      }

      toast.success('Flow deletado com sucesso!')
      
      // Recarrega a lista de flows
      await loadFlows()
      
      // Se o flow deletado estava selecionado, limpa a seleção
      if (selectedFlowId === flowId) {
        setSelectedFlowId("")
      }
    } catch (err) {
      console.error('Erro ao deletar flow:', err)
      toast.error('Erro ao deletar flow')
    }
  }, [user?.email, userId, loadFlows, selectedFlowId])

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
        toast.error('Erro ao carregar agentes')
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
          toast.success(`${selectedEdges.length} conexão(ões) deletada(s)`)
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
          toast.success(`${selectedNodes.length} nó(s) deletado(s)`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, setNodes, setEdges, isEditDialogOpen])

  // Função genérica para adicionar qualquer tipo de node
  const addNodeAtCenter = useCallback((nodeConfig: Partial<Node>) => {
    if (!reactFlowInstance.current) {
      toast.error("Erro ao adicionar nó. Tente novamente.")
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

  function addAgentNode(agent: AvailableAgent) {
    const nodeId = addNodeAtCenter({
      type: "agent",
      data: { 
        label: agent.name,
        agentId: agent.id,
        bio: agent.bio,
      },
    })

    if (nodeId) {
      toast.success(`Agente "${agent.name}" adicionado ao fluxo`)
    }
  }

  // Função para adicionar blocos do drawer
  const addBlockNode = useCallback((blockType: string) => {
    const blockConfigs: Record<string, Partial<Node>> = {
      'start': {
        type: 'start',
        data: { label: 'Início' },
      },
      'stop': {
        type: 'stop',
        data: { label: 'Fim' },
      },
      'if-else': {
        type: 'if-else',
        data: { label: 'Condicional', condition: '{{condição}}' },
      },
      'loop': {
        type: 'loop',
        data: { label: 'Loop', iterations: '10' },
      },
      'code': {
        type: 'code',
        data: { label: 'Código', code: '// Seu código aqui' },
      },
      'delay': {
        type: 'delay',
        data: { label: 'Aguardar', duration: '5 segundos' },
      },
    }

    const config = blockConfigs[blockType]
    if (!config) {
      toast.error(`Tipo de bloco "${blockType}" não encontrado`)
      return
    }

    const nodeId = addNodeAtCenter(config)
    if (nodeId) {
      const blockLabels: Record<string, string> = {
        'start': 'Início',
        'stop': 'Fim',
        'if-else': 'Condicional',
        'loop': 'Loop',
        'code': 'Código',
        'delay': 'Aguardar',
      }
      toast.success(`Bloco "${blockLabels[blockType]}" adicionado`)
      setDrawerOpen(false)
    }
  }, [addNodeAtCenter])

  function handleSaveClick() {
    setFlowName("")
    setOpenSaveDialog(true)
  }

  function handleClearCanvas() {
    if (nodes.length === 0 && edges.length === 0) {
      toast.info("O quadro já está vazio")
      return
    }

    if (confirm('Tem certeza que deseja limpar o quadro? Todos os nodes e conexões serão removidos.')) {
      setNodes([])
      setEdges([])
      setSelectedFlowId("")
      toast.success("Quadro limpo com sucesso!")
    }
  }


  async function saveFlow() {
    if (!flowName.trim()) {
      toast.error("Por favor, informe um nome para o fluxo")
      return
    }

    if (!user?.email || !userId) {
      toast.error("Usuário não autenticado")
      return
    }

    // Busca o node de tipo "start"
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      toast.error("Por favor, adicione um bloco 'Início' ao fluxo")
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

      // 1. Buscar companies_id a partir do user_id
      const { data: companyUser, error: companyError } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyError || !companyUser?.companies_id) {
        console.error('Erro ao buscar companies_id:', companyError)
        toast.error('Erro ao salvar flow: empresa não encontrada')
        return
      }

      const companiesId = companyUser.companies_id

      // 2. Salva o JSON completo no campo nodes (que já existe na tabela)
      const payload = {
        name: flowName.trim(),
        nodes: flowData, // JSON completo com startNodeId, nodes e edges
        user_email: user.email, // Mantém para compatibilidade/auditoria
        companies_id: companiesId, // ✅ Adiciona companies_id
      }

      const { data, error } = await supabase
        .from('tb_flows')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Erro ao salvar flow:', error)
        toast.error('Erro ao salvar flow')
        return
      }

      toast.success("Fluxo salvo com sucesso!")
      setOpenSaveDialog(false)
      setFlowName("")
      await loadFlows() // Recarrega a lista de flows
    } catch (err) {
      console.error('Erro ao salvar flow:', err)
      toast.error('Erro ao salvar flow')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Flows</h2>
          <p className="text-muted-foreground">
            Crie fluxos visuais conectando agentes
          </p>
        </div>

        <div className="flex gap-2 items-center">
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
              <SelectValue placeholder={loadingFlows ? "Carregando..." : "Selecione um flow"} />
            </SelectTrigger>
            <SelectContent>
              {flows.length === 0 ? (
                <SelectItem value="none" disabled>
                  Nenhum flow encontrado
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
          
          {selectedFlowId && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => deleteFlow(selectedFlowId)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Deletar flow"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            <Workflow className="mr-2 h-4 w-4" /> Blocos
          </Button>
          <Button variant="outline" onClick={() => setOpenAgentDrawer(true)}>
            <Bot className="mr-2 h-4 w-4" /> Agentes
          </Button>
          <Button variant="outline" onClick={handleClearCanvas}>
            <Eraser className="mr-2 h-4 w-4" /> Limpar Quadro
          </Button>
          <Button onClick={handleSaveClick}>
            <GitBranch className="mr-2 h-4 w-4" /> Salvar Fluxo
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
        agents={availableAgents}
        loading={loadingAgents}
      />

      {/* Dialog para salvar flow */}
      <Dialog open={openSaveDialog} onOpenChange={setOpenSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Fluxo</DialogTitle>
            <DialogDescription>
              Digite um nome para salvar este fluxo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">Nome do Fluxo</Label>
              <Input
                id="flow-name"
                placeholder="Ex: Fluxo de Atendimento"
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
              Cancelar
            </Button>
            <Button onClick={saveFlow} disabled={!flowName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editor de Fluxo</CardTitle>
              <CardDescription>
                Arraste, conecte e defina a lógica entre os agentes
              </CardDescription>
            </div>
            {startNode && (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
                <Play className="h-3 w-3 mr-1" />
                Executor definido
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Dica: Adicione um bloco "Início" para definir o ponto de partida. Clique com botão direito nos blocos de controle para editá-los.
          </p>
        </CardHeader>

        <div className="flex-1 min-h-0 relative">
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
              if (node && node.id && ['loop', 'if-else', 'delay', 'code'].includes(node.type || '')) {
                handleNodeDoubleClick(node.id)
              }
            }}
            nodeTypes={createNodeTypes()}
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
                return node.type === 'agent' ? '#3b82f6' : '#94a3b8'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
            <Controls />
            <Background gap={20} size={1} />
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
          availableFlows={flows.map(f => ({ id: f.id, name: f.name }))}
        />
      )}
    </div>
  )
}
