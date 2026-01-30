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
import { Info, Copy } from 'lucide-react'
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
    description: 'Verifica se a mensagem contém uma palavra específica'
  },
  {
    id: 'message_length',
    name: 'Mensagem tem mais de X caracteres',
    condition: "{{message}} > 50",
    description: 'Verifica o tamanho da mensagem'
  },
  {
    id: 'has_phone',
    name: 'Usuário forneceu telefone',
    condition: "{{phone_number}} não está vazio",
    description: 'Verifica se o telefone foi fornecido'
  },
  {
    id: 'is_first_message',
    name: 'É primeira mensagem',
    condition: "{{message_count}} == 1",
    description: 'Verifica se é a primeira mensagem do usuário'
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

  const handleTemplateSelect = (templateId: string) => {
    const template = CONDITION_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setFormData({ 
        ...formData, 
        condition: template.condition,
        conditionTemplate: templateId 
      })
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
        <div className="grid grid-cols-2 gap-2">
          {CONDITION_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 text-left justify-start"
              onClick={() => handleTemplateSelect(template.id)}
            >
              <div className="flex-1">
                <div className="text-xs font-medium">{template.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {template.description}
                </div>
              </div>
            </Button>
          ))}
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
            <SelectTrigger id="conditionField">
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
            <SelectTrigger id="conditionOperator">
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
            />
            <p className="text-xs text-muted-foreground">
              Para texto, use aspas simples. Para números, digite apenas o número.
            </p>
          </div>
        )}

        {/* Preview da condição */}
        {formData.condition && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  Condição gerada:
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-mono break-all">
                  {formData.condition}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(formData.condition)}
                title="Copiar condição"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Lista de variáveis disponíveis */}
        <div className="space-y-2">
          <Label className="text-xs">Variáveis Disponíveis</Label>
          <div className="p-2 bg-muted rounded text-xs space-y-1">
            {AVAILABLE_VARIABLES.map((variable) => (
              <div key={variable.key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{variable.label}:</span>
                <code className="text-primary font-mono">{variable.example}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
