
import React, { useEffect, useState } from "react"
import { Agent, AgentModelConfig } from "../../services/api"
import { supabase } from "../../utils/supabase/client"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { Separator } from "../ui/separator"
import { Bot, BrainCircuit, Key, Save, Sparkles, Terminal, Database } from "lucide-react"
import { Badge } from "../ui/badge"
import { useAuth } from "../../contexts/AuthContext"
import { toast } from "sonner"

interface AgentConfigSheetProps {
    agent: Agent | null
    isOpen: boolean
    onClose: () => void
    onSave: (id: string, updates: Partial<Agent>) => Promise<void>
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for the SONIA platform.
Your goal is to assist users with their inquiries efficiently and politely.
Always maintain a professional tone.`

export function AgentConfigSheet({ agent, isOpen, onClose, onSave }: AgentConfigSheetProps) {
    const { user, userId } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [formData, setFormData] = useState<Partial<Agent>>({})
    const [modelConfig, setModelConfig] = useState<AgentModelConfig>({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: ''
    })
    const [crmIntegrations, setCrmIntegrations] = useState<any[]>([])
    const [selectedCrmIntegrationId, setSelectedCrmIntegrationId] = useState<string>('')
    const [crmIntegrationsLoading, setCrmIntegrationsLoading] = useState(false)

    useEffect(() => {
        if (agent && isOpen) {
            setFormData({
                name: agent.name,
                role: agent.role,
                description: agent.description,
                systemPrompt: agent.systemPrompt || DEFAULT_SYSTEM_PROMPT,
                languages: agent.languages,
                channels: agent.channels
            })

            // Carrega tudo em sequência para garantir ordem correta
            const loadAllData = async () => {
                setIsFetching(true)
                
                // 1. Primeiro carrega CRMs disponíveis
                if (userId) {
                    setCrmIntegrationsLoading(true)
                    try {
                        // 1.1. Buscar companies_id a partir do user_id
                        const { data: companyUser, error: companyError } = await supabase
                            .from('tb_company_users')
                            .select('companies_id')
                            .eq('user_id', userId)
                            .maybeSingle()

                        if (companyError || !companyUser?.companies_id) {
                            console.error("Erro ao buscar companies_id:", companyError)
                            setCrmIntegrations([])
                            return
                        }

                        const companiesId = companyUser.companies_id

                        // 1.2. Buscar CRMs usando companies_id
                        const { data, error } = await supabase
                            .from('tb_crm_integrations')
                            .select(`
                                id,
                                tb_crms (
                                    id,
                                    name,
                                    slug
                                )
                            `)
                            .eq('companies_id', companiesId)
                            .eq('is_active', true)
                            .order('created_at', { ascending: false })

                        if (error) throw error
                        const integrations = data || []
                        console.log("CRMs carregados:", integrations)
                        setCrmIntegrations(integrations)
                    } catch (error) {
                        console.error("Erro ao carregar CRMs:", error)
                        setCrmIntegrations([])
                    } finally {
                        setCrmIntegrationsLoading(false)
                    }
                }

                // 2. Depois busca configurações do agente via procedure
                if (user?.email) {
                    try {
                        const { data, error } = await supabase.rpc('sp_get_agent_config_by_email', {
                            p_user_email: user.email,
                            p_agent_id: agent.id
                        })

                        if (error) {
                            console.error("Erro ao buscar configurações:", error)
                        } else if (data && data.length > 0) {
                            const config = data[0]
                            
                            console.log("Dados recebidos da API:", config)
                            
                            // Atualiza modelConfig com os valores da API
                            setModelConfig({
                                provider: config.provider || 'openai',
                                model: config.provider_model || 'gpt-4o',
                                temperature: config.temperature !== null && config.temperature !== undefined 
                                    ? Number(config.temperature) 
                                    : 0.7,
                                maxTokens: config.max_tokens !== null && config.max_tokens !== undefined 
                                    ? Number(config.max_tokens) 
                                    : 1000,
                                apiKey: config.api_key || ''
                            })

                            // Atualiza systemPrompt com o valor da API
                            const systemInstructions = config.system_instructions !== null && config.system_instructions !== undefined
                                ? config.system_instructions
                                : DEFAULT_SYSTEM_PROMPT
                            
                            console.log("Atualizando systemPrompt com:", systemInstructions)
                            
                            setFormData(prev => ({
                                ...prev,
                                systemPrompt: systemInstructions
                            }))

                            // Atualiza CRM se existir
                            console.log("CRM Integration ID recebido da procedure:", config.crm_integration_id, "Tipo:", typeof config.crm_integration_id)
                            if (config.crm_integration_id) {
                                const crmId = String(config.crm_integration_id).trim()
                                console.log("Definindo CRM Integration ID da procedure:", crmId)
                                setSelectedCrmIntegrationId(crmId)
                            }
                        }
                    } catch (error) {
                        console.error("Falha ao carregar configurações:", error)
                    }
                }

                // 3. Por último, busca CRM diretamente da tabela se não veio da procedure
                if (agent?.id) {
                    try {
                        const { data: agentData, error: agentError } = await supabase
                            .from('tb_agents')
                            .select('crm_integration_id')
                            .eq('id', agent.id)
                            .single()
                        
                        if (!agentError && agentData?.crm_integration_id) {
                            const crmId = String(agentData.crm_integration_id).trim()
                            console.log("CRM encontrado diretamente na tabela tb_agents:", crmId)
                            // Só atualiza se ainda não foi definido pela procedure
                            setSelectedCrmIntegrationId(prev => {
                                if (prev && prev !== '') {
                                    console.log("CRM já definido pela procedure, mantendo:", prev)
                                    return prev
                                }
                                console.log("Definindo CRM da tabela:", crmId)
                                return crmId
                            })
                        } else if (agentError) {
                            console.error("Erro ao buscar CRM do agente diretamente:", agentError)
                        } else {
                            console.log("Nenhum CRM encontrado para este agente na tabela")
                        }
                    } catch (error) {
                        console.error("Erro ao buscar CRM do agente:", error)
                    }
                }
                
                setIsFetching(false)
            }
            
            loadAllData()
        }
    }, [agent, isOpen, user, userId])

    // Verifica se o CRM selecionado está na lista de CRMs disponíveis
    useEffect(() => {
        if (selectedCrmIntegrationId && crmIntegrations.length > 0) {
            const crmExists = crmIntegrations.some(crm => crm.id === selectedCrmIntegrationId)
            if (!crmExists) {
                console.warn("CRM selecionado não está na lista de CRMs disponíveis:", selectedCrmIntegrationId)
                console.log("CRMs disponíveis:", crmIntegrations.map(c => c.id))
            } else {
                console.log("CRM selecionado confirmado na lista:", selectedCrmIntegrationId)
            }
        }
    }, [selectedCrmIntegrationId, crmIntegrations])

    const handleSave = async () => {
        if (!agent || !user?.email) return
        setIsLoading(true)
        try {
            // Garantir que temperature e maxTokens sejam números válidos
            const temperature = typeof modelConfig.temperature === 'number' 
                ? modelConfig.temperature 
                : parseFloat(String(modelConfig.temperature || 0.7))
            
            const maxTokens = typeof modelConfig.maxTokens === 'number' 
                ? Math.floor(modelConfig.maxTokens) 
                : parseInt(String(modelConfig.maxTokens || 1000), 10)

            console.log("Salvando configurações:", {
                temperature,
                maxTokens,
                provider: modelConfig.provider,
                model: modelConfig.model
            })

            // Chamada da procedure sp_update_agent_llm_config_by_email conforme solicitado
            const { error } = await supabase.rpc('sp_update_agent_llm_config_by_email', {
                p_user_email: user.email,
                p_agent_id: agent.id,
                p_name: formData.name || null,
                p_provider: modelConfig.provider || null,
                p_provider_model: modelConfig.model || null,
                p_temperature: temperature, // float4 - garantindo que seja número
                p_max_tokens: maxTokens,     // bigint - garantindo que seja inteiro
                p_system_instructions: formData.systemPrompt || null
            })

            if (error) {
                console.error("Erro na procedure:", error)
                throw error
            }

            // Atualiza o CRM do agente separadamente
            const crmIntegrationId = selectedCrmIntegrationId && selectedCrmIntegrationId !== 'none' && selectedCrmIntegrationId !== 'loading' && selectedCrmIntegrationId !== '__none__'
                ? selectedCrmIntegrationId
                : null

            console.log("Atualizando CRM do agente:", {
                agentId: agent.id,
                crmIntegrationId,
                selectedCrmIntegrationId,
                userId,
                userEmail: user.email
            })

            // Verifica se temos userId antes de continuar
            if (!userId) {
                console.error("userId não disponível")
                toast.error("Erro: usuário não identificado. Faça login novamente.")
            } else {
                // 1. Buscar companies_id a partir do user_id
                const { data: companyUser, error: companyError } = await supabase
                    .from('tb_company_users')
                    .select('companies_id')
                    .eq('user_id', userId)
                    .maybeSingle()

                if (companyError || !companyUser?.companies_id) {
                    console.error("Erro ao buscar companies_id:", companyError)
                    toast.error("Erro: empresa não encontrada")
                    return
                }

                const companiesId = companyUser.companies_id

                // Verifica se o CRM pertence à empresa antes de atualizar
                if (crmIntegrationId) {
                    const { data: crmCheck, error: crmCheckError } = await supabase
                        .from('tb_crm_integrations')
                        .select('id, companies_id')
                        .eq('id', crmIntegrationId)
                        .eq('companies_id', companiesId)
                        .single()

                    if (crmCheckError || !crmCheck) {
                        console.error("CRM não encontrado ou não pertence à empresa:", crmCheckError)
                        toast.error("CRM selecionado não encontrado ou não pertence à sua empresa")
                    } else {
                        // Busca o agente para verificar se pertence à empresa
                        const { data: agentCheck, error: agentCheckError } = await supabase
                            .from('tb_agents')
                            .select('id, companies_id')
                            .eq('id', agent.id)
                            .eq('companies_id', companiesId)
                            .single()

                        if (agentCheckError || !agentCheck) {
                            console.error("Agente não encontrado ou não pertence à empresa:", agentCheckError)
                            toast.error("Erro: agente não encontrado ou não pertence à sua empresa")
                        } else {
                            // Atualiza o CRM do agente
                            const { error: crmError } = await supabase
                                .from('tb_agents')
                                .update({ crm_integration_id: crmIntegrationId })
                                .eq('id', agent.id)
                                .eq('companies_id', companiesId)

                            if (crmError) {
                                console.error("Erro ao atualizar CRM do agente:", crmError)
                                toast.error("Configurações salvas, mas houve erro ao atualizar CRM: " + (crmError.message || "Erro desconhecido"))
                            } else {
                                console.log("CRM atualizado com sucesso!")
                                toast.success("Configurações e CRM atualizados com sucesso!")
                            }
                        }
                    }
                } else {
                    // Remove o CRM do agente (definir como null)
                    // Busca o agente para verificar se pertence à empresa
                    const { data: agentCheck, error: agentCheckError } = await supabase
                        .from('tb_agents')
                        .select('id, companies_id')
                        .eq('id', agent.id)
                        .eq('companies_id', companiesId)
                        .single()

                    if (agentCheckError || !agentCheck) {
                        console.error("Agente não encontrado ou não pertence à empresa:", agentCheckError)
                        toast.error("Erro: agente não encontrado ou não pertence à sua empresa")
                    } else {
                        const { error: crmError } = await supabase
                            .from('tb_agents')
                            .update({ crm_integration_id: null })
                            .eq('id', agent.id)
                            .eq('companies_id', companiesId)

                        if (crmError) {
                            console.error("Erro ao remover CRM do agente:", crmError)
                            toast.error("Configurações salvas, mas houve erro ao remover CRM: " + (crmError.message || "Erro desconhecido"))
                        } else {
                            console.log("CRM removido com sucesso!")
                            toast.success("Configurações salvas e CRM removido com sucesso!")
                        }
                    }
                }
            }

            console.log("Configurações salvas com sucesso!")

            // Atualiza o estado local do pai para refletir as mudanças no UI
            await onSave(agent.id, {
                ...formData,
                modelConfig: {
                    ...modelConfig,
                    temperature,
                    maxTokens
                }
            })
            
            onClose()
        } catch (error: any) {
            console.error("Erro ao salvar via procedure:", error)
            alert("Erro ao salvar configurações: " + (error.message || "Erro desconhecido"))
        } finally {
            setIsLoading(false)
        }
    }

    const getProviderModels = (provider: string) => {
        switch(provider) {
            case 'openai': return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
            case 'anthropic': return ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
            case 'groq': return ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'];
            default: return [];
        }
    }

    if (!agent) return null

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {agent.avatar}
                        </div>
                        <div>
                            <SheetTitle>{agent.name}</SheetTitle>
                            <SheetDescription>{agent.role}</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {isFetching ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                        <p className="text-sm">Sincronizando com o banco...</p>
                    </div>
                ) : (
                    <Tabs defaultValue="brain" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="brain">Brain & Model</TabsTrigger>
                            <TabsTrigger value="prompt">Prompt Engineering</TabsTrigger>
                            <TabsTrigger value="general">General Info</TabsTrigger>
                        </TabsList>

                        <TabsContent value="brain" className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        <BrainCircuit className="h-4 w-4" />
                                        LLM Provider
                                    </Label>
                                    <Badge variant="outline" className="capitalize">{modelConfig.provider}</Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Provider</Label>
                                        <Select 
                                            value={modelConfig.provider} 
                                            onValueChange={(val: any) => setModelConfig({...modelConfig, provider: val, model: getProviderModels(val)[0]})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select provider" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="openai">OpenAI</SelectItem>
                                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                                <SelectItem value="groq">Groq</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Model</Label>
                                        <Select 
                                            value={modelConfig.model} 
                                            onValueChange={(val) => setModelConfig({...modelConfig, model: val})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getProviderModels(modelConfig.provider).map(m => (
                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Key className="h-4 w-4 text-muted-foreground" />
                                        API Key <span className="text-xs text-muted-foreground font-normal">(Stored securely on server)</span>
                                    </Label>
                                    <Input 
                                        type="password" 
                                        placeholder="••••••••••••••••" 
                                        value={modelConfig.apiKey || ''}
                                        onChange={(e) => setModelConfig({...modelConfig, apiKey: e.target.value})}
                                        disabled={true}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Temperature: {modelConfig.temperature}</Label>
                                        <span className="text-xs text-muted-foreground">Creativity vs. Precision</span>
                                    </div>
                                    <Slider 
                                        min={0} 
                                        max={1} 
                                        step={0.1} 
                                        value={[modelConfig.temperature]} 
                                        onValueChange={(val) => setModelConfig({...modelConfig, temperature: val[0]})}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Max Tokens: {modelConfig.maxTokens}</Label>
                                        <span className="text-xs text-muted-foreground">Response Length</span>
                                    </div>
                                    <Slider 
                                        min={100} 
                                        max={8000} 
                                        step={100} 
                                        value={[modelConfig.maxTokens]} 
                                        onValueChange={(val) => setModelConfig({...modelConfig, maxTokens: val[0]})}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="prompt" className="space-y-4">
                            <div className="flex flex-col h-[400px]">
                                <Label className="mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Terminal className="h-4 w-4" />
                                        System Instructions
                                    </span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                                        <Sparkles className="h-3 w-3" /> Enhance with AI
                                    </Button>
                                </Label>
                                <Textarea 
                                    className="flex-1 font-mono text-sm resize-none leading-relaxed" 
                                    value={formData.systemPrompt || DEFAULT_SYSTEM_PROMPT}
                                    onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                                    placeholder="You are a helpful assistant..."
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Define the agent's personality, constraints, and knowledge access here.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="general" className="space-y-4">
                             <div className="space-y-2">
                                <Label>Agent Name</Label>
                                <Input 
                                    value={formData.name || ''} 
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Role / Designation</Label>
                                <Input 
                                    value={formData.role || ''} 
                                    disabled
                                    className="bg-slate-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea 
                                    value={formData.description || ''} 
                                    disabled
                                    className="bg-slate-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    CRM Integration
                                </Label>
                                <Select 
                                    value={selectedCrmIntegrationId || "__none__"} 
                                    onValueChange={(val) => {
                                        console.log("CRM selecionado mudou:", val)
                                        setSelectedCrmIntegrationId(val === "__none__" ? "" : val)
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um CRM (opcional)">
                                            {selectedCrmIntegrationId && crmIntegrations.length > 0 ? (
                                                (() => {
                                                    const selectedCRM = crmIntegrations.find(crm => crm.id === selectedCrmIntegrationId)
                                                    return selectedCRM?.tb_crms?.name || "CRM Selecionado"
                                                })()
                                            ) : "Nenhum CRM"}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Nenhum CRM</SelectItem>
                                        {crmIntegrationsLoading ? (
                                            <SelectItem value="loading" disabled>Carregando CRMs...</SelectItem>
                                        ) : crmIntegrations.length === 0 ? (
                                            <SelectItem value="none" disabled>Nenhum CRM conectado. Configure na tela de Integrações.</SelectItem>
                                        ) : (
                                            crmIntegrations.map(crm => {
                                                console.log("CRM disponível:", crm.id, "Nome:", crm.tb_crms?.name, "Selecionado:", selectedCrmIntegrationId === crm.id)
                                                return (
                                                    <SelectItem key={crm.id} value={crm.id}>
                                                        {crm.tb_crms?.name || 'CRM'}
                                                    </SelectItem>
                                                )
                                            })
                                        )}
                                    </SelectContent>
                                </Select>
                                {selectedCrmIntegrationId && (
                                    <p className="text-xs text-muted-foreground">
                                        CRM ID: {selectedCrmIntegrationId}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Permite que o agente acesse dados do CRM selecionado.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                {!isFetching && (
                    <SheetFooter className="mt-8">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
                            {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    )
}
