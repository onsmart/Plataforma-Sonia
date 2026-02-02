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
  const [apiKey, setApiKey] = useState<string>('')
  const [selectedCRM, setSelectedCRM] = useState<CRM | null>(null)

  // Carrega CRMs disponíveis
  useEffect(() => {
    if (isOpen) {
      loadAvailableCRMs()
    }
  }, [isOpen])

  // Atualiza selectedCRM quando selectedCRMId muda
  useEffect(() => {
    if (selectedCRMId && availableCRMs.length > 0) {
      const crm = availableCRMs.find(c => c.id === selectedCRMId)
      setSelectedCRM(crm || null)
      // Limpa API key quando muda o CRM
      setApiKey('')
    }
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
      toast.error('Erro ao carregar CRMs disponíveis')
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    if (!user?.email || !userId) {
      toast.error('Usuário não autenticado')
      return
    }

    if (!selectedCRMId) {
      toast.error('Selecione um CRM')
      return
    }

    if (!selectedCRM) {
      toast.error('CRM selecionado inválido')
      return
    }

    // Validação baseada no tipo de CRM
    if (selectedCRM.type === 'api_key' && !apiKey.trim()) {
      toast.error('API Key é obrigatória para este tipo de CRM')
      return
    }

    setIsLoading(true)
    try {
      // Verifica se já existe uma integração para este usuário e CRM
      const { data: existing } = await supabase
        .from('tb_crm_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('crm_id', selectedCRMId)
        .maybeSingle()

      const integrationData: any = {
        user_id: userId,
        crm_id: selectedCRMId,
        is_active: true,
        config: {}
      }

      // Adiciona credenciais baseado no tipo
      if (selectedCRM.type === 'api_key') {
        integrationData.api_key = apiKey.trim()
      }
      // Para oauth, seria feito via callback (similar ao Outlook)
      // Para webhook, não precisa de credenciais aqui

      if (existing) {
        // Atualiza integração existente
        const { error } = await supabase
          .from('tb_crm_integrations')
          .update(integrationData)
          .eq('id', existing.id)

        if (error) throw error
        toast.success('Integração de CRM atualizada com sucesso!')
      } else {
        // Cria nova integração
        const { error } = await supabase
          .from('tb_crm_integrations')
          .insert(integrationData)

        if (error) throw error
        toast.success('Integração de CRM criada com sucesso!')
      }

            // Limpa formulário
            setSelectedCRMId('')
            setApiKey('')
            setSelectedCRM(null)
            
            await onSave()
            onClose()
    } catch (error: any) {
      console.error('Erro ao salvar integração CRM:', error)
      toast.error(error.message || 'Erro ao salvar integração de CRM')
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
                Configure a integração com seu CRM para que os agentes possam acessar dados
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isFetching ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm">Carregando CRMs disponíveis...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Seleção de CRM */}
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
                  Nenhum CRM disponível. Configure CRMs na tabela tb_crms primeiro.
                </p>
              )}
            </div>

            {/* Informações do CRM selecionado */}
            {selectedCRM && (
              <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tipo de Autenticação:</span>
                  <span className="text-sm capitalize">{selectedCRM.type}</span>
                </div>
                {selectedCRM.description && (
                  <p className="text-xs text-muted-foreground">{selectedCRM.description}</p>
                )}
              </div>
            )}

            {/* Campo de API Key (para tipo api_key) */}
            {selectedCRM?.type === 'api_key' && (
              <div className="space-y-2">
                <Label htmlFor="api-key" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Cole sua API Key aqui..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sua API Key será armazenada de forma segura e usada apenas para acessar o CRM.
                </p>
              </div>
            )}

            {/* Mensagem para OAuth */}
            {selectedCRM?.type === 'oauth' && (
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Este CRM usa autenticação OAuth. A conexão será feita através de um fluxo de autorização.
                </p>
              </div>
            )}

            {/* Mensagem para Webhook */}
            {selectedCRM?.type === 'webhook' && (
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Este CRM usa webhooks. Configure o endpoint de webhook nas configurações do CRM.
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
          <Button onClick={handleSave} disabled={isLoading || !selectedCRMId}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Integração
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
