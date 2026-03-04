
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Bot, Sparkles, Cpu, Plus, Trash2, Check,
  Globe, Lock, ChevronRight, Settings2, Loader2, Info,
  MessageSquare, BrainCircuit, Mic2, Search, Database, FileText, Save, X, LayoutGrid, Zap
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { cn } from "../lib/utils"
import { Badge } from "../components/ui/badge"
import { toast } from "sonner"
import { Toaster } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
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
  const [selectedProvider, setSelectedProvider] = useState("openai")
  const [model, setModel] = useState("gpt-4o-mini")
  const [selectedCrm, setSelectedCrm] = useState("none")
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  
  // PARÂMETROS DIDÁTICOS
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([1000])

  const [capabilities, setCapabilities] = useState({
    voice: false,
    memory: true,
    internet: false,
    rag: true
  })

  const providerModels: Record<string, { id: string, name: string }[]> = {
    openai: [{ id: "gpt-4o", name: "GPT-4o (Premium)" }, { id: "gpt-4o-mini", name: "GPT-4o Mini (Veloz)" }],
    anthropic: [{ id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }, { id: "claude-3-haiku", name: "Claude 3 Haiku" }],
    google: [{ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" }]
  }

  const [availableFiles, setAvailableFiles] = useState<any[]>([])
  const [availableCrms, setAvailableCrms] = useState<any[]>([])
  const [availableWhatsappIntegrations, setAvailableWhatsappIntegrations] = useState<any[]>([])
  const [selectedWhatsappIntegration, setSelectedWhatsappIntegration] = useState("none")

  // Mapeamento de cores para habilidades (classes fixas que o Tailwind detecta)
  const capabilityStyles = {
    voice: {
      active: "bg-purple-500 border-purple-500 text-white",
      inactive: "bg-slate-50 border-slate-200 text-slate-400"
    },
    memory: {
      active: "bg-emerald-500 border-emerald-500 text-white",
      inactive: "bg-slate-50 border-slate-200 text-slate-400"
    },
    internet: {
      active: "bg-amber-500 border-amber-500 text-white",
      inactive: "bg-slate-50 border-slate-200 text-slate-400"
    },
    rag: {
      active: "bg-blue-500 border-blue-500 text-white",
      inactive: "bg-slate-50 border-slate-200 text-slate-400"
    }
  }

  // Mapeamento de cores de ícones (classes fixas)
  const iconColors = {
    voice: {
      active: "text-white",
      inactive: "text-slate-400"
    },
    memory: {
      active: "text-white",
      inactive: "text-slate-400"
    },
    internet: {
      active: "text-white",
      inactive: "text-slate-400"
    },
    rag: {
      active: "text-white",
      inactive: "text-slate-400"
    }
  }

  // Mapeamento de cores para arquivos selecionados
  const fileStyles = {
    selected: "bg-blue-50 border-blue-400 text-blue-700",
    unselected: "bg-white border-slate-100 text-slate-400"
  }

  const fileIconColors = {
    selected: "text-blue-600",
    unselected: "text-slate-400"
  }

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

  // Debug: monitorar mudanças no nome
  useEffect(() => {
    console.log("Nome atualizado:", name)
  }, [name])

  // Debug: monitorar mudanças no WhatsApp Integration
  useEffect(() => {
    console.log("selectedWhatsappIntegration atualizado:", selectedWhatsappIntegration)
    console.log("availableWhatsappIntegrations:", availableWhatsappIntegrations)
    if (selectedWhatsappIntegration && selectedWhatsappIntegration !== "none") {
      const found = availableWhatsappIntegrations.find(int => int.id === selectedWhatsappIntegration)
      console.log("Integração encontrada no array:", found)
    }
  }, [selectedWhatsappIntegration, availableWhatsappIntegrations])

  const loadAvailableData = async () => {
    if (!user?.email || !userId) return
    try {
      const { data: filesData } = await supabase.rpc('sp_list_files_by_email', { p_email: user.email })
      setAvailableFiles(filesData || [])

      const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
      if (companyUser?.companies_id) {
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms(crmsData || [])
        
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
      console.log("loadAgentData: Iniciando carregamento para ID:", id)
      
      // SEMPRE buscar o nome diretamente da tabela tb_agents (a RPC não retorna o nome)
      // A coluna na tabela é 'nome' (português), não 'name'
      const { data: agentData, error: agentError } = await supabase.from('tb_agents').select('nome').eq('id', id).single()
      
      if (agentData && agentData.nome) {
        console.log("Nome do agente carregado da tabela:", agentData.nome)
        setName(agentData.nome)
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
          console.log("Dados do agente carregados (fallback):", fallbackData)
          setName(fallbackData.nome || fallbackData.name || "")
          setInstructions(fallbackData.personality_prompt || fallbackData.system_prompt || "")
          setSelectedProvider(fallbackData.provider || "openai")
          setModel(fallbackData.provider_model || "gpt-4o-mini")
          setSelectedCrm(fallbackData.crm_integration_id ? String(fallbackData.crm_integration_id) : "none")
          setSelectedWhatsappIntegration(fallbackData.integrations_id ? String(fallbackData.integrations_id) : "none")
          setTemperature([fallbackData.temperature ?? 0.7])
          setMaxTokens([fallbackData.max_tokens ?? 1000])
          const caps = fallbackData.capabilities || {}
          setCapabilities({ voice: !!caps.voice, memory: caps.memory !== false, internet: !!caps.internet, rag: caps.rag !== false })
        }
      } else if (configData && configData.length > 0) {
        const config = configData[0]
        console.log("Dados do agente carregados via RPC:", config)
        console.log("integrations_id da RPC:", config.integrations_id, "Tipo:", typeof config.integrations_id)
        // A RPC não retorna o nome, então já buscamos acima
        setInstructions(config.personality_prompt || config.system_prompt || config.system_instructions || "")
        setSelectedProvider(config.provider || "openai")
        setModel(config.provider_model || config.model || "gpt-4o-mini")
        setSelectedCrm(config.crm_integration_id ? String(config.crm_integration_id) : "none")
        setSelectedWhatsappIntegration(config.integrations_id ? String(config.integrations_id) : "none")
        setTemperature([config.temperature !== null && config.temperature !== undefined ? Number(config.temperature) : 0.7])
        setMaxTokens([config.max_tokens !== null && config.max_tokens !== undefined ? Number(config.max_tokens) : 1000])
        const caps = config.capabilities || {}
        setCapabilities({ voice: !!caps.voice, memory: caps.memory !== false, internet: !!caps.internet, rag: caps.rag !== false })
      }

      // SEMPRE buscar integrations_id diretamente da tabela (a RPC pode não retornar)
      const { data: agentIntegrationsData, error: integrationsError } = await supabase
        .from('tb_agents')
        .select('integrations_id, crm_integration_id')
        .eq('id', id)
        .single()
      
      if (!integrationsError && agentIntegrationsData) {
        console.log("Dados de integrações carregados diretamente da tabela:", agentIntegrationsData)
        if (agentIntegrationsData.integrations_id) {
          const whatsappId = String(agentIntegrationsData.integrations_id).trim()
          console.log("Definindo WhatsApp Integration da tabela (fallback):", whatsappId)
          setSelectedWhatsappIntegration(whatsappId)
        }
        if (agentIntegrationsData.crm_integration_id && !selectedCrm) {
          const crmId = String(agentIntegrationsData.crm_integration_id).trim()
          console.log("Definindo CRM da tabela (fallback):", crmId)
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
        crm_integration_id: selectedCrm === 'none' ? null : selectedCrm,
        integrations_id: selectedWhatsappIntegration === 'none' ? null : selectedWhatsappIntegration
      }
      
      if (agentId) {
        const { error } = await supabase.from('tb_agents').update(payload).eq('id', agentId)
        if (error) {
          console.error("Erro ao atualizar agente:", error)
          toast.error(t('errors.saveError', { message: error.message }))
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

  if (isFetching) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#F8FAFC' }}>
      <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
      <p className="text-[10px] font-black uppercase" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>{t('loading.syncing')}</p>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="min-h-screen pb-32 font-sans overflow-x-hidden" style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#F4F7FA', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
        <style>{`
          .slider-cyan [data-slot="slider-track"] {
            background-color: ${theme === 'dark' ? '#334155' : '#e2e8f0'} !important;
          }
          .slider-cyan [data-slot="slider-range"] {
            background: linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%) !important;
          }
          .slider-cyan [data-slot="slider-thumb"] {
            border-color: #06b6d4 !important;
            background-color: ${theme === 'dark' ? '#1e293b' : '#ffffff'} !important;
            box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2) !important;
          }
          .slider-cyan [data-slot="slider-thumb"]:hover {
            box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.3) !important;
          }
          [data-slot="input"] {
            border-radius: 2.5rem !important;
          }
        `}</style>
        <Toaster position="top-center" />

        {/* Header Sonia Premium */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-10 py-6 backdrop-blur-xl border-b-2 shadow-sm" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', borderColor: theme === 'dark' ? '#1e293b' : '#f1f5f9' }}>
          <div className="flex items-center gap-6">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2rem] shadow-xl flex items-center justify-center border-4 shrink-0" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#ffffff' }}>
              <Zap className="h-8 w-8 text-blue-400" strokeWidth={2.5} style={{ color: '#60A5FA', fill: '#60A5FA' }} />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-2xl tracking-tighter leading-none" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{name || (agentId ? t('header.editBrain') : t('header.newBrain'))}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: theme === 'dark' ? '#06b6d4' : '#3b82f6' }}>{t('header.highPerformance')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-2xl font-bold px-6" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }} onClick={() => window.history.back()}>{t('button.cancel')}</Button>
            <Button onClick={handleSave} disabled={isLoading} className="rounded-full px-10 h-14 font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)', color: '#ffffff', boxShadow: '0 10px 25px -5px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)' }}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2 text-white" /> : <Save className="w-4 h-4 mr-2 text-white" />}
              {t('button.saveSonia')}
            </Button>
          </div>
        </header>

        <main className="max-w-[1450px] mx-auto px-10 py-12">
          {/* GRID TRAVADO: 8 colunas para conteúdo e 4 para ajustes na direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

            {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL */}
            <div className="lg:col-span-8 space-y-16">
              
              {/* Personalidade */}
              <section className="p-12 border-2 space-y-10 relative overflow-hidden group transition-all duration-300" style={{
                borderRadius: '5rem',
                background: theme === 'dark' ? '#1e293b' : 'linear-gradient(to bottom right, #dbeafe, #cffafe)',
                borderColor: theme === 'dark' ? '#06b6d4' : '#bfdbfe',
                boxShadow: theme === 'dark' 
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(30, 58, 138, 0.1), 0 0 0 1px rgba(191, 219, 254, 0.3)',
                transform: 'translateY(0)',
                marginBottom: '2rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.4), 0 30px 60px -10px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2)'
                  : '0 30px 60px -10px rgba(30, 58, 138, 0.15), 0 0 0 1px rgba(191, 219, 254, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(30, 58, 138, 0.1), 0 0 0 1px rgba(191, 219, 254, 0.3)'
              }}>
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-[2rem] flex items-center justify-center text-white shadow-inner shrink-0" style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)'
                  }}>
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <h2 className="font-black uppercase text-xs tracking-[0.2em]" style={{ color: theme === 'dark' ? '#06b6d4' : '#1e40af' }}>{t('identity.title')}</h2>
                </div>

                <div className="grid relative z-10">
                  <div className="space-y-2 mb-12">
                    <Label className="text-[10px] font-black uppercase ml-4 tracking-widest uppercase" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('identity.nameLabel')}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('identity.namePlaceholder')} className="h-18 border-2 px-8 text-lg font-bold focus:border-blue-500 shadow-inner !rounded-[2.5rem]" style={{ borderRadius: '2.5rem !important', backgroundColor: theme === 'dark' ? '#1e293b' : 'rgba(248, 250, 252, 0.5)', borderColor: theme === 'dark' ? '#334155' : '#f1f5f9', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-4 tracking-widest uppercase" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('identity.instructionsLabel')}</Label>
                    <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('identity.instructionsPlaceholder')} className="border-2 p-10 text-base font-medium focus:border-blue-500 resize-none transition-all shadow-inner leading-relaxed rounded-lg" style={{ minHeight: '500px', backgroundColor: theme === 'dark' ? '#1e293b' : 'rgba(248, 250, 252, 0.5)', borderColor: theme === 'dark' ? '#334155' : '#f1f5f9', color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }} />
                  </div>
                </div>
              </section>

              {/* Conexões */}
              <section className="p-12 border-2 space-y-10 relative overflow-hidden transition-all duration-300" style={{
                borderRadius: '5rem',
                background: theme === 'dark' ? '#1e293b' : 'linear-gradient(to bottom right, #d1fae5, #ccfbf1)',
                borderColor: theme === 'dark' ? '#06b6d4' : '#a7f3d0',
                boxShadow: theme === 'dark' 
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(6, 78, 59, 0.1), 0 0 0 1px rgba(167, 243, 208, 0.3)',
                transform: 'translateY(0)',
                marginBottom: '2rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.4), 0 30px 60px -10px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2)'
                  : '0 30px 60px -10px rgba(6, 78, 59, 0.15), 0 0 0 1px rgba(167, 243, 208, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(6, 78, 59, 0.1), 0 0 0 1px rgba(167, 243, 208, 0.3)'
              }}>
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-[2rem] bg-emerald-500 flex items-center justify-center text-white shadow-inner shrink-0">
                    <Database size={24} className="text-white" />
                  </div>
                  <h2 className="font-black uppercase text-xs tracking-[0.2em]" style={{ color: theme === 'dark' ? '#10b981' : '#047857' }}>{t('connections.title')}</h2>
                </div>

                <div className="grid gap-10 relative z-10">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-4 tracking-widest" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('connections.crmLabel')}</Label>
                    <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                      <SelectTrigger className="h-18 border-2 px-8 font-black shadow-sm transition-all focus:ring-emerald-500" style={{ borderRadius: '2.5rem', backgroundColor: theme === 'dark' ? '#1e293b' : 'rgba(248, 250, 252, 0.5)', borderColor: theme === 'dark' ? '#334155' : '#f1f5f9', color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                        <SelectValue placeholder={t('connections.crmPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-[2rem] border-none shadow-2xl p-2 border-2" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                        <SelectItem value="none" className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>{t('connections.noCRM')}</SelectItem>
                        {availableCrms.map(crm => (
                          <SelectItem key={crm.id} value={String(crm.id)} className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{crm.tb_crms?.name || 'CRM'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-4 tracking-widest" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>WhatsApp Integration</Label>
                    <Select 
                      value={selectedWhatsappIntegration || "none"} 
                      onValueChange={(val) => {
                        console.log("WhatsApp Integration mudou de", selectedWhatsappIntegration, "para", val)
                        setSelectedWhatsappIntegration(val)
                      }}
                    >
                      <SelectTrigger className="h-18 border-2 px-8 font-black shadow-sm transition-all focus:ring-emerald-500" style={{ borderRadius: '2.5rem', backgroundColor: theme === 'dark' ? '#1e293b' : 'rgba(248, 250, 252, 0.5)', borderColor: theme === 'dark' ? '#334155' : '#f1f5f9', color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                        <SelectValue placeholder="Selecione uma integração WhatsApp" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[2rem] border-none shadow-2xl p-2 border-2" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                        <SelectItem value="none" className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>Nenhuma integração</SelectItem>
                        {availableWhatsappIntegrations.map(int => (
                          <SelectItem key={int.id} value={int.id} className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                            {`${int.phone_number || 'Sem Telefone'} | ${int.email || 'Sem Email'}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {capabilities.rag && (
                    <div className="space-y-2 animate-in slide-in-from-top-4">
                      <Label className="text-[10px] font-black uppercase ml-4 tracking-widest" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('connections.filesLabel')}</Label>
                      <div className="grid grid-cols-1 gap-4">
                        {availableFiles.map((file) => {
                          const isSelected = selectedFileIds.includes(file.id)
                          
                          return (
                            <div 
                              key={file.id} 
                              onClick={() => setSelectedFileIds(prev => 
                                prev.includes(file.id) 
                                  ? prev.filter(id => id !== file.id) 
                                  : [...prev, file.id]
                              )}
                              className={cn(
                                "flex items-center justify-between p-6 border-2 transition-all cursor-pointer shadow-sm",
                                isSelected && "shadow-lg scale-[1.02]",
                                !isSelected && "hover:border-blue-200"
                              )}
                              style={{
                                borderRadius: '3rem',
                                backgroundColor: isSelected 
                                  ? (theme === 'dark' ? '#1e3a5f' : '#dbeafe')
                                  : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                borderColor: isSelected 
                                  ? (theme === 'dark' ? '#06b6d4' : '#60a5fa')
                                  : (theme === 'dark' ? '#334155' : '#f1f5f9'),
                                color: isSelected 
                                  ? (theme === 'dark' ? '#06b6d4' : '#1e40af')
                                  : (theme === 'dark' ? '#94a3b8' : '#94a3b8')
                              }}
                            >
                              <div className="flex items-center gap-5">
                                <FileText 
                                  size={24} 
                                  strokeWidth={2.5}
                                  style={{ color: isSelected ? (theme === 'dark' ? '#06b6d4' : '#2563eb') : (theme === 'dark' ? '#64748b' : '#94a3b8') }}
                                />
                                <span className="text-sm font-black tracking-tight" style={{ color: isSelected ? (theme === 'dark' ? '#06b6d4' : '#1e40af') : (theme === 'dark' ? '#cbd5e1' : '#475569') }}>{file.original_name}</span>
                              </div>
                              {isSelected ? (
                                <Check className="w-6 h-6" strokeWidth={3} style={{ color: theme === 'dark' ? '#06b6d4' : '#2563eb' }} />
                              ) : (
                                <Plus className="w-6 h-6 opacity-20" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* SIDEBAR DIREITA: AJUSTES E SKILLS (FIXA E DIDÁTICA) */}
            <aside className="lg:col-span-4 space-y-16 sticky top-32 shrink-0">
              
              {/* Ajuste Neural - ROXO PREMIUM */}
              <div className="p-12 relative overflow-hidden border-2 space-y-10 transition-all duration-300" style={{
                borderRadius: '5rem',
                background: theme === 'dark' ? '#1e293b' : 'linear-gradient(to bottom right, #faf5ff, #fce7f3)',
                borderColor: theme === 'dark' ? '#06b6d4' : '#e9d5ff',
                boxShadow: theme === 'dark' 
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(88, 28, 135, 0.1), 0 0 0 1px rgba(233, 213, 255, 0.3)',
                transform: 'translateY(0)',
                marginBottom: '2rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.4), 0 30px 60px -10px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2)'
                  : '0 30px 60px -10px rgba(88, 28, 135, 0.15), 0 0 0 1px rgba(233, 213, 255, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(88, 28, 135, 0.1), 0 0 0 1px rgba(233, 213, 255, 0.3)'
              }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/30 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-[2rem] bg-purple-500 flex items-center justify-center text-white shadow-inner shrink-0">
                    <BrainCircuit size={24} className="text-white" />
                  </div>
                  <h4 className="font-black text-[10px] uppercase tracking-[0.4em] relative z-10" style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed' }}>
                    {t('neural.title')}
                  </h4>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase ml-4 tracking-widest" style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed' }}>{t('neural.providerLabel')}</Label>
                    <Select value={selectedProvider} onValueChange={(val) => { setSelectedProvider(val); setModel(providerModels[val][0].id); }}>
                      <SelectTrigger className="h-14 border-purple-200 font-black text-xs px-6 shadow-inner" style={{ borderRadius: '2.5rem', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#6b21a8' : '#c084fc', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-[2rem] border-slate-200" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                        <SelectItem value="openai" className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>OpenAI</SelectItem>
                        <SelectItem value="anthropic" className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>Anthropic</SelectItem>
                        <SelectItem value="google" className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>Google Cloud</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase ml-4 tracking-widest" style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed' }}>{t('neural.modelLabel')}</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="h-14 border-purple-200 font-black text-xs px-6 shadow-inner" style={{ borderRadius: '2.5rem', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#6b21a8' : '#c084fc', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-[2rem] border-slate-200" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                        {providerModels[selectedProvider]?.map(m => (
                          <SelectItem key={m.id} value={m.id} className="rounded-2xl font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SLIDER DE PRECISÃO */}
                  <div className="space-y-6 pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#6b21a8' : '#c084fc' }}>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[9px] font-black uppercase ml-4 tracking-[0.2em]" style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed' }}>{t('neural.creativityLabel')}</Label>
                      <span className="text-3xl font-black" style={{ color: theme === 'dark' ? '#a78bfa' : '#9333ea' }}>{Math.round(temperature[0] * 100)}%</span>
                    </div>
                    <div 
                      className="relative slider-cyan"
                      style={{
                        ['--slider-track-bg' as any]: theme === 'dark' ? '#334155' : '#e2e8f0',
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
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a78bfa' : '#a855f7' }}>
                      <span>{t('neural.exact')}</span><span>{t('neural.creative')}</span>
                    </div>
                  </div>

                  {/* NOVO: SLIDER DE TOKENS (TAMANHO DA RESPOSTA) */}
                  <div className="space-y-6 pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#6b21a8' : '#c084fc' }}>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[9px] font-black uppercase ml-4 tracking-[0.2em]" style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed' }}>{t('neural.responseSizeLabel')}</Label>
                      <span className="text-2xl font-black" style={{ color: theme === 'dark' ? '#f472b6' : '#db2777' }}>{maxTokens[0]} {t('neural.tokens')}</span>
                    </div>
                    <div 
                      className="relative slider-cyan"
                      style={{
                        ['--slider-track-bg' as any]: theme === 'dark' ? '#334155' : '#e2e8f0',
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
              </div>

              {/* Habilidades - CORES VIBRANTES E ÍCONES BLINDADOS */}
              <div className="border-2 shadow-2xl transition-all duration-300 overflow-hidden" style={{ 
                borderRadius: '5rem', 
                padding: '4.5rem 3.5rem !important',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                borderColor: theme === 'dark' ? '#06b6d4' : '#ffffff',
                boxShadow: theme === 'dark' 
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
                transform: 'translateY(0)',
                marginBottom: '2rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.4), 0 30px 60px -10px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2)'
                  : '0 30px 60px -10px rgba(0, 0, 0, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = theme === 'dark'
                  ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 20px 40px -10px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1)'
                  : '0 20px 40px -10px rgba(0, 0, 0, 0.1)'
              }}>
                <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-center tracking-widest mb-6" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>{t('skills.title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'memory', label: t('skills.crm'), icon: LayoutGrid, checked: selectedCrm !== 'none' },
                    { id: 'rag', label: t('skills.rag'), icon: Search, checked: capabilities.rag },
                  ].map((cap) => {
                    const isActive = cap.checked
                    const styles = capabilityStyles[cap.id as keyof typeof capabilityStyles]
                    
                    return (
                      <div
                        key={cap.id}
                        onClick={() => {
                          if (cap.id === 'rag') setCapabilities(prev => ({ ...prev, rag: !prev.rag }))
                        }}
                        className={cn(
                          "p-3 flex flex-col items-center gap-1.5 transition-all cursor-pointer border-2",
                          isActive ? styles.active : styles.inactive,
                          isActive ? "" : "hover:opacity-100 opacity-60"
                        )}
                        style={{ 
                          borderRadius: '1.25rem', 
                          minHeight: '80px',
                          boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
                          borderWidth: '2px'
                        }}
                      >
                        <cap.icon 
                          size={18} 
                          strokeWidth={2.5} 
                          className={isActive ? "text-white" : "text-slate-400"}
                        />
                        <span className={cn(
                          "text-[7px] font-black uppercase tracking-widest text-center leading-tight",
                          isActive ? "text-white" : "text-slate-500"
                        )}>
                          {cap.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BOTÃO FINAL DE ATIVAÇÃO */}
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full h-24 font-black uppercase text-sm tracking-[0.6em] shadow-[0_30px_60px_rgba(0,0,0,0.1)] transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
                style={{
                  borderRadius: '9999px',
                  background: theme === 'dark' 
                    ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)'
                    : '#0f172a',
                  color: '#ffffff',
                  boxShadow: theme === 'dark'
                    ? '0 30px 60px rgba(8, 145, 178, 0.2)'
                    : '0 30px 60px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = theme === 'dark'
                      ? 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)'
                      : '#000000'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = theme === 'dark'
                      ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)'
                      : '#0f172a'
                  }
                }}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-white" />
                ) : (
                  <Check size={28} className="text-emerald-400" strokeWidth={3} />
                )}
                {t('button.updateSonia')}
              </Button>
            </aside>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
