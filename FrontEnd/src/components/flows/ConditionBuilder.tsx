import React from 'react'
import {
  ChevronRight,
  Hash,
  MessageSquare,
  Phone,
  Sparkles,
  User,
} from 'lucide-react'
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
  shortLabel: string
  description: string
  example: string
  kind: VariableKind
  icon: React.ElementType
  suggestedValue?: string
  defaultOperator: string
  operators: string[]
}

type OperatorOption = {
  value: string
  label: string
  shortLabel: string
  description: string
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
    label: 'Categoria ou etapa atual',
    shortLabel: 'Categoria',
    description: 'Usa um valor de contexto salvo anteriormente no fluxo, como suporte, vendas ou financeiro.',
    example: '{{intent}}',
    kind: 'text',
    icon: Sparkles,
    suggestedValue: 'suporte',
    defaultOperator: 'contains',
    operators: ['contains', 'equals', 'not_equals', 'starts_with', 'ends_with']
  },
  {
    key: 'message',
    label: 'Mensagem do cliente',
    shortLabel: 'Mensagem',
    description: 'Analisa o texto que o cliente enviou para decidir o caminho.',
    example: '{{message}}',
    kind: 'text',
    icon: MessageSquare,
    suggestedValue: 'agendar',
    defaultOperator: 'contains',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
  },
  {
    key: 'message_count',
    label: 'Quantidade de mensagens',
    shortLabel: 'Quantidade',
    description: 'Conta quantas mensagens ja existem nesta conversa.',
    example: '{{message_count}}',
    kind: 'number',
    icon: Hash,
    suggestedValue: '1',
    defaultOperator: 'equals',
    operators: ['equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal']
  },
  {
    key: 'phone_number',
    label: 'Telefone informado',
    shortLabel: 'Telefone',
    description: 'Verifica se o numero do cliente ja foi identificado.',
    example: '{{phone_number}}',
    kind: 'presence',
    icon: Phone,
    defaultOperator: 'is_not_empty',
    operators: ['is_not_empty', 'is_empty', 'equals']
  },
  {
    key: 'user_name',
    label: 'Nome do cliente',
    shortLabel: 'Nome',
    description: 'Usa o nome do contato quando ele estiver disponivel.',
    example: '{{user_name}}',
    kind: 'text',
    icon: User,
    suggestedValue: 'Carlos',
    defaultOperator: 'contains',
    operators: ['contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
  },
]

const OPERATORS: OperatorOption[] = [
  {
    value: 'contains',
    label: 'Contem',
    shortLabel: 'Contem',
    description: 'Usa quando o texto precisa ter uma palavra ou trecho.'
  },
  {
    value: 'not_contains',
    label: 'Nao contem',
    shortLabel: 'Nao contem',
    description: 'Usa quando o texto nao pode ter uma palavra ou trecho.'
  },
  {
    value: 'equals',
    label: 'E igual a',
    shortLabel: 'Igual a',
    description: 'Usa quando o valor precisa ser exatamente igual.'
  },
  {
    value: 'not_equals',
    label: 'E diferente de',
    shortLabel: 'Diferente de',
    description: 'Usa quando o valor nao pode ser igual.'
  },
  {
    value: 'greater_than',
    label: 'E maior que',
    shortLabel: 'Maior que',
    description: 'Usa para numeros acima de um valor.'
  },
  {
    value: 'less_than',
    label: 'E menor que',
    shortLabel: 'Menor que',
    description: 'Usa para numeros abaixo de um valor.'
  },
  {
    value: 'greater_equal',
    label: 'E maior ou igual a',
    shortLabel: 'Maior ou igual',
    description: 'Usa para numeros maiores ou no limite informado.'
  },
  {
    value: 'less_equal',
    label: 'E menor ou igual a',
    shortLabel: 'Menor ou igual',
    description: 'Usa para numeros menores ou no limite informado.'
  },
  {
    value: 'starts_with',
    label: 'Comeca com',
    shortLabel: 'Comeca com',
    description: 'Usa quando o texto precisa iniciar com um valor especifico.'
  },
  {
    value: 'ends_with',
    label: 'Termina com',
    shortLabel: 'Termina com',
    description: 'Usa quando o texto precisa terminar com um valor especifico.'
  },
  {
    value: 'is_empty',
    label: 'Nao foi informado',
    shortLabel: 'Nao informado',
    description: 'Usa quando voce quer saber se a informacao esta vazia.',
    noValue: true
  },
  {
    value: 'is_not_empty',
    label: 'Foi informado',
    shortLabel: 'Foi informado',
    description: 'Usa quando voce quer confirmar que a informacao existe.',
    noValue: true
  },
]

const QUICK_RULES: QuickRule[] = [
  {
    id: 'first_message',
    title: 'Primeiro contato',
    subtitle: 'Quando esta for a primeira mensagem da conversa',
    icon: Hash,
    field: 'message_count',
    operator: 'equals',
    value: '1'
  },
  {
    id: 'message_has_keyword',
    title: 'Palavra na mensagem',
    subtitle: 'Quando a mensagem tiver uma palavra ou assunto especifico',
    icon: MessageSquare,
    field: 'message',
    operator: 'contains',
    value: 'suporte'
  },
  {
    id: 'name_known',
    title: 'Nome ja identificado',
    subtitle: 'Quando o fluxo ja souber o nome do cliente',
    icon: User,
    field: 'user_name',
    operator: 'is_not_empty'
  },
  {
    id: 'has_phone',
    title: 'Telefone ja informado',
    subtitle: 'Quando o numero do cliente ja estiver preenchido',
    icon: Phone,
    field: 'phone_number',
    operator: 'is_not_empty'
  },
]

const VALUE_SUGGESTIONS: Record<string, string[]> = {
  intent: ['suporte', 'vendas', 'financeiro', 'prioridade_alta'],
  message: ['suporte', 'comprar', 'cancelar', 'humano', 'urgente'],
  message_count: ['1', '2', '3', '5'],
  user_name: ['Carlos', 'Maria', 'Joao'],
}

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
    case 'starts_with':
      return `${fieldToken} comeca com ${formattedValue}`
    case 'ends_with':
      return `${fieldToken} termina com ${formattedValue}`
    default:
      return ''
  }
}

const parseQuotedValue = (value: string) =>
  value.replace(/^'/, '').replace(/'$/, '').trim()

const parseCondition = (condition?: string) => {
  const normalized = String(condition || '').trim()
  if (!normalized) return null

  const emptyMatch = normalized.match(/^\{\{(\w+)\}\}\s+(esta vazio|nao esta vazio)$/i)
  if (emptyMatch) {
    return {
      field: emptyMatch[1],
      operator: emptyMatch[2].toLowerCase() === 'esta vazio' ? 'is_empty' : 'is_not_empty',
      value: ''
    }
  }

  const operatorMatchers: Array<{ regex: RegExp; operator: string }> = [
    { regex: /^\{\{(\w+)\}\}\s+contem\s+(.+)$/i, operator: 'contains' },
    { regex: /^\{\{(\w+)\}\}\s+nao contem\s+(.+)$/i, operator: 'not_contains' },
    { regex: /^\{\{(\w+)\}\}\s*==\s*(.+)$/i, operator: 'equals' },
    { regex: /^\{\{(\w+)\}\}\s*!=\s*(.+)$/i, operator: 'not_equals' },
    { regex: /^\{\{(\w+)\}\}\s*>=\s*(.+)$/i, operator: 'greater_equal' },
    { regex: /^\{\{(\w+)\}\}\s*<=\s*(.+)$/i, operator: 'less_equal' },
    { regex: /^\{\{(\w+)\}\}\s+comeca com\s+(.+)$/i, operator: 'starts_with' },
    { regex: /^\{\{(\w+)\}\}\s+termina com\s+(.+)$/i, operator: 'ends_with' },
    { regex: /^\{\{(\w+)\}\}\s*>\s*(.+)$/i, operator: 'greater_than' },
    { regex: /^\{\{(\w+)\}\}\s*<\s*(.+)$/i, operator: 'less_than' },
  ]

  for (const matcher of operatorMatchers) {
    const match = normalized.match(matcher.regex)
    if (!match) continue

    return {
      field: match[1],
      operator: matcher.operator,
      value: parseQuotedValue(match[2])
    }
  }

  return null
}

const buildFriendlySentence = (field?: string, operator?: string, value?: string) => {
  const variable = getVariable(field)
  const operatorData = getOperator(operator)

  if (!variable || !operatorData) {
    return 'Escolha a regra que decide quando este fluxo segue pelo caminho SIM.'
  }

  if (operatorData.noValue) {
    return `Se ${variable.label.toLowerCase()} ${operatorData.label.toLowerCase()}, o fluxo segue pelo caminho SIM.`
  }

  if (!value?.trim()) {
    return `Escolha o valor esperado para ${variable.label.toLowerCase()}.`
  }

  return `Se ${variable.label.toLowerCase()} ${operatorData.label.toLowerCase()} "${value.trim()}", o fluxo segue pelo caminho SIM.`
}

export function ConditionBuilder({ formData, setFormData }: ConditionBuilderProps) {
  const selectedVariable = getVariable(formData.conditionField)
  const availableOperators = getOperatorsForField(formData.conditionField)
  const selectedOperator = getOperator(formData.conditionOperator)
  const selectedValueSuggestions = VALUE_SUGGESTIONS[formData.conditionField || ''] || []
  const generatedCondition = buildCondition(
    formData.conditionField,
    formData.conditionOperator,
    formData.conditionValue
  )
  const selectedQuickRule = QUICK_RULES.find((rule) => rule.id === formData.conditionTemplate)

  React.useEffect(() => {
    if (!formData.conditionField && formData.condition) {
      const parsed = parseCondition(formData.condition)
      if (parsed && getVariable(parsed.field) && getOperator(parsed.operator)) {
        setFormData({
          ...formData,
          conditionField: parsed.field,
          conditionOperator: parsed.operator,
          conditionValue: parsed.value,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.condition, formData.conditionField])

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
    <div className="space-y-5">
      <div className="rounded-3xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-background to-background p-4 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:via-background dark:to-background">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Como esta decisao funciona</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Escolha a informacao que o bloco deve observar, diga como ela deve ser comparada e informe o valor esperado.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground/90">
              Se a regra for verdadeira, o fluxo segue pelo caminho <span className="font-semibold text-foreground">SIM</span>. Caso contrario, segue pelo caminho <span className="font-semibold text-foreground">NAO</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold text-foreground">Regras prontas</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Use um atalho quando quiser montar uma condicao comum com um clique.
            </p>
          </div>
          {selectedQuickRule && (
            <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300">
              Atalho aplicado
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {QUICK_RULES.map((rule) => {
            const Icon = rule.icon
            const isSelected = selectedQuickRule?.id === rule.id

            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => applyRule(rule)}
                className={[
                  'group rounded-2xl border p-4 text-left transition-all',
                  'hover:-translate-y-0.5 hover:shadow-lg',
                  isSelected
                    ? 'border-orange-300 bg-orange-50 shadow-[0_18px_40px_-28px_rgba(249,115,22,0.38)] dark:border-orange-400/30 dark:bg-orange-500/10'
                    : 'border-border/70 bg-card/80 hover:border-orange-200 dark:hover:border-orange-400/20'
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className={[
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
                    isSelected
                      ? 'bg-orange-500/12 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300'
                      : 'bg-muted text-muted-foreground group-hover:bg-orange-500/10 group-hover:text-orange-600 dark:group-hover:text-orange-300'
                  ].join(' ')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.subtitle}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm dark:bg-card/60">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="conditionField" className="text-sm font-semibold text-foreground">
              1. O que o bloco deve observar?
            </Label>
            <Select value={formData.conditionField || ''} onValueChange={handleFieldChange}>
              <SelectTrigger id="conditionField" className="h-12 rounded-2xl border-border/70 bg-background/80">
                <SelectValue placeholder="Escolha a informacao que decide o caminho" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_VARIABLES.map((variable) => {
                  const Icon = variable.icon
                  return (
                    <SelectItem key={variable.key} value={variable.key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{variable.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {selectedVariable && (
              <div className="rounded-2xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {selectedVariable.description}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-2">
              <Label htmlFor="conditionOperator" className="text-sm font-semibold text-foreground">
                2. Como o sistema deve comparar?
              </Label>
              <Select
                value={formData.conditionOperator || ''}
                onValueChange={handleOperatorChange}
                disabled={!formData.conditionField}
              >
                <SelectTrigger id="conditionOperator" className="h-12 rounded-2xl border-border/70 bg-background/80">
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
              {selectedOperator && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {selectedOperator.description}
                </p>
              )}
            </div>

            {!selectedOperator?.noValue && (
              <div className="space-y-2">
                <Label htmlFor="conditionValue" className="text-sm font-semibold text-foreground">
                  3. Qual valor deve ser encontrado?
                </Label>
                <Input
                  id="conditionValue"
                  value={formData.conditionValue || ''}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={selectedVariable?.suggestedValue ? `Ex: ${selectedVariable.suggestedValue}` : 'Digite o valor esperado'}
                  disabled={!formData.conditionField || !formData.conditionOperator}
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Use a palavra, nome ou numero que deve acionar o caminho SIM.
                </p>
              </div>
            )}
          </div>

          {!selectedOperator?.noValue && selectedValueSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sugestoes prontas
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedValueSuggestions.map((suggestion) => {
                  const isActive = String(formData.conditionValue || '').trim().toLowerCase() === suggestion.toLowerCase()

                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleValueChange(suggestion)}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-300'
                      ].join(' ')}
                    >
                      {suggestion}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-orange-200/70 bg-orange-50/70 p-4 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-700 dark:text-orange-300">
          Resumo da decisao
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {buildFriendlySentence(
            formData.conditionField,
            formData.conditionOperator,
            formData.conditionValue
          )}
        </p>
        {generatedCondition && (
          <div className="mt-3 rounded-2xl border border-orange-200/70 bg-background/80 px-3 py-2 dark:border-orange-400/15 dark:bg-background/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Expressao tecnica
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {generatedCondition}
            </p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
            SIM = segue pelo conector verde
          </span>
          <span className="rounded-full bg-rose-500/12 px-2.5 py-1 font-semibold text-rose-700 dark:text-rose-300">
            NAO = segue pelo conector vermelho
          </span>
        </div>
      </div>
    </div>
  )
}
