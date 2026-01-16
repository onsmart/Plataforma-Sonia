
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
import { Bot, BrainCircuit, Key, Save, Sparkles, Terminal } from "lucide-react"
import { Badge } from "../ui/badge"
import { useAuth } from "../../contexts/AuthContext"

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
    const { user } = useAuth()
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

            if (user?.email) {
                const loadRemoteData = async () => {
                    setIsFetching(true)
                    try {
                        const { data, error } = await supabase.rpc('sp_get_agent_config_by_email', {
                            p_user_email: user.email,
                            p_agent_id: agent.id
                        })

                        if (error) {
                            console.error("Erro ao buscar configurações:", error)
                            // Usa valores padrão em caso de erro
                            return
                        }

                        // Se há dados retornados, mapeia para o estado
                        if (data && data.length > 0) {
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
                            // Se system_instructions existir (mesmo que seja string vazia), usa ele
                            // Caso contrário, mantém o valor padrão
                            const systemInstructions = config.system_instructions !== null && config.system_instructions !== undefined
                                ? config.system_instructions
                                : DEFAULT_SYSTEM_PROMPT
                            
                            console.log("Atualizando systemPrompt com:", systemInstructions)
                            
                            setFormData(prev => ({
                                ...prev,
                                systemPrompt: systemInstructions
                            }))
                        }
                    } catch (error) {
                        console.error("Falha ao carregar configurações:", error)
                    } finally {
                        setIsFetching(false)
                    }
                }
                loadRemoteData()
            }
        }
    }, [agent, isOpen, user])

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
