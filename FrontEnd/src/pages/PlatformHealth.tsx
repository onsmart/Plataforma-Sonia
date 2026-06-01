import { useEffect, useState } from 'react'
import { AgentService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Loader2 } from 'lucide-react'

type PlatformHealthResponse = {
  environment?: string
  version?: string
  uptimeSeconds?: number
  checks?: Record<string, boolean>
  recentAuditEvents?: Array<{ action: string; created_at: string; resource_type?: string | null }>
}

export function PlatformHealth() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlatformHealthResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await AgentService.getPlatformHealth()
        if (!cancelled) setData(result)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar saúde da plataforma')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Saúde da plataforma</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600">{error}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Saúde da plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Ambiente: {data?.environment} · Versão: {data?.version} · Uptime: {data?.uptimeSeconds ?? 0}s
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(data?.checks || {}).map(([key, ok]) => (
            <div key={key} className="flex justify-between border-b border-border/40 py-1">
              <span>{key}</span>
              <span className={ok ? 'text-emerald-600' : 'text-red-600'}>{ok ? 'OK' : 'Falha'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos de auditoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(data?.recentAuditEvents || []).length === 0 ? (
            <p className="text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            (data?.recentAuditEvents || []).map((event, index) => (
              <div key={`${event.action}-${index}`} className="border-b border-border/40 py-1">
                <div className="font-medium">{event.action}</div>
                <div className="text-xs text-muted-foreground">{event.created_at}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PlatformHealth
