import React, { useEffect, useMemo, useState } from "react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/switch"
import { CalendarDays, Clock, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Webhook } from "lucide-react"
import { toast } from "sonner"
import { BASE_URL, getAuthHeaders } from "../../services/api"

export type CalendlyEventTypeOption = {
  uri: string
  name: string
  slug?: string | null
  scheduling_url?: string | null
  active?: boolean
  duration?: number | null
  location_kind?: string | null
  location_label?: string | null
}

export type CalendlyEventTypeMapping = {
  id: string
  specialty: string
  doctor?: string | null
  unit?: string | null
  consultationType?: string | null
  eventTypeUri: string
  eventTypeName: string
  locationKind?: string | null
  locationLabel?: string | null
  timezone?: string | null
  active?: boolean
}

export type CalendlyIntegrationRow = {
  id: string
  provider: string
  email_address?: string | null
  owner_uri?: string | null
  organization_uri?: string | null
  scheduling_url?: string | null
  webhook_scope?: 'user' | 'organization'
  webhook_base_url?: string | null
  webhook_subscription_uri?: string | null
  default_timezone?: string | null
  status?: string
  is_default?: boolean
  is_active?: boolean
  has_access_token?: boolean
  last_test_at?: string | null
  last_sync_at?: string | null
  last_webhook_sync_at?: string | null
  event_type_mappings?: CalendlyEventTypeMapping[]
}

type CalendlyIntegrationSheetProps = {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  initialIntegration?: CalendlyIntegrationRow | null
}

type FormState = {
  integrationId: string | null
  accessToken: string
  emailAddress: string
  defaultTimezone: string
  webhookBaseUrl: string
  webhookScope: 'user' | 'organization'
  isDefault: boolean
  isActive: boolean
  eventTypeMappings: CalendlyEventTypeMapping[]
}

const SPECIALTY_OPTIONS = [
  'clinica_geral',
  'cardiologia',
  'dermatologia',
  'ginecologia',
  'ortopedia',
  'pediatria',
  'endocrinologia',
  'psiquiatria',
  'psicologia',
  'nutricao',
  'outra',
]

function createEmptyMapping(index: number): CalendlyEventTypeMapping {
  return {
    id: `mapping-${Date.now()}-${index}`,
    specialty: 'clinica_geral',
    doctor: '',
    unit: '',
    consultationType: '',
    eventTypeUri: '',
    eventTypeName: '',
    locationKind: '',
    locationLabel: '',
    timezone: '',
    active: true,
  }
}

function mapIntegrationToForm(integration?: CalendlyIntegrationRow | null): FormState {
  return {
    integrationId: integration?.id || null,
    accessToken: '',
    emailAddress: integration?.email_address || '',
    defaultTimezone: integration?.default_timezone || 'America/Sao_Paulo',
    webhookBaseUrl: integration?.webhook_base_url || '',
    webhookScope: integration?.webhook_scope === 'user' ? 'user' : 'organization',
    isDefault: integration?.is_default === true,
    isActive: integration?.is_active !== false,
    eventTypeMappings: Array.isArray(integration?.event_type_mappings) ? integration!.event_type_mappings : [],
  }
}

export function CalendlyIntegrationSheet({
  isOpen,
  onClose,
  onSave,
  initialIntegration,
}: CalendlyIntegrationSheetProps) {
  const [form, setForm] = useState<FormState>(() => mapIntegrationToForm(initialIntegration))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncingWebhook, setSyncingWebhook] = useState(false)
  const [loadingEventTypes, setLoadingEventTypes] = useState(false)
  const [eventTypes, setEventTypes] = useState<CalendlyEventTypeOption[]>([])

  useEffect(() => {
    if (!isOpen) return
    setForm(mapIntegrationToForm(initialIntegration))
  }, [initialIntegration, isOpen])

  useEffect(() => {
    if (!isOpen || !form.integrationId) return
    void loadEventTypes(form.integrationId)
  }, [isOpen, form.integrationId])

  const selectedEventTypeCount = useMemo(
    () => form.eventTypeMappings.filter((mapping) => mapping.eventTypeUri).length,
    [form.eventTypeMappings]
  )

  const loadEventTypes = async (integrationId: string) => {
    setLoadingEventTypes(true)
    try {
      const response = await fetch(`${BASE_URL}/calendar/integrations/${integrationId}/event-types`, {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar event types')
      setEventTypes(Array.isArray(json.eventTypes) ? json.eventTypes : [])
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar event types do Calendly')
    } finally {
      setLoadingEventTypes(false)
    }
  }

  const handleSave = async () => {
    if (!form.accessToken.trim() && !form.integrationId) {
      toast.error('Informe o token pessoal do Calendly para criar a integração.')
      return
    }

    setSaving(true)
    try {
      const method = form.integrationId ? 'PUT' : 'POST'
      const endpoint = form.integrationId
        ? `${BASE_URL}/calendar/integrations/${form.integrationId}`
        : `${BASE_URL}/calendar/integrations`

      const response = await fetch(endpoint, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          accessToken: form.accessToken || undefined,
          emailAddress: form.emailAddress || undefined,
          defaultTimezone: form.defaultTimezone || undefined,
          webhookBaseUrl: form.webhookBaseUrl || undefined,
          webhookScope: form.webhookScope,
          isDefault: form.isDefault,
          isActive: form.isActive,
          eventTypeMappings: form.eventTypeMappings,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar integração do Calendly')

      const integration = json.integration as CalendlyIntegrationRow
      setForm((current) => ({
        ...current,
        integrationId: integration.id,
        emailAddress: integration.email_address || current.emailAddress,
        defaultTimezone: integration.default_timezone || current.defaultTimezone,
      }))
      toast.success('Integração do Calendly salva com sucesso.')
      await onSave()
      if (integration.id) {
        await loadEventTypes(integration.id)
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar integração do Calendly')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!form.integrationId) {
      toast.error('Salve a integração antes de testar a conexão.')
      return
    }
    setTesting(true)
    try {
      const response = await fetch(`${BASE_URL}/calendar/integrations/${form.integrationId}/test`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao testar integração')
      const result = json.result || {}
      toast.success(`Calendly conectado. ${result.eventTypesCount || 0} event types encontrados.`)
      await onSave()
      await loadEventTypes(form.integrationId)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao testar integração do Calendly')
    } finally {
      setTesting(false)
    }
  }

  const handleSyncWebhook = async () => {
    if (!form.integrationId) {
      toast.error('Salve a integração antes de registrar o webhook.')
      return
    }
    setSyncingWebhook(true)
    try {
      const response = await fetch(`${BASE_URL}/calendar/integrations/${form.integrationId}/webhook/sync`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao registrar webhook')
      toast.success('Webhook do Calendly sincronizado com sucesso.')
      await onSave()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar webhook do Calendly')
    } finally {
      setSyncingWebhook(false)
    }
  }

  const handleSaveMappings = async () => {
    if (!form.integrationId) {
      toast.error('Salve a integração antes de salvar os mapeamentos.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`${BASE_URL}/calendar/integrations/${form.integrationId}/mappings`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          eventTypeMappings: form.eventTypeMappings,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar mapeamentos')
      toast.success('Mapeamentos do Calendly salvos com sucesso.')
      await onSave()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar mapeamentos')
    } finally {
      setSaving(false)
    }
  }

  const updateMapping = (mappingId: string, patch: Partial<CalendlyEventTypeMapping>) => {
    setForm((current) => ({
      ...current,
      eventTypeMappings: current.eventTypeMappings.map((mapping) => {
        if (mapping.id !== mappingId) return mapping
        const next = { ...mapping, ...patch }
        if (patch.eventTypeUri) {
          const selectedEventType = eventTypes.find((item) => item.uri === patch.eventTypeUri)
          if (selectedEventType) {
            next.eventTypeName = selectedEventType.name
            next.locationKind = selectedEventType.location_kind || ''
            next.locationLabel = selectedEventType.location_label || ''
          }
        }
        return next
      }),
    }))
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[460px] max-w-[100vw] overflow-y-auto border-l border-border/70 bg-zinc-950/98 px-0 text-zinc-50 backdrop-blur-xl sm:w-[760px]">
        <SheetHeader className="border-b border-white/10 px-6 pb-6 pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/18 via-blue-500/14 to-indigo-500/18 text-sky-300 shadow-[0_10px_30px_-18px_rgba(56,189,248,0.8)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-xl font-black tracking-tight text-zinc-50">Conectar Calendly</SheetTitle>
              <SheetDescription className="max-w-xl text-sm leading-6 text-zinc-400">
                Configure o token pessoal, defina o webhook e mapeie especialidades da clínica para event types do Calendly.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-base font-bold text-zinc-100">Credenciais</Label>
                <p className="text-xs leading-5 text-zinc-400">
                  Use um Personal Access Token do Calendly com acesso aos event types e agendamentos.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">
                Calendly
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold text-zinc-100">Personal Access Token</Label>
                <Input
                  type="password"
                  value={form.accessToken}
                  onChange={(e) => setForm((current) => ({ ...current, accessToken: e.target.value }))}
                  placeholder="Cole o PAT do Calendly aqui..."
                  className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-100">Email da conta</Label>
                <Input
                  value={form.emailAddress}
                  onChange={(e) => setForm((current) => ({ ...current, emailAddress: e.target.value }))}
                  placeholder="agendamentos@clinica.com.br"
                  className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-100">Timezone padrão</Label>
                <Input
                  value={form.defaultTimezone}
                  onChange={(e) => setForm((current) => ({ ...current, defaultTimezone: e.target.value }))}
                  placeholder="America/Sao_Paulo"
                  className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold text-zinc-100">Webhook base URL</Label>
                <Input
                  value={form.webhookBaseUrl}
                  onChange={(e) => setForm((current) => ({ ...current, webhookBaseUrl: e.target.value }))}
                  placeholder="https://seu-backend-publico.com"
                  className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
                <p className="text-xs leading-5 text-zinc-400">
                  A plataforma registrará o webhook em <span className="font-mono">/calendar/webhook/:integrationId</span>.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-100">Escopo do webhook</Label>
                <Select
                  value={form.webhookScope}
                  onValueChange={(value: 'user' | 'organization') => setForm((current) => ({ ...current, webhookScope: value }))}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100">
                    <SelectValue placeholder="Escolha o escopo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="organization">organization</SelectItem>
                    <SelectItem value="user">user</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Padrão do workspace</p>
                    <p className="text-xs text-zinc-400">Usa esta integração como preferência do bloco `appointment`.</p>
                  </div>
                  <Switch
                    checked={form.isDefault}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Integração ativa</p>
                    <p className="text-xs text-zinc-400">Desative para preservar a configuração sem uso operacional.</p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-base font-bold text-zinc-100">Event types e mapeamentos</Label>
                <p className="text-xs leading-5 text-zinc-400">
                  {selectedEventTypeCount} mapeamentos com event type selecionado.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.integrationId && loadEventTypes(form.integrationId)}
                  disabled={!form.integrationId || loadingEventTypes}
                  className="rounded-xl border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                >
                  {loadingEventTypes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Atualizar event types
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      eventTypeMappings: [...current.eventTypeMappings, createEmptyMapping(current.eventTypeMappings.length + 1)],
                    }))
                  }
                  className="rounded-xl border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo mapeamento
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {form.eventTypeMappings.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
                  Nenhum mapeamento criado ainda. Adicione uma linha para conectar especialidade, médico ou unidade a um event type do Calendly.
                </div>
              )}

              {form.eventTypeMappings.map((mapping) => (
                <div key={mapping.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sky-300" />
                      <span className="text-sm font-semibold text-zinc-100">Mapeamento clínico</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          eventTypeMappings: current.eventTypeMappings.filter((item) => item.id !== mapping.id),
                        }))
                      }
                      className="rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Especialidade</Label>
                      <Select value={mapping.specialty} onValueChange={(value) => updateMapping(mapping.id, { specialty: value })}>
                        <SelectTrigger className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-white/10 bg-zinc-950 text-zinc-100">
                          {SPECIALTY_OPTIONS.map((specialty) => (
                            <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Event type</Label>
                      <Select value={mapping.eventTypeUri || 'none'} onValueChange={(value) => updateMapping(mapping.id, { eventTypeUri: value === 'none' ? '' : value })}>
                        <SelectTrigger className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100">
                          <SelectValue placeholder="Selecione um event type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-white/10 bg-zinc-950 text-zinc-100">
                          <SelectItem value="none">Sem event type</SelectItem>
                          {eventTypes.map((eventType) => (
                            <SelectItem key={eventType.uri} value={eventType.uri}>
                              {eventType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Médico</Label>
                      <Input
                        value={mapping.doctor || ''}
                        onChange={(e) => updateMapping(mapping.id, { doctor: e.target.value })}
                        placeholder="Opcional"
                        className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Unidade</Label>
                      <Input
                        value={mapping.unit || ''}
                        onChange={(e) => updateMapping(mapping.id, { unit: e.target.value })}
                        placeholder="Opcional"
                        className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Tipo de consulta</Label>
                      <Input
                        value={mapping.consultationType || ''}
                        onChange={(e) => updateMapping(mapping.id, { consultationType: e.target.value })}
                        placeholder="presencial ou online"
                        className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-zinc-300">Timezone</Label>
                      <Input
                        value={mapping.timezone || ''}
                        onChange={(e) => updateMapping(mapping.id, { timezone: e.target.value })}
                        placeholder="America/Sao_Paulo"
                        className="h-11 rounded-xl border-white/10 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Webhook className="h-5 w-5 text-sky-300" />
              <div>
                <p className="text-base font-bold text-zinc-100">Operações assistidas</p>
                <p className="text-xs text-zinc-400">Use estes passos para ativar agenda real e sincronização de cancelamento/remarcação.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleTest}
                disabled={testing || !form.integrationId}
                className="rounded-xl bg-sky-500 text-white hover:bg-sky-400"
              >
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Testar conexão
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncWebhook}
                disabled={syncingWebhook || !form.integrationId}
                className="rounded-xl border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              >
                {syncingWebhook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Webhook className="mr-2 h-4 w-4" />}
                Registrar webhook
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveMappings}
                disabled={saving || !form.integrationId}
                className="rounded-xl border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar mapeamentos
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-white/10 px-6 py-5">
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-400">
              Depois de salvar, selecione esta integração no bloco <span className="font-mono">appointment</span> para agendar direto no chat.
            </p>
            <div className="flex flex-wrap gap-2">
              <SheetClose asChild>
                <Button variant="ghost" className="rounded-xl text-zinc-300 hover:bg-white/10 hover:text-zinc-100">Fechar</Button>
              </SheetClose>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-sky-500 text-white hover:bg-sky-400">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar integração
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

