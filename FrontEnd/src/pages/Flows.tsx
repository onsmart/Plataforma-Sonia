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
import { GitBranch, Plus, X, Trash2, Play } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase/client"

// Nó simples de agente com handles de conexão
function AgentNode({ data, selected, id }: any) {
  const isStartNode = data.isStartNode || false
  
  return (
    <div className={`rounded-xl border p-4 shadow-sm min-w-[160px] relative transition-all ${
      isStartNode
        ? 'bg-background border-red-600 border-3 shadow-lg ring-2 ring-red-500/50'
        : selected 
        ? 'bg-primary/10 border-primary border-2 shadow-lg' 
        : 'bg-background border-border'
    }`} style={isStartNode ? { borderWidth: '3px' } : {}}>
      {/* Handle de entrada (fêmea) - parte superior */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-2 !border-primary-foreground !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <p className={`text-sm font-semibold ${isStartNode ? 'text-red-600 dark:text-red-500' : selected ? 'text-primary' : ''}`}>
        {data.label}
      </p>
      <p className={`text-xs ${isStartNode ? 'text-red-500' : 'text-muted-foreground'}`}>Agente</p>
      
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

const nodeTypes = {
  agent: AgentNode,
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

export function Flows() {
  const { user } = useAuth()
  const [openAgentModal, setOpenAgentModal] = useState(false)
  const [openSaveDialog, setOpenSaveDialog] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [flows, setFlows] = useState<any[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [startNodeId, setStartNodeId] = useState<string | null>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

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

  // Carrega flows do banco de dados
  const loadFlows = useCallback(async () => {
    if (!user?.email) return

    setLoadingFlows(true)
    try {
      // TODO: Substituir por RPC real quando disponível
      // Por enquanto, vamos buscar de uma tabela tb_flows
      const { data, error } = await supabase
        .from('tb_flows')
        .select('id, name, created_at')
        .eq('user_email', user.email)
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
          agentId: node.data?.agentId || node.data?.agentId || null,
          isStartNode: node.data?.isStartNode || false
        }
      }
    })
  }, [])

  // Normaliza edges: garante que source/target referenciem node.id, não agentId
  const normalizeEdges = useCallback((edges: Edge[], nodes: Node[]): Edge[] => {
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
      
      normalized.push({
        id: `edge-${index}`,
        source,
        target,
        type: (edge.type || 'default') as string
      } as Edge)
    })
    
    return normalized
  }, [])

  // Carrega um flow específico
  const loadFlow = useCallback(async (flowId: string) => {
    if (!user?.email) return

    try {
      const { data, error } = await supabase
        .from('tb_flows')
        .select('nodes')
        .eq('id', flowId)
        .eq('user_email', user.email)
        .single()

      if (error) {
        console.error('Erro ao carregar flow:', error)
        toast.error('Erro ao carregar flow')
        return
      }

      // Extrai os dados do JSON (que está salvo no campo nodes)
      const flowData = data?.nodes || {}
      
      // Restaura o startNodeId do JSON
      let startNodeIdValue = flowData?.startNodeId || null
      
      // Normaliza nodes primeiro
      let normalizedNodes: Node[] = []
      if (flowData?.nodes && Array.isArray(flowData.nodes)) {
        normalizedNodes = normalizeNodes(flowData.nodes)
        
        // Se startNodeId aponta para um ID antigo, atualiza
        if (startNodeIdValue) {
          const oldNode = flowData.nodes.find((n: Node) => n.id === startNodeIdValue)
          if (oldNode) {
            const newStartNode = normalizedNodes.find(n => 
              n.data?.agentId === oldNode.data?.agentId && 
              (oldNode.id === startNodeIdValue || n.id === startNodeIdValue)
            )
            if (newStartNode) {
              startNodeIdValue = newStartNode.id
            }
          }
        }
        
        // Se não há startNodeId mas há nodes, define o primeiro como inicial
        if (!startNodeIdValue && normalizedNodes.length > 0) {
          startNodeIdValue = normalizedNodes[0].id
        }
        
        // Atualiza isStartNode nos nodes normalizados
        normalizedNodes = normalizedNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isStartNode: node.id === startNodeIdValue
          }
        }))
      }
      
      setStartNodeId(startNodeIdValue)
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
  }, [user?.email, setNodes, setEdges, normalizeNodes, normalizeEdges])

  // Deleta um flow do banco de dados
  const deleteFlow = useCallback(async (flowId: string) => {
    if (!user?.email) return

    // Confirmação antes de deletar
    if (!confirm('Tem certeza que deseja deletar este flow? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('tb_flows')
        .delete()
        .eq('id', flowId)
        .eq('user_email', user.email)

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
  }, [user?.email, loadFlows, selectedFlowId])

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
          // Se o nó inicial foi deletado, limpa o startNodeId
          if (startNodeId && nodeIds.includes(startNodeId)) {
            setStartNodeId(null)
          }
          toast.success(`${selectedNodes.length} agente(s) deletado(s)`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, setNodes, setEdges, startNodeId])

  function addAgentNode(agent: AvailableAgent) {
    if (!reactFlowInstance.current) {
      toast.error("Erro ao adicionar agente. Tente novamente.")
      return
    }

    // Obtém o viewport atual
    const viewport = reactFlowInstance.current.getViewport()
    
    // Calcula posição no centro da viewport visível
    // Usa a posição atual do viewport + offset para centralizar
    const centerX = -viewport.x / viewport.zoom + (window.innerWidth * 0.4) / viewport.zoom
    const centerY = -viewport.y / viewport.zoom + (window.innerHeight * 0.3) / viewport.zoom

    // Gera ID sequencial (node-1, node-2, etc.)
    const existingNodeIds = nodes.map(n => n.id)
    let nodeNumber = 1
    while (existingNodeIds.includes(`node-${nodeNumber}`)) {
      nodeNumber++
    }
    const nodeId = `node-${nodeNumber}`
    
    const newNode: Node = {
      id: nodeId,
      type: "agent",
      position: { 
        x: centerX || Math.random() * 500 + 100, 
        y: centerY || Math.random() * 300 + 100 
      },
      data: { 
        label: agent.name,
        agentId: agent.id, // Guarda o ID real do agente
        bio: agent.bio,
        isStartNode: false // Por padrão não é o inicial
      },
      draggable: true,
    }
    
    // Se não há nó inicial, define este como inicial automaticamente
    const isFirstNode = nodes.length === 0
    if (isFirstNode) {
      newNode.data.isStartNode = true
      setStartNodeId(nodeId)
    }
    
    setNodes((nds) => [...nds, newNode])
    toast.success(`Agente "${agent.name}" adicionado ao fluxo${isFirstNode ? ' (definido como executor)' : ''}`)
    
    // Foca no novo nó após um pequeno delay
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ 
          padding: 0.3,
          includeHiddenNodes: false,
          duration: 300
        })
      }
    }, 150)
  }

  function handleSaveClick() {
    setFlowName("")
    setOpenSaveDialog(true)
  }

  // Define um nó como executor (inicial)
  const setNodeAsStart = useCallback((nodeId: string) => {
    // Remove o status de executor de todos os nós
    setNodes((nds) => 
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isStartNode: node.id === nodeId
        }
      }))
    )
    setStartNodeId(nodeId)
    toast.success('Nó definido como executor')
  }, [setNodes])

  async function saveFlow() {
    if (!flowName.trim()) {
      toast.error("Por favor, informe um nome para o fluxo")
      return
    }

    if (!user?.email) {
      toast.error("Usuário não autenticado")
      return
    }

    // Valida se há um nó inicial definido
    if (!startNodeId) {
      toast.error("Por favor, defina um agente como executor (clique com botão direito no nó)")
      return
    }

    try {
      // Formata edges no formato simples (sem id)
      const formattedEdges = edges.map(edge => ({
        source: edge.source,
        target: edge.target
      }))

      // Estrutura do JSON conforme modelo fornecido
      const flowData = {
        startNodeId: startNodeId,
        nodes: nodes,
        edges: formattedEdges, // Array simples sem id
      }

      // Salva o JSON completo no campo nodes (que já existe na tabela)
      const payload = {
        name: flowName.trim(),
        nodes: flowData, // JSON completo com startNodeId, nodes e edges
        user_email: user.email,
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
          
          <Button variant="outline" onClick={() => setOpenAgentModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Agente
          </Button>
          <Button onClick={handleSaveClick}>
            <GitBranch className="mr-2 h-4 w-4" /> Salvar Fluxo
          </Button>
        </div>
      </div>

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

      {openAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Adicionar agente ao fluxo</h3>
              <button onClick={() => setOpenAgentModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {loadingAgents ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Carregando agentes...
                </div>
              ) : availableAgents.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Nenhum agente disponível. Crie agentes primeiro.
                </div>
              ) : (
                availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      addAgentNode(agent)
                      setOpenAgentModal(false)
                    }}
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted transition-colors"
                  >
                    <div className="font-semibold text-sm">{agent.name}</div>
                    {agent.bio && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {agent.bio}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editor de Fluxo</CardTitle>
              <CardDescription>
                Arraste, conecte e defina a lógica entre os agentes
              </CardDescription>
            </div>
            {startNodeId && (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
                <Play className="h-3 w-3 mr-1" />
                Executor definido
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Dica: Clique com o botão direito em um agente para defini-lo como executor (inicial)
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
              setNodeAsStart(node.id)
            }}
            nodeTypes={nodeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            className="bg-background"
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode={['Meta', 'Control']}
            selectionOnDrag
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
    </div>
  )
}
