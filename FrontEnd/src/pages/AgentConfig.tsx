
import { useEffect, useState } from "react"
import {
  Bot, Sparkles, Cpu, Plus, Trash2, Check,
  Globe, Lock, ChevronRight, Settings2, Loader2, Info,
  MessageSquare, BrainCircuit, Mic2, Search, Database, FileText, Save, X, LayoutGrid
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
  const [temperature, setTemperature] = useState([0.7])

  const [capabilities, setCapabilities] = useState({
    voice: false,
    memory: true,
    internet: false,
    rag: true
  })

  // Dados Reais e Mapeamentos
  const providerModels: Record<string, { id: string, name: string }[]> = {
    openai: [{ id: "gpt-4o", name: "GPT-4o (Premium)" }, { id: "gpt-4o-mini", name: "GPT-4o Mini (Veloz)" }],
    anthropic: [{ id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }, { id: "claude-3-haiku", name: "Claude 3 Haiku" }],
    google: [{ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" }]
  }

  const [availableFiles, setAvailableFiles] = useState<any[]>([])
  const [availableCrms, setAvailableCrms] = useState<any[]>([])

  // Inicialização (Edit vs Create)
  useEffect(() => {
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
        const { data: crmsData } = await supabase.from('tb_crm_integrations').select(`id, tb_crms (id, name)`).eq('companies_id', companyUser.companies_id).eq('is_active', true)
        setAvailableCrms(crmsData || [])
      }
    } catch (e) { console.error(e) }
  }

  const loadAgentData = async (id: string) => {
    try {
      const { data, error } = await supabase.from('tb_agents').select('*').eq('id', id).single()
      if (data) {
        setName(data.name || "")
        setInstructions(data.personality_prompt || data.system_prompt || "")
        setSelectedProvider(data.provider || "openai")
        setModel(data.provider_model || "gpt-4o-mini")
        setSelectedCrm(data.crm_integration_id || "none")
        setTemperature([data.temperature ?? 0.7])
        const caps = data.capabilities || {}
        setCapabilities({ voice: !!caps.voice, memory: caps.memory !== false, internet: !!caps.internet, rag: caps.rag !== false })
      }

      // Carregar arquivos vinculados
      if (user?.email) {
        const { data: agentFiles } = await supabase.rpc('sp_get_agent_files', {
          p_email: user.email,
          p_agent_id: id
        })
        if (agentFiles) {
          setSelectedFileIds(agentFiles.map((f: any) => f.file_id))
        }
      }
    } catch (e) { console.error(e) }
  }

  const handleSave = async () => {
    if (!name) { toast.error("Dê um nome ao agente!"); return }
    setIsLoading(true)
    try {
      const payload = {
        name,
        provider: selectedProvider,
        provider_model: model,
        temperature: temperature[0],
        capabilities: { ...capabilities, rag: capabilities.rag },
        personality_prompt: instructions,
        system_prompt: instructions,
        crm_integration_id: selectedCrm === 'none' ? null : selectedCrm
      }
      if (agentId) {
        const { error } = await supabase.from('tb_agents').update(payload).eq('id', agentId)
        if (error) throw error
        if (user?.email) {
          await supabase.rpc('sp_replace_agent_files', {
            p_email: user.email,
            p_agent_id: agentId,
            p_file_ids: selectedFileIds.length > 0 ? selectedFileIds : null
          })
        }
      } else {
        await api.agents.create(payload)
      }
      toast.success("Configuração Salva!")
      setTimeout(() => window.history.back(), 1500)
    } catch (e) {
      console.error(e)
      toast.error("Erro ao salvar.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
      <p className="text-[10px] font-black uppercase text-slate-400">Sincronizando IA...</p>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#F4F7FA] pb-32 font-sans overflow-x-hidden">
        <Toaster position="top-center" />

        {/* Header Premium */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-10 py-6 bg-white/90 backdrop-blur-xl border-b-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 bg-blue-600 rounded-2xl shadow-lg flex items-center justify-center border-4 border-white shrink-0">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl text-slate-900 tracking-tighter leading-none">Ajustar Sonia</h1>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Configuração Avançada</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-2xl font-bold text-slate-400" onClick={() => window.history.back()}>Descartar</Button>
            <Button onClick={handleSave} disabled={isLoading} style={{ backgroundColor: '#2563eb' }} className="rounded-full px-10 h-12 text-white font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {agentId ? 'Atualizar Cérebro' : 'Mobilizar IA'}
            </Button>
          </div>
        </header>

        <main className="max-w-[1440px] mx-auto px-10 py-12">
          {/* GRID FIXO: Colunas 8 e 4 (Impede a queda da sidebar) */}
          <div className="flex flex-col lg:flex-row gap-12 items-start">

            {/* LADO ESQUERDO: CONTEÚDO (66% da largura) */}
            <div className="flex-1 w-full lg:w-2/3 space-y-12">

              {/* Card de Identidade */}
              <section className="bg-white p-12 rounded-[4rem] border-2 border-slate-100 space-y-12">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-black border border-slate-100"><Sparkles size={24} /></div>
                  <h2 className="font-black text-slate-900 uppercase text-xs tracking-[0.3em]">Personalidade</h2>
                </div>

                <div className="grid gap-12">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-4">Nome do seu Agente</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sonia Atendimento VIP" className="h-18 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-8 text-lg font-bold focus:border-blue-500" />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-4">Instruções Mentais (Prompt)</Label>
                    <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Defina como ela deve agir..." className="min-h-[350px] rounded-[3rem] border-2 border-slate-100 bg-slate-50/50 p-10 text-base font-medium focus:border-blue-500 resize-none transition-all" />
                  </div>
                </div>
              </section>

              {/* Card de Conexões */}
              <section className="bg-white p-12 rounded-[4rem] border-2 border-slate-100 space-y-12">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-black border border-slate-100"><Database size={24} /></div>
                  <h2 className="font-black text-slate-900 uppercase text-xs tracking-[0.3em]">Conexões de Dados</h2>
                </div>

                <div className="grid gap-12">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Vincular CRM Ativo</Label>
                    <Select value={selectedCrm} onValueChange={setSelectedCrm}>
                      <SelectTrigger className="h-18 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-8 font-bold text-slate-700 transition-all">
                        <SelectValue placeholder="Selecione um CRM..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-3xl border-none shadow-2xl p-2 bg-white">
                        <SelectItem value="none" className="rounded-xl font-bold text-slate-400">Nenhum CRM vinculado</SelectItem>
                        {availableCrms.map(crm => (
                          <SelectItem key={crm.id} value={crm.id} className="rounded-xl font-bold text-slate-900 hover:bg-slate-50">{crm.tb_crms?.name || 'CRM'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {capabilities.rag && (
                    <div className="space-y-6 animate-in slide-in-from-top-4">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Base de Conhecimento (RAG)</Label>
                      <div className="grid grid-cols-1 gap-4 px-2">
                        {availableFiles.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                            Nenhum arquivo disponível na Knowledge Base.
                          </p>
                        ) : availableFiles.map((file) => (
                          <div key={file.id} onClick={() => setSelectedFileIds(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])}
                            className={cn("flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer", selectedFileIds.includes(file.id) ? "bg-blue-50 border-blue-500 text-blue-700 shadow-lg scale-[1.02]" : "bg-white border-slate-100 text-slate-400")}>
                            <div className="flex items-center gap-5 text-slate-900">
                              <FileText size={22} color={selectedFileIds.includes(file.id) ? '#2563eb' : '#000000'} />
                              <span className="text-sm font-black">{file.original_name}</span>
                            </div>
                            {selectedFileIds.includes(file.id) ? <Check className="w-6 h-6 text-blue-600" /> : <Plus className="w-6 h-6 text-black opacity-30 cursor-pointer" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* LADO DIREITO: AJUSTES (33% da largura - Nunca cai) */}
            <aside className="w-full lg:w-1/3 space-y-10 lg:sticky lg:top-32 shrink-0">

              {/* O NOVO AJUSTE NEURAL - CLEAN WHITE */}
              <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-100 space-y-10 relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-black border border-slate-100">
                    <BrainCircuit size={20} />
                  </div>
                  <h4 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-900">Mecanismo Neural</h4>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Provedor</Label>
                    <Select value={selectedProvider} onValueChange={(val) => { setSelectedProvider(val); setModel(providerModels[val][0].id); }}>
                      <SelectTrigger className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-black text-sm px-6">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl bg-white border-slate-200 shadow-xl">
                        <SelectItem value="openai" className="font-bold">OpenAI</SelectItem>
                        <SelectItem value="anthropic" className="font-bold">Anthropic</SelectItem>
                        <SelectItem value="google" className="font-bold">Google Cloud</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Modelo da IA</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-black text-sm px-6">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl bg-white border-slate-200 shadow-xl">
                        {providerModels[selectedProvider]?.map(m => (
                          <SelectItem key={m.id} value={m.id} className="font-bold">{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Biscoitos (Criatividade)</Label>
                      <span className="text-xl font-black text-blue-600 leading-none">{Math.round(temperature[0] * 100)}%</span>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={temperature} onValueChange={setTemperature} className="cursor-pointer" />
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-300 tracking-widest">
                      <span>Exato</span>
                      <span>Criativo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Habilidades - Ícones pretos e Flat */}
              <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-100 space-y-10">
                <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-400 text-center uppercase tracking-widest">Habilidades da IA</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'voice', label: 'Voz', icon: Mic2, checked: capabilities.voice },
                    { id: 'memory', label: 'CRM', icon: LayoutGrid, checked: selectedCrm !== 'none' },
                    { id: 'internet', label: 'Web', icon: Globe, checked: capabilities.internet },
                    { id: 'rag', label: 'RAG', icon: Search, checked: capabilities.rag },
                  ].map((cap) => (
                    <div
                      key={cap.id}
                      onClick={() => {
                        if (cap.id === 'rag') setCapabilities(prev => ({ ...prev, rag: !prev.rag }))
                        if (cap.id === 'voice') setCapabilities(prev => ({ ...prev, voice: !prev.voice }))
                        if (cap.id === 'internet') setCapabilities(prev => ({ ...prev, internet: !prev.internet }))
                      }}
                      style={{
                        backgroundColor: cap.checked ? '#2563eb' : '#f8fafc',
                        borderColor: cap.checked ? '#2563eb' : 'transparent'
                      }}
                      className={cn(
                        "p-6 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all cursor-pointer border-2",
                        cap.checked ? "scale-105" : "opacity-100"
                      )}
                    >
                      <cap.icon size={32} strokeWidth={2.5} color={cap.checked ? '#FFFFFF' : '#000000'} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: cap.checked ? 'white' : '#000000' }}>
                        {cap.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão Salvar - Flat e Sólido */}
              <Button
                onClick={handleSave}
                disabled={isLoading}
                style={{ backgroundColor: '#1e293b' }}
                className="w-full h-24 rounded-[3rem] text-white font-black uppercase text-sm tracking-[0.4em] transition-all active:scale-95 flex items-center justify-center gap-4 hover:bg-black"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Check size={28} className="text-blue-500" strokeWidth={3} />}
                {agentId ? "ATUALIZAR IA" : "ATIVAR AGENTE"}
              </Button>
            </aside>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
