import React, { useEffect, useState } from "react"
import { supabase } from "../../utils/supabase/client"
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
import { Database, Key, Loader2, Save } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { toast } from "sonner"

interface CRM {
  id: string
  slug: string
  name: string
  type: 'oauth' | 'api_key' | 'webhook'
  description?: string
  source?: 'database' | 'catalog'
}

const SUPPORTED_CRM_SLUGS = ['hubspot', 'mailchimp'] as const

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

const extractMailchimpDataCenter = (apiKey: string) => {
  const match = apiKey.trim().match(/-([a-z]{2,}\d+)$/i)
  return match?.[1]?.toLowerCase() || null
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
  }, [selectedCRMId, availableCRMs])

  const loadAvailableCRMs = async () => {
    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from('tb_crms')
        .select('id, slug, name, type, description')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      const databaseCRMs = (data || [])
        .filter((crm) => SUPPORTED_CRM_SLUGS.includes(crm.slug as typeof SUPPORTED_CRM_SLUGS[number]))
        .map((crm) => ({ ...crm, source: 'database' as const }))
      const existingSlugs = new Set(databaseCRMs.map((crm) => crm.slug))
      const catalogCRMs = DEFAULT_CRM_CATALOG.filter((crm) => !existingSlugs.has(crm.slug))
      setAvailableCRMs([...databaseCRMs, ...catalogCRMs].sort((a, b) => a.name.localeCompare(b.name)))
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

    if (requiresCredential && !credentialValue.trim()) {
      toast.error(isHubSpot ? 'Informe o token privado do HubSpot.' : 'Informe a API Key do Mailchimp.')
      return
    }

    setIsLoading(true)
    try {
      const { data: companyUser, error: companyUserError } = await supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (companyUserError) throw companyUserError

      const companiesId = companyUser?.companies_id || null

      let crmId = selectedCRMId

      if (selectedCRM.source === 'catalog' || selectedCRMId.startsWith('catalog:')) {
        const { data: existingCRM, error: lookupError } = await supabase
          .from('tb_crms')
          .select('id')
          .eq('slug', selectedCRM.slug)
          .maybeSingle()

        if (lookupError) throw lookupError

        if (existingCRM?.id) {
          crmId = existingCRM.id
        } else {
          const { data: createdCRM, error: createError } = await supabase
            .from('tb_crms')
            .insert({
              slug: selectedCRM.slug,
              name: selectedCRM.name,
              type: selectedCRM.type,
              description: selectedCRM.description,
              is_active: true,
            })
            .select('id')
            .single()

          if (createError) throw createError
          crmId = createdCRM.id
        }
      }

      let existingQuery = supabase
        .from('tb_crm_integrations')
        .select('id')
        .eq('crm_id', crmId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      existingQuery = companiesId
        ? existingQuery.eq('companies_id', companiesId)
        : existingQuery.eq('user_id', userId)

      const { data: existing, error: existingError } = await existingQuery.maybeSingle()
      if (existingError) throw existingError

      const trimmedCredential = credentialValue.trim()
      const trimmedMailchimpListId = mailchimpListId.trim()
      const mailchimpDataCenter = selectedCRM.slug === 'mailchimp'
        ? extractMailchimpDataCenter(trimmedCredential)
        : null
      const connectedAt = new Date().toISOString()
      const integrationData: Record<string, unknown> = {
        user_id: userId,
        companies_id: companiesId,
        crm_id: crmId,
        is_active: true,
        config: {
          provider_slug: selectedCRM.slug,
          provider_name: selectedCRM.name,
          auth_mode: providerMeta.authMode,
          status: 'connected',
          connected_at: connectedAt,
          last_saved_at: connectedAt,
          credential_present: true,
          credential_label: providerMeta.storedCredentialLabel,
          supported_in_ui: true,
          backend_supported: selectedCRM.slug === 'hubspot',
          ...(trimmedMailchimpListId ? { default_list_id: trimmedMailchimpListId } : {}),
          ...(mailchimpDataCenter ? { data_center: mailchimpDataCenter } : {}),
        },
      }

      if (requiresCredential) {
        integrationData.api_key = trimmedCredential
        integrationData.config = {
          ...(integrationData.config as Record<string, unknown>),
          token_hint: trimmedCredential ? `${trimmedCredential.slice(0, 6)}...` : null,
        }

        if (isHubSpot) {
          integrationData.access_token = trimmedCredential
          integrationData.config = {
            ...(integrationData.config as Record<string, unknown>),
            private_app_token: trimmedCredential,
          }
        }
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('tb_crm_integrations')
          .update(integrationData)
          .eq('id', existing.id)

        if (error) throw error
        toast.success('Integracao de CRM atualizada com sucesso!')
      } else {
        const { error } = await supabase
          .from('tb_crm_integrations')
          .insert(integrationData)

        if (error) throw error
        toast.success('Integracao de CRM criada com sucesso!')
      }

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
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Conectar CRM</SheetTitle>
              <SheetDescription>
                Configure a integracao com seu CRM para que os agentes possam acessar dados.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isFetching ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm">Carregando CRMs disponiveis...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="crm-select" className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Selecione o CRM
              </Label>
              <Select value={selectedCRMId} onValueChange={setSelectedCRMId}>
                <SelectTrigger id="crm-select">
                  <SelectValue placeholder="Escolha um CRM..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCRMs.map((crm) => (
                    <SelectItem key={crm.id} value={crm.id}>
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 font-medium">
                          {crm.name}
                          {crm.source === 'catalog' && <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">Novo</Badge>}
                        </span>
                        {crm.description && (
                          <span className="text-xs text-muted-foreground">{crm.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableCRMs.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum CRM disponivel no momento.</p>
              )}
            </div>

            {selectedCRM && (
              <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tipo de autenticacao:</span>
                  <span className="text-sm capitalize">{selectedCRM.type}</span>
                </div>
                {selectedCRM.description && (
                  <p className="text-xs text-muted-foreground">{selectedCRM.description}</p>
                )}
                {isHubSpot && (
                  <p className="text-xs text-muted-foreground">
                    HubSpot foi ajustado para usar token privado e ficar disponivel no escopo da empresa.
                  </p>
                )}
                {selectedCRM.source === 'catalog' && (
                  <p className="text-xs text-muted-foreground">
                    Este provedor sera adicionado ao catalogo da plataforma quando a integracao for salva.
                  </p>
                )}
              </div>
            )}

            {requiresCredential && (
              <div className="space-y-2">
                <Label htmlFor="crm-credential" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {providerMeta.credentialLabel}
                </Label>
                <Input
                  id="crm-credential"
                  type="password"
                  placeholder={providerMeta.credentialPlaceholder}
                  value={credentialValue}
                  onChange={(e) => setCredentialValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{providerMeta.credentialHelpText}</p>
              </div>
            )}

            {isMailchimp && (
              <div className="space-y-2">
                <Label htmlFor="mailchimp-list-id" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Audience/List ID padrao
                </Label>
                <Input
                  id="mailchimp-list-id"
                  placeholder="Ex: a1b2c3d4e5"
                  value={mailchimpListId}
                  onChange={(e) => setMailchimpListId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional para leitura. Recomendado para criar e atualizar contatos no Mailchimp.
                </p>
              </div>
            )}

            {selectedCRM?.type === 'oauth' && !isHubSpot && (
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Este CRM usa OAuth e ainda precisa de um fluxo dedicado nesta tela.
                </p>
              </div>
            )}

            {selectedCRM?.type === 'webhook' && (
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Este CRM usa webhook. Configure o endpoint correspondente nas configuracoes do provedor.
                </p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </SheetClose>
          <Button onClick={handleSave} disabled={isLoading || !selectedCRMId || !supportsDirectSave}>
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
