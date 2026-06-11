import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/switch"
import { CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck, Webhook } from "lucide-react"
import { IntegrationBrandIcon } from "../integrations/IntegrationBrandIcon"
import { toast } from "sonner"
import { BASE_URL, getAuthHeaders } from "../../services/api"

const MASKED_SECRET_VALUE = "************"
const isMaskedSecretValue = (value: string) => value === MASKED_SECRET_VALUE
const normalizeSecretInput = (nextValue: string, currentValue: string) =>
  isMaskedSecretValue(currentValue) ? nextValue.replace(MASKED_SECRET_VALUE, '') : nextValue

export type CalComEventTypeOption = {
  id: number
  title: string
  slug?: string | null
  length?: number | null
  schedulingType?: string | null
  active?: boolean
}

export type CalComEventTypeMapping = {
  id: string
  specialty: string
  eventTypeId: number
  eventTypeName: string
  eventTypeSlug?: string | null
  doctor?: string | null
  unit?: string | null
  consultationType?: string | null
  locationKind?: string | null
  locationLabel?: string | null
  timezone?: string | null
  active?: boolean
}

export type CalComIntegrationRow = {
  id: string
  provider: string
  email_address?: string | null
  cal_username?: string | null
  base_url?: string | null
  webhook_secret?: string | null
  webhook_subscription_id?: string | null
  default_timezone?: string | null
  status?: string
  is_default?: boolean
  is_active?: boolean
  has_api_key?: boolean
  last_test_at?: string | null
  last_sync_at?: string | null
  last_webhook_sync_at?: string | null
  event_type_mappings?: CalComEventTypeMapping[]
}

type CalComIntegrationSheetProps = {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  initialIntegration?: CalComIntegrationRow | null
}

type FormState = {
  integrationId: string | null
  apiKey: string
  emailAddress: string
  calUsername: string
  baseUrl: string
  defaultTimezone: string
  isDefault: boolean
  isActive: boolean
}

function normalizeRoutingKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '')
}

function mergeMappingsWithEventTypes(
  eventTypes: CalComEventTypeOption[],
  savedMappings: CalComEventTypeMapping[],
  defaultTimezone: string
): CalComEventTypeMapping[] {
  const savedById = new Map(
    savedMappings
      .filter((m) => m.eventTypeId > 0)
      .map((m) => [m.eventTypeId, m] as const)
  )

  return eventTypes.map((eventType) => {
    const existing = savedById.get(eventType.id)
    const suggestedKey = normalizeRoutingKey(String(eventType.slug || eventType.title || ''))

    if (existing) {
      return {
        ...existing,
        id: existing.id || `mapping-${eventType.id}`,
        eventTypeId: eventType.id,
        eventTypeName: eventType.title,
        eventTypeSlug: eventType.slug ?? existing.eventTypeSlug ?? null,
        timezone: existing.timezone || defaultTimezone,
      }
    }

    return {
      id: `mapping-${eventType.id}`,
      specialty: suggestedKey,
      eventTypeId: eventType.id,
      eventTypeName: eventType.title,
      eventTypeSlug: eventType.slug ?? null,
      doctor: null,
      unit: null,
      consultationType: null,
      locationKind: null,
      locationLabel: null,
      timezone: defaultTimezone,
      active: true,
    }
  })
}

function mapIntegrationToForm(integration?: CalComIntegrationRow | null): FormState {
  return {
    integrationId: integration?.id || null,
    apiKey: integration?.has_api_key ? MASKED_SECRET_VALUE : '',
    emailAddress: integration?.email_address || '',
    calUsername: integration?.cal_username || '',
    baseUrl: integration?.base_url || '',
    defaultTimezone: integration?.default_timezone || 'America/Sao_Paulo',
    isDefault: integration?.is_default === true,
    isActive: integration?.is_active !== false,
  }
}

export function CalComIntegrationSheet({
  isOpen,
  onClose,
  onSave,
  initialIntegration,
}: CalComIntegrationSheetProps) {
  const [form, setForm] = useState<FormState>(() => mapIntegrationToForm(initialIntegration))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncingWebhook, setSyncingWebhook] = useState(false)
  const [loadingEventTypes, setLoadingEventTypes] = useState(false)
  const [eventTypes, setEventTypes] = useState<CalComEventTypeOption[]>([])
  const [mappings, setMappings] = useState<CalComEventTypeMapping[]>([])
  const [savingMappings, setSavingMappings] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(mapIntegrationToForm(initialIntegration))
    setMappings(Array.isArray(initialIntegration?.event_type_mappings) ? initialIntegration!.event_type_mappings : [])
  }, [initialIntegration, isOpen])

  useEffect(() => {
    if (!isOpen || !form.integrationId) return
    void loadEventTypes(form.integrationId)
  }, [isOpen, form.integrationId])

  const loadEventTypes = async (integrationId: string) => {
    setLoadingEventTypes(true)
    try {
      const response = await fetch(`${BASE_URL}/calcom/integrations/${integrationId}/event-types`, {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.details || json.error || 'Erro ao carregar event types')
      const loaded: CalComEventTypeOption[] = Array.isArray(json.eventTypes) ? json.eventTypes : []
      setEventTypes(loaded)
      setMappings((current) =>
        mergeMappingsWithEventTypes(loaded, current, form.defaultTimezone || 'America/Sao_Paulo')
      )
      if (loaded.length === 0) {
        toast.info('Nenhum event type encontrado nesta conta Cal.com.')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar event types do Cal.com')
    } finally {
      setLoadingEventTypes(false)
    }
  }

  const handleSave = async () => {
    const apiKey = isMaskedSecretValue(form.apiKey) ? undefined : form.apiKey.trim() || undefined

    if (!apiKey && !form.integrationId) {
      toast.error('Informe a API Key do Cal.com para criar a integração.')
      return
    }

    setSaving(true)
    try {
      const method = form.integrationId ? 'PUT' : 'POST'
      const endpoint = form.integrationId
        ? `${BASE_URL}/calcom/integrations/${form.integrationId}`
        : `${BASE_URL}/calcom/integrations`

      const response = await fetch(endpoint, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          apiKey,
          emailAddress: form.emailAddress || undefined,
          calUsername: form.calUsername || undefined,
          baseUrl: form.baseUrl || undefined,
          defaultTimezone: form.defaultTimezone || undefined,
          isDefault: form.isDefault,
          isActive: form.isActive,
          eventTypeMappings: mappings
            .map((mapping) => ({
              ...mapping,
              specialty: String(mapping.specialty || '').trim(),
              eventTypeId: Number(mapping.eventTypeId),
              eventTypeName: String(mapping.eventTypeName || '').trim(),
            }))
            .filter((m) => m.specialty && m.eventTypeId > 0 && m.eventTypeName),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || 'Erro ao salvar integração Cal.com')
      }

      const integration = json.integration as CalComIntegrationRow
      setForm((current) => ({
        ...current,
        integrationId: integration.id,
        emailAddress: integration.email_address || current.emailAddress,
        calUsername: integration.cal_username || current.calUsername,
        defaultTimezone: integration.default_timezone || current.defaultTimezone,
      }))
      if (Array.isArray(integration.event_type_mappings) && integration.event_type_mappings.length > 0) {
        setMappings(integration.event_type_mappings)
      }
      toast.success('Integração Cal.com salva com sucesso.')
      await onSave()
      if (integration.id) {
        await loadEventTypes(integration.id)
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar integração Cal.com')
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
      const response = await fetch(`${BASE_URL}/calcom/integrations/${form.integrationId}/test`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao testar integração')
      const result = json.result || {}
      toast.success(`Cal.com conectado. ${result.eventTypesCount || 0} event types encontrados.`)
      await onSave()
      await loadEventTypes(form.integrationId)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao testar integração Cal.com')
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
      const response = await fetch(`${BASE_URL}/calcom/integrations/${form.integrationId}/webhook/sync`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || 'Erro ao registrar webhook')
      }
      toast.success('Webhook Cal.com sincronizado com sucesso.')
      await onSave()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar webhook Cal.com')
    } finally {
      setSyncingWebhook(false)
    }
  }

  const handleSuggestRoutingKeys = () => {
    if (eventTypes.length === 0) return
    const tz = form.defaultTimezone || 'America/Sao_Paulo'
    setMappings(
      eventTypes.map((eventType) => {
        const existing = mappings.find((m) => m.eventTypeId === eventType.id)
        const base = existing || mergeMappingsWithEventTypes([eventType], [], tz)[0]
        return {
          ...base,
          specialty: normalizeRoutingKey(String(eventType.slug || eventType.title || '')),
        }
      })
    )
    toast.success('Chaves sugeridas a partir dos nomes dos event types da conta.')
  }

  const handleMappingFieldChange = (
    id: string,
    field: keyof CalComEventTypeMapping,
    value: string | number | boolean | null
  ) => {
    setMappings((current) =>
      current.map((mapping) => {
        if (mapping.id !== id) return mapping
        return { ...mapping, [field]: value }
      })
    )
  }

  const handleSaveMappings = async () => {
    if (!form.integrationId) {
      toast.error('Salve a integração antes de configurar os mapeamentos.')
      return
    }

    const normalizedMappings = mappings
      .map((mapping) => ({
        ...mapping,
        specialty: String(mapping.specialty || '').trim(),
        eventTypeId: Number(mapping.eventTypeId),
        eventTypeName: String(mapping.eventTypeName || '').trim(),
        doctor: String(mapping.doctor || '').trim() || null,
        unit: String(mapping.unit || '').trim() || null,
        consultationType: String(mapping.consultationType || '').trim() || null,
        locationKind: String(mapping.locationKind || '').trim() || null,
        locationLabel: String(mapping.locationLabel || '').trim() || null,
        timezone: String(mapping.timezone || '').trim() || null,
        active: mapping.active !== false,
      }))
      .filter((m) => m.specialty && m.eventTypeId > 0 && m.eventTypeName)

    if (normalizedMappings.length === 0) {
      toast.error('Adicione pelo menos uma regra com chave de roteamento e event type do Cal.com.')
      return
    }

    setSavingMappings(true)
    try {
      const response = await fetch(`${BASE_URL}/calcom/integrations/${form.integrationId}/mappings`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ mappings: normalizedMappings }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.details || json.error || 'Erro ao salvar mapeamentos Cal.com')
      setMappings(normalizedMappings)
      toast.success('Mapeamentos Cal.com salvos com sucesso.')
      void onSave()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar mapeamentos Cal.com')
    } finally {
      setSavingMappings(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden border-white/10 bg-zinc-950 p-0 text-zinc-50">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-4">
            <IntegrationBrandIcon
              provider="calcom"
              size="sm"
              boxed
              className="rounded-xl border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-zinc-50">
                {form.integrationId ? 'Configurar Cal.com' : 'Conectar Cal.com'}
              </DialogTitle>
              <p className="mt-0.5 text-sm leading-5 text-zinc-400">
                Configure agenda, disponibilidade, booking e cancelamento para usar nos fluxos.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-5">
            {/* CREDENCIAIS */}
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-base font-bold text-zinc-100">Credenciais</Label>
                  <p className="text-xs leading-5 text-zinc-400">
                    Use uma API Key do Cal.com (Settings → Developer → API Keys). Para instância self-hosted, informe também a URL base.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-zinc-400/20 bg-zinc-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200">
                  Cal.com
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-semibold text-zinc-100">API Key</Label>
                  <Input
                    type="password"
                    value={form.apiKey}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setForm((current) => ({
                      ...current,
                      apiKey: normalizeSecretInput(e.target.value, current.apiKey),
                    }))}
                    onBlur={() => setForm((current) => ({
                      ...current,
                      apiKey: current.integrationId && !current.apiKey.trim() && initialIntegration?.has_api_key
                        ? MASKED_SECRET_VALUE
                        : current.apiKey,
                    }))}
                    placeholder={initialIntegration?.has_api_key ? 'Chave salva — digite para rotacionar' : 'cal_live_xxxxxxxx...'}
                    className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-zinc-100">Email da conta</Label>
                  <Input
                    value={form.emailAddress}
                    onChange={(e) => setForm((current) => ({ ...current, emailAddress: e.target.value }))}
                    placeholder="usuario@empresa.com"
                    className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-zinc-100">Username Cal.com</Label>
                  <Input
                    value={form.calUsername}
                    onChange={(e) => setForm((current) => ({ ...current, calUsername: e.target.value }))}
                    placeholder="meu-usuario"
                    className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-zinc-100">URL base (self-hosted, opcional)</Label>
                  <Input
                    value={form.baseUrl}
                    onChange={(e) => setForm((current) => ({ ...current, baseUrl: e.target.value }))}
                    placeholder="https://cal.minha-empresa.com/api/v2"
                    className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <p className="text-xs text-zinc-500">Deixe em branco para usar api.cal.com (cloud).</p>
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

                <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-4 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Padrão do workspace</p>
                      <p className="text-xs text-zinc-400">Usa esta integração como preferida nos blocos de agenda.</p>
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

            {/* CAPACIDADES */}
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-base font-bold text-zinc-100">Ferramentas e recursos liberados</Label>
                  <p className="text-xs leading-5 text-zinc-400">
                    Depois de conectar, a plataforma poderá consultar disponibilidade, criar bookings e sincronizar alterações.
                  </p>
                </div>
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
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  'Consultar disponibilidade',
                  'Criar agendamento',
                  'Remarcar agendamento',
                  'Cancelar agendamento',
                  'Receber webhook de eventos',
                  'Instância self-hosted suportada',
                ].map((capability) => (
                  <div key={capability} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-zinc-200">{capability}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* EVENT TYPES */}
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <IntegrationBrandIcon provider="calcom" size="sm" boxed />
                <div>
                  <p className="text-base font-bold text-zinc-100">Event types da conta conectada</p>
                  <p className="text-xs text-zinc-400">
                    Lista carregada ao vivo da API do Cal.com ({eventTypes.length}{' '}
                    {eventTypes.length === 1 ? 'evento' : 'eventos'}).
                  </p>
                </div>
              </div>

              {eventTypes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
                  Nenhum event type carregado ainda. Salve a integração e teste a conexão para buscar os dados da conta.
                </div>
              ) : (
                <div className="space-y-3">
                  {eventTypes.map((eventType) => (
                    <div key={eventType.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">{eventType.title}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {typeof eventType.length === 'number' && eventType.length > 0
                              ? `${eventType.length} min`
                              : 'Duração não definida'}
                            {eventType.slug && ` · /${eventType.slug}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 text-zinc-200">
                          {eventType.active === false ? 'Inativo' : 'Ativo'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MAPEAMENTOS */}
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-base font-bold text-zinc-100">Mapeamento (1:1 com a conta)</Label>
                  <p className="text-xs leading-5 text-zinc-400">
                    Cada event type retornado pela API gera uma regra abaixo. Defina a chave de roteamento (ex.:{' '}
                    <span className="font-mono">reuniao_diagnostico</span>) usada pelos agentes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.integrationId && loadEventTypes(form.integrationId)}
                    disabled={!form.integrationId || loadingEventTypes}
                    className="rounded-xl border-zinc-400/30 bg-zinc-400/10 text-zinc-200 hover:bg-zinc-400/20"
                  >
                    {loadingEventTypes ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar com Cal.com
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSuggestRoutingKeys}
                    disabled={!form.integrationId || eventTypes.length === 0}
                    className="rounded-xl border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                  >
                    Sugerir chaves
                  </Button>
                </div>
              </div>

              {loadingEventTypes ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-10 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando event types da conta…
                </div>
              ) : eventTypes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
                  Salve a integração e clique em &quot;Testar conexão&quot; para listar os event types reais desta conta.
                </div>
              ) : (
                <div className="space-y-4">
                  {eventTypes.map((eventType) => {
                    const mapping =
                      mappings.find((m) => m.eventTypeId === eventType.id) ||
                      mergeMappingsWithEventTypes([eventType], mappings, form.defaultTimezone || 'America/Sao_Paulo')[0]
                    return (
                      <div key={eventType.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-zinc-50">{eventType.title}</p>
                            <p className="mt-1 text-xs text-zinc-400">
                              {typeof eventType.length === 'number' ? `${eventType.length} min` : 'Duração não definida'}
                              {eventType.slug && ` · /${eventType.slug}`}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 rounded-full border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                            Na conta
                          </Badge>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-zinc-100">Chave de roteamento</Label>
                            <Input
                              value={mapping.specialty}
                              onChange={(e) =>
                                handleMappingFieldChange(
                                  mapping.id,
                                  'specialty',
                                  normalizeRoutingKey(e.target.value)
                                )
                              }
                              placeholder="reuniao_diagnostico"
                              className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 font-mono text-zinc-100 placeholder:text-zinc-500"
                            />
                            <p className="text-xs text-zinc-500">
                              Mesmo valor nas ferramentas Cal.com do agente. Sugestão:{' '}
                              <span className="font-mono text-zinc-400">
                                {normalizeRoutingKey(eventType.slug || eventType.title)}
                              </span>
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-zinc-100">Timezone</Label>
                            <Input
                              value={mapping.timezone || ''}
                              onChange={(e) =>
                                handleMappingFieldChange(mapping.id, 'timezone', e.target.value)
                              }
                              placeholder="America/Sao_Paulo"
                              className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                            />
                          </div>

                          <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">Usar este event type nos agentes</p>
                              <p className="text-xs text-zinc-400">
                                Desative apenas se quiser manter salvo sem expor para agendamento.
                              </p>
                            </div>
                            <Switch
                              checked={mapping.active !== false}
                              onCheckedChange={(checked) =>
                                handleMappingFieldChange(mapping.id, 'active', checked)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                <Button
                  type="button"
                  onClick={handleSaveMappings}
                  disabled={!form.integrationId || savingMappings}
                  className="rounded-xl bg-zinc-600 text-white hover:bg-zinc-500"
                >
                  {savingMappings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar mapeamentos
                </Button>
              </div>
            </div>

            {/* OPERAÇÕES ASSISTIDAS */}
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Webhook className="h-5 w-5 text-zinc-300" />
                <div>
                  <p className="text-base font-bold text-zinc-100">Operações assistidas</p>
                  <p className="text-xs text-zinc-400">Ative e valide a conexão real antes de usar essa integração em automações.</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                <Button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !form.integrationId}
                  className="rounded-xl bg-zinc-600 text-white hover:bg-zinc-500"
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
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Depois de salvar, esta integração poderá ser selecionada em blocos, agentes e ferramentas que executam ações de calendário.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={onClose} className="rounded-xl text-zinc-300 hover:bg-white/10 hover:text-zinc-100">Fechar</Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-zinc-600 text-white hover:bg-zinc-500">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar integração
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
