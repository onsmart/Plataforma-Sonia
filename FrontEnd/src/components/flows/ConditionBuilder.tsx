import React from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Button } from '../ui/button'
import { Info, Copy, Phone, MessageSquare, Hash, User } from 'lucide-react'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip'

interface ConditionBuilderProps {
  formData: any
  setFormData: (data: any) => void
}

// Variáveis disponíveis no contexto
const AVAILABLE_VARIABLES = [
  { key: 'message', label: 'Mensagem do usuário', example: '{{message}}' },
  { key: 'user_name', label: 'Nome do usuário', example: '{{user_name}}' },
  { key: 'message_count', label: 'Quantidade de mensagens', example: '{{message_count}}' },
  { key: 'phone_number', label: 'Número de telefone', example: '{{phone_number}}' },
  { key: 'whatsapp_contact_id', label: 'ID do contato WhatsApp', example: '{{whatsapp_contact_id}}' },
]

// Operadores disponíveis
const OPERATORS = [
  { value: 'equals', label: 'É igual a', symbol: '==' },
  { value: 'not_equals', label: 'É diferente de', symbol: '!=' },
  { value: 'contains', label: 'Contém', symbol: 'contém' },
  { value: 'not_contains', label: 'Não contém', symbol: 'não contém' },
  { value: 'greater_than', label: 'É maior que', symbol: '>' },
  { value: 'less_than', label: 'É menor que', symbol: '<' },
  { value: 'greater_equal', label: 'É maior ou igual a', symbol: '>=' },
  { value: 'less_equal', label: 'É menor ou igual a', symbol: '<=' },
  { value: 'is_empty', label: 'Está vazio', symbol: 'vazio', noValue: true },
  { value: 'is_not_empty', label: 'Não está vazio', symbol: 'não vazio', noValue: true },
  { value: 'starts_with', label: 'Começa com', symbol: 'começa com' },
  { value: 'ends_with', label: 'Termina com', symbol: 'termina com' },
]

// Templates de condições comuns
const CONDITION_TEMPLATES = [
  {
    id: 'message_contains',
    name: 'Mensagem contém palavra',
    condition: "{{message}} contém 'ajuda'",
    description: 'Verifica se a mensagem contém uma palavra específica',
    icon: MessageSquare,
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'message_length',
    name: 'Mensagem tem mais de X caracteres',
    condition: "{{message}} > 50",
    description: 'Verifica o tamanho da mensagem',
    icon: Hash,
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  },
  {
    id: 'has_phone',
    name: 'Usuário forneceu telefone',
    condition: "{{phone_number}} não está vazio",
    description: 'Verifica se o telefone foi fornecido',
    icon: Phone,
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
  },
  {
    id: 'is_first_message',
    name: 'É primeira mensagem',
    condition: "{{message_count}} == 1",
    description: 'Verifica se é a primeira mensagem do usuário',
    icon: User,
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
  },
]

export function ConditionBuilder({ formData, setFormData }: ConditionBuilderProps) {
  // Gera a condição baseada nos campos do formulário
  const generateCondition = () => {
    const field = formData.conditionField
    const operator = formData.conditionOperator
    const value = formData.conditionValue

    if (!field || !operator) return ''

    const fieldVar = AVAILABLE_VARIABLES.find(v => v.key === field)?.example || `{{${field}}}`
    const operatorData = OPERATORS.find(op => op.value === operator)

    if (!operatorData) return ''

    // Operadores que não precisam de valor
    if (operatorData.noValue) {
      if (operator === 'is_empty') {
        return `${fieldVar} está vazio`
      }
      if (operator === 'is_not_empty') {
        return `${fieldVar} não está vazio`
      }
    }

    // Operadores que precisam de valor
    if (!value) return ''

    switch (operator) {
      case 'equals':
        return `${fieldVar} == '${value}'`
      case 'not_equals':
        return `${fieldVar} != '${value}'`
      case 'contains':
        return `${fieldVar} contém '${value}'`
      case 'not_contains':
        return `${fieldVar} não contém '${value}'`
      case 'greater_than':
        return `${fieldVar} > ${value}`
      case 'less_than':
        return `${fieldVar} < ${value}`
      case 'greater_equal':
        return `${fieldVar} >= ${value}`
      case 'less_equal':
        return `${fieldVar} <= ${value}`
      case 'starts_with':
        return `${fieldVar} começa com '${value}'`
      case 'ends_with':
        return `${fieldVar} termina com '${value}'`
      default:
        return ''
    }
  }

  // Atualiza a condição quando os campos mudam
  React.useEffect(() => {
    const generated = generateCondition()
    if (generated && formData.conditionField && formData.conditionOperator) {
      // Só atualiza se a condição gerada for diferente da atual
      // Isso evita loops infinitos quando o usuário edita manualmente no modo avançado
      if (generated !== formData.condition) {
        setFormData((prev: any) => ({ ...prev, condition: generated }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.conditionField, formData.conditionOperator, formData.conditionValue])

  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(formData.conditionTemplate || null)

  React.useEffect(() => {
    // Atualiza o template selecionado quando o formData muda
    if (formData.conditionTemplate) {
      setSelectedTemplate(formData.conditionTemplate)
    }
  }, [formData.conditionTemplate])

  const handleTemplateSelect = (templateId: string) => {
    const template = CONDITION_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      
      // Preenche os campos baseado no template
      let newFormData: any = {
        ...formData,
        condition: template.condition,
        conditionTemplate: templateId
      }

      // Extrai campo, operador e valor do template
      switch (templateId) {
        case 'message_contains':
          newFormData.conditionField = 'message'
          newFormData.conditionOperator = 'contains'
          newFormData.conditionValue = 'ajuda'
          break
        case 'message_length':
          newFormData.conditionField = 'message'
          newFormData.conditionOperator = 'greater_than'
          newFormData.conditionValue = '50'
          break
        case 'has_phone':
          newFormData.conditionField = 'phone_number'
          newFormData.conditionOperator = 'is_not_empty'
          newFormData.conditionValue = ''
          break
        case 'is_first_message':
          newFormData.conditionField = 'message_count'
          newFormData.conditionOperator = 'equals'
          newFormData.conditionValue = '1'
          break
      }

      setFormData(newFormData)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-4">
      {/* Templates rápidos */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Templates Rápidos</Label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Clique em um template para usar uma condição pré-configurada</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CONDITION_TEMPLATES.map((template) => {
            const Icon = template.icon
            const isSelected = selectedTemplate === template.id
            return (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={`h-auto py-3 px-4 text-left rounded-xl border-2 transition-all ${template.color} ${isSelected ? 'ring-2 ring-orange-400 shadow-lg' : 'shadow-sm hover:shadow-md'}`}
                style={{
                  borderRadius: '12px',
                  transform: isSelected ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                  transition: 'all 0.2s ease-in-out',
                  borderWidth: isSelected ? '3px' : '2px',
                  borderColor: isSelected ? '#f97316' : undefined,
                  boxShadow: isSelected 
                    ? '0 10px 25px -5px rgba(249, 115, 22, 0.3), 0 0 15px rgba(249, 115, 22, 0.2)' 
                    : undefined,
                  zIndex: isSelected ? 10 : 1,
                  position: 'relative'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/50">
                    <Icon className="h-4 w-4 text-orange-600" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">{template.name}</div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {template.description}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="conditionField">Verificar</Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Selecione qual informação você quer verificar</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={formData.conditionField || ''}
            onValueChange={(value) => setFormData({ ...formData, conditionField: value })}
          >
            <SelectTrigger 
              id="conditionField"
              className="rounded-xl border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              style={{ borderRadius: '12px' }}
            >
              <SelectValue placeholder="Selecione o que verificar" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_VARIABLES.map((variable) => (
                <SelectItem key={variable.key} value={variable.key}>
                  <div className="flex items-center justify-between w-full">
                    <span>{variable.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 ml-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(variable.example)
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="conditionOperator">Operador</Label>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Selecione como você quer comparar o valor</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={formData.conditionOperator || ''}
            onValueChange={(value) => setFormData({ ...formData, conditionOperator: value })}
          >
            <SelectTrigger 
              id="conditionOperator"
              className="rounded-xl border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              style={{ borderRadius: '12px' }}
            >
              <SelectValue placeholder="Selecione a comparação" />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((operator) => (
                <SelectItem key={operator.value} value={operator.value}>
                  {operator.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.conditionOperator && 
         !OPERATORS.find(op => op.value === formData.conditionOperator)?.noValue && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="conditionValue">Valor para Comparar</Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Digite o valor que você quer comparar</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="conditionValue"
              value={formData.conditionValue || ''}
              onChange={(e) => setFormData({ ...formData, conditionValue: e.target.value })}
              placeholder="Digite o valor"
              className="rounded-xl border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              style={{ borderRadius: '12px' }}
            />
            <p className="text-xs text-muted-foreground">
              Para texto, use aspas simples. Para números, digite apenas o número.
            </p>
          </div>
        )}

        {/* Preview da condição */}
        {formData.condition && (
          <div 
            className="p-4 rounded-xl border-2"
            style={{
              backgroundColor: '#0f172a',
              borderColor: '#1e293b',
              borderRadius: '12px'
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 mb-2">
                  Condição gerada:
                </p>
                <div className="font-mono text-sm break-all" style={{ color: '#e2e8f0' }}>
                  {formData.condition.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
                    if (part.match(/\{\{[^}]+\}\}/)) {
                      return (
                        <span key={i} style={{ color: '#fbbf24' }}>
                          {part}
                        </span>
                      )
                    }
                    return <span key={i}>{part}</span>
                  })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-700"
                onClick={() => {
                  copyToClipboard(formData.condition)
                  toast.success('Condição copiada!')
                }}
                title="Copiar condição"
                style={{ color: '#94a3b8' }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Lista de variáveis disponíveis */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700">Variáveis Disponíveis</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map((variable) => (
              <Badge
                key={variable.key}
                variant="outline"
                className="cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-all rounded-lg px-3 py-1.5"
                onClick={() => {
                  copyToClipboard(variable.example)
                  toast.success(`${variable.example} copiado!`)
                }}
                style={{
                  borderRadius: '8px',
                  borderColor: '#f97316',
                  color: '#f97316'
                }}
              >
                <code className="font-mono text-xs">{variable.example}</code>
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
