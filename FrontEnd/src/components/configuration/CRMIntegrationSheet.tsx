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
import { Database, Key, Loader2, Save } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { toast } from "sonner"

interface CRM {
  id: string
  slug: string
  name: string
  type: 'oauth' | 'api_key' | 'webhook'
  description?: string
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
  const [selectedCRM, setSelectedCRM] = useState<CRM | null>(null)

  const isHubSpot = selectedCRM?.slug === 'hubspot'
  const requiresCredential = selectedCRM?.type === 'api_key' || isHubSpot
  const supportsDirectSave = selectedCRM?.type !== 'oauth' || isHubSpot
  const credentialLabel = isHubSpot ? 'Token privado do HubSpot' : 'API Key'
  const credentialPlaceholder = isHubSpot
    ? 'Cole o token privado do HubSpot aqui...'
    : 'Cole sua API Key aqui...'
  const credentialHelpText = isHubSpot
    ? 'Use o token de Private App do HubSpot para leitura e escrita de contatos e negocios.'
    : 'Sua API Key sera armazenada de forma segura e usada apenas para acessar o CRM.'

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

      setAvailableCRMs(data || [])
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

    if (!supportsDirectSave) {
      toast.error('Este CRM ainda depende de um fluxo OAuth dedicado, que nao esta disponivel nesta tela.')
      return
    }

    if (requiresCredential && !credentialValue.trim()) {
      toast.error(isHubSpot ? 'Informe o token privado do HubSpot.' : 'API Key e obrigatoria para este tipo de CRM')
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

      let existingQuery = supabase
        .from('tb_crm_integrations')
        .select('id')
        .eq('crm_id', selectedCRMId)

      existingQuery = companiesId
        ? existingQuery.eq('companies_id', companiesId)
        : existingQuery.eq('user_id', userId)

      const { data: existing, error: existingError } = await existingQuery.maybeSingle()
      if (existingError) throw existingError

      const trimmedCredential = credentialValue.trim()
      const integrationData: Record<string, unknown> = {
        user_id: userId,
        companies_id: companiesId,
        crm_id: selectedCRMId,
        is_active: true,
        config: {
          provider_slug: selectedCRM.slug,
          auth_mode: isHubSpot ? 'private_app_token' : selectedCRM.type,
        },
      }

      if (requiresCredential) {
        integrationData.api_key = trimmedCredential
        integrationData.config = {
          ...(integrationData.config as Record<string, unknown>),
          credential_label: isHubSpot ? 'private_app_token' : 'api_key',
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
                      <div className="flex flex-col">
                        <span className="font-medium">{crm.name}</span>
                        {crm.description && (
                          <span className="text-xs text-muted-foreground">{crm.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableCRMs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum CRM disponivel. Configure CRMs na tabela tb_crms primeiro.
                </p>
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
              </div>
            )}

            {requiresCredential && (
              <div className="space-y-2">
                <Label htmlFor="crm-credential" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {credentialLabel}
                </Label>
                <Input
                  id="crm-credential"
                  type="password"
                  placeholder={credentialPlaceholder}
                  value={credentialValue}
                  onChange={(e) => setCredentialValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{credentialHelpText}</p>
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
