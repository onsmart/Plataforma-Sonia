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
import { CheckCircle2, Key, Loader2, Save, ShieldCheck } from "lucide-react"
import { IntegrationBrandIcon } from "../integrations/IntegrationBrandIcon"
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

const HUBSPOT_CAPABILITIES = [
  'Consultar contatos no CRM',
  'Criar e atualizar contatos',
  'Buscar negocios (deals)',
  'Usar integracao em fluxos e agentes',
] as const

const HUBSPOT_REQUIRED_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.schemas.contacts.read',
] as const

const HUBSPOT_OPTIONAL_PROPERTIES = [
  'lead_source',
  'last_flow_channel',
] as const

const HUBSPOT_SETUP_STEPS = [
  'No HubSpot: Configuracoes → Integracoes → Private Apps → Criar app (ou editar existente).',
  'Na aba Scopes, habilite leitura/escrita de contatos e leitura de negocios (deals).',
  'Na aba Auth, clique em "Show token" e copie o Access token (comeca com pat-).',
  'Cole o token aqui, clique em Salvar integracao e depois em Testar conexao.',
] as const

const normalizeHubSpotTokenInput = (value: string) => {
  let token = value.trim()
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, '').trim()
  }
  return token.replace(/^['"]|['"]$/g, '').trim()
}

const getCRMProviderMeta = (slug?: string) => {
  if (slug === 'hubspot') {
    return {
      authMode: 'private_app_token',
      credentialLabel: 'Access token (Private App)',
      credentialPlaceholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      credentialHelpText:
        'Cole apenas o Access token da aba Auth do Private App. Nao use Client secret, App ID nem chave legada.',
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

    const credentialToTest = isMaskedSecretValue(credentialValue)
      ? ''
      : normalizeHubSpotTokenInput(credentialValue)
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
        if (credentialToTest && !existingIntegrationId) {
          toast.message('Token valido. Clique em Salvar integracao para persistir no workspace.')
        }
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
      : isHubSpot
        ? normalizeHubSpotTokenInput(credentialValue)
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

  const providerBadgeLabel = selectedCRM?.name || 'CRM'
  const headerDescription = isHubSpot
    ? 'Conecte o HubSpot com um Private App token para liberar contatos, negocios e automacoes no escopo da sua empresa.'
    : isMailchimp
      ? 'Conecte o Mailchimp com API Key para audiencias, campanhas e sincronizacao de contatos com os agentes.'
      : 'Configure a integracao com seu CRM para que os agentes possam consultar e atualizar dados do workspace.'

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full max-w-none overflow-y-auto border-l border-border/70 bg-zinc-950/98 px-0 text-zinc-50 backdrop-blur-xl sm:w-[92vw] sm:max-w-[720px]">
        <SheetHeader className="border-b border-white/10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
            <IntegrationBrandIcon
              slug={selectedCRM?.slug || 'hubspot'}
              size="md"
              boxed
              className="rounded-2xl border border-white/10 shadow-[0_10px_30px_-18px_rgba(56,189,248,0.35)]"
            />
            <div className="max-w-2xl space-y-1.5">
              <SheetTitle className="text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">
                {selectedCRM ? `Conectar ${selectedCRM.name}` : 'Conectar CRM'}
              </SheetTitle>
              <SheetDescription className="text-sm leading-6 text-zinc-400 sm:text-[15px]">
                {headerDescription}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isFetching ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-zinc-400 sm:px-6">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-sky-300" />
            <p className="text-sm">Carregando provedores disponiveis...</p>
          </div>
        ) : (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
              <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="crm-select" className="text-base font-bold text-zinc-100">
                      Provedor
                    </Label>
                    <p className="text-xs leading-5 text-zinc-400">
                      Escolha o CRM que os agentes e fluxos vao utilizar neste workspace.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200"
                  >
                    {providerBadgeLabel}
                  </Badge>
                </div>

                <Select value={selectedCRMId} onValueChange={setSelectedCRMId}>
                  <SelectTrigger
                    id="crm-select"
                    className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 px-4 text-left text-zinc-100 shadow-none transition-colors hover:border-sky-400/30 focus:border-sky-400/50 focus:ring-0"
                  >
                    <SelectValue placeholder="Selecione HubSpot, Mailchimp..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-white/10 bg-zinc-950 text-zinc-100">
                    {availableCRMs.map((crm) => (
                      <SelectItem key={crm.id} value={crm.id} className="rounded-xl focus:bg-white/10 focus:text-zinc-50">
                        <div className="flex items-start gap-3 py-0.5">
                          <IntegrationBrandIcon slug={crm.slug} size="sm" boxed />
                          <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-zinc-100">{crm.name}</span>
                          {crm.description && (
                            <span className="text-xs text-zinc-400">{crm.description}</span>
                          )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedCRM && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 text-zinc-200">
                      {selectedCRM.type === 'api_key' ? 'Token / API Key' : selectedCRM.type}
                    </Badge>
                    {hasStoredCredential && (
                      <Badge variant="outline" className="rounded-full border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
                        Credencial salva
                      </Badge>
                    )}
                    {existingIntegrationId && (
                      <Badge variant="outline" className="rounded-full border-sky-400/25 bg-sky-400/10 text-sky-200">
                        Integracao ativa
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {isHubSpot && selectedCRM && (
                <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
                  <p className="text-base font-bold text-zinc-100">Como obter o token no HubSpot</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Use somente o <span className="font-semibold text-zinc-200">Access token</span> do Private App — nao
                    o Client secret.
                  </p>
                  <ol className="mt-4 space-y-2.5">
                    {HUBSPOT_SETUP_STEPS.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm leading-6 text-zinc-300">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10 text-xs font-bold text-sky-200">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Escopos obrigatorios</p>
                    <ul className="mt-2 space-y-1.5">
                      {HUBSPOT_REQUIRED_SCOPES.map((scope) => (
                        <li key={scope} className="font-mono text-xs text-sky-200/90">
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Propriedades opcionais recomendadas</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      Se quiser eliminar warnings do fluxo clínico no HubSpot, crie estas propriedades customizadas no objeto Contact:
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {HUBSPOT_OPTIONAL_PROPERTIES.map((property) => (
                        <li key={property} className="font-mono text-xs text-zinc-200">
                          {property}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {requiresCredential && (
                <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Key className="h-5 w-5 shrink-0 text-sky-300" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-bold text-zinc-100">Credenciais</p>
                      <p className="text-xs leading-5 text-zinc-400">{providerMeta.credentialHelpText}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="crm-credential" className="text-sm font-semibold text-zinc-100">
                        {providerMeta.credentialLabel}
                      </Label>
                      <Input
                        id="crm-credential"
                        type="password"
                        placeholder={
                          hasStoredCredential
                            ? 'Credencial salva — digite apenas para rotacionar'
                            : providerMeta.credentialPlaceholder
                        }
                        value={credentialValue}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(e) =>
                          setCredentialValue((current) => normalizeSecretInput(e.target.value, current))
                        }
                        onBlur={() => {
                          if (hasStoredCredential && !credentialValue.trim()) {
                            setCredentialValue(MASKED_SECRET_VALUE)
                          }
                        }}
                        className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 font-mono text-sm text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>

                    {isMailchimp && (
                      <div className="space-y-2">
                        <Label htmlFor="mailchimp-list-id" className="text-sm font-semibold text-zinc-100">
                          Audience / List ID padrao
                        </Label>
                        <Input
                          id="mailchimp-list-id"
                          placeholder="Ex: a1b2c3d4e5"
                          value={mailchimpListId}
                          onChange={(e) => setMailchimpListId(e.target.value)}
                          className="h-12 rounded-2xl border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500"
                        />
                        <p className="text-xs leading-5 text-zinc-400">
                          Opcional para leitura. Recomendado para criar e atualizar contatos.
                        </p>
                      </div>
                    )}

                    {isHubSpot && (
                      <div className="flex gap-3 rounded-2xl border border-sky-400/15 bg-sky-400/8 px-4 py-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                        <p className="text-xs leading-5 text-sky-100/90">
                          O teste de conexao valida apenas autenticacao e permissao da API. Nenhum dado pessoal de
                          contatos e exibido (LGPD).
                        </p>
                      </div>
                    )}

                    {lastTestSummary && (
                      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ultimo teste</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-200">{lastTestSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isHubSpot && selectedCRM && (
                <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
                  <div className="mb-4 space-y-1">
                    <p className="text-base font-bold text-zinc-100">Recursos liberados</p>
                    <p className="text-xs leading-5 text-zinc-400">
                      Depois de conectar, a plataforma podera usar estas capacidades nos agentes e fluxos.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {HUBSPOT_CAPABILITIES.map((capability) => (
                      <div
                        key={capability}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                        <span className="text-sm text-zinc-200">{capability}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isHubSpot && selectedCRM && (
                <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-sky-300" />
                    <div className="space-y-1">
                      <p className="text-base font-bold text-zinc-100">Validar conexao</p>
                      <p className="text-xs text-zinc-400">
                        Teste o token antes de salvar ou confirme uma integracao ja cadastrada.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isLoading || testing || !selectedCRMId}
                    className="rounded-xl bg-sky-500 text-white hover:bg-sky-400"
                  >
                    {testing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Testar conexao
                  </Button>
                </div>
              )}

              {selectedCRM?.type === 'oauth' && !isHubSpot && (
                <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-4 sm:p-5">
                  <p className="text-sm leading-6 text-blue-100">
                    Este CRM usa OAuth e ainda precisa de um fluxo dedicado nesta tela.
                  </p>
                </div>
              )}

              {selectedCRM?.type === 'webhook' && (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 sm:p-5">
                  <p className="text-sm leading-6 text-emerald-100">
                    Este CRM usa webhook. Configure o endpoint correspondente nas configuracoes do provedor.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="border-t border-white/10 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-center text-xs leading-5 text-zinc-400 sm:text-left">
              {isHubSpot
                ? 'Depois de salvar, o HubSpot ficara disponivel para agentes, fluxos e ferramentas de CRM no workspace.'
                : 'Depois de salvar, esta integracao podera ser usada por agentes e automacoes do workspace.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  disabled={isLoading || testing}
                  className="rounded-xl text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
                >
                  Fechar
                </Button>
              </SheetClose>
              <Button
                onClick={handleSave}
                disabled={isLoading || testing || !selectedCRMId || !supportsDirectSave}
                className="rounded-xl bg-sky-500 text-white hover:bg-sky-400"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar integracao
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
