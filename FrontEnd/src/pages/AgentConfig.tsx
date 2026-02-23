
import { useEffect, useState } from "react"
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

export function AgentConfig() {
  const { user, userId } = useAuth()
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

  const loadAvailableData = async () => {
    if (!user?.email || !userId) return
    try {
      const { data: filesData } = await supabase.rpc('sp_list_files_by_email', { p_email: user.email })
      setAvailableFiles(filesData || [])

      const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
      if (companyUser?.companies_id) {
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms(crmsData || [])
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
          setTemperature([fallbackData.temperature ?? 0.7])
          setMaxTokens([fallbackData.max_tokens ?? 1000])
          const caps = fallbackData.capabilities || {}
          setCapabilities({ voice: !!caps.voice, memory: caps.memory !== false, internet: !!caps.internet, rag: caps.rag !== false })
        }
      } else if (configData && configData.length > 0) {
        const config = configData[0]
        console.log("Dados do agente carregados via RPC:", config)
        // A RPC não retorna o nome, então já buscamos acima
        setInstructions(config.personality_prompt || config.system_prompt || config.system_instructions || "")
        setSelectedProvider(config.provider || "openai")
        setModel(config.provider_model || config.model || "gpt-4o-mini")
        setSelectedCrm(config.crm_integration_id ? String(config.crm_integration_id) : "none")
        setTemperature([config.temperature !== null && config.temperature !== undefined ? Number(config.temperature) : 0.7])
        setMaxTokens([config.max_tokens !== null && config.max_tokens !== undefined ? Number(config.max_tokens) : 1000])
        const caps = config.capabilities || {}
        setCapabilities({ voice: !!caps.voice, memory: caps.memory !== false, internet: !!caps.internet, rag: caps.rag !== false })
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
    if (!name) { toast.error("Dê um nome ao agente!"); return }
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
        crm_integration_id: selectedCrm === 'none' ? null : selectedCrm
      }
      
      if (agentId) {
        const { error } = await supabase.from('tb_agents').update(payload).eq('id', agentId)
        if (error) {
          console.error("Erro ao atualizar agente:", error)
          toast.error(`Erro ao salvar: ${error.message}`)
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
        toast.success("Configuração salva!"); window.history.back()
      } else {
        await api.agents.create(payload)
        toast.success("Configuração salva!"); window.history.back()
      }
    } catch (e: any) { 
      console.error("Erro ao salvar:", e)
      toast.error(`Erro ao salvar: ${e.message || 'Erro desconhecido'}`) 
    } finally { setIsLoading(false) }
  }

  if (isFetching) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
      <p className="text-[10px] font-black uppercase text-slate-400">Sincronizando Sonia...</p>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#F4F7FA] pb-32 font-sans overflow-x-hidden text-slate-900">
        <Toaster position="top-center" />

        {/* Header Sonia Premium */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-10 py-6 bg-white/90 backdrop-blur-xl border-b-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center border-4 border-white shrink-0">
              <Zap className="h-8 w-8 text-blue-400" strokeWidth={2.5} style={{ color: '#60A5FA', fill: '#60A5FA' }} />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-2xl text-slate-900 tracking-tighter leading-none">{name || (agentId ? 'Editar Cérebro' : 'Novo Cérebro')}</h1>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Configuração de Alta Performance</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-2xl font-bold text-slate-400 px-6" onClick={() => window.history.back()}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading} className="rounded-full px-10 h-14 !bg-blue-600 text-white font-black uppercase text-xs shadow-xl shadow-blue-200 hover:!bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2 text-white" /> : <Save className="w-4 h-4 mr-2 text-white" />}
              Salvar Sonia
            </Button>
          </div>
        </header>

        <main className="max-w-[1450px] mx-auto px-10 py-12">
          {/* GRID TRAVADO: 8 colunas para conteúdo e 4 para ajustes na direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL */}
            <div className="lg:col-span-8 space-y-12">
              
              {/* Personalidade */}
              <section className="bg-gradient-to-br from-blue-50 to-cyan-50 p-12 rounded-[4rem] shadow-2xl shadow-blue-900/5 border-2 border-blue-100 space-y-10 relative overflow-hidden group">
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-inner shrink-0">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <h2 className="font-black text-blue-700 uppercase text-xs tracking-[0.2em]">Identidade da IA</h2>
                </div>

                <div className="grid relative z-10">
                  <div className="space-y-2 mb-12">
                    <Label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest uppercase">Nome da sua Sonia</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sonia Atendimento VIP" className="h-18 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-8 text-lg font-bold focus:border-blue-500 shadow-inner" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest uppercase">Instruções Mentais (Prompt)</Label>
                    <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Defina como ela deve agir..." className="rounded-[3rem] border-2 border-slate-100 bg-slate-50/50 p-10 text-base font-medium text-slate-700 focus:border-blue-500 resize-none transition-all shadow-inner leading-relaxed" style={{ minHeight: '500px' }} />
                  </div>
                </div>
              </section>

              {/* Conexões */}
              <section className="bg-gradient-to-br from-emerald-50 to-teal-50 p-12 rounded-[4rem] shadow-2xl shadow-emerald-900/5 border-2 border-emerald-100 space-y-10 relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-inner shrink-0">
                    <Database size={24} className="text-white" />
                  </div>
                  <h2 className="font-black text-emerald-700 uppercase text-xs tracking-[0.2em]">Conexões e Knowledge Base</h2>
                </div>

                <div className="grid gap-10 relative z-10">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Integração CRM Ativa</Label>
                    <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                      <SelectTrigger className="h-18 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-8 font-black text-slate-700 shadow-sm transition-all focus:ring-emerald-500">
                        <SelectValue placeholder="Selecione um CRM..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-3xl border-none shadow-2xl p-2 bg-white border-2">
                        <SelectItem value="none" className="rounded-xl font-bold text-slate-400">Nenhum CRM vinculado</SelectItem>
                        {availableCrms.map(crm => (
                          <SelectItem key={crm.id} value={String(crm.id)} className="rounded-xl font-bold text-slate-900">{crm.tb_crms?.name || 'CRM'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {capabilities.rag && (
                    <div className="space-y-2 animate-in slide-in-from-top-4">
                      <Label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Arquivos Selecionados (RAG)</Label>
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
                                "flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer shadow-sm",
                                isSelected ? fileStyles.selected : fileStyles.unselected,
                                isSelected && "shadow-lg scale-[1.02]",
                                !isSelected && "hover:border-blue-200"
                              )}
                            >
                              <div className="flex items-center gap-5">
                                <FileText 
                                  size={24} 
                                  strokeWidth={2.5}
                                  className={isSelected ? fileIconColors.selected : fileIconColors.unselected}
                                />
                                <span className="text-sm font-black tracking-tight">{file.original_name}</span>
                              </div>
                              {isSelected ? (
                                <Check className={cn("w-6 h-6", fileIconColors.selected)} strokeWidth={3} />
                              ) : (
                                <Plus className="w-6 h-6 opacity-20" />
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
            <aside className="lg:col-span-4 space-y-10 sticky top-32 shrink-0">
              
              {/* Ajuste Neural - ROXO PREMIUM */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden border-2 border-purple-100 space-y-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/30 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                <div className="flex items-center gap-3 relative z-10 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-inner shrink-0">
                    <BrainCircuit size={24} className="text-white" />
                  </div>
                  <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-purple-700 relative z-10">
                    Ajuste Neural
                  </h4>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase text-purple-700 ml-4 tracking-widest">Provedor de IA</Label>
                    <Select value={selectedProvider} onValueChange={(val) => { setSelectedProvider(val); setModel(providerModels[val][0].id); }}>
                      <SelectTrigger className="h-14 bg-white border-purple-200 rounded-2xl text-slate-900 font-black text-xs px-6 shadow-inner"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl bg-white text-slate-950 border-slate-200">
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google Cloud</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase text-purple-700 ml-4 tracking-widest">Modelo de IA</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="h-14 bg-white border-purple-200 rounded-2xl text-slate-900 font-black text-xs px-6 shadow-inner"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl bg-white text-slate-950 border-slate-200">
                        {providerModels[selectedProvider]?.map(m => (
                          <SelectItem key={m.id} value={m.id} className="font-bold">{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SLIDER DE PRECISÃO */}
                  <div className="space-y-6 pt-4 border-t border-purple-200">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[9px] font-black uppercase text-purple-700 ml-4 tracking-[0.2em]">Biscoitos (Criatividade)</Label>
                      <span className="text-3xl font-black text-purple-600">{Math.round(temperature[0] * 100)}%</span>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={temperature} onValueChange={setTemperature} className="cursor-pointer" />
                    <div className="flex justify-between text-[8px] font-black text-purple-500 uppercase tracking-widest">
                      <span>Exato</span><span>Criativo</span>
                    </div>
                  </div>

                  {/* NOVO: SLIDER DE TOKENS (TAMANHO DA RESPOSTA) */}
                  <div className="space-y-6 pt-4 border-t border-purple-200">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[9px] font-black uppercase text-purple-700 ml-4 tracking-[0.2em]">Tamanho da Resposta</Label>
                      <span className="text-2xl font-black text-pink-600">{maxTokens[0]} tkn</span>
                    </div>
                    <Slider min={100} max={4000} step={100} value={maxTokens} onValueChange={setMaxTokens} className="cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* Habilidades - CORES VIBRANTES E ÍCONES BLINDADOS */}
              <div className="bg-white p-10 rounded-[4rem] border-4 border-white shadow-2xl space-y-10">
                <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-400 text-center uppercase tracking-widest">Habilidades Sonia</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'memory', label: 'CRM', icon: LayoutGrid, checked: selectedCrm !== 'none' },
                    { id: 'rag', label: 'RAG', icon: Search, checked: capabilities.rag },
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
                          "p-8 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all cursor-pointer border-2 shadow-sm",
                          isActive ? styles.active : styles.inactive,
                          isActive ? "shadow-xl shadow-blue-200 scale-105" : "hover:opacity-100 opacity-60"
                        )}
                      >
                        <cap.icon 
                          size={36} 
                          strokeWidth={2.5} 
                          className={isActive ? "text-white" : "text-slate-400"}
                        />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest text-center",
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
                className="w-full h-24 rounded-[3.5rem] bg-slate-900 text-white font-black uppercase text-sm tracking-[0.6em] shadow-[0_30px_60px_rgba(0,0,0,0.1)] transition-all active:scale-95 flex items-center justify-center gap-4 hover:bg-black disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-white" />
                ) : (
                  <Check size={28} className="text-emerald-400" strokeWidth={3} />
                )}
                ATUALIZAR SONIA
              </Button>
            </aside>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
