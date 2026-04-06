import React from 'react'
import { Bot, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface ConditionBuilderProps {
  formData: any
  setFormData: (data: any) => void
}

type VariableKind = 'text' | 'number' | 'presence'

type AvailableVariable = {
  key: string
  label: string
  description: string
  example: string
  kind: VariableKind
  suggestedValue?: string
  defaultOperator: string
  operators: string[]
}

type OperatorOption = {
  value: string
  label: string
  noValue?: boolean
}

type QuickRule = {
  id: string
  title: string
  subtitle: string
  icon: React.ElementType
  field: string
  operator: string
  value?: string
}

const AVAILABLE_VARIABLES: AvailableVariable[] = [
  {
    key: 'intent',
    label: 'Resultado do classificador',
    description: 'Usa a categoria identificada pelo bloco anterior, como agendamento ou suporte.',
    example: '{{intent}}',
    kind: 'text',
    suggestedValue: 'agendamento',
    defaultOperator: 'contains',
    operators: ['contains', 'equals', 'not_equals']
  },
  {
    key: 'message',
    label: 'Mensagem do usuario',
    description: 'Analisa o texto que o cliente enviou.',
    example: '{{message}}',
    kind: 'text',
    suggestedValue: 'ajuda',
    defaultOperator: 'contains',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty']
  },
  {
    key: 'message_count',
    label: 'Quantidade de mensagens',
    description: 'Conta quantas mensagens ja existem na conversa.',
    example: '{{message_count}}',
    kind: 'number',
    suggestedValue: '1',
    defaultOperator: 'greater_than',
    operators: ['equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal']
  },
  {
    key: 'phone_number',
    label: 'Telefone informado',
    description: 'Verifica se o numero do cliente esta preenchido.',
    example: '{{phone_number}}',
    kind: 'presence',
    defaultOperator: 'is_not_empty',
    operators: ['is_not_empty', 'is_empty', 'equals']
  },
  {
    key: 'user_name',
    label: 'Nome do usuario',
    description: 'Usa o nome do contato, quando ele existir.',
    example: '{{user_name}}',
    kind: 'text',
    suggestedValue: 'Carlos',
    defaultOperator: 'contains',
    operators: ['contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty']
  },
]

const OPERATORS: OperatorOption[] = [
  { value: 'contains', label: 'Contem' },
  { value: 'not_contains', label: 'Nao contem' },
  { value: 'equals', label: 'E igual a' },
  { value: 'not_equals', label: 'E diferente de' },
  { value: 'greater_than', label: 'E maior que' },
  { value: 'less_than', label: 'E menor que' },
  { value: 'greater_equal', label: 'E maior ou igual a' },
  { value: 'less_equal', label: 'E menor ou igual a' },
  { value: 'is_empty', label: 'Nao foi informado', noValue: true },
  { value: 'is_not_empty', label: 'Foi informado', noValue: true },
]

const QUICK_RULES: QuickRule[] = [
  {
    id: 'classifier_agendamento',
    title: 'Ir para agendamento',
    subtitle: 'Quando o classificador identificar agendamento',
    icon: Bot,
    field: 'intent',
    operator: 'contains',
    value: 'agendamento'
  },
  {
    id: 'classifier_suporte',
    title: 'Ir para suporte',
    subtitle: 'Quando o classificador identificar suporte',
    icon: Bot,
    field: 'intent',
    operator: 'contains',
    value: 'suporte'
  },
  {
    id: 'has_phone',
    title: 'Telefone preenchido',
    subtitle: 'Quando o cliente ja informou telefone',
    icon: Phone,
    field: 'phone_number',
    operator: 'is_not_empty'
  },
  {
    id: 'message_contains',
    title: 'Mensagem contem palavra',
    subtitle: 'Quando a mensagem tiver uma palavra especifica',
    icon: MessageSquare,
    field: 'message',
    operator: 'contains',
    value: 'ajuda'
  },
]

const getVariable = (field?: string) =>
  AVAILABLE_VARIABLES.find((variable) => variable.key === field)

const getOperator = (operator?: string) =>
  OPERATORS.find((item) => item.value === operator)

const getOperatorsForField = (field?: string) => {
  const variable = getVariable(field)
  if (!variable) return OPERATORS
  return OPERATORS.filter((operator) => variable.operators.includes(operator.value))
}

const formatValue = (value: string, kind: VariableKind) => {
  if (kind === 'number') {
    return value
  }

  return `'${value}'`
}

const buildCondition = (field?: string, operator?: string, value?: string) => {
  if (!field || !operator) return ''

  const variable = getVariable(field)
  const operatorData = getOperator(operator)
  const fieldToken = variable?.example || `{{${field}}}`

  if (!variable || !operatorData) return ''

  if (operatorData.noValue) {
    if (operator === 'is_empty') return `${fieldToken} esta vazio`
    if (operator === 'is_not_empty') return `${fieldToken} nao esta vazio`
  }

  if (!value?.trim()) return ''

  const formattedValue = formatValue(value.trim(), variable.kind)

  switch (operator) {
    case 'contains':
      return `${fieldToken} contem ${formattedValue}`
    case 'not_contains':
      return `${fieldToken} nao contem ${formattedValue}`
    case 'equals':
      return `${fieldToken} == ${formattedValue}`
    case 'not_equals':
      return `${fieldToken} != ${formattedValue}`
    case 'greater_than':
      return `${fieldToken} > ${formattedValue}`
    case 'less_than':
      return `${fieldToken} < ${formattedValue}`
    case 'greater_equal':
      return `${fieldToken} >= ${formattedValue}`
    case 'less_equal':
      return `${fieldToken} <= ${formattedValue}`
    default:
      return ''
  }
}

const buildFriendlySentence = (field?: string, operator?: string, value?: string) => {
  const variable = getVariable(field)
  const operatorData = getOperator(operator)

  if (!variable || !operatorData) {
    return 'Escolha uma regra para decidir quando o fluxo deve seguir pelo caminho IF.'
  }

  if (operatorData.noValue) {
    return `Se ${variable.label.toLowerCase()} ${operatorData.label.toLowerCase()}, siga pelo caminho IF.`
  }

  if (!value?.trim()) {
    return `Escolha o valor esperado para ${variable.label.toLowerCase()}.`
  }

  return `Se ${variable.label.toLowerCase()} ${operatorData.label.toLowerCase()} "${value.trim()}", siga pelo caminho IF.`
}

export function ConditionBuilder({ formData, setFormData }: ConditionBuilderProps) {
  const selectedVariable = getVariable(formData.conditionField)
  const availableOperators = getOperatorsForField(formData.conditionField)
  const selectedOperator = getOperator(formData.conditionOperator)
  const generatedCondition = buildCondition(
    formData.conditionField,
    formData.conditionOperator,
    formData.conditionValue
  )
  const selectedQuickRule = QUICK_RULES.find((rule) => rule.id === formData.conditionTemplate)

  React.useEffect(() => {
    if (generatedCondition !== (formData.condition || '')) {
      setFormData({
        ...formData,
        condition: generatedCondition,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedCondition])

  const applyRule = (rule: QuickRule) => {
    setFormData({
      ...formData,
      conditionField: rule.field,
      conditionOperator: rule.operator,
      conditionValue: rule.value || '',
      conditionTemplate: rule.id,
      condition: buildCondition(rule.field, rule.operator, rule.value || ''),
    })
  }

  const handleFieldChange = (field: string) => {
    const variable = getVariable(field)
    if (!variable) return

    const firstOperator = getOperatorsForField(field)[0]
    const nextOperator = variable.operators.includes(formData.conditionOperator)
      ? formData.conditionOperator
      : variable.defaultOperator || firstOperator?.value || ''
    const nextOperatorData = getOperator(nextOperator)
    const nextValue = nextOperatorData?.noValue
      ? ''
      : formData.conditionField === field && formData.conditionValue
      ? formData.conditionValue
      : variable.suggestedValue || ''

    setFormData({
      ...formData,
      conditionField: field,
      conditionOperator: nextOperator,
      conditionValue: nextValue,
      conditionTemplate: undefined,
      condition: buildCondition(field, nextOperator, nextValue),
    })
  }

  const handleOperatorChange = (operator: string) => {
    const operatorData = getOperator(operator)
    const nextValue = operatorData?.noValue
      ? ''
      : formData.conditionValue || selectedVariable?.suggestedValue || ''

    setFormData({
      ...formData,
      conditionOperator: operator,
      conditionValue: nextValue,
      conditionTemplate: undefined,
      condition: buildCondition(formData.conditionField, operator, nextValue),
    })
  }

  const handleValueChange = (value: string) => {
    setFormData({
      ...formData,
      conditionValue: value,
      conditionTemplate: undefined,
      condition: buildCondition(formData.conditionField, formData.conditionOperator, value),
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-orange-700">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Configuracao recomendada</span>
            </div>
            <p className="text-sm text-slate-700">
              Para o seu teste com classificador, use <strong>Resultado do classificador</strong> + <strong>Contem</strong> + <strong>agendamento</strong>.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl border-orange-300 bg-white hover:bg-orange-100"
            onClick={() => applyRule(QUICK_RULES[0])}
          >
            Usar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Atalhos prontos</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_RULES.map((rule) => {
            const Icon = rule.icon
            const isSelected = selectedQuickRule?.id === rule.id

            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => applyRule(rule)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${isSelected ? 'bg-orange-100' : 'bg-slate-100'}`}>
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-orange-600' : 'text-slate-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
                    <div className="text-xs text-slate-500">{rule.subtitle}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conditionField" className="text-sm font-semibold">
              1. O que voce quer verificar?
            </Label>
            <Select value={formData.conditionField || ''} onValueChange={handleFieldChange}>
              <SelectTrigger id="conditionField" className="rounded-xl">
                <SelectValue placeholder="Escolha a informacao que decide o caminho" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_VARIABLES.map((variable) => (
                  <SelectItem key={variable.key} value={variable.key}>
                    {variable.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVariable && (
              <p className="text-xs text-slate-500">{selectedVariable.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="conditionOperator" className="text-sm font-semibold">
                2. Como comparar?
              </Label>
              <Select
                value={formData.conditionOperator || ''}
                onValueChange={handleOperatorChange}
                disabled={!formData.conditionField}
              >
                <SelectTrigger id="conditionOperator" className="rounded-xl">
                  <SelectValue placeholder="Escolha a comparacao" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((operator) => (
                    <SelectItem key={operator.value} value={operator.value}>
                      {operator.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedOperator?.noValue && (
              <div className="space-y-2">
                <Label htmlFor="conditionValue" className="text-sm font-semibold">
                  3. Qual valor voce espera?
                </Label>
                <Input
                  id="conditionValue"
                  value={formData.conditionValue || ''}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={selectedVariable?.suggestedValue ? `Ex: ${selectedVariable.suggestedValue}` : 'Digite o valor'}
                  disabled={!formData.conditionField || !formData.conditionOperator}
                  className="rounded-xl"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resumo da regra
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {buildFriendlySentence(
                formData.conditionField,
                formData.conditionOperator,
                formData.conditionValue
              )}
            </p>
            {generatedCondition && (
              <p className="mt-2 font-mono text-xs text-slate-500">
                Expressao: {generatedCondition}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
