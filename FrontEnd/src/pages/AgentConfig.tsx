
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Sparkles, Check,
  Loader2, BrainCircuit, Database, Save, Zap, ChevronDown, X,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { cn } from "../lib/utils"
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
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "next-themes"
import { SUPPORTED_AGENT_LANGUAGES, getAgentLanguageLabel, normalizeAgentLanguageCode } from "../lib/agent-language"
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

export function AgentConfig() {
  const { theme } = useTheme()
  const { user, userId } = useAuth()
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
  
  // PARÂMETROS DIDÁTICOS
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([1000])

  const [availableFiles, setAvailableFiles] = useState<any[]>([])
  const [availableCrms, setAvailableCrms] = useState<any[]>([])
  const [availableWhatsappIntegrations, setAvailableWhatsappIntegrations] = useState<any[]>([])
  const [selectedWhatsappIntegration, setSelectedWhatsappIntegration] = useState("none")

  const loadAvailableData = useCallback(async () => {
    if (!user?.email || !userId) return
    try {
      const { data: filesData } = await supabase.rpc('sp_list_files_by_email', { p_email: user.email })
      setAvailableFiles(filesData || [])

      const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
      if (companyUser?.companies_id) {
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name, slug)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms((crmsData || []).filter((crm: any) => ['hubspot', 'mailchimp'].includes(crm?.tb_crms?.slug)))
        
        if (user?.email) {
          try {
            const { data, error } = await supabase.rpc('sp_get_integration_by_email', {
              p_user_email: user.email
            })
            if (error) throw error
            setAvailableWhatsappIntegrations(data || [])
          } catch (err) {
            console.error("Erro ao buscar integrações:", err)
            setAvailableWhatsappIntegrations([])
          }
        }
      }
    } catch (e) { console.error(e) }
  }, [user?.email, userId])

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
      } else if (agentError) {
        console.error("Erro ao buscar nome do agente:", agentError)
      }
      
      const { data: configData, error: configError } = await supabase.rpc('sp_get_agent_config_by_email', {
        p_user_email: user.email,
        p_agent_id: id
      })

      if (configError) {
        console.error("Erro ao buscar configurações via RPC:", configError)
        const { data: fallbackData, error: fallbackError } = await supabase.from('tb_agents').select('*').eq('id', id).single()
        
        if (fallbackError) {
          console.error("Erro ao carregar agente (fallback):", fallbackError)
          return
        }
        
        if (fallbackData) {
          setName(fallbackData.nome || fallbackData.name || "")
          setSelectedPrimaryLanguage(normalizeAgentLanguageCode(fallbackData.primary_language, 'pt-BR'))
          setSelectedProvider(fallbackData.provider || "openai")
          setModel(fallbackData.provider_model || "gpt-4o-mini")
          setSelectedCrm(fallbackData.crm_integration_id ? String(fallbackData.crm_integration_id) : "none")
          setSelectedWhatsappIntegration(fallbackData.integrations_id ? String(fallbackData.integrations_id) : "none")
          setTemperature([fallbackData.temperature ?? 0.7])
          setMaxTokens([fallbackData.max_tokens ?? 1000])
          setExtraFeatures(String(fallbackData.extra_features || ''))
        }
      } else if (configData && configData.length > 0) {
        const config = configData[0]
        setSelectedPrimaryLanguage(normalizeAgentLanguageCode(config.primary_language, 'pt-BR'))
        setSelectedProvider(config.provider || "openai")
        setModel(config.provider_model || config.model || "gpt-4o-mini")
        setSelectedCrm(config.crm_integration_id ? String(config.crm_integration_id) : "none")
        setSelectedWhatsappIntegration(config.integrations_id ? String(config.integrations_id) : "none")
        setTemperature([config.temperature !== null && config.temperature !== undefined ? Number(config.temperature) : 0.7])
        setMaxTokens([config.max_tokens !== null && config.max_tokens !== undefined ? Number(config.max_tokens) : 1000])
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
        extra_features: extraFeatures.trim() || null
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
  const configShellStyle = {
    borderRadius: '12px',
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border) / 0.8)',
    boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
    transform: 'translateY(0)',
    marginBottom: '0',
  } as CSSProperties

  const fieldSurfaceStyle = {
    borderRadius: '10px',
    backgroundColor: 'hsl(var(--background))',
    borderColor: 'hsl(var(--border) / 0.85)',
    color: 'hsl(var(--foreground))',
    boxShadow: 'none',
  } as CSSProperties

  const selectContentStyle = {
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border) / 0.85)',
    boxShadow: isDark ? 'none' : '0 18px 40px -28px rgba(15, 23, 42, 0.12)'
  } as CSSProperties

  const secondaryButtonStyle = {
    color: 'hsl(var(--foreground))',
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border) / 0.8)',
    borderRadius: '10px',
    boxShadow: 'none'
  } as CSSProperties

  const primaryButtonStyle = {
    background: 'hsl(var(--primary))',
    color: 'hsl(var(--primary-foreground))',
    borderRadius: '10px',
    boxShadow: 'none'
  } as CSSProperties

  const sectionCardClass = "space-y-6 rounded-xl border border-border bg-card p-5 shadow-none sm:p-6 lg:p-7"
  const sectionHeaderClass = "flex items-start gap-3"
  const sectionTitleClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60 dark:text-muted-foreground"
  const neuralSettingsCard = (
    <section className={`${sectionCardClass} border-border/90 bg-card/95`} style={configShellStyle}>
      <div className={sectionHeaderClass}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BrainCircuit size={20} />
        </div>
        <div className="space-y-1">
          <h3 className={sectionTitleClass}>{t('neural.title')}</h3>
          <p className="text-sm leading-6 text-foreground/72">
            Ajuste o estilo das respostas do agente sem precisar expor configuracoes tecnicas de IA para quem esta configurando.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border/80 bg-muted/25 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/60 dark:text-muted-foreground">{t('neural.creativityLabel')}</Label>
              <p className="text-sm leading-relaxed text-foreground/72">
                Define se a Sonia responde de forma mais objetiva e previsivel ou com mais flexibilidade para variar frases e exemplos.
              </p>
            </div>
            <span className="text-2xl font-semibold text-foreground">{Math.round(temperature[0] * 100)}%</span>
          </div>
          <div
            className="relative slider-cyan"
            style={{
              ['--slider-track-bg' as any]: isDark ? '#3f3f46' : '#e2e8f0',
              ['--slider-range-bg' as any]: '#06b6d4'
            }}
          >
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={temperature}
              onValueChange={setTemperature}
              className="cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-foreground/60 dark:text-muted-foreground">
            <span>{t('neural.exact')} e direta</span>
            <span>{t('neural.creative')} e variada</span>
          </div>
          <div className="rounded-lg border border-dashed border-border/80 bg-background/80 px-3 py-3 text-xs leading-relaxed text-foreground/68 dark:bg-card dark:text-muted-foreground">
            Use valores mais baixos para atendimento operacional, confirmacoes e fluxos mais controlados.
            Use valores mais altos quando voce quiser respostas mais naturais, comerciais ou consultivas.
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/80 bg-muted/25 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/60 dark:text-muted-foreground">{t('neural.responseSizeLabel')}</Label>
              <p className="text-sm leading-relaxed text-foreground/72">
                Controla quanto espaco a resposta pode ocupar. Na pratica, isso influencia se a Sonia responde de forma curta ou mais detalhada.
              </p>
            </div>
            <span className="text-xl font-semibold text-foreground">{maxTokens[0]} {t('neural.tokens')}</span>
          </div>
          <div
            className="relative slider-cyan"
            style={{
              ['--slider-track-bg' as any]: isDark ? '#3f3f46' : '#e2e8f0',
              ['--slider-range-bg' as any]: '#06b6d4'
            }}
          >
            <Slider
              min={100}
              max={4000}
              step={100}
              value={maxTokens}
              onValueChange={setMaxTokens}
              className="cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-foreground/60 dark:text-muted-foreground">
            <span>Mais curta</span>
            <span>Mais detalhada</span>
          </div>
          <div className="rounded-lg border border-dashed border-border/80 bg-background/80 px-3 py-3 text-xs leading-relaxed text-foreground/68 dark:bg-card dark:text-muted-foreground">
            Para WhatsApp e atendimento rapido, prefira limites menores. Para suporte, qualificacao ou respostas mais explicativas, aumente esse valor.
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground/72">
          Estes ajustes entram no mesmo salvamento da página: use <span className="font-medium text-foreground">Salvar alterações</span> no topo (voz e demais opções também).
        </p>
      </div>
    </section>
  )

  if (isFetching) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-[10px] font-black uppercase text-muted-foreground">{t('loading.syncing')}</p>
    </div>
  )

  return (
      <div className="min-h-screen -m-4 overflow-x-hidden bg-background px-4 py-4 font-sans text-foreground sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <style>{`
          .slider-cyan [data-slot="slider-track"] {
            background: ${isDark ? 'linear-gradient(90deg, #3f3f46, #27272a)' : 'linear-gradient(90deg, rgba(226,232,240,0.96), rgba(203,213,225,0.9))'} !important;
            height: 0.5rem !important;
          }
          .slider-cyan [data-slot="slider-range"] {
            background: linear-gradient(90deg, #0e7490 0%, #06b6d4 55%, #22d3ee 100%) !important;
            box-shadow: 0 0 12px rgba(6, 182, 212, 0.12) !important;
          }
          .slider-cyan [data-slot="slider-thumb"] {
            border-color: #22d3ee !important;
            background-color: ${isDark ? '#27272a' : '#ffffff'} !important;
            width: 1.1rem !important;
            height: 1.1rem !important;
            box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12), 0 6px 14px -6px rgba(0, 0, 0, 0.35) !important;
          }
          .slider-cyan [data-slot="slider-thumb"]:hover {
            box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.18), 0 8px 16px -6px rgba(0, 0, 0, 0.4) !important;
          }
          [data-slot="input"] {
            border-radius: 1.15rem !important;
          }
        `}</style>
        <Toaster position="top-center" />

        {/* Header Sonia Premium */}
        <header className="mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-xl p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8" style={configShellStyle}>
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60 dark:text-muted-foreground">Configuração de agente</p>
                  <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px]">Em edição</Badge>
                </div>
                <h1 className="mt-1 truncate text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{name || (agentId ? t('header.editBrain') : t('header.newBrain'))}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/72 sm:text-[15px]">
                  Ajuste identidade, conexões, parâmetros de resposta e voz. O papel e o fluxo do agente vêm do template vinculado no hub.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <Button variant="ghost" className="h-11 rounded-lg px-5 font-medium" style={secondaryButtonStyle} onClick={() => window.history.back()}>{t('button.cancel')}</Button>
            <Button onClick={handleSave} disabled={isLoading} className="h-11 min-w-[12rem] rounded-lg px-6 font-semibold disabled:opacity-50" style={primaryButtonStyle}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </header>

        <main className="mx-auto mt-8 flex w-full max-w-5xl flex-col gap-10 pb-12 sm:mt-9 lg:mt-10">
          <div className="grid grid-cols-1 gap-10">
            <div className="min-w-0 space-y-10">
              
              {/* Personalidade */}
              <section className={cn(sectionCardClass, "mt-1 sm:mt-2")} style={configShellStyle}>
                <div className={sectionHeaderClass}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles size={20} />
                  </div>
                  <div className="space-y-1">
                    <h2 className={sectionTitleClass}>{t('identity.title')}</h2>
                    <p className="text-sm text-foreground/72">
                      Nome exibido e idioma das respostas. Comportamento, tom e roteiro vêm do template de papel do agente.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">{t('identity.nameLabel')}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('identity.namePlaceholder')} className="h-12 border px-4 text-sm font-bold transition-all duration-300 focus-visible:ring-2 focus-visible:ring-cyan-500/25 dark:focus-visible:ring-cyan-400/20 sm:text-base" style={fieldSurfaceStyle} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">Idioma principal</Label>
                    <Select value={selectedPrimaryLanguage} onValueChange={(value) => setSelectedPrimaryLanguage(normalizeAgentLanguageCode(value, 'pt-BR'))}>
                      <SelectTrigger className="h-12 border px-4 font-black shadow-none transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20" style={fieldSurfaceStyle}>
                        <SelectValue placeholder={getAgentLanguageLabel(selectedPrimaryLanguage, 'Português (Brasil)')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-[1.35rem] border p-2" style={selectContentStyle}>
                        {SUPPORTED_AGENT_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code} className="rounded-2xl font-bold text-zinc-900 dark:text-zinc-50">
                            {language.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">
                      Funcionalidades extras
                    </Label>
                    <Textarea
                      value={extraFeatures}
                      onChange={(e) => setExtraFeatures(e.target.value)}
                      placeholder="Ex.: regras próprias do agente, capacidades específicas, prioridades de atendimento ou instruções extras além do template compartilhado."
                      className="min-h-[160px] border px-4 py-3 text-sm leading-6 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-cyan-500/25 dark:focus-visible:ring-cyan-400/20"
                      style={fieldSurfaceStyle}
                    />
                    <p className="text-sm text-foreground/72">
                      Este campo complementa o template base com instruções fixas exclusivas deste agente.
                    </p>
                  </div>
                </div>
              </section>

              {/* Conexões */}
              <section className={cn(sectionCardClass, "mt-1 sm:mt-2")} style={configShellStyle}>
                <div className={sectionHeaderClass}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Database size={20} />
                  </div>
                  <div className="space-y-1">
                    <h2 className={sectionTitleClass}>{t('connections.title')}</h2>
                    <p className="text-sm text-foreground/72">
                      Visão somente leitura das conexões atualmente vinculadas a este agente. Para alterar integrações, use o hub de agentes. A lista abaixo atualiza ao voltar a esta aba ou ao focar a janela.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-3 rounded-lg border border-border/80 bg-muted/25 px-4 py-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">
                      Conexões vinculadas a este agente
                    </Label>
                    {linkedConnectionLines.length === 0 ? (
                      <p className="text-sm text-foreground/70">
                        Nenhuma integração externa vinculada no momento
                        {agentId ? '.' : ' — salve o agente no hub e associe WhatsApp ou CRM lá.'}
                      </p>
                    ) : (
                      <ul className="list-disc space-y-2 pl-5 text-sm font-medium text-foreground">
                        {linkedConnectionLines.map((line, idx) => (
                          <li key={`${idx}-${line}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">{t('connections.filesLabel')}</Label>
                        <p className="mt-1 text-sm text-foreground/72">
                          Escolha os arquivos da base sem expandir a página — busque na lista abaixo.
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit shrink-0 rounded-md px-3 py-1">
                        {selectedFileIds.length} selecionado{selectedFileIds.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    {availableFiles.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-foreground/70">
                        Nenhum arquivo disponivel para vincular a este agente.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="h-auto min-h-12 w-full justify-between px-4 py-3 text-left font-normal"
                              style={fieldSurfaceStyle}
                            >
                              <span className="truncate text-sm font-semibold">
                                {selectedFileIds.length === 0
                                  ? "Selecionar arquivos..."
                                  : selectedFileIds.length === 1
                                    ? availableFiles.find((f: any) => f.id === selectedFileIds[0])?.original_name || "1 arquivo"
                                    : `${selectedFileIds.length} arquivos na base`}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-55" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nome..." className="h-11" />
                              <CommandList className="max-h-[min(60vh,22rem)]">
                                <CommandEmpty>Nenhum arquivo encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {availableFiles.map((file: any) => {
                                    const isSelected = selectedFileIds.includes(file.id)
                                    return (
                                      <CommandItem
                                        key={file.id}
                                        value={`${file.original_name} ${file.id}`}
                                        onSelect={() => toggleFileSelection(file.id)}
                                        className="cursor-pointer"
                                      >
                                        <div
                                          className={cn(
                                            "mr-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                                            isSelected
                                              ? "border-primary bg-primary text-primary-foreground"
                                              : "border-muted-foreground/35"
                                          )}
                                        >
                                          {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium">{file.original_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {file.file_purpose === "skills" ? "Skills" : "RAG"}
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

                        {selectedFileIds.length > 0 ? (
                          <div className="max-h-28 overflow-y-auto rounded-lg border border-border/80 bg-muted/15 p-3">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Selecionados</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedFileIds.map((fileId) => {
                                const file = availableFiles.find((f: any) => f.id === fileId)
                                if (!file) return null
                                return (
                                  <Badge key={fileId} variant="secondary" className="flex max-w-full items-center gap-1 truncate pr-0.5">
                                    <span className="truncate">{file.original_name}</span>
                                    <button
                                      type="button"
                                      className="rounded p-1 text-foreground/60 hover:bg-destructive/15 hover:text-destructive"
                                      aria-label={`Remover ${file.original_name}`}
                                      onClick={() => toggleFileSelection(fileId)}
                                    >
                                      <X className="h-3 w-3 shrink-0" />
                                    </button>
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <AgentVoiceSettings
                ref={voiceSettingsRef}
                agentId={agentId}
                neuralSettings={neuralSettingsCard}
              />

            </div>
          </div>

        </main>
      </div>
  )
}
