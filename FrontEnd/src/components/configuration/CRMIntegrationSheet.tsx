import React, { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { Database, Key, Loader2, Save, FlaskConical } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { toast } from "sonner"
import { BASE_URL, getAuthHeaders } from "../../services/api"

interface CRM {
  id: string
  slug: string
  name: string
  type: 'oauth' | 'api_key' | 'webhook'
  description?: string
  source?: 'database' | 'catalog'
}

const SUPPORTED_CRM_SLUGS = ['hubspot', 'mailchimp'] as const
const MASKED_SECRET_VALUE = "************"
const isMaskedSecretValue = (value: string) => value === MASKED_SECRET_VALUE
const normalizeSecretInput = (nextValue: string, currentValue: string) =>
  isMaskedSecretValue(currentValue) ? nextValue.replace(MASKED_SECRET_VALUE, '') : nextValue

const DEFAULT_CRM_CATALOG: CRM[] = [
  {
    id: 'catalog:hubspot',
    slug: 'hubspot',
    name: 'HubSpot',
    type: 'api_key',
    description: 'CRM, marketing e vendas via Private App token.',
    source: 'catalog',
  },
  {
    id: 'catalog:mailchimp',
    slug: 'mailchimp',
    name: 'Mailchimp',
    type: 'api_key',
    description: 'Audiencias, campanhas e automacoes de marketing.',
    source: 'catalog',
  },
]

const getCRMProviderMeta = (slug?: string) => {
  if (slug === 'hubspot') {
    return {
      authMode: 'private_app_token',
      credentialLabel: 'Token privado do HubSpot',
      credentialPlaceholder: 'Cole o token privado do HubSpot aqui...',
      credentialHelpText: 'Use um Private App token com escopos de contatos e negocios para o agente acessar o CRM.',
      storedCredentialLabel: 'private_app_token',
    }
  }

  return {
    authMode: 'api_key',
    credentialLabel: 'API Key do Mailchimp',
    credentialPlaceholder: 'Cole a API Key do Mailchimp aqui...',
    credentialHelpText: 'Use uma API Key da Marketing API. O data center sera identificado pelo sufixo da chave quando disponivel.',
    storedCredentialLabel: 'api_key',
  }
}

interface CRMIntegrationSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
}

export function CRMIntegrationSheet({ isOpen, onClose, onSave }: CRMIntegrationSheetProps) {
  const { user, userId } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [availableCRMs, setAvailableCRMs] = useState<CRM[]>([])
  const [selectedCRMId, setSelectedCRMId] = useState<string>('')
  const [credentialValue, setCredentialValue] = useState<string>('')
  const [mailchimpListId, setMailchimpListId] = useState<string>('')
  const [selectedCRM, setSelectedCRM] = useState<CRM | null>(null)
  const [hasStoredCredential, setHasStoredCredential] = useState(false)
  const [existingCRMConfig, setExistingCRMConfig] = useState<Record<string, unknown> | null>(null)
  const [existingIntegrationId, setExistingIntegrationId] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [lastTestSummary, setLastTestSummary] = useState<string | null>(null)

  const isHubSpot = selectedCRM?.slug === 'hubspot'
  const isMailchimp = selectedCRM?.slug === 'mailchimp'
  const providerMeta = getCRMProviderMeta(selectedCRM?.slug)
  const requiresCredential = !!selectedCRM
  const supportsDirectSave = !!selectedCRM && SUPPORTED_CRM_SLUGS.includes(selectedCRM.slug as typeof SUPPORTED_CRM_SLUGS[number])

  useEffect(() => {
    if (isOpen) {
      void loadAvailableCRMs()
    }
  }, [isOpen])

  useEffect(() => {
    if (!selectedCRMId || availableCRMs.length === 0) return

    const crm = availableCRMs.find((item) => item.id === selectedCRMId) || null
    setSelectedCRM(crm)
    setCredentialValue('')
    setHasStoredCredential(false)
    setExistingCRMConfig(null)
    setExistingIntegrationId(null)
    setLastTestSummary(null)
    if (crm) {
      void loadExistingCredentialState(crm)
    }
  }, [selectedCRMId, availableCRMs])

  const loadExistingCredentialState = async (crm: CRM) => {
    if (!user?.email) return
    try {
      const response = await fetch(
        `${BASE_URL}/crm/integrations?slug=${encodeURIComponent(crm.slug)}`,
        { headers: await getAuthHeaders() }
      )
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(json?.details || json?.error || 'Erro ao carregar integracao CRM.')
      }

      const existing = Array.isArray(json?.integrations) ? json.integrations[0] : null
      if (!existing) return

      const config =
        existing.config && typeof existing.config === 'object' && !Array.isArray(existing.config)
          ? (existing.config as Record<string, unknown>)
          : null
      const credentialExists = existing.credential_present === true

      setExistingCRMConfig(config)
      setExistingIntegrationId(existing.id ? String(existing.id) : null)
      setHasStoredCredential(credentialExists)
      setCredentialValue(credentialExists ? MASKED_SECRET_VALUE : '')
      setMailchimpListId(String(config?.default_list_id || '').trim())
      const lastMessage = String(config?.last_test_message || '').trim()
      setLastTestSummary(lastMessage || null)
    } catch (error) {
      console.warn('Erro ao verificar credencial CRM existente:', error)
    }
  }

  const loadAvailableCRMs = async () => {
    setIsFetching(true)
    try {
      setAvailableCRMs(
        [...DEFAULT_CRM_CATALOG].sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (error: any) {
      console.error('Erro ao carregar CRMs:', error)
      toast.error('Erro ao carregar CRMs disponiveis')
    } finally {
      setIsFetching(false)
    }
  }

  const resetForm = () => {
    setSelectedCRMId('')
    setCredentialValue('')
    setMailchimpListId('')
    setSelectedCRM(null)
    setHasStoredCredential(false)
    setExistingCRMConfig(null)
    setExistingIntegrationId(null)
    setLastTestSummary(null)
  }

  const handleTestConnection = async () => {
    if (!isHubSpot) {
      toast.error('Teste de conexao disponivel apenas para HubSpot nesta versao.')
      return
    }

    const credentialToTest = isMaskedSecretValue(credentialValue) ? '' : credentialValue.trim()
    if (!credentialToTest && !existingIntegrationId) {
      toast.error('Informe o token do HubSpot ou salve a integracao antes de testar.')
      return
    }

    setTesting(true)
    try {
      const response = credentialToTest
        ? await fetch(`${BASE_URL}/crm/integrations/test`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              provider: 'hubspot',
              token: credentialToTest,
            }),
          })
        : await fetch(`${BASE_URL}/crm/integrations/${existingIntegrationId}/test`, {
            method: 'POST',
            headers: await getAuthHeaders(),
          })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(json?.details || json?.error || 'Erro ao testar integracao HubSpot.')
      }

      const result = json?.result || {}
      setLastTestSummary(String(result.message || ''))

      if (result.success) {
        toast.success(
          `HubSpot conectado. Portal ${result.portalId || 'OK'} · CRM ${result.crmSchemaAccessVerified ? 'liberado' : 'parcial'}.`
        )
        if (existingIntegrationId) {
          await onSave()
        }
      } else {
        toast.error(result.message || 'Falha ao validar o HubSpot.')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao testar integracao HubSpot.')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!user?.email || !userId) {
      toast.error('Usuario nao autenticado')
      return
    }

    if (!selectedCRMId) {
      toast.error('Selecione um CRM')
      return
    }

    if (!selectedCRM) {
      toast.error('CRM selecionado invalido')
      return
    }

    if (!SUPPORTED_CRM_SLUGS.includes(selectedCRM.slug as typeof SUPPORTED_CRM_SLUGS[number])) {
      toast.error('Apenas HubSpot e Mailchimp estao disponiveis nesta versao.')
      return
    }

    if (!supportsDirectSave) {
      toast.error('Este CRM ainda nao esta disponivel nesta tela.')
      return
    }

    const credentialToSave = isMaskedSecretValue(credentialValue)
      ? ''
      : credentialValue.trim()

    if (requiresCredential && !credentialToSave && !hasStoredCredential) {
      toast.error(isHubSpot ? 'Informe o token privado do HubSpot.' : 'Informe a API Key do Mailchimp.')
      return
    }

    setIsLoading(true)
    try {
      const trimmedMailchimpListId = mailchimpListId.trim()
      const response = await fetch(`${BASE_URL}/crm/integrations`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          integrationId: existingIntegrationId,
          providerSlug: selectedCRM.slug,
          providerName: selectedCRM.name,
          providerType: selectedCRM.type,
          description: selectedCRM.description,
          credential: credentialToSave || undefined,
          mailchimpListId: trimmedMailchimpListId || undefined,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(json?.details || json?.error || 'Erro ao salvar integracao de CRM.')
      }

      toast.success(
        existingIntegrationId
          ? 'Integracao de CRM atualizada com sucesso!'
          : 'Integracao de CRM criada com sucesso!'
      )

      resetForm()
      await onSave()
      onClose()
    } catch (error: any) {
      console.error('Erro ao salvar integracao CRM:', error)
      toast.error(error.message || 'Erro ao salvar integracao de CRM')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex h-full w-full max-w-[100vw] flex-col overflow-hidden border-l border-border/70 bg-zinc-950/98 px-0 text-zinc-50 backdrop-blur-xl sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-white/10 px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/18 via-blue-500/14 to-indigo-500/18 text-cyan-300 shadow-[0_10px_30px_-18px_rgba(34,211,238,0.9)]">
              <Database className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-lg font-black tracking-tight text-zinc-50 sm:text-xl">Conectar CRM</SheetTitle>
              <SheetDescription className="text-sm leading-6 text-zinc-400">
                Configure a integracao com seu CRM para que os agentes possam acessar dados.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isFetching ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-zinc-400 sm:px-6">
            <Loader2 className="mb-4 h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando CRMs disponiveis...</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label htmlFor="crm-select" className="flex items-center gap-2 text-base font-bold text-zinc-100">
                    <Database className="h-4 w-4 text-cyan-300" />
                    Selecione o CRM
                  </Label>
                  <p className="text-xs leading-5 text-zinc-400">
                    Escolha o provedor que os agentes vão usar para consultar e atualizar dados.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                  CRM
                </Badge>
              </div>
              <Select value={selectedCRMId} onValueChange={setSelectedCRMId}>
                <SelectTrigger
                  id="crm-select"
                  className="h-14 rounded-2xl border-white/10 bg-zinc-900/80 px-4 text-left text-zinc-100 shadow-none transition-colors hover:border-cyan-400/30 focus:border-cyan-400/50 focus:ring-0"
                >
                  <SelectValue placeholder="Escolha um CRM..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/10 bg-zinc-950 text-zinc-100">
                  {availableCRMs.map((crm) => (
                    <SelectItem key={crm.id} value={crm.id} className="rounded-xl focus:bg-white/10 focus:text-zinc-50">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 font-medium">
                          {crm.name}
                          {crm.source === 'catalog' && <Badge variant="outline" className="h-5 rounded-md border-emerald-400/30 bg-emerald-400/10 px-1.5 text-[10px] text-emerald-200">Novo</Badge>}
                        </span>
                        {crm.description && (
                          <span className="text-xs text-zinc-400">{crm.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableCRMs.length === 0 && (
                <p className="mt-3 text-xs text-zinc-500">Nenhum CRM disponivel no momento.</p>
              )}
            </div>

            {selectedCRM && (
              <div className="space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Tipo de autenticacao:</span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                    {selectedCRM.type}
                  </span>
                </div>
                {selectedCRM.description && (
                  <p className="text-xs leading-5 text-zinc-400">{selectedCRM.description}</p>
                )}
                {isHubSpot && (
                  <p className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-3 py-3 text-xs leading-5 text-cyan-100/90">
                    HubSpot foi ajustado para usar token privado e ficar disponivel no escopo da empresa.
                  </p>
                )}
                {selectedCRM.source === 'catalog' && (
                  <p className="rounded-2xl border border-emerald-400/15 bg-emerald-400/8 px-3 py-3 text-xs leading-5 text-emerald-100/90">
                    Este provedor sera adicionado ao catalogo da plataforma quando a integracao for salva.
                  </p>
                )}
              </div>
            )}

            {requiresCredential && (
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <Label htmlFor="crm-credential" className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                  <Key className="h-4 w-4 text-amber-300" />
                  {providerMeta.credentialLabel}
                </Label>
                <Input
                  id="crm-credential"
                  type="password"
                  placeholder={hasStoredCredential ? 'Credencial salva - digite para rotacionar' : providerMeta.credentialPlaceholder}
                  value={credentialValue}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(e) => setCredentialValue((current) => normalizeSecretInput(e.target.value, current))}
                  onBlur={() => {
                    if (hasStoredCredential && !credentialValue.trim()) {
                      setCredentialValue(MASKED_SECRET_VALUE)
                    }
                  }}
                  className="h-[52px] rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
                <p className="text-xs leading-5 text-zinc-400">{providerMeta.credentialHelpText}</p>
                {isHubSpot && (
                  <p className="rounded-2xl border border-emerald-400/15 bg-emerald-400/8 px-3 py-3 text-xs leading-5 text-emerald-100/90">
                    O teste de conexao valida apenas autenticacao e permissao da API. Nenhum dado pessoal de contatos e exibido (LGPD).
                  </p>
                )}
                {lastTestSummary && (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-5 text-zinc-300">
                    Ultimo teste: {lastTestSummary}
                  </p>
                )}
              </div>
            )}

            {isMailchimp && (
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <Label htmlFor="mailchimp-list-id" className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                  <Database className="h-4 w-4 text-cyan-300" />
                  Audience/List ID padrao
                </Label>
                <Input
                  id="mailchimp-list-id"
                  placeholder="Ex: a1b2c3d4e5"
                  value={mailchimpListId}
                  onChange={(e) => setMailchimpListId(e.target.value)}
                  className="h-[52px] rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                />
                <p className="text-xs leading-5 text-zinc-400">
                  Opcional para leitura. Recomendado para criar e atualizar contatos no Mailchimp.
                </p>
              </div>
            )}

            {selectedCRM?.type === 'oauth' && !isHubSpot && (
              <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-4">
                <p className="text-sm leading-6 text-blue-100">
                  Este CRM usa OAuth e ainda precisa de um fluxo dedicado nesta tela.
                </p>
              </div>
            )}

            {selectedCRM?.type === 'webhook' && (
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-sm leading-6 text-emerald-100">
                  Este CRM usa webhook. Configure o endpoint correspondente nas configuracoes do provedor.
                </p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="mt-auto flex shrink-0 flex-col gap-3 border-t border-white/10 bg-zinc-950/98 px-4 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <SheetClose asChild>
            <Button
              variant="outline"
              disabled={isLoading || testing}
              className="h-12 w-full rounded-2xl border-white/10 bg-white/[0.03] px-5 font-semibold text-zinc-100 hover:bg-white/[0.06] hover:text-zinc-50 sm:w-auto"
            >
              Cancelar
            </Button>
          </SheetClose>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isHubSpot && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isLoading || testing || !selectedCRMId}
                className="h-12 w-full rounded-2xl border-cyan-400/30 bg-cyan-400/10 px-5 font-semibold text-cyan-100 hover:bg-cyan-400/15 sm:w-auto"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Testar conexao
                  </>
                )}
              </Button>
            )}
          <Button
            onClick={handleSave}
            disabled={isLoading || testing || !selectedCRMId || !supportsDirectSave}
            className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-5 font-bold text-white shadow-[0_16px_32px_-16px_rgba(59,130,246,0.85)] transition-all hover:brightness-110 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Integracao
              </>
            )}
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
