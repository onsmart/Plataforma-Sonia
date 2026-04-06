import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { toast } from 'sonner'
import { ConditionBuilder } from './ConditionBuilder'
import { Wand2, Code2, RefreshCw, Infinity, Hash, Plus, Minus, Search, Clock, Info, FileText } from 'lucide-react'

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

interface AvailableFlow {
  id: string
  name: string
}

interface EditNodeDialogProps {
  isOpen: boolean
  onClose: () => void
  node: any
  onSave: (nodeId: string, data: any) => void
  availableAgents?: AvailableAgent[]
  availableTemplates?: AvailableTemplate[]
  availableFlows?: AvailableFlow[]
}

export function EditNodeDialog({
  isOpen,
  onClose,
  node,
  onSave,
  availableAgents = [],
  availableTemplates = [],
  availableFlows = []
}: EditNodeDialogProps) {
  const [formData, setFormData] = useState<any>({})
  const [isFlowDropdownOpen, setIsFlowDropdownOpen] = useState(false)
  const [delayTimeUnit, setDelayTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds')

  const normalizeInitialData = (currentNode: any) => {
    if (!currentNode) return {}

    const currentData = currentNode.data || {}
    if (currentNode.type !== 'agent') {
      return currentData
    }

    return {
      executionMode: currentData.executionMode || (currentData.templateId && !currentData.agentId ? 'template' : 'agent'),
      label: currentData.label || 'Agente IA',
      agentId: currentData.agentId || '',
      agentName: currentData.agentName || '',
      templateId: currentData.templateId || '',
      templateName: currentData.templateName || '',
      bio: currentData.bio || '',
      additionalInstructions: currentData.additionalInstructions || '',
    }
  }

  useEffect(() => {
    if (node) {
      setFormData(normalizeInitialData(node))
      setIsFlowDropdownOpen(false)
    }
  }, [node?.id]) // Só atualiza quando o node.id muda, não quando availableFlows muda

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFlowDropdownOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('.flow-dropdown-container')) {
          setIsFlowDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFlowDropdownOpen])

  if (!node) {
    return null
  }

  const handleSave = () => {
    if (node.type === 'agent') {
      const executionMode = formData.executionMode === 'template' ? 'template' : 'agent'

      if (executionMode === 'agent') {
        if (!formData.agentId) {
          toast.error('Selecione um agente para este bloco.')
          return
        }

        const selectedAgent = availableAgents.find(agent => agent.id === formData.agentId)
        const payload = {
          ...formData,
          executionMode: 'agent',
          label: formData.label?.trim() || selectedAgent?.name || 'Agente IA',
          agentName: selectedAgent?.name || formData.agentName || '',
          templateId: undefined,
          templateName: undefined,
          additionalInstructions: formData.additionalInstructions || '',
        }

        onSave(node.id, payload)
        onClose()
        return
      }

      if (!formData.templateId) {
        toast.error('Selecione um template para este bloco.')
        return
      }

      const selectedTemplate = availableTemplates.find(template => template.id === formData.templateId)
      const payload = {
        ...formData,
        executionMode: 'template',
        label: formData.label?.trim() || selectedTemplate?.name || 'Template',
        templateName: selectedTemplate?.name || formData.templateName || '',
        agentId: undefined,
        agentName: undefined,
        additionalInstructions: formData.additionalInstructions || '',
      }

      onSave(node.id, payload)
      onClose()
      return
    }
    // Validação para Loop
    if (node.type === 'loop') {
      if (formData.infinite) {
        // Se infinito está marcado, garante que iterations seja '∞'
        formData.iterations = '∞'
      } else {
        // Se infinito não está marcado, valida o campo de iterações
        const iterationsValue = formData.iterations?.toString().trim()
        if (!iterationsValue || iterationsValue === '0' || iterationsValue === '' || iterationsValue === '∞' || parseInt(iterationsValue) <= 0) {
          // Mostra mensagem e define como 1
          toast.warning('O número de iterações não pode estar vazio ou ser zero. Será salvo com 1 repetição.')
          formData.iterations = '1'
        }
      }
    }
    
    onSave(node.id, formData)
    onClose()
  }

  const renderForm = () => {
    switch (node.type) {
      case 'agent':
        const executionMode = formData.executionMode === 'template' ? 'template' : 'agent'
        const selectedAgent = availableAgents.find(agent => agent.id === formData.agentId)
        const selectedTemplate = availableTemplates.find(template => template.id === formData.templateId)

        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
                <Wand2 className="h-12 w-12 text-emerald-600" strokeWidth={2} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-node-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="agent-node-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex: Classificador, Agendamento ou Suporte"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Modo de execução</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    executionMode: 'agent',
                    templateId: '',
                    templateName: '',
                  })}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    executionMode === 'agent'
                      ? 'bg-emerald-50 border-emerald-400 shadow-lg ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 hover:border-emerald-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="font-bold text-sm mb-1">Agente existente</div>
                  <div className="text-xs text-slate-600">Reaproveita o runtime completo atual por `agentId`.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    executionMode: 'template',
                    agentId: '',
                    agentName: '',
                  })}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    executionMode === 'template'
                      ? 'bg-blue-50 border-blue-400 shadow-lg ring-2 ring-blue-200'
                      : 'bg-white border-slate-200 hover:border-blue-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="font-bold text-sm mb-1">Template</div>
                  <div className="text-xs text-slate-600">Executa o template direto no flow, sem criar agente no banco.</div>
                </button>
              </div>
            </div>

            {executionMode === 'agent' ? (
              <div className="space-y-2">
                <Label htmlFor="agent-select" className="text-sm font-semibold">Agente</Label>
                <Select
                  value={formData.agentId || ''}
                  onValueChange={(value) => {
                    const agent = availableAgents.find(item => item.id === value)
                    setFormData({
                      ...formData,
                      executionMode: 'agent',
                      agentId: value,
                      agentName: agent?.name || '',
                      label: formData.label || agent?.name || 'Agente IA',
                    })
                  }}
                >
                  <SelectTrigger id="agent-select" className="rounded-xl" style={{ borderRadius: '12px' }}>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent?.bio && (
                  <p className="text-xs text-slate-500">{selectedAgent.bio}</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="template-select" className="text-sm font-semibold">Template</Label>
                  <Select
                    value={formData.templateId || ''}
                    onValueChange={(value) => {
                      const template = availableTemplates.find(item => item.id === value)
                      setFormData({
                        ...formData,
                        executionMode: 'template',
                        templateId: value,
                        templateName: template?.name || '',
                        label: formData.label || template?.name || 'Template',
                      })
                    }}
                  >
                    <SelectTrigger id="template-select" className="rounded-xl" style={{ borderRadius: '12px' }}>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInstructions" className="text-sm font-semibold">Instruções complementares</Label>
                  <Textarea
                    id="additionalInstructions"
                    value={formData.additionalInstructions || ''}
                    onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
                    placeholder="Opcional: complemente o comportamento deste bloco sem alterar o template original."
                    rows={5}
                    className="rounded-xl resize-none"
                    style={{ borderRadius: '12px' }}
                  />
                  <p className="text-xs text-slate-500">
                    Essas instruções serão combinadas com o template apenas neste node do flow.
                  </p>
                </div>
              </>
            )}
          </div>
        )

      case 'loop':
        const isInfinite = formData.infinite || false
        const iterations = parseInt(formData.iterations) || 10
        
        return (
          <div className="space-y-6">
            {/* Ícone grande no topo */}
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-purple-50 border-2 border-purple-200">
                <RefreshCw className="h-12 w-12 text-purple-600" strokeWidth={2} />
              </div>
            </div>

            {/* Seleção de Fluxo com busca */}
            <div className="space-y-2 flow-dropdown-container">
              <Label htmlFor="flow" className="text-sm font-semibold">Fluxo para Executar em Loop</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFlowDropdownOpen(!isFlowDropdownOpen)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 h-9 rounded-xl border border-purple-200 bg-input-background focus:border-purple-400 focus:ring-purple-400 focus:ring-2 focus:ring-offset-0 cursor-pointer hover:border-purple-300 transition-colors"
                  style={{ borderRadius: '12px' }}
                >
                  <span className={formData.flowId ? 'text-foreground' : 'text-muted-foreground'}>
                    {formData.flowId 
                      ? availableFlows.find(f => f.id === formData.flowId)?.name || 'Selecione um fluxo'
                      : 'Selecione um fluxo'}
                  </span>
                  <Search className="h-4 w-4 text-slate-400" />
                </button>
                {isFlowDropdownOpen && (
                  <div 
                    className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-200 rounded-xl shadow-lg"
                    style={{
                      maxHeight: '240px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#c084fc #f3e8ff'
                    }}
                  >
                    {availableFlows.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">
                        Nenhum fluxo disponível
                      </div>
                    ) : (
                      availableFlows.map((flow) => (
                        <button
                          key={flow.id}
                          onClick={() => {
                            setFormData({ 
                              ...formData, 
                              flowId: flow.id,
                              flowName: flow.name
                            })
                            setIsFlowDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                            formData.flowId === flow.id ? 'bg-purple-50 font-semibold' : ''
                          }`}
                        >
                          <div className="font-medium text-slate-900">{flow.name}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {formData.flowId && (
                <p className="text-xs text-purple-600 font-medium">
                  ✓ Fluxo selecionado: {availableFlows.find(f => f.id === formData.flowId)?.name || 'Desconhecido'}
                </p>
              )}
            </div>

            {/* Tiles de Decisão: Contagem Fixa vs Infinito */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo de Repetição</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Card: Contagem Fixa */}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ 
                      ...formData, 
                      infinite: false, 
                      iterations: formData.iterations === '∞' || !formData.iterations ? '10' : formData.iterations 
                    })
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    !isInfinite 
                      ? 'bg-purple-50 border-purple-400 shadow-lg ring-2 ring-purple-200' 
                      : 'bg-white border-slate-200 hover:border-purple-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${!isInfinite ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      <Hash className={`h-5 w-5 ${!isInfinite ? 'text-purple-600' : 'text-slate-400'}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 ${!isInfinite ? 'text-purple-900' : 'text-slate-700'}`}>
                        Contagem Fixa
                      </div>
                      <div className="text-xs text-slate-600">
                        O fluxo repete um número exato de vezes
                      </div>
                    </div>
                  </div>
                </button>

                {/* Card: Loop Infinito */}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, infinite: true, iterations: '∞' })
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isInfinite 
                      ? 'bg-purple-50 border-purple-400 shadow-lg ring-2 ring-purple-200' 
                      : 'bg-white border-slate-200 hover:border-purple-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isInfinite ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      <Infinity className={`h-5 w-5 ${isInfinite ? 'text-purple-600' : 'text-slate-400'}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 ${isInfinite ? 'text-purple-900' : 'text-slate-700'}`}>
                        Loop Infinito
                      </div>
                      <div className="text-xs text-slate-600">
                        O fluxo repete até ser interrompido manualmente
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Input com Stepper (só aparece se não for infinito) */}
            {!isInfinite && (
              <div className="space-y-2">
                <Label htmlFor="iterations" className="text-sm font-semibold">Número de Iterações</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(formData.iterations) || 10
                      if (current > 1) {
                        setFormData({ ...formData, iterations: (current - 1).toString() })
                      }
                    }}
                    className="p-2 rounded-lg border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-400 transition-all"
                    style={{ borderRadius: '12px' }}
                  >
                    <Minus className="h-4 w-4 text-purple-600" />
                  </button>
                  <Input
                    id="iterations"
                    type="number"
                    min="1"
                    value={formData.iterations === '∞' ? '' : (formData.iterations || '10')}
                    onChange={(e) => setFormData({ ...formData, iterations: e.target.value })}
                    className="text-center text-lg font-bold rounded-xl border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    style={{ borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(formData.iterations) || 10
                      setFormData({ ...formData, iterations: (current + 1).toString() })
                    }}
                    className="p-2 rounded-lg border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-400 transition-all"
                    style={{ borderRadius: '12px' }}
                  >
                    <Plus className="h-4 w-4 text-purple-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Visual em Tempo Real */}
            <div className={`p-4 rounded-xl border-2 ${
              isInfinite 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-purple-50 border-purple-200'
            }`} style={{ borderRadius: '12px' }}>
              {isInfinite ? (
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <div className="font-semibold text-sm text-orange-900 mb-1">
                      Atenção: Loop Infinito
                    </div>
                    <div className="text-xs text-orange-700">
                      Este fluxo rodará para sempre. Use com cautela e certifique-se de ter uma forma de interrompê-lo.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="text-lg">🚀</span>
                  <div>
                    <div className="font-semibold text-sm text-purple-900 mb-1">
                      Resultado
                    </div>
                    <div className="text-xs text-purple-700">
                      Este fluxo vai rodar <strong>{iterations}</strong> {iterations === 1 ? 'vez' : 'vezes'} antes de encerrar.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'if-else':
        return (
          <div className="space-y-4">
            <Tabs defaultValue="simple" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-orange-200/70 bg-orange-50/70 p-1 dark:border-orange-400/20 dark:bg-orange-500/10">
                <TabsTrigger 
                  value="simple" 
                  className="flex items-center gap-2 rounded-xl text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Wand2 className="h-4 w-4" />
                  Modo Simples
                </TabsTrigger>
                <TabsTrigger 
                  value="advanced"
                  className="flex items-center gap-2 rounded-xl text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Code2 className="h-4 w-4" />
                  Modo Avançado
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="simple" className="space-y-4 mt-4">
                <ConditionBuilder 
                  formData={formData}
                  setFormData={setFormData}
                />
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <Label htmlFor="condition">Condição (Modo Avançado)</Label>
                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-200" style={{ backgroundColor: '#1e293b' }}>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-xs text-slate-400 ml-2">condição.js</span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-800/50 text-slate-500 text-xs font-mono flex flex-col items-end pr-2 border-r border-slate-700" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
                        {Array.from({ length: 6 }, (_, i) => (
                          <div key={i} style={{ lineHeight: '24px', height: '24px' }}>{i + 1}</div>
                        ))}
                      </div>
                      <Textarea
                        id="condition"
                        value={formData.condition || ''}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        placeholder="Ex: {{intent}} contem 'agendamento' ou {{message_count}} > 1"
                        rows={6}
                        className="font-mono text-sm bg-transparent text-slate-100 placeholder:text-slate-500 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                        style={{ 
                          color: '#e2e8f0',
                          paddingLeft: '48px',
                          paddingRight: '16px',
                          paddingTop: '12px',
                          paddingBottom: '12px',
                          lineHeight: '24px'
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Use variaveis entre chaves duplas: {"{{variavel}}"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Operadores suportados: ==, !=, {'>'}, {'<'}, {'>='}, {'<='}, contém, não contém, começa com, termina com
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Exemplos: {"{{intent}} contem 'agendamento'"} | {"{{message_count}} > 1"} | {"{{phone_number}} nao esta vazio"}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )

      case 'delay':
        // Converte o valor para a unidade selecionada
        const getValueInUnit = () => {
          const seconds = parseInt(formData.duration) || 0
          if (delayTimeUnit === 'minutes') return Math.floor(seconds / 60)
          if (delayTimeUnit === 'hours') return Math.floor(seconds / 3600)
          return seconds
        }
        
        // Formata o tempo total em formato legível
        const formatTotalTime = (totalSeconds: number) => {
          if (totalSeconds === 0) return '0 segundos'
          
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          
          const parts = []
          if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`)
          if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`)
          if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`)
          
          return parts.join(' e ') || '0 segundos'
        }
        
        const totalSeconds = parseInt(formData.duration) || 0
        const currentValue = getValueInUnit()
        
        const handlePresetClick = (seconds: number) => {
          setFormData({ ...formData, duration: seconds.toString() })
          setDelayTimeUnit('seconds')
        }
        
        const handleValueChange = (newValue: number) => {
          let seconds = newValue
          if (delayTimeUnit === 'minutes') seconds = newValue * 60
          if (delayTimeUnit === 'hours') seconds = newValue * 3600
          setFormData({ ...formData, duration: seconds.toString() })
        }
        
        return (
          <div className="space-y-6">
            {/* Ícone grande no topo com fundo "nuvem" */}
            <div className="flex justify-center">
              <div className="p-6 rounded-full border-2 shadow-sm" style={{ backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }}>
                <Clock className="h-14 w-14" strokeWidth={2} style={{ color: '#06b6d4' }} />
              </div>
            </div>

            {/* Atalhos de Tempo (Quick Presets) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Atalhos Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '5s', seconds: 5 },
                  { label: '30s', seconds: 30 },
                  { label: '1min', seconds: 60 },
                  { label: '5min', seconds: 300 },
                  { label: '10min', seconds: 600 }
                ].map((preset) => {
                  const isSelected = totalSeconds === preset.seconds
                  return (
                    <button
                      key={preset.seconds}
                      type="button"
                      onClick={() => handlePresetClick(preset.seconds)}
                      className="px-4 py-2 rounded-xl border-2 transition-all text-sm font-medium"
                      style={{ 
                        borderRadius: '12px',
                        backgroundColor: isSelected ? '#06b6d4' : '#f8fafc',
                        color: isSelected ? 'white' : '#334155',
                        borderColor: isSelected ? '#06b6d4' : '#e2e8f0',
                        transform: 'translateY(0)',
                        boxShadow: isSelected 
                          ? '0 4px 12px rgba(6, 182, 212, 0.3)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.2)'
                          e.currentTarget.style.borderColor = '#06b6d4'
                          e.currentTarget.style.backgroundColor = '#ecfeff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.backgroundColor = '#f8fafc'
                        }
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Stepper com Seletor de Unidade */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-semibold">Duração</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const newValue = Math.max(0, currentValue - 1)
                    handleValueChange(newValue)
                  }}
                  className="p-2 rounded-lg border-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-400 transition-all"
                  style={{ borderRadius: '12px' }}
                >
                  <Minus className="h-4 w-4 text-cyan-600" />
                </button>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  value={currentValue}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    handleValueChange(value)
                  }}
                  className="text-center text-lg font-bold rounded-xl border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                  style={{ borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}
                />
                <Select
                  value={delayTimeUnit}
                  onValueChange={(value: 'seconds' | 'minutes' | 'hours') => {
                    setDelayTimeUnit(value)
                    // Recalcula o valor quando muda a unidade
                    const seconds = parseInt(formData.duration) || 0
                    if (value === 'minutes') {
                      setFormData({ ...formData, duration: Math.floor(seconds / 60).toString() })
                    } else if (value === 'hours') {
                      setFormData({ ...formData, duration: Math.floor(seconds / 3600).toString() })
                    } else {
                      setFormData({ ...formData, duration: seconds.toString() })
                    }
                  }}
                >
                  <SelectTrigger className="w-32 rounded-xl border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400" style={{ borderRadius: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = currentValue + 1
                    handleValueChange(newValue)
                  }}
                  className="p-2 rounded-lg border-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-400 transition-all"
                  style={{ borderRadius: '12px' }}
                >
                  <Plus className="h-4 w-4 text-cyan-600" />
                </button>
              </div>
            </div>

            {/* Conversor em Tempo Real com borda de identidade */}
            {totalSeconds > 0 && (
              <div 
                className="p-4 rounded-xl border-2 bg-cyan-50/50 border-cyan-200 relative overflow-hidden" 
                style={{ 
                  borderRadius: '12px',
                  borderLeftWidth: '4px',
                  borderLeftColor: '#06b6d4',
                  borderTopColor: 'rgba(6, 182, 212, 0.2)',
                  borderRightColor: 'rgba(6, 182, 212, 0.2)',
                  borderBottomColor: 'rgba(6, 182, 212, 0.2)'
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">🕒</span>
                  <div>
                    <div className="font-semibold text-sm text-cyan-900 mb-1">
                      Tempo Total
                    </div>
                    <div className="text-xs text-cyan-700">
                      {formatTotalTime(totalSeconds)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'comment':
        const commentLength = (formData.comment || '').length
        const maxCommentLength = 200
        return (
          <div className="space-y-4">
            {/* Ícone no topo */}
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-amber-50 border-2 border-amber-100 shadow-sm">
                <FileText className="h-12 w-12" strokeWidth={2.5} style={{ color: '#f59e0b' }} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-slate-700 font-semibold">Comentário</Label>
              <div className="relative">
                <Textarea
                  id="comment"
                  value={formData.comment || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= maxCommentLength) {
                      setFormData({ ...formData, comment: value })
                    }
                  }}
                  placeholder="Adicione uma nota explicativa sobre este ponto do fluxo..."
                  rows={6}
                  className="text-sm rounded-[2rem] border-slate-200 focus:border-amber-400 focus:ring-amber-400/50 focus:ring-2 transition-all resize-none"
                  style={{
                    padding: '1rem 1.25rem',
                  }}
                />
                <div className="absolute bottom-3 right-4 text-xs text-slate-400">
                  {commentLength}/{maxCommentLength}
                </div>
              </div>
            </div>
            
            {/* Banner de Informação */}
            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-sm text-blue-900 leading-relaxed">
                Este comentário não será executado, serve apenas para documentação e ajuda a explicar o fluxo.
              </p>
            </div>
          </div>
        )

      default:
        return <p className="text-sm text-muted-foreground">Este node não possui configurações editáveis.</p>
    }
  }

  const getTitle = () => {
    switch (node.type) {
      case 'agent': return 'Editar Agente IA'
      case 'loop': return 'Editar Loop'
      case 'if-else': return 'Editar Condicional'
      case 'delay': return 'Editar Aguardar'
      case 'comment': return 'Editar Comentário'
      default: return 'Editar Node'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] flex flex-col"
        style={{ 
          borderRadius: '16px', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Configure as propriedades deste node
          </DialogDescription>
        </DialogHeader>
        <div 
          style={{ 
            flex: '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            paddingRight: '8px',
            marginRight: '-8px'
          }}
        >
          <div className="py-4">
            {renderForm()}
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            className="rounded-xl text-white shadow-lg"
            style={{
              backgroundColor: node.type === 'agent'
                ? '#10b981'
                : node.type === 'if-else' 
                ? '#f97316' 
                : node.type === 'loop' 
                ? '#9333ea' 
                : node.type === 'delay'
                ? '#06b6d4'
                : node.type === 'comment'
                ? '#f59e0b'
                : '#2563eb',
              boxShadow: node.type === 'agent'
                ? '0 10px 25px -5px rgba(16, 185, 129, 0.3)'
                : node.type === 'if-else' 
                ? '0 10px 25px -5px rgba(249, 115, 22, 0.3)' 
                : node.type === 'loop'
                ? '0 10px 25px -5px rgba(147, 51, 234, 0.3)'
                : node.type === 'delay'
                ? '0 10px 25px -5px rgba(6, 182, 212, 0.3)'
                : node.type === 'comment'
                ? '0 10px 25px -5px rgba(245, 158, 11, 0.3)'
                : '0 10px 25px -5px rgba(37, 99, 235, 0.3)'
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
