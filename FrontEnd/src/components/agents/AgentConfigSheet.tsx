
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { Separator } from "../ui/separator"
import { Bot, BrainCircuit, Key, Save, Sparkles, Terminal, Database, FileText, CheckCircle2, X, ChevronDown, Search } from "lucide-react"
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
    const [whatsappIntegrations, setWhatsappIntegrations] = useState<any[]>([])
    const [selectedWhatsappIntegrationId, setSelectedWhatsappIntegrationId] = useState<string>('')
    const [whatsappIntegrationsLoading, setWhatsappIntegrationsLoading] = useState(false)
    const [availableFiles, setAvailableFiles] = useState<any[]>([])
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
    const [filesLoading, setFilesLoading] = useState(false)

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

                // 0. Carregar arquivos disponíveis e arquivos do agente
                await loadFiles()

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

                    // 1.3. Buscar integrações WhatsApp usando a mesma RPC do AgentsHub
                    setWhatsappIntegrationsLoading(true)
                    try {
                        if (user?.email) {
                            const { data, error } = await supabase.rpc('sp_get_integration_by_email', {
                                p_user_email: user.email
                            })
                            if (error) throw error
                            setWhatsappIntegrations(data || [])
                        }
                    } catch (error) {
                        console.error("Erro ao carregar integrações WhatsApp:", error)
                        setWhatsappIntegrations([])
                    } finally {
                        setWhatsappIntegrationsLoading(false)
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

                            // Atualiza personalityPrompt com o valor da API
                            const personality = config.personality_prompt || ''

                            console.log("Atualizando personalityPrompt com:", personality)

                            setFormData(prev => ({
                                ...prev,
                                personalityPrompt: personality,
                                systemPrompt: personality // compatibilidade local
                            }))

                            // Atualiza CRM se existir
                            console.log("CRM Integration ID recebido da procedure:", config.crm_integration_id, "Tipo:", typeof config.crm_integration_id)
                            if (config.crm_integration_id) {
                                const crmId = String(config.crm_integration_id).trim()
                                console.log("Definindo CRM Integration ID da procedure:", crmId)
                                setSelectedCrmIntegrationId(crmId)
                            }

                            // Atualiza WhatsApp Integration se existir
                            console.log("WhatsApp Integration ID recebido da procedure:", config.integrations_id, "Tipo:", typeof config.integrations_id)
                            if (config.integrations_id) {
                                const whatsappId = String(config.integrations_id).trim()
                                console.log("Definindo WhatsApp Integration ID da procedure:", whatsappId)
                                setSelectedWhatsappIntegrationId(whatsappId)
                            }
                        }
                    } catch (error) {
                        console.error("Falha ao carregar configurações:", error)
                    }
                }

                // 3. Por último, SEMPRE busca CRM e WhatsApp diretamente da tabela (a procedure pode não retornar)
                if (agent?.id) {
                    try {
                        const { data: agentData, error: agentError } = await supabase
                            .from('tb_agents')
                            .select('crm_integration_id, integrations_id')
                            .eq('id', agent.id)
                            .single()

                        console.log("Dados de integrações buscados diretamente da tabela:", {
                            agentId: agent.id,
                            agentData,
                            agentError: agentError?.message
                        })

                        if (!agentError && agentData) {
                            // CRM Integration
                            if (agentData.crm_integration_id) {
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
                            } else {
                                console.log("Nenhum CRM encontrado para este agente na tabela")
                            }

                            // WhatsApp Integration - SEMPRE atualiza da tabela (mais confiável)
                            if (agentData.integrations_id) {
                                const whatsappId = String(agentData.integrations_id).trim()
                                console.log("WhatsApp Integration encontrado diretamente na tabela tb_agents:", whatsappId)
                                console.log("Valor atual do estado antes de atualizar:", selectedWhatsappIntegrationId)
                                setSelectedWhatsappIntegrationId(whatsappId)
                                console.log("WhatsApp Integration ID definido para:", whatsappId)
                            } else {
                                console.log("Nenhuma integração WhatsApp encontrada para este agente na tabela")
                                setSelectedWhatsappIntegrationId('')
                            }
                        } else if (agentError) {
                            console.error("Erro ao buscar integrações do agente diretamente:", agentError)
                        }
                    } catch (error) {
                        console.error("Erro ao buscar integrações do agente:", error)
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

    // Debug: monitorar mudanças no WhatsApp Integration
    useEffect(() => {
        console.log("🔍 [DEBUG WhatsApp] selectedWhatsappIntegrationId:", selectedWhatsappIntegrationId)
        console.log("🔍 [DEBUG WhatsApp] whatsappIntegrations disponíveis:", whatsappIntegrations.map(w => ({ id: w.id, phone: w.phone_number })))
        if (selectedWhatsappIntegrationId && selectedWhatsappIntegrationId !== '') {
            const found = whatsappIntegrations.find(w => w.id === selectedWhatsappIntegrationId)
            console.log("🔍 [DEBUG WhatsApp] Integração encontrada no array:", found)
            if (!found) {
                console.warn("⚠️ WhatsApp Integration ID não encontrado na lista de integrações disponíveis!")
            } else {
                console.log("✅ WhatsApp Integration confirmado na lista")
            }
        }
    }, [selectedWhatsappIntegrationId, whatsappIntegrations])

    const loadFiles = async () => {
        if (!agent || !user?.email) return

        setFilesLoading(true)
        try {
            // 1. Carregar arquivos disponíveis da empresa
            const { data: filesData, error: filesError } = await supabase.rpc('sp_list_files_by_email', {
                p_email: user.email
            })

            if (filesError) {
                console.error("Erro ao carregar arquivos:", filesError)
                setAvailableFiles([])
            } else {
                setAvailableFiles(filesData || [])
            }

            // 2. Carregar arquivos já vinculados ao agente
            const { data: agentFilesData, error: agentFilesError } = await supabase.rpc('sp_get_agent_files', {
                p_email: user.email,
                p_agent_id: agent.id
            })

            if (agentFilesError) {
                console.error("Erro ao carregar arquivos do agente:", agentFilesError)
                setSelectedFileIds([])
            } else {
                const linkedFileIds = (agentFilesData || []).map((f: any) => f.file_id)
                setSelectedFileIds(linkedFileIds)
            }
        } catch (error) {
            console.error("Erro ao carregar arquivos:", error)
            setAvailableFiles([])
            setSelectedFileIds([])
        } finally {
            setFilesLoading(false)
        }
    }

    const toggleFileSelection = (fileId: string) => {
        setSelectedFileIds(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId)
            } else {
                return [...prev, fileId]
            }
        })
    }

    const saveAgentFiles = async () => {
        if (!agent || !user?.email) {
            console.error('[saveAgentFiles] ❌ Agente ou email não disponível')
            return { success: false, error: 'Agente ou email não disponível' }
        }

        try {
            // Garantir que fileIds seja um array válido (não null/undefined)
            const fileIdsArray = Array.isArray(selectedFileIds) && selectedFileIds.length > 0
                ? selectedFileIds
                : []

            console.log('[saveAgentFiles] 🔄 Salvando arquivos:', {
                agentId: agent.id,
                email: user.email,
                fileIds: fileIdsArray,
                count: fileIdsArray.length,
                isArray: Array.isArray(fileIdsArray),
                type: typeof fileIdsArray
            })

            const { data, error } = await supabase.rpc('sp_replace_agent_files', {
                p_email: user.email,
                p_agent_id: agent.id,
                p_file_ids: fileIdsArray.length > 0 ? fileIdsArray : null
            })

            if (error) {
                console.error('[saveAgentFiles] ❌ Erro na RPC:', error)
                console.error('[saveAgentFiles] Detalhes do erro:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                })
                return { success: false, error: error.message }
            }

            console.log('[saveAgentFiles] ✅ Arquivos salvos com sucesso:', data)
            console.log('[saveAgentFiles] Resultado:', {
                removed: data?.removed_count || 0,
                added: data?.added_count || 0,
                message: data?.message
            })

            return { success: true, data }
        } catch (err: any) {
            console.error('[saveAgentFiles] ❌ Erro inesperado:', err)
            console.error('[saveAgentFiles] Stack:', err.stack)
            return { success: false, error: err.message }
        }
    }

    const handleSave = async () => {
        if (!agent || !user?.email) {
            console.error('[handleSave] ❌ Agente ou email não disponível')
            return
        }

        console.log('[handleSave] 🚀 Iniciando salvamento:', {
            agentId: agent.id,
            email: user.email,
            selectedFileIds: selectedFileIds,
            fileCount: selectedFileIds.length
        })

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
                p_personality_prompt: formData.personalityPrompt || formData.systemPrompt || null
            })

            if (error) {
                console.error("Erro na procedure:", error)
                throw error
            }

            console.log('[handleSave] ✅ Configurações do agente salvas, agora salvando arquivos...')

            // Salvar arquivos vinculados ao agente (função separada) - ANTES do CRM para garantir execução
            console.log('[handleSave] Chamando saveAgentFiles com:', {
                selectedFileIds,
                count: selectedFileIds.length,
                isArray: Array.isArray(selectedFileIds)
            })

            try {
                const filesResult = await saveAgentFiles()
                console.log('[handleSave] Resultado de saveAgentFiles:', filesResult)

                if (!filesResult.success) {
                    console.error("[handleSave] ❌ Erro ao salvar arquivos do agente:", filesResult.error)
                    toast.error("Configurações salvas, mas houve erro ao salvar arquivos: " + (filesResult.error || "Erro desconhecido"))
                } else {
                    console.log("[handleSave] ✅ Arquivos do agente salvos com sucesso!")
                    const added = filesResult.data?.added_count || 0
                    const removed = filesResult.data?.removed_count || 0
                    if (added > 0 || removed > 0) {
                        toast.success(`Arquivos atualizados: ${added} adicionado(s), ${removed} removido(s)`)
                    } else if (selectedFileIds.length === 0) {
                        toast.success("Arquivos removidos do agente")
                    }
                }
            } catch (filesErr: any) {
                console.error("[handleSave] ❌ Erro ao chamar saveAgentFiles:", filesErr)
                toast.error("Erro ao salvar arquivos: " + (filesErr.message || "Erro desconhecido"))
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

            // Atualiza a integração WhatsApp do agente separadamente
            const whatsappIntegrationId = selectedWhatsappIntegrationId && selectedWhatsappIntegrationId !== 'none' && selectedWhatsappIntegrationId !== 'loading' && selectedWhatsappIntegrationId !== '__none__'
                ? selectedWhatsappIntegrationId
                : null

            console.log("Atualizando WhatsApp Integration do agente:", {
                agentId: agent.id,
                whatsappIntegrationId,
                selectedWhatsappIntegrationId,
                userId,
                userEmail: user.email
            })

            // Verifica se temos userId antes de continuar
            if (!userId) {
                console.error("userId não disponível para WhatsApp")
            } else {
                // Buscar companies_id a partir do user_id (já temos do código acima do CRM)
                const { data: companyUser, error: companyError } = await supabase
                    .from('tb_company_users')
                    .select('companies_id')
                    .eq('user_id', userId)
                    .maybeSingle()

                if (companyError || !companyUser?.companies_id) {
                    console.error("Erro ao buscar companies_id para WhatsApp:", companyError)
                } else {
                    const companiesId = companyUser.companies_id

                    // Verifica se a integração WhatsApp pertence à empresa antes de atualizar
                    if (whatsappIntegrationId) {
                        const { data: whatsappCheck, error: whatsappCheckError } = await supabase
                            .from('tb_integrations')
                            .select('id, companies_id')
                            .eq('id', whatsappIntegrationId)
                            .eq('companies_id', companiesId)
                            .eq('type', 'whatsapp')
                            .single()

                        if (whatsappCheckError || !whatsappCheck) {
                            console.error("Integração WhatsApp não encontrada ou não pertence à empresa:", whatsappCheckError)
                            toast.error("Integração WhatsApp selecionada não encontrada ou não pertence à sua empresa")
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
                                // Atualiza a integração WhatsApp do agente
                                const { error: whatsappError } = await supabase
                                    .from('tb_agents')
                                    .update({ integrations_id: whatsappIntegrationId })
                                    .eq('id', agent.id)
                                    .eq('companies_id', companiesId)

                                if (whatsappError) {
                                    console.error("Erro ao atualizar WhatsApp Integration do agente:", whatsappError)
                                    toast.error("Configurações salvas, mas houve erro ao atualizar WhatsApp Integration: " + (whatsappError.message || "Erro desconhecido"))
                                } else {
                                    console.log("WhatsApp Integration atualizado com sucesso!")
                                    toast.success("Configurações, CRM e WhatsApp Integration atualizados com sucesso!")
                                }
                            }
                        }
                    } else {
                        // Remove a integração WhatsApp do agente (definir como null)
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
                            const { error: whatsappError } = await supabase
                                .from('tb_agents')
                                .update({ integrations_id: null })
                                .eq('id', agent.id)
                                .eq('companies_id', companiesId)

                            if (whatsappError) {
                                console.error("Erro ao remover WhatsApp Integration do agente:", whatsappError)
                                toast.error("Configurações salvas, mas houve erro ao remover WhatsApp Integration: " + (whatsappError.message || "Erro desconhecido"))
                            } else {
                                console.log("WhatsApp Integration removido com sucesso!")
                                toast.success("Configurações salvas e WhatsApp Integration removido com sucesso!")
                            }
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
        switch (provider) {
            case 'openai': return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
            case 'anthropic': return ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
            case 'groq': return ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'];
            default: return [];
        }
    }

    if (!agent) return null

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[800px] sm:w-[900px] lg:w-[1000px] h-full overflow-y-auto">
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
                    <Tabs defaultValue="brain" className="w-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 gap-2">
                            <TabsTrigger value="brain" className="text-xs sm:text-sm">
                                <BrainCircuit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Brain & Model</span>
                                <span className="sm:hidden">Brain</span>
                            </TabsTrigger>
                            <TabsTrigger value="prompt" className="text-xs sm:text-sm">
                                <Terminal className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Prompt Engineering</span>
                                <span className="sm:hidden">Prompt</span>
                            </TabsTrigger>
                            <TabsTrigger value="knowledge" className="text-xs sm:text-sm">
                                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Knowledge Base</span>
                                <span className="sm:hidden">Files</span>
                            </TabsTrigger>
                            <TabsTrigger value="general" className="text-xs sm:text-sm">
                                <Database className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">General Info</span>
                                <span className="sm:hidden">Info</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="brain" className="space-y-4 h-[500px] overflow-y-auto flex-shrink-0">
                            <div className="space-y-4 h-full">
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
                                            onValueChange={(val: any) => setModelConfig({ ...modelConfig, provider: val, model: getProviderModels(val)[0] })}
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
                                            onValueChange={(val) => setModelConfig({ ...modelConfig, model: val })}
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
                                        onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
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
                                        onValueChange={(val) => setModelConfig({ ...modelConfig, temperature: val[0] })}
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
                                        onValueChange={(val) => setModelConfig({ ...modelConfig, maxTokens: val[0] })}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="prompt" className="space-y-4 h-[500px] overflow-y-auto flex-shrink-0">
                            <div className="flex flex-col h-full">
                                <Label className="mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Terminal className="h-4 w-4" />
                                        Personalidade e Tom de Voz
                                    </span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                                        <Sparkles className="h-3 w-3" /> Enhance with AI
                                    </Button>
                                </Label>
                                <Textarea
                                    className="flex-1 font-mono text-sm resize-none leading-relaxed min-h-[300px] max-h-[300px] overflow-y-auto"
                                    value={formData.personalityPrompt || ""}
                                    onChange={(e) => setFormData({ ...formData, personalityPrompt: e.target.value, systemPrompt: e.target.value })}
                                    placeholder="Ex: Você é um assistente calmo, usa emojis e responde de forma concisa..."
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Descreva <b>como</b> o agente deve se comportar. As instruções técnicas (o que ele faz) vêm do template selecionado.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="knowledge" className="space-y-4 h-[500px] overflow-y-auto flex-shrink-0">
                            <div className="space-y-4 h-full">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Arquivos da Knowledge Base
                                    </Label>
                                    {selectedFileIds.length > 0 && (
                                        <Badge variant="outline">{selectedFileIds.length} selecionado(s)</Badge>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    Selecione os arquivos que este agente pode usar como contexto. Os arquivos devem estar disponíveis na Knowledge Base.
                                </p>

                                {filesLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    </div>
                                ) : availableFiles.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Nenhum arquivo disponível na Knowledge Base.</p>
                                        <p className="text-xs mt-1">Faça upload de arquivos na tela de Knowledge Base primeiro.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full justify-between"
                                                >
                                                    <span className="truncate">
                                                        {selectedFileIds.length === 0
                                                            ? "Selecione os arquivos..."
                                                            : selectedFileIds.length === 1
                                                                ? availableFiles.find((f: any) => f.id === selectedFileIds[0])?.original_name || "1 arquivo selecionado"
                                                                : `${selectedFileIds.length} arquivos selecionados`}
                                                    </span>
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Buscar arquivo..." />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum arquivo encontrado.</CommandEmpty>
                                                        <CommandGroup>
                                                            {availableFiles.map((file: any) => {
                                                                const isSelected = selectedFileIds.includes(file.id)
                                                                return (
                                                                    <CommandItem
                                                                        key={file.id}
                                                                        value={file.original_name}
                                                                        onSelect={() => toggleFileSelection(file.id)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${isSelected
                                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                                            : 'border-muted-foreground/30'
                                                                            }`}>
                                                                            {isSelected && (
                                                                                <CheckCircle2 className="h-3 w-3" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="font-medium">{file.original_name}</div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {(file.size_bytes / 1024).toFixed(1)} KB • {file.mime_type || 'unknown'}
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

                                        {/* Mostrar arquivos selecionados */}
                                        {selectedFileIds.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-sm">Arquivos selecionados:</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedFileIds.map((fileId) => {
                                                        const file = availableFiles.find((f: any) => f.id === fileId)
                                                        if (!file) return null
                                                        return (
                                                            <Badge
                                                                key={fileId}
                                                                variant="secondary"
                                                                className="flex items-center gap-1 pr-1"
                                                            >
                                                                <span className="truncate max-w-[200px]">{file.original_name}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        toggleFileSelection(fileId)
                                                                    }}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </Badge>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="general" className="space-y-4 h-[500px] overflow-y-auto flex-shrink-0">
                            <div className="space-y-4 h-full">
                                <div className="space-y-2">
                                    <Label>Agent Name</Label>
                                    <Input
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Bot className="h-4 w-4" />
                                        WhatsApp Integration
                                    </Label>
                                    <Select
                                        value={selectedWhatsappIntegrationId || "__none__"}
                                        onValueChange={(val) => {
                                            console.log("WhatsApp Integration selecionado mudou:", val)
                                            setSelectedWhatsappIntegrationId(val === "__none__" ? "" : val)
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione uma integração WhatsApp (opcional)">
                                                {selectedWhatsappIntegrationId && whatsappIntegrations.length > 0 ? (() => {
                                                    const selectedWhatsapp = whatsappIntegrations.find(w => w.id === selectedWhatsappIntegrationId)
                                                    return selectedWhatsapp?.phone_number || "WhatsApp Selecionado"
                                                })() : "Nenhuma integração"}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Nenhuma integração</SelectItem>
                                            {whatsappIntegrationsLoading ? (
                                                <SelectItem value="loading" disabled>Carregando integrações...</SelectItem>
                                            ) : whatsappIntegrations.length === 0 ? (
                                                <SelectItem value="none" disabled>Nenhuma integração WhatsApp conectada. Configure na tela de Integrações.</SelectItem>
                                            ) : (
                                                whatsappIntegrations.map(int => (
                                                    <SelectItem key={int.id} value={int.id}>
                                                        {`${int.phone_number || 'Sem Telefone'} | ${int.email || 'Sem Email'}`}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {selectedWhatsappIntegrationId && (
                                        <p className="text-xs text-muted-foreground">
                                            Integração ID: {selectedWhatsappIntegrationId}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Permite que o agente leia e envie mensagens via WhatsApp. Necessário para ações como "read_whatsapp_db" e "send_whatsapp".
                                    </p>
                                </div>
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
