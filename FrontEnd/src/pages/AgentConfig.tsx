
import { type CSSProperties, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Sparkles, Plus, Check,
  Loader2, BrainCircuit, Database, FileText, Save, Zap
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
import { AgentVoiceSettings } from "../components/agents/AgentVoiceSettings"

export function AgentConfig() {
  const { theme } = useTheme()
  const { user, userId } = useAuth()
  const { t } = useTranslation('agentConfig')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)

  // Form States
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [selectedPrimaryLanguage, setSelectedPrimaryLanguage] = useState("pt-BR")
  const [selectedProvider, setSelectedProvider] = useState("openai")
  const [model, setModel] = useState("gpt-4o-mini")
  const [selectedCrm, setSelectedCrm] = useState("none")
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  
  // PARÂMETROS DIDÁTICOS
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([1000])

  const [availableFiles, setAvailableFiles] = useState<any[]>([])
  const [availableCrms, setAvailableCrms] = useState<any[]>([])
  const [availableWhatsappIntegrations, setAvailableWhatsappIntegrations] = useState<any[]>([])
  const [selectedWhatsappIntegration, setSelectedWhatsappIntegration] = useState("none")

  // Inicialização (Edit vs Create)
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
    init()
  }, [user?.email, userId])

  const loadAvailableData = async () => {
    if (!user?.email || !userId) return
    try {
      const { data: filesData } = await supabase.rpc('sp_list_files_by_email', { p_email: user.email })
      setAvailableFiles(filesData || [])

      const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
      if (companyUser?.companies_id) {
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name, slug)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms((crmsData || []).filter((crm: any) => ['hubspot', 'mailchimp'].includes(crm?.tb_crms?.slug)))
        
        // Buscar integrações usando a mesma RPC do AgentsHub
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
  }

  const loadAgentData = async (id: string) => {
    if (!user?.email) {
      console.warn("loadAgentData: user.email não disponível")
      return
    }
    try {
      // SEMPRE buscar o nome diretamente da tabela tb_agents (a RPC não retorna o nome)
      // A coluna na tabela é 'nome' (português), não 'name'
      const { data: agentData, error: agentError } = await supabase.from('tb_agents').select('nome, primary_language').eq('id', id).single()
      
      if (agentData && agentData.nome) {
        setName(agentData.nome)
        setSelectedPrimaryLanguage(normalizeAgentLanguageCode(agentData.primary_language, 'pt-BR'))
      } else if (agentError) {
        console.error("Erro ao buscar nome do agente:", agentError)
      }
      
      // Buscar configurações via RPC
      const { data: configData, error: configError } = await supabase.rpc('sp_get_agent_config_by_email', {
        p_user_email: user.email,
        p_agent_id: id
      })

      if (configError) {
        console.error("Erro ao buscar configurações via RPC:", configError)
        // Fallback: buscar tudo diretamente da tabela
        const { data: fallbackData, error: fallbackError } = await supabase.from('tb_agents').select('*').eq('id', id).single()
        
        if (fallbackError) {
          console.error("Erro ao carregar agente (fallback):", fallbackError)
          return
        }
        
        if (fallbackData) {
          setName(fallbackData.nome || fallbackData.name || "")
          setInstructions(fallbackData.personality_prompt || fallbackData.system_prompt || "")
          setSelectedPrimaryLanguage(normalizeAgentLanguageCode(fallbackData.primary_language, 'pt-BR'))
          setSelectedProvider(fallbackData.provider || "openai")
          setModel(fallbackData.provider_model || "gpt-4o-mini")
          setSelectedCrm(fallbackData.crm_integration_id ? String(fallbackData.crm_integration_id) : "none")
          setSelectedWhatsappIntegration(fallbackData.integrations_id ? String(fallbackData.integrations_id) : "none")
          setTemperature([fallbackData.temperature ?? 0.7])
          setMaxTokens([fallbackData.max_tokens ?? 1000])
        }
      } else if (configData && configData.length > 0) {
        const config = configData[0]
        // A RPC não retorna o nome, então já buscamos acima
        setInstructions(config.personality_prompt || config.system_prompt || config.system_instructions || "")
        setSelectedPrimaryLanguage(normalizeAgentLanguageCode(config.primary_language, 'pt-BR'))
        setSelectedProvider(config.provider || "openai")
        setModel(config.provider_model || config.model || "gpt-4o-mini")
        setSelectedCrm(config.crm_integration_id ? String(config.crm_integration_id) : "none")
        setSelectedWhatsappIntegration(config.integrations_id ? String(config.integrations_id) : "none")
        setTemperature([config.temperature !== null && config.temperature !== undefined ? Number(config.temperature) : 0.7])
        setMaxTokens([config.max_tokens !== null && config.max_tokens !== undefined ? Number(config.max_tokens) : 1000])
      }

      // SEMPRE buscar integrations_id diretamente da tabela (a RPC pode não retornar)
      const { data: agentIntegrationsData, error: integrationsError } = await supabase
        .from('tb_agents')
        .select('integrations_id, crm_integration_id, primary_language')
        .eq('id', id)
        .single()
      
      if (!integrationsError && agentIntegrationsData) {
        if (agentIntegrationsData.integrations_id) {
          const whatsappId = String(agentIntegrationsData.integrations_id).trim()
          setSelectedWhatsappIntegration(whatsappId)
        }
        if (agentIntegrationsData.primary_language) {
          setSelectedPrimaryLanguage(normalizeAgentLanguageCode(agentIntegrationsData.primary_language, 'pt-BR'))
        }
        if (agentIntegrationsData.crm_integration_id && !selectedCrm) {
          const crmId = String(agentIntegrationsData.crm_integration_id).trim()
          setSelectedCrm(crmId)
        }
      }

      // Carregar arquivos vinculados
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
  }

  const handleSave = async () => {
    if (!name) { toast.error(t('errors.nameRequired')); return }
    setIsLoading(true)
    try {
      // A tabela tb_agents usa 'nome' (português), não 'name'
      const payload: any = {
        nome: name, // Campo correto da tabela
        provider: selectedProvider,
        provider_model: model,
        temperature: temperature[0],
        max_tokens: maxTokens[0],
        personality_prompt: instructions,
        primary_language: normalizeAgentLanguageCode(selectedPrimaryLanguage, 'pt-BR'),
        crm_integration_id: selectedCrm === 'none' ? null : selectedCrm,
        integrations_id: selectedWhatsappIntegration === 'none' ? null : selectedWhatsappIntegration
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

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-foreground/72">
          Esses ajustes afetam o comportamento geral do agente, diferente dos ajustes de voz, que mudam apenas como o audio soa.
        </p>
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg px-6 font-semibold disabled:opacity-50 sm:w-auto"
          style={primaryButtonStyle}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Check size={18} strokeWidth={3} />
          )}
          {t('button.updateSonia')}
        </Button>
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
      <div className="min-h-screen -m-4 overflow-x-hidden bg-background px-4 py-4 font-sans text-foreground sm:px-6 sm:py-5 lg:px-8 lg:py-6">
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
        <header className="mx-auto flex w-full max-w-7xl flex-col gap-5 rounded-xl p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8" style={configShellStyle}>
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
                <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/72 sm:text-[15px]">
                  Ajuste identidade, prompt, conexões, comportamento e voz do agente em uma tela única.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <Button variant="ghost" className="h-11 rounded-lg px-5 font-medium" style={secondaryButtonStyle} onClick={() => window.history.back()}>{t('button.cancel')}</Button>
            <Button onClick={handleSave} disabled={isLoading} className="h-11 rounded-lg px-6 font-semibold disabled:opacity-50" style={primaryButtonStyle}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('button.saveSonia')}
            </Button>
          </div>
        </header>

        <main className="mx-auto mt-8 flex w-full max-w-7xl flex-col gap-10 sm:mt-9 lg:mt-10">
          {/* GRID TRAVADO: 8 colunas para conteúdo e 4 para ajustes na direita */}
          <div className="grid grid-cols-1 gap-10">

            {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL */}
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
                      Defina o nome, o idioma principal e o prompt base que orienta o comportamento do agente.
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
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">{t('identity.instructionsLabel')}</Label>
                    <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('identity.instructionsPlaceholder')} className="min-h-[320px] resize-y border p-5 text-sm font-medium leading-relaxed transition-all duration-300 focus-visible:ring-2 focus-visible:ring-cyan-500/25 dark:focus-visible:ring-cyan-400/20 lg:min-h-[360px]" style={{ ...fieldSurfaceStyle, borderRadius: '1rem' }} />
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
                      Conecte os sistemas usados pelo agente e escolha a base de conhecimento disponivel para consulta.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">{t('connections.crmLabel')}</Label>
                    <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                      <SelectTrigger className="h-12 border px-4 font-black shadow-none transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20" style={fieldSurfaceStyle}>
                        <SelectValue placeholder={t('connections.crmPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-[1.35rem] border p-2" style={selectContentStyle}>
                        <SelectItem value="none" className="rounded-2xl font-bold text-foreground/60">{t('connections.noCRM')}</SelectItem>
                        {availableCrms.map(crm => (
                          <SelectItem key={crm.id} value={String(crm.id)} className="rounded-2xl font-bold text-zinc-900 dark:text-zinc-50">{crm.tb_crms?.name || 'CRM'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">WhatsApp Integration</Label>
                    <Select 
                      value={selectedWhatsappIntegration || "none"} 
                      onValueChange={setSelectedWhatsappIntegration}
                    >
                      <SelectTrigger className="h-12 border px-4 font-black shadow-none transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20" style={fieldSurfaceStyle}>
                        <SelectValue placeholder="Selecione uma integração WhatsApp" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[1.35rem] border p-2" style={selectContentStyle}>
                        <SelectItem value="none" className="rounded-2xl font-bold text-foreground/60">Nenhuma integração</SelectItem>
                        {availableWhatsappIntegrations.map(int => (
                          <SelectItem key={int.id} value={int.id} className="rounded-2xl font-bold text-zinc-900 dark:text-zinc-50">
                            {`${int.phone_number || 'Sem Telefone'} | ${int.email || 'Sem Email'}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-zinc-400">{t('connections.filesLabel')}</Label>
                        <p className="mt-1 text-sm text-foreground/72">
                          Selecione os arquivos que o agente pode consultar como base de conhecimento.
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit rounded-md px-3 py-1">
                        {selectedFileIds.length} selecionado{selectedFileIds.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    {availableFiles.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-foreground/70">
                        Nenhum arquivo disponivel para vincular a este agente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {availableFiles.map((file) => {
                          const isSelected = selectedFileIds.includes(file.id)

                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => setSelectedFileIds(prev =>
                                prev.includes(file.id)
                                  ? prev.filter(id => id !== file.id)
                                  : [...prev, file.id]
                              )}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-border/80 bg-muted/15 hover:border-primary/35 dark:bg-background"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                                  isSelected
                                    ? "border-primary/30 bg-primary text-primary-foreground"
                                    : "border-border/80 bg-background/80 text-foreground/65 dark:bg-card dark:text-muted-foreground"
                                )}>
                                  <FileText size={16} strokeWidth={2.2} />
                                </div>
                                <div className="min-w-0">
                                  <div className={cn(
                                    "truncate text-sm font-semibold",
                                    isSelected ? "text-foreground" : "text-foreground"
                                  )}>
                                    {file.original_name}
                                  </div>
                                  <div className="text-xs text-foreground/65">
                                    {isSelected ? "Incluido na base do agente" : "Clique para incluir"}
                                  </div>
                                </div>
                              </div>
                              {isSelected ? (
                                <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.6} />
                              ) : (
                                <Plus className="h-5 w-5 shrink-0 text-muted-foreground/60" strokeWidth={2.2} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <AgentVoiceSettings
                agentId={agentId}
                agentName={name}
                neuralSettings={neuralSettingsCard}
              />

            </div>

            {/* SIDEBAR DIREITA: AJUSTES E SKILLS (FIXA E DIDÁTICA) */}
            <aside className="hidden">
              
              {/* Ajuste Neural - ROXO PREMIUM */}
              <div className={sectionCardClass} style={configShellStyle}>
                <div className={sectionHeaderClass}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <BrainCircuit size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className={sectionTitleClass}>{t('neural.title')}</h4>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Ajuste como a Sonia responde sem expor configuracoes tecnicas de provedor ou modelo para o usuario final.
                    </p>
                  </div>
                </div>

                <p className="hidden">
                  Ajuste como a Sonia responde sem expor configurações técnicas de provedor ou modelo para o usuário final.
                </p>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* SLIDER DE PRECISÃO */}
                  <div className="space-y-4 rounded-lg border border-border bg-background px-4 py-4">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('neural.creativityLabel')}</Label>
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
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                      <span>{t('neural.exact')}</span><span>{t('neural.creative')}</span>
                    </div>
                  </div>

                  {/* NOVO: SLIDER DE TOKENS (TAMANHO DA RESPOSTA) */}
                  <div className="space-y-4 rounded-lg border border-border bg-background px-4 py-4">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('neural.responseSizeLabel')}</Label>
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
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Estes ajustes controlam criatividade e tamanho de resposta do agente e sao salvos junto com a configuracao principal.
                  </p>
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg px-6 font-semibold disabled:opacity-50 sm:w-auto"
                    style={primaryButtonStyle}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Check size={18} strokeWidth={3} />
                    )}
                    {t('button.updateSonia')}
                  </Button>
                </div>
              </div>

              {/* BOTÃO FINAL DE ATIVAÇÃO */}
            </aside>
          </div>

        </main>
      </div>
  )
}
