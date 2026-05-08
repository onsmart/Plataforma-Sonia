import React from 'react'
import { Plus, Route, Trash2, Workflow } from 'lucide-react'
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
import { ACCENT_BAR, type FlowAccent } from './flowBlockTheme'

interface ConditionBuilderProps {
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
  mode?: 'binary' | 'switch'
}

type BranchFieldOption = {
  value: string
  label: string
  helper: string
  placeholder: string
}

const BRANCH_FIELDS: BranchFieldOption[] = [
  {
    value: 'message',
    label: 'Mensagem recebida',
    helper: 'Lê o texto que o cliente acabou de enviar.',
    placeholder: 'Ex.: sim, 1',
  },
  {
    value: 'intent',
    label: 'Intenção salva',
    helper: 'Usa uma classificação que já foi salva anteriormente no fluxo.',
    placeholder: 'Ex.: suporte',
  },
  {
    value: 'option',
    label: 'Opção digitada',
    helper: 'Ideal para menus numéricos como 1, 2, 3, 4...',
    placeholder: 'Ex.: 1',
  },
  {
    value: 'user_name',
    label: 'Nome do cliente',
    helper: 'Usa o nome salvo no contexto da conversa.',
    placeholder: 'Ex.: Carlos',
  },
  {
    value: 'phone_number',
    label: 'Telefone',
    helper: 'Usa o telefone reconhecido do contato.',
    placeholder: 'Ex.: 5511999999999',
  },
  {
    value: 'custom',
    label: 'Outra chave do contexto',
    helper: 'Permite ler qualquer chave personalizada do fluxo.',
    placeholder: 'Ex.: etapa_atual',
  },
]

function getBranchFieldOption(value?: string) {
  return BRANCH_FIELDS.find((item) => item.value === value) || BRANCH_FIELDS[0]
}

function normalizeListPreview(value?: string) {
  const items = String(value || '')
    .split(/[,\n;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items.join(', ') : 'sim, 1'
}

function buildConditionExpression(formData: any, mode: 'binary' | 'switch') {
  const field = String(formData.branchField || 'message').trim() || 'message'
  const fieldLabel =
    field === 'custom'
      ? String(formData.branchCustomField || 'valor').trim() || 'valor'
      : field

  if (mode === 'switch') {
    const cases = Array.isArray(formData.switchCases) ? formData.switchCases : []
    const renderedCases = cases
      .map((item: any, index: number) => {
        const label = String(item?.label || '').trim() || `Opção ${index + 1}`
        const values = normalizeListPreview(item?.value || '')
        return `${label} = {${values}}`
      })
      .join('\n')

    const defaultLabel = String(formData.switchDefaultLabel || 'Outros').trim() || 'Outros'
    return `switch (${fieldLabel}) {\n${renderedCases || 'Opção 1 = {1}'}\ndefault = {${defaultLabel}}\n}`
  }

  const ifValue = normalizeListPreview(formData.ifValue || '')
  const elseLabel = String(formData.elseLabel || 'não, 2').trim() || 'não, 2'
  return `if (${fieldLabel}) = {${ifValue}}\nelse = {${elseLabel}}`
}

function getModeAccent(mode: 'binary' | 'switch'): FlowAccent {
  return mode === 'switch' ? 'indigo' : 'orange'
}

export function ConditionBuilder({
  formData,
  setFormData,
  mode = 'binary',
}: ConditionBuilderProps) {
  const selectedField = getBranchFieldOption(formData.branchField)
  const switchCases = Array.isArray(formData.switchCases) ? formData.switchCases : []
  const preview = buildConditionExpression(formData, mode)
  const accentName = getModeAccent(mode)
  const accent = ACCENT_BAR[accentName]

  const accentSurfaceStyle = {
    borderColor: `rgba(${accent.rgb}, 0.28)`,
    backgroundImage: `linear-gradient(135deg, rgba(${accent.rgb}, 0.16) 0%, rgba(${accent.rgb}, 0.08) 34%, rgba(255,255,255,0.96) 100%)`,
    boxShadow: `0 22px 48px -34px rgba(${accent.rgb}, 0.34)`,
  }

  const accentIconStyle = {
    backgroundColor: `rgba(${accent.rgb}, 0.14)`,
    color: accent.idle,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.64), 0 16px 30px -24px rgba(${accent.rgb}, 0.5)`,
  }

  const accentPreviewStyle = {
    borderColor: `rgba(${accent.rgb}, 0.28)`,
    backgroundColor: `rgba(${accent.rgb}, 0.09)`,
    boxShadow: `0 18px 36px -32px rgba(${accent.rgb}, 0.28)`,
  }

  React.useEffect(() => {
    const expression = buildConditionExpression(formData, mode)
    if (expression !== (formData.condition || '')) {
      setFormData((prev: any) => ({
        ...prev,
        condition: expression,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    formData.branchField,
    formData.branchCustomField,
    formData.ifValue,
    formData.elseLabel,
    JSON.stringify(formData.switchCases || []),
    formData.switchDefaultLabel,
  ])

  const updateCase = (caseId: string, patch: Record<string, string>) => {
    setFormData((prev: any) => ({
      ...prev,
      switchCases: (Array.isArray(prev?.switchCases) ? prev.switchCases : []).map((item: any) =>
        item.id === caseId ? { ...item, ...patch } : item
      ),
    }))
  }

  const addCase = () => {
    setFormData((prev: any) => {
      const previousCases = Array.isArray(prev?.switchCases) ? prev.switchCases : []
      const caseNumber = previousCases.length + 1

      return {
        ...prev,
        switchCases: [
          ...previousCases,
          {
            id: `case_${Date.now()}_${caseNumber}`,
            label: `Opção ${caseNumber}`,
            value: String(caseNumber),
          },
        ],
      }
    })
  }

  const removeCase = (caseId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      switchCases: (Array.isArray(prev?.switchCases) ? prev.switchCases : []).filter(
        (item: any) => item.id !== caseId
      ),
    }))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border p-4 shadow-sm" style={accentSurfaceStyle}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={accentIconStyle}>
            {mode === 'switch' ? <Route className="h-5 w-5" /> : <Workflow className="h-5 w-5" />}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-semibold text-foreground">
              {mode === 'switch' ? 'Roteamento por opções' : 'Decisão simples'}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === 'switch'
                ? 'Cada opção gera uma saída própria e tudo que não casar segue para a saída padrão.'
                : 'Se o valor bater com IF, o fluxo sai pelo conector verde. Caso contrário, segue pelo ELSE.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm dark:bg-card/60">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Qual valor este bloco deve observar?
            </Label>
            <Select
              value={formData.branchField || 'message'}
              onValueChange={(value) =>
                setFormData((prev: any) => ({ ...prev, branchField: value }))
              }
            >
              <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                <SelectValue placeholder="Escolha o valor observado pelo bloco" />
              </SelectTrigger>
              <SelectContent>
                {BRANCH_FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">{selectedField.helper}</p>
          </div>

          {formData.branchField === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Nome da chave personalizada
              </Label>
              <Input
                value={formData.branchCustomField || ''}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, branchCustomField: e.target.value }))
                }
                placeholder={selectedField.placeholder}
                className="h-12 rounded-2xl border-border/70 bg-background/80"
              />
            </div>
          )}

          {mode === 'binary' ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  IF = quando o valor for
                </Label>
                <Input
                  value={formData.ifValue || ''}
                  onChange={(e) =>
                    setFormData((prev: any) => ({ ...prev, ifValue: e.target.value }))
                  }
                  placeholder={selectedField.placeholder}
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Você pode informar mais de um gatilho separado por vírgula. Ex.: `sim, 1, quero atendimento`.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Nome visual do ELSE</Label>
                <Input
                  value={formData.elseLabel || ''}
                  onChange={(e) =>
                    setFormData((prev: any) => ({ ...prev, elseLabel: e.target.value }))
                  }
                  placeholder="não, 2"
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Esse texto aparece no editor. Em execução, tudo que não bater com IF vai para ELSE.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold text-foreground">Saídas do bloco</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cada linha representa uma ramificação. Ex.: 1, 2, 3, 4...
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={addCase}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar opção
                  </Button>
                </div>

                <div className="space-y-3">
                  {switchCases.map((item: any, index: number) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/70 bg-background/60 p-4"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_auto]">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Rótulo
                          </Label>
                          <Input
                            value={item.label || ''}
                            onChange={(e) => updateCase(item.id, { label: e.target.value })}
                            placeholder={`Opção ${index + 1}`}
                            className="h-11 rounded-2xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Valor que ativa
                          </Label>
                          <Input
                            value={item.value || ''}
                            onChange={(e) => updateCase(item.id, { value: e.target.value })}
                            placeholder={`Ex.: ${index + 1}`}
                            className="h-11 rounded-2xl"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 rounded-2xl px-3 text-rose-600 hover:text-rose-700"
                            onClick={() => removeCase(item.id)}
                            disabled={switchCases.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Saída padrão</Label>
                <Input
                  value={formData.switchDefaultLabel || ''}
                  onChange={(e) =>
                    setFormData((prev: any) => ({ ...prev, switchDefaultLabel: e.target.value }))
                  }
                  placeholder="Outros"
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-3xl border p-4 shadow-sm" style={accentPreviewStyle}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: accent.selected }}>
          Visualização
        </p>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 dark:border-slate-700">
          <pre className="whitespace-pre-wrap break-words">{preview}</pre>
        </div>
      </div>
    </div>
  )
}
