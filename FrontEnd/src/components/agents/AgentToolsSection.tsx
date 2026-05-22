import { useCallback, useEffect, useMemo, useState } from 'react'
import { BASE_URL, getAuthHeaders } from '../../services/api'
import {
  type AgentExtraFeaturesV2,
  type AgentToolEntry,
  buildToolKey,
  parseAgentExtraFeatures,
  serializeAgentExtraFeatures,
} from '../../lib/agent-extra-features'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Input } from '../ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { IntegrationBrandIcon } from '../integrations/IntegrationBrandIcon'

type CatalogTool = {
  toolKey: string
  provider: string
  toolName: string
  displayName: string
  description: string
  requiresIntegrationId?: boolean
  requiresCrmIntegrationId?: boolean
}

type IntegrationOption = { id: string; label: string }

type CatalogResponse = {
  tools: CatalogTool[]
  availableProviders: string[]
  integrationsByProvider: Record<string, IntegrationOption[]>
  providerLabels: Record<string, string>
  presets?: Array<{
    id: string
    name: string
    description: string
    toolKeys: string[]
    provider: string
  }>
}

type SetupHealthCheck = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  message: string
}

const PROVIDER_META: Record<string, { description: string }> = {
  calendly: {
    description: 'Agenda e reuniões via Calendly',
  },
  hubspot: {
    description: 'Contatos e CRM HubSpot',
  },
  whatsapp: {
    description: 'Mensagens e templates WhatsApp',
  },
  email: {
    description: 'Envio de e-mails',
  },
}

export interface AgentToolsSectionProps {
  extraFeaturesJson: string
  onExtraFeaturesChange: (json: string) => void
  agentId?: string
  className?: string
}

function statusIcon(status: SetupHealthCheck['status']) {
  if (status === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
  if (status === 'warn') return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
}

export function AgentToolsSection({
  extraFeaturesJson,
  onExtraFeaturesChange,
  agentId,
  className,
}: AgentToolsSectionProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [healthOpen, setHealthOpen] = useState(false)
  const [health, setHealth] = useState<{ ok: boolean; checks: SetupHealthCheck[] } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  /** Integrações que o usuário ativou neste agente (UI); persistência = tools no JSON */
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set())

  const features = useMemo(
    () => parseAgentExtraFeatures(extraFeaturesJson),
    [extraFeaturesJson]
  )

  const emit = useCallback(
    (next: AgentExtraFeaturesV2) => {
      onExtraFeaturesChange(serializeAgentExtraFeatures(next))
    },
    [onExtraFeaturesChange]
  )

  const toolsByProvider = useMemo(() => {
    if (!catalog?.tools?.length) return new Map<string, CatalogTool[]>()
    const map = new Map<string, CatalogTool[]>()
    for (const tool of catalog.tools) {
      const list = map.get(tool.provider) || []
      list.push(tool)
      map.set(tool.provider, list)
    }
    return map
  }, [catalog])

  const toolStateMap = useMemo(() => {
    const map = new Map<string, AgentToolEntry>()
    for (const t of features.tools) {
      map.set(t.toolKey, t)
    }
    return map
  }, [features.tools])

  useEffect(() => {
    const fromSaved = new Set<string>()
    for (const t of features.tools) {
      fromSaved.add(t.provider)
    }
    setActiveProviders(fromSaved)
  }, [extraFeaturesJson])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/integrations/tools/catalog/for-setup`, {
          headers: await getAuthHeaders(false),
        })
        const data = await res.json()
        if (!cancelled && res.ok) setCatalog(data)
      } catch {
        if (!cancelled) setCatalog(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!agentId || features.demo !== 'onsmart_sonia') {
      setHealth(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setHealthLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/agents/${agentId}/setup-health`, {
          headers: await getAuthHeaders(false),
        })
        const data = await res.json()
        if (!cancelled && res.ok) {
          setHealth({ ok: Boolean(data.ok), checks: data.checks || [] })
        }
      } catch {
        if (!cancelled) setHealth(null)
      } finally {
        if (!cancelled) setHealthLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId, features.demo, extraFeaturesJson])

  const getProviderBindingId = (provider: string): string => {
    const row = features.tools.find(
      (t) =>
        t.provider === provider &&
        (t.integrationId || t.crmIntegrationId)
    )
    if (provider === 'hubspot') return row?.crmIntegrationId || ''
    return row?.integrationId || ''
  }

  const getProviderSpecialty = (provider: string): string => {
    const row = features.tools.find(
      (t) => t.provider === provider && t.config?.specialty
    )
    return row?.config?.specialty || ''
  }

  const setProviderBindingId = (provider: string, bindingId: string) => {
    const nextTools = features.tools.map((t) => {
      if (t.provider !== provider) return t
      if (provider === 'hubspot') {
        return { ...t, crmIntegrationId: bindingId }
      }
      return { ...t, integrationId: bindingId }
    })
    emit({ ...features, tools: nextTools })
  }

  const setProviderSpecialty = (provider: string, specialty: string) => {
    const nextTools = features.tools.map((t) =>
      t.provider === provider
        ? { ...t, config: { ...t.config, specialty } }
        : t
    )
    emit({ ...features, tools: nextTools })
  }

  const setProviderActive = (provider: string, active: boolean) => {
    if (active) {
      setActiveProviders((prev) => new Set(prev).add(provider))
      return
    }
    setActiveProviders((prev) => {
      const next = new Set(prev)
      next.delete(provider)
      return next
    })
    emit({
      ...features,
      tools: features.tools.filter((t) => t.provider !== provider),
    })
  }

  const setToolEnabled = (tool: CatalogTool, enabled: boolean) => {
    const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
    const integrations = catalog?.integrationsByProvider?.[tool.provider] || []
    const bindingId = getProviderBindingId(tool.provider) || integrations[0]?.id

    let nextTools = features.tools.filter((t) => t.toolKey !== key)

    if (enabled) {
      setActiveProviders((prev) => new Set(prev).add(tool.provider))
      const specialty = getProviderSpecialty(tool.provider)
      nextTools.push({
        toolKey: key,
        provider: tool.provider,
        toolName: tool.toolName,
        enabled: true,
        integrationId:
          tool.provider !== 'hubspot' && tool.requiresIntegrationId
            ? bindingId
            : undefined,
        crmIntegrationId:
          tool.provider === 'hubspot' && tool.requiresCrmIntegrationId
            ? bindingId
            : undefined,
        config:
          tool.provider === 'calendly' && specialty
            ? { specialty }
            : tool.provider === 'calendly'
              ? { specialty: 'reuniao_diagnostico' }
              : undefined,
      })
    }

    emit({ ...features, tools: nextTools })
  }

  const applySchedulingPreset = () => {
    const preset = catalog?.presets?.find((p) => p.id === 'conversational_scheduling')
    if (!preset) return
    const integrations = catalog?.integrationsByProvider?.calendly || []
    const integrationId = integrations[0]?.id
    if (!integrationId) return

    setActiveProviders((prev) => new Set(prev).add('calendly'))
    const specialty = 'reuniao_diagnostico'
    let nextTools = features.tools.filter((t) => t.provider !== 'calendly')

    for (const toolKey of preset.toolKeys) {
      const cat = catalog?.tools.find((t) => t.toolKey === toolKey)
      if (!cat) continue
      nextTools.push({
        toolKey,
        provider: cat.provider,
        toolName: cat.toolName,
        enabled: true,
        integrationId,
        config: { specialty },
      })
    }

    emit({ ...features, tools: nextTools })
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-4 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando integrações…
      </div>
    )
  }

  if (!catalog?.availableProviders?.length) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed p-4 text-sm text-muted-foreground',
          className
        )}
      >
        Conecte integrações em <strong>Configurações → Integrações</strong> para habilitar
        ferramentas neste agente.
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Ative cada integração que este agente pode usar. As ferramentas aparecem só depois de
        ligar a integração.
      </p>

      {features.demo === 'onsmart_sonia' && agentId && (
        <Collapsible open={healthOpen} onOpenChange={setHealthOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs hover:bg-muted/40"
            >
              <span className="font-medium">Status da demo Onsmart</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {healthLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {health && (
                  <span className={health.ok ? 'text-emerald-500' : 'text-amber-500'}>
                    {health.ok ? 'OK' : 'Atenção'}
                  </span>
                )}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', healthOpen && 'rotate-180')}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5 rounded-md border bg-muted/20 px-3 py-2">
            {health?.checks?.map((c) => (
              <div key={c.id} className="flex gap-2 text-xs text-muted-foreground">
                {statusIcon(c.status)}
                <span>{c.message}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {catalog.presets?.some((p) => p.id === 'conversational_scheduling') &&
        !activeProviders.has('calendly') && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={applySchedulingPreset}
          >
            Atalho: agendamento conversacional (Calendly)
          </Button>
        )}

      <div className="space-y-2">
        {catalog.availableProviders.map((provider) => {
          const meta = PROVIDER_META[provider] || {
            description: 'Integração conectada',
          }
          const label = catalog.providerLabels?.[provider] || provider
          const integrations = catalog.integrationsByProvider[provider] || []
          const tools = toolsByProvider.get(provider) || []
          const isActive = activeProviders.has(provider)
          const bindingId = getProviderBindingId(provider) || integrations[0]?.id || ''
          const enabledToolCount = tools.filter((t) =>
            toolStateMap.get(t.toolKey || buildToolKey(t.provider, t.toolName))?.enabled
          ).length

          return (
            <div
              key={provider}
              className={cn(
                'rounded-lg border transition-colors',
                isActive ? 'border-primary/30 bg-primary/5' : 'border-border/80'
              )}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <IntegrationBrandIcon provider={provider} size="sm" boxed />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-none">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(v) => setProviderActive(provider, v)}
                  aria-label={`Ativar ${label}`}
                />
              </div>

              {isActive && (
                <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-2">
                  {integrations.length > 1 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Conta</Label>
                      <Select
                        value={bindingId || undefined}
                        onValueChange={(v) => setProviderBindingId(provider, v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {integrations.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {integrations.length === 1 && (
                    <p className="text-xs text-muted-foreground">
                      Conta: <span className="text-foreground">{integrations[0].label}</span>
                    </p>
                  )}

                  {provider === 'calendly' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo de evento</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="reuniao_diagnostico"
                        value={getProviderSpecialty(provider) || 'reuniao_diagnostico'}
                        onChange={(e) => setProviderSpecialty(provider, e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Ferramentas disponíveis
                      </Label>
                      {enabledToolCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {enabledToolCount} ativa(s)
                        </span>
                      )}
                    </div>
                    <ul className="divide-y divide-border/60 rounded-md border bg-background/60">
                      {tools.map((tool) => {
                        const key =
                          tool.toolKey || buildToolKey(tool.provider, tool.toolName)
                        const enabled = Boolean(toolStateMap.get(key)?.enabled)

                        return (
                          <li
                            key={key}
                            className="flex items-start gap-3 px-3 py-2.5 first:rounded-t-md last:rounded-b-md"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-tight">{tool.displayName}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                {tool.description}
                              </p>
                            </div>
                            <Switch
                              className="mt-0.5 shrink-0"
                              checked={enabled}
                              onCheckedChange={(v) => setToolEnabled(tool, v)}
                              disabled={!bindingId && integrations.length > 0}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
