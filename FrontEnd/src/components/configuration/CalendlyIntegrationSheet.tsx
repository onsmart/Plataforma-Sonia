import React, { useEffect, useState } from "react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/switch"
import { CalendarDays, CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck, Webhook } from "lucide-react"
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
  }
}

function formatEventTypeMeta(eventType: CalendlyEventTypeOption) {
  const parts = []
  if (typeof eventType.duration === 'number' && eventType.duration > 0) {
    parts.push(`${eventType.duration} min`)
  }
  if (eventType.location_label) {
    parts.push(eventType.location_label)
  } else if (eventType.location_kind) {
    parts.push(eventType.location_kind)
  }
  return parts.join(" • ")
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
      if (!response.ok) {
        throw new Error(json.details || json.error || 'Erro ao registrar webhook')
      }
      toast.success('Webhook do Calendly sincronizado com sucesso.')
      await onSave()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar webhook do Calendly')
    } finally {
      setSyncingWebhook(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full max-w-none overflow-y-auto border-l border-border/70 bg-zinc-950/98 px-0 text-zinc-50 backdrop-blur-xl sm:w-[92vw] sm:max-w-[980px]">
        <SheetHeader className="border-b border-white/10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/18 via-blue-500/14 to-indigo-500/18 text-sky-300 shadow-[0_10px_30px_-18px_rgba(56,189,248,0.8)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="max-w-2xl space-y-1.5">
              <SheetTitle className="text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">Conectar Calendly</SheetTitle>
              <SheetDescription className="text-sm leading-6 text-zinc-400 sm:text-[15px]">
                Configure a conta do usuário no Calendly para liberar as ferramentas de agenda, disponibilidade, booking, remarcação e cancelamento dentro da plataforma.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-base font-bold text-zinc-100">Credenciais</Label>
                  <p className="text-xs leading-5 text-zinc-400">
                    Use um Personal Access Token do Calendly com acesso à agenda, event types e webhooks.
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
                    placeholder="usuario@empresa.com"
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
                  'Usar integração no bloco appointment',
                ].map((capability) => (
                  <div key={capability} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-zinc-200">{capability}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-sky-300" />
                <div>
                  <p className="text-base font-bold text-zinc-100">Event types encontrados</p>
                  <p className="text-xs text-zinc-400">
                    Esses event types ficam disponíveis para seleção e uso pela plataforma depois da conexão.
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
                    <div key={eventType.uri} className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">{eventType.name}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatEventTypeMeta(eventType) || 'Sem metadados adicionais'}
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

            <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Webhook className="h-5 w-5 text-sky-300" />
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
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-white/10 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-center text-xs text-zinc-400 sm:text-left">
              Depois de salvar, essa integração poderá ser selecionada nos blocos <span className="font-mono">appointment</span> e nas ferramentas do Calendly.
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
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
