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
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { IntegrationBrandIcon } from '../integrations/IntegrationBrandIcon'
import {
  agentConfigFieldHint,
  agentConfigFieldLabel,
  agentConfigInnerPanel,
  agentConfigInput,
} from '../../lib/agent-config-layout'

type CatalogTool = {
  toolKey: string
  provider: string
  toolName: string
  displayName: string
  description: string
  requiresIntegrationId?: boolean
  requiresCrmIntegrationId?: boolean
}

type IntegrationOption = { id: string; label: string; isActive?: boolean }

const SETUP_PROVIDER_ORDER = ['calendly', 'hubspot', 'whatsapp'] as const

type CatalogResponse = {
  tools: CatalogTool[]
  availableProviders: string[]
  setupProviders?: string[]
  integrationsByProvider: Record<string, IntegrationOption[]>
  providerLabels: Record<string, string>
  platformTemplateIntegrationSection?: string
  presets?: Array<{
    id: string
    name: string
    description: string
    toolKeys: string[]
    provider: string
    templateRoleAppendix?: string
  }>
}

const PROVIDER_META: Record<string, { description: string }> = {
  calendly: { description: 'Agenda e reuniões via Calendly' },
  hubspot: { description: 'Contatos e CRM HubSpot' },
  whatsapp: { description: 'Mensagens e templates WhatsApp' },
}

export interface AgentToolsSectionProps {
  extraFeaturesJson: string
  onExtraFeaturesChange: (json: string) => void
  agentId?: string
  className?: string
}

export function AgentToolsSection({
  extraFeaturesJson,
  onExtraFeaturesChange,
  className,
}: AgentToolsSectionProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
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

  const providersToShow = useMemo(() => {
    const fromApi = catalog?.setupProviders?.length
      ? catalog.setupProviders
      : catalog?.availableProviders?.length
        ? catalog.availableProviders
        : []
    const merged = new Set<string>([...SETUP_PROVIDER_ORDER, ...fromApi])
    return SETUP_PROVIDER_ORDER.filter((p) => merged.has(p))
  }, [catalog])

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

  const getProviderBindingId = (provider: string): string => {
    const row = features.tools.find(
      (t) => t.provider === provider && (t.integrationId || t.crmIntegrationId)
    )
    if (provider === 'hubspot') return row?.crmIntegrationId || ''
    return row?.integrationId || ''
  }

  const getProviderSpecialty = (provider: string): string => {
    const row = features.tools.find((t) => t.provider === provider && t.config?.specialty)
    return row?.config?.specialty || ''
  }

  const setProviderBindingId = (provider: string, bindingId: string) => {
    const nextTools = features.tools.map((t) => {
      if (t.provider !== provider) return t
      if (provider === 'hubspot') return { ...t, crmIntegrationId: bindingId }
      return { ...t, integrationId: bindingId }
    })
    emit({ ...features, tools: nextTools })
  }

  const setProviderSpecialty = (provider: string, specialty: string) => {
    const nextTools = features.tools.map((t) =>
      t.provider === provider ? { ...t, config: { ...t.config, specialty } } : t
    )
    emit({ ...features, tools: nextTools })
  }

  const setProviderActive = (provider: string, active: boolean) => {
    if (active) {
      const accounts = catalog?.integrationsByProvider?.[provider] || []
      const usable = accounts.filter((a) => a.isActive !== false)
      if (usable.length === 0) return
      setActiveProviders((prev) => new Set(prev).add(provider))
      return
    }
    setActiveProviders((prev) => {
      const next = new Set(prev)
      next.delete(provider)
      return next
    })
    emit({ ...features, tools: features.tools.filter((t) => t.provider !== provider) })
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
          tool.provider !== 'hubspot' && tool.requiresIntegrationId ? bindingId : undefined,
        crmIntegrationId:
          tool.provider === 'hubspot' && tool.requiresCrmIntegrationId ? bindingId : undefined,
        config: tool.provider === 'calendly' && specialty ? { specialty } : undefined,
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
    const specialty = getProviderSpecialty('calendly')
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
        ...(specialty ? { config: { specialty } } : {}),
      })
    }

    emit({ ...features, tools: nextTools })
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-8 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando integrações…
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className={cn(agentConfigInnerPanel, 'border-dashed text-sm text-muted-foreground', className)}>
        Não foi possível carregar o catálogo. Recarregue a página ou verifique o backend.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {catalog.presets?.some((p) => p.id === 'conversational_scheduling') &&
        !activeProviders.has('calendly') && (
          <Button type="button" variant="secondary" size="sm" className="h-9 rounded-lg text-xs" onClick={applySchedulingPreset}>
            Atalho: pacote Calendly (agendamento conversacional)
          </Button>
        )}

      {activeProviders.has('calendly') &&
        toolStateMap.get('calendly.check_availability')?.enabled &&
        toolStateMap.get('calendly.book_appointment')?.enabled && (
          <div className={cn(agentConfigInnerPanel, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
            <div>
              <p className="text-sm font-medium">Motor passo a passo (legado)</p>
              <p className={agentConfigFieldHint}>Use apenas se o template exigir o fluxo antigo em código.</p>
            </div>
            <Switch
              checked={features.scheduling_engine === 'coordinator'}
              onCheckedChange={(checked) => {
                emit({ ...features, scheduling_engine: checked ? 'coordinator' : 'template' })
              }}
            />
          </div>
        )}

      <div className="grid gap-3">
        {providersToShow.map((provider) => {
          const meta = PROVIDER_META[provider] || { description: 'Integração conectada' }
          const label = catalog.providerLabels?.[provider] || provider
          const integrations = catalog.integrationsByProvider[provider] || []
          const usableIntegrations = integrations.filter((i) => i.isActive !== false)
          const hasConnection = usableIntegrations.length > 0
          const tools = toolsByProvider.get(provider) || []
          const isActive = activeProviders.has(provider)
          const bindingId =
            getProviderBindingId(provider) || usableIntegrations[0]?.id || integrations[0]?.id || ''
          const enabledToolCount = tools.filter((t) =>
            toolStateMap.get(t.toolKey || buildToolKey(t.provider, t.toolName))?.enabled
          ).length

          return (
            <div
              key={provider}
              className={cn(
                'overflow-hidden rounded-xl border transition-colors',
                isActive && hasConnection
                  ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10'
                  : 'border-border/50 bg-card/40'
              )}
            >
              <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3.5 sm:px-5">
                <IntegrationBrandIcon provider={provider} size="sm" boxed />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    {enabledToolCount > 0 ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {enabledToolCount} ativa(s)
                      </span>
                    ) : null}
                  </div>
                  <p className={agentConfigFieldHint}>{meta.description}</p>
                </div>
                <Switch
                  checked={isActive && hasConnection}
                  disabled={!hasConnection}
                  onCheckedChange={(v) => setProviderActive(provider, v)}
                  aria-label={`Ativar ${label}`}
                />
              </div>

              {!hasConnection && (
                <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
                  {integrations.length === 0
                    ? 'Conecte em Configurações → Integrações.'
                    : 'Conta desativada — reative em Integrações.'}
                </p>
              )}

              {isActive && hasConnection && (
                <div className="space-y-4 px-4 py-4 sm:px-5">
                  {integrations.length > 1 && (
                    <div className="space-y-2">
                      <Label className={agentConfigFieldLabel}>Conta vinculada</Label>
                      <Select value={bindingId || undefined} onValueChange={(v) => setProviderBindingId(provider, v)}>
                        <SelectTrigger className={cn(agentConfigInput, 'h-10')}><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {integrations.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {integrations.length === 1 && (
                    <p className="text-xs text-muted-foreground">
                      Conta: <span className="font-medium text-foreground">{integrations[0].label}</span>
                    </p>
                  )}

                  {provider === 'calendly' && (
                    <div className="space-y-2">
                      <Label className={agentConfigFieldLabel}>Chave de roteamento</Label>
                      <Input
                        className={cn(agentConfigInput, 'h-10')}
                        placeholder="ex.: consulta_30min"
                        value={getProviderSpecialty(provider)}
                        onChange={(e) => setProviderSpecialty(provider, e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className={agentConfigFieldLabel}>Ferramentas</Label>
                    <ul className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/40">
                      {tools.map((tool) => {
                        const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
                        const enabled = Boolean(toolStateMap.get(key)?.enabled)
                        return (
                          <li key={key} className="flex items-center gap-3 bg-background/40 px-3 py-3 sm:px-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{tool.displayName}</p>
                              <p className={cn(agentConfigFieldHint, 'line-clamp-2')}>{tool.description}</p>
                            </div>
                            <Switch
                              className="shrink-0"
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
