
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Sparkles, Check,
  Loader2, Database, Save, ArrowLeft, ChevronDown, X,
  Plug, BookOpen, Mic2, FileText,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { cn } from "../lib/utils"
import {
  agentConfigContentWrap,
  agentConfigEyebrow,
  agentConfigFieldHint,
  agentConfigFieldLabel,
  agentConfigGlow,
  agentConfigInnerPanel,
  agentConfigInput,
  agentConfigMeshBg,
  agentConfigMobileBar,
  agentConfigPageShell,
  agentConfigSubheading,
  agentConfigTabTrigger,
  agentConfigTabsList,
  agentConfigTextarea,
  agentConfigTopBar,
} from "../lib/agent-config-layout"
import { AgentConfigSection } from "../components/agents/AgentConfigSection"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Badge } from "../components/ui/badge"
import { toast } from "sonner"
import { Toaster } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { Slider } from "../components/ui/slider"
import { api } from "../utils/api"
import { AgentToolsSection } from "../components/agents/AgentToolsSection"
import {
  getWelcomeFromExtraFeatures,
  mergeWelcomeIntoSerialized,
} from "../lib/agent-extra-features"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { fetchWhatsappIntegrationsForWorkspace } from "../lib/workspace-integrations"
import { useTheme } from "next-themes"
import { SUPPORTED_AGENT_LANGUAGES, normalizeAgentLanguageCode } from "../lib/agent-language"
import { AgentVoiceSettings, type AgentVoiceSettingsHandle } from "../components/agents/AgentVoiceSettings"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command"

function getAgentInitials(value: string): string {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return "AI"
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

type KnowledgeEntryRow = {
  id: string
  original_name: string
  file_purpose?: string
  is_ready?: boolean
}

function KnowledgeEntryPicker({
  label,
  hint,
  emptyText,
  createLabel,
  files,
  selectedIds,
  onToggle,
  onCreate,
  badgeLabel,
}: {
  label: string
  hint: string
  emptyText: string
  createLabel: string
  files: KnowledgeEntryRow[]
  selectedIds: string[]
  onToggle: (fileId: string) => void
  onCreate: () => void
  badgeLabel: string
}) {
  const sectionSelected = selectedIds.filter((id) => files.some((f) => f.id === id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className={agentConfigFieldLabel}>{label}</Label>
          <p className={agentConfigFieldHint}>{hint}</p>
        </div>
        <Badge variant="outline" className="rounded-md">
          {sectionSelected.length} selecionado{sectionSelected.length === 1 ? '' : 's'}
        </Badge>
      </div>
      {files.length === 0 ? (
        <div className={cn(agentConfigInnerPanel, "border-dashed space-y-3 text-sm text-muted-foreground")}>
          <p>{emptyText}</p>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={onCreate}>
            {createLabel}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className={cn(agentConfigInput, "h-auto min-h-11 w-full justify-between py-2.5 font-normal")}>
                <span className="truncate text-sm">
                  {sectionSelected.length === 0 ? `Selecionar ${badgeLabel}…` : `${sectionSelected.length} ${badgeLabel}(s)`}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0" align="start">
              <Command>
                <CommandInput placeholder={`Buscar ${badgeLabel.toLowerCase()}…`} className="h-10" />
                <CommandList className="max-h-64">
                  <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                  <CommandGroup>
                    {files.map((file) => {
                      const isSelected = selectedIds.includes(file.id)
                      const isReady = Boolean(file.is_ready)
                      return (
                        <CommandItem
                          key={file.id}
                          value={`${file.original_name} ${file.id}`}
                          onSelect={() => onToggle(file.id)}
                          className="rounded-lg"
                        >
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded border", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                            {isSelected ? <Check className="h-3 w-3" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{file.original_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {isReady ? 'Pronto' : 'Processando…'}
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {sectionSelected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sectionSelected.map((fileId) => {
                const file = files.find((f) => f.id === fileId)
                if (!file) return null
                return (
                  <Badge key={fileId} variant="secondary" className="gap-1 rounded-md pr-1">
                    <span className="max-w-[180px] truncate">{file.original_name}</span>
                    {!file.is_ready ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">· processando</span>
                    ) : null}
                    <button type="button" className="rounded p-0.5 hover:bg-destructive/15 hover:text-destructive" onClick={() => onToggle(fileId)} aria-label="Remover">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs" onClick={onCreate}>
            + {createLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

export function AgentConfig() {
  const { theme } = useTheme()
  const { user, userId, companiesId } = useAuth()
  const { navigate } = useNavigation()
  const { t } = useTranslation('agentConfig')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const voiceSettingsRef = useRef<AgentVoiceSettingsHandle>(null)

  // Form States
  const [name, setName] = useState("")
  const [selectedPrimaryLanguage, setSelectedPrimaryLanguage] = useState("pt-BR")
  const [selectedProvider, setSelectedProvider] = useState("openai")
  const [model, setModel] = useState("gpt-4o-mini")
  const [selectedCrm, setSelectedCrm] = useState("none")
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [extraFeatures, setExtraFeatures] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  
  // PARÂMETROS DIDÁTICOS
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([1000])

  const [availableFiles, setAvailableFiles] = useState<any[]>([])
  const [availableCrms, setAvailableCrms] = useState<any[]>([])
  const [availableWhatsappIntegrations, setAvailableWhatsappIntegrations] = useState<any[]>([])
  const [selectedWhatsappIntegration, setSelectedWhatsappIntegration] = useState("none")

  // Template
  type TemplateOption = { id: string; name: string; role: string; description: string; isShared?: boolean }
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false)

  const loadAvailableData = useCallback(async () => {
    if (!user?.email || !userId) return
    try {
      const { data: filesData } = await supabase.rpc('sp_list_files_by_email', { p_email: user.email })
      setAvailableFiles((filesData || []).filter((f: any) => !f.is_deleted))

      const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
      if (companyUser?.companies_id) {
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name, slug)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms((crmsData || []).filter((crm: any) => ['hubspot', 'mailchimp'].includes(crm?.tb_crms?.slug)))

        setAvailableWhatsappIntegrations(
          await fetchWhatsappIntegrationsForWorkspace({ userId, companiesId })
        )
      }

      setTemplatesLoading(true)
      try {
        const { BASE_URL, getAuthHeaders } = await import('../services/api')
        const res = await fetch(`${BASE_URL}/templates?email=${encodeURIComponent(user.email)}`, {
          headers: await getAuthHeaders()
        })
        if (res.ok) {
          const data = await res.json()
          setTemplates(Array.isArray(data) ? data : [])
        }
      } finally {
        setTemplatesLoading(false)
      }
    } catch (e) { console.error(e) }
  }, [user?.email, userId, companiesId])

  const loadAgentData = useCallback(async (id: string) => {
    if (!user?.email) {
      console.warn("loadAgentData: user.email não disponível")
      return
    }
    try {
      const { data: agentData, error: agentError } = await supabase.from('tb_agents').select('nome, primary_language, extra_features').eq('id', id).single()
      
      if (agentData && agentData.nome) {
        setName(agentData.nome)
        setSelectedPrimaryLanguage(normalizeAgentLanguageCode(agentData.primary_language, 'pt-BR'))
        setExtraFeatures(String(agentData.extra_features || ''))
        setWelcomeMessage(getWelcomeFromExtraFeatures(agentData.extra_features))
      } else if (agentError) {
        console.error("Erro ao buscar nome do agente:", agentError)
      }
      
      const { data: agentRow, error: agentRowError } = await supabase
        .from('tb_agents')
        .select(
          'nome, name, primary_language, provider, provider_model, crm_integration_id, integrations_id, temperature, max_tokens, extra_features, role_template_id'
        )
        .eq('id', id)
        .maybeSingle()

      if (agentRowError) {
        console.warn('Erro ao carregar config do agente (tb_agents):', agentRowError.message)
      } else if (agentRow) {
        setSelectedPrimaryLanguage(normalizeAgentLanguageCode(agentRow.primary_language, 'pt-BR'))
        setSelectedProvider(agentRow.provider || 'openai')
        setModel(agentRow.provider_model || 'gpt-4o-mini')
        setSelectedCrm(agentRow.crm_integration_id ? String(agentRow.crm_integration_id) : 'none')
        setSelectedWhatsappIntegration(
          agentRow.integrations_id ? String(agentRow.integrations_id) : 'none'
        )
        setTemperature([
          agentRow.temperature !== null && agentRow.temperature !== undefined
            ? Number(agentRow.temperature)
            : 0.7,
        ])
        setMaxTokens([
          agentRow.max_tokens !== null && agentRow.max_tokens !== undefined
            ? Number(agentRow.max_tokens)
            : 1000,
        ])
        setSelectedTemplateId(agentRow.role_template_id ?? null)
      }

      const { data: agentIntegrationsData, error: integrationsError } = await supabase
        .from('tb_agents')
        .select('integrations_id, crm_integration_id, primary_language, extra_features')
        .eq('id', id)
        .single()
      
      if (!integrationsError && agentIntegrationsData) {
        setSelectedWhatsappIntegration(
          agentIntegrationsData.integrations_id
            ? String(agentIntegrationsData.integrations_id).trim()
            : "none"
        )
        setSelectedCrm(
          agentIntegrationsData.crm_integration_id
            ? String(agentIntegrationsData.crm_integration_id).trim()
            : "none"
        )
        if (agentIntegrationsData.primary_language) {
          setSelectedPrimaryLanguage(normalizeAgentLanguageCode(agentIntegrationsData.primary_language, 'pt-BR'))
        }
        setExtraFeatures(String(agentIntegrationsData.extra_features || ''))
        setWelcomeMessage(getWelcomeFromExtraFeatures(agentIntegrationsData.extra_features))
      }

      const { data: agentFiles } = await supabase.rpc('sp_get_agent_files', {
        p_email: user.email,
        p_agent_id: id
      })
      if (agentFiles) {
        setSelectedFileIds(agentFiles.map((f: any) => f.file_id))
      }
    } catch (e) { 
      console.error("Erro ao carregar dados do agente:", e) 
    }
  }, [user?.email])

  useEffect(() => {
    if (!user?.email || !userId) return

    const hash = window.location.hash
    const queryStr = hash.includes('?') ? hash.split('?')[1] : ''
    const params = new URLSearchParams(queryStr)
    const id = params.get('id')

    const init = async () => {
      setIsFetching(true)
      if (id) {
        setAgentId(id)
        await loadAgentData(id)
      }
      await loadAvailableData()
      setIsFetching(false)
    }

    void init()
  }, [user?.email, userId, loadAgentData, loadAvailableData])

  useEffect(() => {
    if (!agentId || !user?.email) return

    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      void loadAvailableData()
      void loadAgentData(agentId)
    }

    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [agentId, user?.email, loadAgentData, loadAvailableData])

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((x) => x !== fileId) : [...prev, fileId]
    )
  }, [])

  const ragAvailableFiles = useMemo(
    () => availableFiles.filter((f: KnowledgeEntryRow) => f.file_purpose !== 'skills'),
    [availableFiles]
  )
  const skillsAvailableFiles = useMemo(
    () => availableFiles.filter((f: KnowledgeEntryRow) => f.file_purpose === 'skills'),
    [availableFiles]
  )

  const linkedConnectionLines = useMemo(() => {
    const lines: string[] = []
    if (selectedCrm && selectedCrm !== 'none') {
      const crm = availableCrms.find((c: any) => String(c.id) === String(selectedCrm))
      if (crm?.tb_crms?.name) {
        lines.push(String(crm.tb_crms.name))
      } else {
        lines.push('CRM (vinculado ao agente)')
      }
    }
    if (selectedWhatsappIntegration && selectedWhatsappIntegration !== 'none') {
      const wa = availableWhatsappIntegrations.find(
        (i: any) => String(i.id) === String(selectedWhatsappIntegration)
      )
      const phone = wa?.phone_number?.trim()
      if (wa) {
        lines.push(phone ? `WhatsApp (${phone})` : 'WhatsApp')
      } else {
        lines.push('WhatsApp (conexão vinculada ao agente)')
      }
    }
    return lines
  }, [selectedCrm, selectedWhatsappIntegration, availableCrms, availableWhatsappIntegrations])

  const handleSave = async () => {
    if (!name) { toast.error(t('errors.nameRequired')); return }
    setIsLoading(true)
    try {
      // A tabela tb_agents usa 'nome' (português), não 'name'
      const payload: Record<string, unknown> = {
        nome: name, // Campo correto da tabela
        provider: selectedProvider,
        provider_model: model,
        temperature: temperature[0],
        max_tokens: maxTokens[0],
        primary_language: normalizeAgentLanguageCode(selectedPrimaryLanguage, 'pt-BR'),
        crm_integration_id: selectedCrm === 'none' ? null : selectedCrm,
        integrations_id: selectedWhatsappIntegration === 'none' ? null : selectedWhatsappIntegration,
        extra_features: mergeWelcomeIntoSerialized(extraFeatures, welcomeMessage).trim() || null,
        role_template_id: selectedTemplateId ?? null,
      }
      
      if (agentId) {
        // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
        const { BASE_URL, getAuthHeaders } = await import('../services/api')
        
        const response = await fetch(`${BASE_URL}/agents/${agentId}`, {
          method: 'PUT',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            email: user?.email,
            ...payload
          })
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("Erro ao atualizar agente:", error)
          toast.error(error.error || t('errors.saveError', { message: error.details || error.message }))
          return
        }
        
        if (user?.email) {
          const { error: filesError } = await supabase.rpc('sp_replace_agent_files', {
            p_email: user.email,
            p_agent_id: agentId,
            p_file_ids: selectedFileIds.length > 0 ? selectedFileIds : null
          })
          if (filesError) {
            console.error("Erro ao salvar arquivos:", filesError)
          }
        }
        try {
          const voiceOutcome = await voiceSettingsRef.current?.saveVoiceIfDirty()
          if (voiceOutcome === "error") {
            return
          }
        } catch (voiceErr: unknown) {
          console.error("Erro ao salvar voz:", voiceErr)
          toast.error("Agente atualizado, mas ocorreu um erro inesperado ao salvar a voz.")
          return
        }
        toast.success(t('success.configSaved')); window.history.back()
      } else {
        await api.agents.create(payload)
        toast.success(t('success.configSaved')); window.history.back()
      }
    } catch (e: any) { 
      console.error("Erro ao salvar:", e)
      toast.error(t('errors.saveError', { message: e.message || t('errors.unknownError') })) 
    } finally { setIsLoading(false) }
  }

  const isDark = theme === 'dark'

  const selectContentStyle = {
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border) / 0.85)',
    boxShadow: isDark ? 'none' : '0 18px 40px -28px rgba(15, 23, 42, 0.12)'
  } as CSSProperties

  const saveButton = (
    <Button
      onClick={handleSave}
      disabled={isLoading}
      className="h-10 rounded-lg px-5 text-sm font-semibold shadow-sm disabled:opacity-50"
    >
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Salvar alterações
    </Button>
  )

  const neuralSettingsBlock = (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={cn(agentConfigInnerPanel, "space-y-4")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className={agentConfigFieldLabel}>{t('neural.creativityLabel')}</Label>
            <p className={agentConfigFieldHint}>
              Respostas mais objetivas ou mais variadas na forma de expressar.
            </p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-primary">{Math.round(temperature[0] * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(temperature[0] * 100)}%` }}
          />
        </div>
        <div className="slider-cyan" style={{ ['--slider-track-bg' as any]: isDark ? '#3f3f46' : '#e2e8f0', ['--slider-range-bg' as any]: 'hsl(var(--primary))' }}>
          <Slider min={0} max={1} step={0.01} value={temperature} onValueChange={setTemperature} />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t('neural.exact')}</span>
          <span>{t('neural.creative')}</span>
        </div>
      </div>
      <div className={cn(agentConfigInnerPanel, "space-y-4")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className={agentConfigFieldLabel}>{t('neural.responseSizeLabel')}</Label>
            <p className={agentConfigFieldHint}>Controle se a Sonia responde de forma curta ou detalhada.</p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-primary">{maxTokens[0]}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, ((maxTokens[0] - 100) / 3900) * 100))}%` }}
          />
        </div>
        <div className="slider-cyan" style={{ ['--slider-track-bg' as any]: isDark ? '#3f3f46' : '#e2e8f0', ['--slider-range-bg' as any]: 'hsl(var(--primary))' }}>
          <Slider min={100} max={4000} step={100} value={maxTokens} onValueChange={setMaxTokens} />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Mais curta</span>
          <span>Mais detalhada</span>
        </div>
      </div>
    </div>
  )

  if (isFetching) return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className={agentConfigEyebrow}>{t('loading.syncing')}</p>
    </div>
  )

  const displayName = name || (agentId ? t('header.editBrain') : t('header.newBrain'))

  return (
    <div className={cn(agentConfigPageShell, "-m-4 sm:-m-0")}>
      <div className={agentConfigMeshBg} aria-hidden />
      <div className={agentConfigGlow} aria-hidden />
      <style>{`
        .slider-cyan [data-slot="slider-track"] { height: 0.45rem !important; border-radius: 9999px; }
        .slider-cyan [data-slot="slider-range"] { background: hsl(var(--primary)) !important; border-radius: 9999px; }
        .slider-cyan [data-slot="slider-thumb"] {
          width: 1rem !important; height: 1rem !important;
          border: 2px solid hsl(var(--primary)) !important;
          background: hsl(var(--background)) !important;
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15) !important;
        }
      `}</style>
      <Toaster position="top-center" />

      <div className={agentConfigTopBar}>
        <div className={cn(agentConfigContentWrap, "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4")}>
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => window.history.back()} aria-label={t('button.cancel')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-sm">
              {getAgentInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className={agentConfigEyebrow}>Configuração de agente</p>
              <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{displayName}</h1>
            </div>
            <Badge variant="outline" className="ml-1 hidden shrink-0 rounded-md sm:inline-flex">Em edição</Badge>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="outline" className="h-10 rounded-lg px-4" onClick={() => window.history.back()}>{t('button.cancel')}</Button>
            {saveButton}
          </div>
        </div>
      </div>

      <div className={cn(agentConfigContentWrap, "py-6 sm:py-8")}>
        <p className={cn(agentConfigSubheading, "mb-6 max-w-3xl")}>
          Organize identidade, integrações, base de conhecimento e voz em abas. O papel conversacional vem do template vinculado no hub.
        </p>

        <Tabs defaultValue="geral" className="gap-6">
          <TabsList className={agentConfigTabsList}>
            <TabsTrigger value="geral" className={agentConfigTabTrigger}>
              <Sparkles className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="integracoes" className={agentConfigTabTrigger}>
              <Plug className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="conhecimento" className={agentConfigTabTrigger}>
              <BookOpen className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Conhecimento
            </TabsTrigger>
            <TabsTrigger value="voz" className={agentConfigTabTrigger}>
              <Mic2 className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Voz & IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-0 space-y-0 outline-none">
            <AgentConfigSection
              icon={Sparkles}
              title={t('identity.title')}
              description="Nome, idioma e mensagem de boas-vindas exibidos ao contato."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className={agentConfigFieldLabel}>{t('identity.nameLabel')}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('identity.namePlaceholder')} className={agentConfigInput} />
                </div>
                <div className="space-y-2">
                  <Label className={agentConfigFieldLabel}>Idioma principal</Label>
                  <Select value={selectedPrimaryLanguage} onValueChange={(v) => setSelectedPrimaryLanguage(normalizeAgentLanguageCode(v, 'pt-BR'))}>
                    <SelectTrigger className={agentConfigInput}><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-lg border p-1" style={selectContentStyle}>
                      {SUPPORTED_AGENT_LANGUAGES.map((language) => (
                        <SelectItem key={language.code} value={language.code} className="rounded-md">{language.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className={agentConfigFieldLabel}>Mensagem inicial</Label>
                  <Textarea
                    value={welcomeMessage}
                    onChange={(e) => {
                      const msg = e.target.value
                      setWelcomeMessage(msg)
                      setExtraFeatures(mergeWelcomeIntoSerialized(extraFeatures, msg))
                    }}
                    placeholder="Boas-vindas no primeiro contato da conversa."
                    className={agentConfigTextarea}
                  />
                  <p className={agentConfigFieldHint}>Enviada automaticamente no primeiro turno da conversa, quando configurada.</p>
                </div>
              </div>
            </AgentConfigSection>

            <AgentConfigSection
              icon={FileText}
              title="Papel conversacional"
              description="Template que define as instruções, objetivo e comportamento deste agente."
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={agentConfigFieldLabel}>Template ativo</Label>
                  <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={cn(agentConfigInput, "h-auto min-h-11 w-full justify-between py-2.5 font-normal")}
                      >
                        <span className="truncate text-sm">
                          {selectedTemplateId
                            ? (templates.find((t) => t.id === selectedTemplateId)?.name ?? "Template selecionado")
                            : "Selecionar template…"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar template…" className="h-10" />
                        <CommandList className="max-h-72">
                          <CommandEmpty>
                            {templatesLoading ? "Carregando templates…" : "Nenhum template encontrado."}
                          </CommandEmpty>
                          <CommandGroup>
                            {templates.map((tmpl) => {
                              const isSelected = selectedTemplateId === tmpl.id
                              const preview = (tmpl.role || tmpl.description || '').slice(0, 90)
                              return (
                                <CommandItem
                                  key={tmpl.id}
                                  value={`${tmpl.name} ${tmpl.role} ${tmpl.description}`}
                                  onSelect={() => {
                                    setSelectedTemplateId(tmpl.id)
                                    setTemplatePopoverOpen(false)
                                  }}
                                  className="rounded-lg"
                                >
                                  <div className={cn("mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                                    {isSelected ? <Check className="h-3 w-3" /> : null}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{tmpl.name}</div>
                                    {preview ? (
                                      <div className="truncate text-xs text-muted-foreground">
                                        {preview}{preview.length >= 90 ? '…' : ''}
                                      </div>
                                    ) : null}
                                  </div>
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className={agentConfigFieldHint}>
                    Altere o template para mudar o papel, tom e objetivos deste agente.{' '}
                    {selectedTemplateId ? (
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => setSelectedTemplateId(null)}
                      >
                        Remover vínculo
                      </button>
                    ) : null}
                  </p>
                </div>

                {selectedTemplateId ? (() => {
                  const tmpl = templates.find((t) => t.id === selectedTemplateId)
                  if (!tmpl) return null
                  const primaryText = (tmpl.role || tmpl.description || '').trim()
                  const secondaryText = tmpl.role && tmpl.description && tmpl.description !== tmpl.role
                    ? tmpl.description.trim()
                    : ''
                  if (!primaryText) return null
                  return (
                    <div className={cn(agentConfigInnerPanel, "space-y-3")}>
                      <div className="flex items-center justify-between gap-2">
                        <Label className={agentConfigFieldLabel}>Instruções do template</Label>
                        <Badge variant="outline" className="shrink-0 rounded-md text-xs">
                          {tmpl.isShared ? "Compartilhado" : "Seu template"}
                        </Badge>
                      </div>
                      <p className="line-clamp-6 text-sm leading-relaxed text-muted-foreground">
                        {primaryText}
                      </p>
                      {secondaryText ? (
                        <p className="line-clamp-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                          {secondaryText}
                        </p>
                      ) : null}
                    </div>
                  )
                })() : null}
              </div>
            </AgentConfigSection>
          </TabsContent>

          <TabsContent value="integracoes" className="mt-0 outline-none">
            <AgentConfigSection
              icon={Plug}
              title="Ferramentas e integrações"
              description="Ative Calendly, HubSpot ou WhatsApp e escolha o que o agente pode executar."
            >
              <AgentToolsSection
                agentId={agentId || undefined}
                extraFeaturesJson={extraFeatures}
                onExtraFeaturesChange={setExtraFeatures}
              />
            </AgentConfigSection>
          </TabsContent>

          <TabsContent value="conhecimento" className="mt-0 outline-none">
            <AgentConfigSection
              icon={Database}
              title={t('connections.title')}
              description="Vincule bases RAG e Skills criadas na sua conta. Apenas conteúdos prontos entram nas respostas."
              headerExtra={
                selectedFileIds.length > 0 ? (
                  <Badge variant="secondary" className="rounded-md">{selectedFileIds.length} vinculado(s)</Badge>
                ) : null
              }
            >
              <div className="grid gap-6">
                <div className={agentConfigInnerPanel}>
                  <Label className={agentConfigFieldLabel}>Conexões ativas neste agente</Label>
                  {linkedConnectionLines.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nenhuma integração externa vinculada{agentId ? '.' : ' — configure no hub de agentes.'}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {linkedConnectionLines.map((line, idx) => (
                        <span key={`${idx}-${line}`} className="inline-flex items-center rounded-lg border border-border/50 bg-background/80 px-3 py-1.5 text-xs font-medium">
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={cn(agentConfigFieldHint, "mt-3")}>Para alterar WhatsApp ou CRM, use o hub de agentes ou Configurações → Integrações.</p>
                </div>

                <KnowledgeEntryPicker
                  label="Bases RAG"
                  hint="Contexto factual consultado nas respostas (FAQ, políticas, produtos)."
                  emptyText="Nenhum RAG na sua conta. Crie conteúdo na Base de Conhecimento (modo RAG)."
                  createLabel="Criar RAG na Base de Conhecimento"
                  files={ragAvailableFiles}
                  selectedIds={selectedFileIds}
                  onToggle={toggleFileSelection}
                  onCreate={() => navigate('knowledge')}
                  badgeLabel="RAG"
                />

                <KnowledgeEntryPicker
                  label="Skills"
                  hint="Regras de comportamento e capacidades do agente (permitido, proibido, fallback)."
                  emptyText="Nenhuma Skill na sua conta. Crie conteúdo na Base de Conhecimento (modo Skills)."
                  createLabel="Criar Skill na Base de Conhecimento"
                  files={skillsAvailableFiles}
                  selectedIds={selectedFileIds}
                  onToggle={toggleFileSelection}
                  onCreate={() => navigate('knowledge')}
                  badgeLabel="Skill"
                />
              </div>
            </AgentConfigSection>
          </TabsContent>

          <TabsContent value="voz" className="mt-0 space-y-5 outline-none">
            <AgentVoiceSettings ref={voiceSettingsRef} agentId={agentId} neuralSettings={neuralSettingsBlock} />
          </TabsContent>
        </Tabs>
      </div>

      <div className={agentConfigMobileBar}>
        <div className="mx-auto flex max-w-5xl gap-2 px-1">
          <Button variant="outline" className="h-10 flex-1 rounded-lg" onClick={() => window.history.back()}>{t('button.cancel')}</Button>
          <div className="flex-[1.35]">{saveButton}</div>
        </div>
      </div>
    </div>
  )
}
