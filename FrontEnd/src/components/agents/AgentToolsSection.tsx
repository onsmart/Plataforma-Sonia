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
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Input } from '../ui/input'
import { Calendar, Mail, MessageCircle, Database, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

type CatalogTool = {
  toolKey: string
  provider: string
  toolName: string
  displayName: string
  description: string
  providerLabel?: string
  requiresIntegrationId?: boolean
  requiresCrmIntegrationId?: boolean
}

type IntegrationOption = { id: string; label: string; isActive?: boolean }

type SetupPreset = {
  id: string
  name: string
  description: string
  toolKeys: string[]
  provider: string
}

type CatalogResponse = {
  tools: CatalogTool[]
  availableProviders: string[]
  integrationsByProvider: Record<string, IntegrationOption[]>
  providerLabels: Record<string, string>
  presets: SetupPreset[]
}

type SetupHealthCheck = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  message: string
}

const PROVIDER_ICONS: Record<string, typeof Calendar> = {
  calendly: Calendar,
  hubspot: Database,
  whatsapp: MessageCircle,
  email: Mail,
}

export interface AgentToolsSectionProps {
  extraFeaturesJson: string
  onExtraFeaturesChange: (json: string) => void
  agentId?: string
  className?: string
}

function statusIcon(status: SetupHealthCheck['status']) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'warn') return <AlertCircle className="h-4 w-4 text-amber-500" />
  return <XCircle className="h-4 w-4 text-red-500" />
}

export function AgentToolsSection({
  extraFeaturesJson,
  onExtraFeaturesChange,
  agentId,
  className,
}: AgentToolsSectionProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<{ ok: boolean; checks: SetupHealthCheck[] } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

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

  const toolStateMap = useMemo(() => {
    const map = new Map<string, AgentToolEntry>()
    for (const t of features.tools) {
      map.set(t.toolKey, t)
    }
    return map
  }, [features.tools])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/integrations/tools/catalog/for-setup`, {
          headers: await getAuthHeaders(false),
        })
        const data = await res.json()
        if (!cancelled && res.ok) {
          setCatalog(data)
        }
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

  const setToolEnabled = (tool: CatalogTool, enabled: boolean) => {
    const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
    const existing = toolStateMap.get(key)
    const integrations = catalog?.integrationsByProvider?.[tool.provider] || []
    const defaultId = integrations[0]?.id

    const nextTools = features.tools.filter((t) => t.toolKey !== key)
    if (enabled) {
      nextTools.push({
        toolKey: key,
        provider: tool.provider,
        toolName: tool.toolName,
        enabled: true,
        integrationId:
          existing?.integrationId ||
          (tool.requiresIntegrationId ? defaultId : undefined),
        crmIntegrationId:
          existing?.crmIntegrationId ||
          (tool.requiresCrmIntegrationId ? defaultId : undefined),
        config: existing?.config,
      })
    }

    emit({ ...features, tools: nextTools })
  }

  const updateToolField = (
    toolKey: string,
    patch: Partial<AgentToolEntry>
  ) => {
    const nextTools = features.tools.map((t) =>
      t.toolKey === toolKey ? { ...t, ...patch } : t
    )
    emit({ ...features, tools: nextTools })
  }

  const applyPreset = (preset: SetupPreset) => {
    const integrations = catalog?.integrationsByProvider?.[preset.provider] || []
    const integrationId = integrations[0]?.id
    let nextTools = [...features.tools]

    for (const toolKey of preset.toolKeys) {
      const cat = catalog?.tools.find((t) => t.toolKey === toolKey)
      if (!cat) continue
      nextTools = nextTools.filter((t) => t.toolKey !== toolKey)
      nextTools.push({
        toolKey,
        provider: cat.provider,
        toolName: cat.toolName,
        enabled: true,
        integrationId,
        config:
          cat.provider === 'calendly'
            ? { specialty: 'reuniao_diagnostico' }
            : undefined,
      })
    }

    emit({ ...features, tools: nextTools })
  }

  const toolsByProvider = useMemo(() => {
    if (!catalog?.tools?.length) return []
    const groups = new Map<string, CatalogTool[]>()
    for (const tool of catalog.tools) {
      const list = groups.get(tool.provider) || []
      list.push(tool)
      groups.set(tool.provider, list)
    }
    return Array.from(groups.entries())
  }, [catalog])

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-6 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando ferramentas disponíveis…
      </div>
    )
  }

  if (!catalog?.availableProviders?.length) {
    return (
      <div className={cn('rounded-lg border border-dashed p-4 text-sm text-muted-foreground', className)}>
        Nenhuma integração conectada. Vá em <strong>Configurações → Integrações</strong> para conectar
        Calendly, WhatsApp, HubSpot ou E-mail.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {features.demo === 'onsmart_sonia' && agentId && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Checklist demo Onsmart</Label>
            {healthLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          {health?.checks?.map((c) => (
            <div key={c.id} className="flex gap-2 text-xs">
              {statusIcon(c.status)}
              <span>
                <strong>{c.label}:</strong> {c.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {catalog.presets?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {catalog.presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      )}

      {toolsByProvider.map(([provider, tools]) => {
        const Icon = PROVIDER_ICONS[provider] || Database
        const label = catalog.providerLabels?.[provider] || provider
        const integrations = catalog.integrationsByProvider[provider] || []

        return (
          <div key={provider} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{label}</span>
              <Badge variant="secondary" className="text-[10px]">
                {integrations.length} conta(s)
              </Badge>
            </div>

            {tools.map((tool) => {
              const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
              const entry = toolStateMap.get(key)
              const enabled = Boolean(entry?.enabled)

              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{tool.displayName}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{tool.description}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/80">{key}</p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={(v) => setToolEnabled(tool, v)} />
                  </div>

                  {enabled && tool.requiresIntegrationId && integrations.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Conta</Label>
                      <Select
                        value={entry?.integrationId || integrations[0]?.id}
                        onValueChange={(v) => updateToolField(key, { integrationId: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
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

                  {enabled && tool.requiresCrmIntegrationId && integrations.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Integração CRM</Label>
                      <Select
                        value={entry?.crmIntegrationId || integrations[0]?.id}
                        onValueChange={(v) => updateToolField(key, { crmIntegrationId: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
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

                  {enabled &&
                    provider === 'calendly' &&
                    (tool.toolName === 'check_availability' || tool.toolName === 'book_appointment') && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de evento (specialty)</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder="reuniao_diagnostico"
                          value={entry?.config?.specialty || ''}
                          onChange={(e) =>
                            updateToolField(key, {
                              config: { specialty: e.target.value },
                            })
                          }
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Deve coincidir com o mapeamento em Integrações → Calendly.
                        </p>
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
