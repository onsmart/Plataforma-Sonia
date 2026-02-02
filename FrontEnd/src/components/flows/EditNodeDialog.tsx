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

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
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
  availableFlows?: AvailableFlow[]
}

export function EditNodeDialog({ isOpen, onClose, node, onSave, availableAgents = [], availableFlows = [] }: EditNodeDialogProps) {
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (node) {
      setFormData(node.data || {})
    }
  }, [node])

  if (!node) {
    return null
  }

  const handleSave = () => {
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
      case 'loop':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flow">Fluxo para Executar em Loop</Label>
              <Select
                value={formData.flowId || ''}
                onValueChange={(value) => {
                  const selectedFlow = availableFlows.find(f => f.id === value)
                  setFormData({ 
                    ...formData, 
                    flowId: value,
                    flowName: selectedFlow?.name || ''
                  })
                }}
              >
                <SelectTrigger id="flow">
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {availableFlows.length === 0 ? (
                    <SelectItem value="" disabled>
                      Nenhum fluxo disponível
                    </SelectItem>
                  ) : (
                    availableFlows.map((flow) => (
                      <SelectItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formData.flowId && (
                <p className="text-xs text-muted-foreground">
                  Fluxo selecionado: {availableFlows.find(f => f.id === formData.flowId)?.name || 'Desconhecido'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="iterations">Número de Iterações</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.infinite || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Quando marca infinito, define iterations como '∞'
                      setFormData({ ...formData, infinite: true, iterations: '∞' })
                    } else {
                      // Quando desmarca infinito, restaura um valor padrão se estiver vazio ou '∞'
                      const currentValue = formData.iterations
                      // Se o valor atual é '∞' ou vazio, usa '10' como padrão
                      if (!currentValue || currentValue === '∞' || currentValue.toString().trim() === '') {
                        setFormData({ ...formData, infinite: false, iterations: '10' })
                      } else {
                        // Mantém o valor atual se for válido
                        setFormData({ ...formData, infinite: false, iterations: currentValue })
                      }
                    }
                  }}
                />
                <Label htmlFor="infinite" className="cursor-pointer">Infinito</Label>
              </div>
              {!formData.infinite && (
                <Input
                  id="iterations"
                  type="number"
                  min="1"
                  value={formData.iterations === '∞' ? '' : (formData.iterations || '')}
                  onChange={(e) => setFormData({ ...formData, iterations: e.target.value })}
                  placeholder="Ex: 10"
                />
              )}
              {formData.infinite && (
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-xs text-purple-800 dark:text-purple-200">
                  Loop infinito ativado
                </div>
              )}
            </div>
          </div>
        )

      case 'if-else':
        return (
          <div className="space-y-4">
            <Tabs defaultValue="simple" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple">Modo Simples</TabsTrigger>
                <TabsTrigger value="advanced">Modo Avançado</TabsTrigger>
              </TabsList>
              
              <TabsContent value="simple" className="space-y-4 mt-4">
                <ConditionBuilder 
                  formData={formData}
                  setFormData={setFormData}
                />
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="condition">Condição (Modo Avançado)</Label>
                  <Textarea
                    id="condition"
                    value={formData.condition || ''}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="Ex: {{message}} contém 'ajuda' ou {{message_count}} > 5"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Use variáveis entre chaves duplas: {"{{variavel}}"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Operadores suportados: ==, !=, {'>'}, {'<'}, {'>='}, {'<='}, contém, não contém, começa com, termina com
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Exemplos: {"{{message}} contém 'ajuda'"} | {"{{message_count}} > 10"} | {"{{phone_number}} não está vazio"}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )

      case 'delay':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (em segundos)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration || ''}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="Ex: 10"
              />
            </div>
          </div>
        )

      case 'code':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Textarea
                id="code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="// Seu código aqui"
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>
        )

      default:
        return <p className="text-sm text-muted-foreground">Este node não possui configurações editáveis.</p>
    }
  }

  const getTitle = () => {
    switch (node.type) {
      case 'loop': return 'Editar Loop'
      case 'if-else': return 'Editar Condicional'
      case 'delay': return 'Editar Aguardar'
      case 'code': return 'Editar Código'
      default: return 'Editar Node'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Configure as propriedades deste node
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {renderForm()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
