import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { chatText } from '../llm/openai'
import mammoth from 'mammoth'

// Importação para pdf-parse (v2 API - CommonJS)
const { PDFParse } = require('pdf-parse')

/**
 * Extrai texto de um arquivo (reutiliza lógica do RAG)
 */
async function extractTextFromFile(file: any, fileData: Blob): Promise<string> {
    let textContent = ''
    
    const isPdfByMime = file.mime_type === 'application/pdf'
    const isPdfByExt = file.original_name?.toLowerCase().endsWith('.pdf')
    
    // PDF
    if (isPdfByMime || isPdfByExt) {
        let parser: any = null
        try {
            logger.info(`[ProcessFileSkills] Processando arquivo PDF: ${file.original_name}`)
            const pdfBuffer = await fileData.arrayBuffer()
            parser = new PDFParse({ data: Buffer.from(pdfBuffer) })
            const result = await parser.getText()
            textContent = result.text
            logger.info(`[ProcessFileSkills] PDF processado: ${textContent.length} caracteres`)
        } catch (error: any) {
            logger.error(`[ProcessFileSkills] Erro ao processar PDF:`, error)
            throw new Error(`Erro ao processar PDF: ${error.message}`)
        } finally {
            if (parser) {
                try {
                    await parser.destroy()
                } catch (destroyError: any) {
                    logger.warn(`[ProcessFileSkills] Erro ao destruir parser PDF: ${destroyError.message}`)
                }
            }
        }
    }
    // DOCX
    else if (file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             file.original_name?.toLowerCase().endsWith('.docx')) {
        try {
            logger.info(`[ProcessFileSkills] Processando arquivo DOCX: ${file.original_name}`)
            const docxBuffer = await fileData.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer: docxBuffer })
            textContent = result.value
            logger.info(`[ProcessFileSkills] DOCX processado: ${textContent.length} caracteres`)
        } catch (error: any) {
            throw new Error(`Erro ao processar DOCX: ${error.message}`)
        }
    }
    // Texto simples (txt, md, csv, json)
    else if (file.mime_type === 'text/plain' ||
             file.mime_type === 'text/markdown' ||
             file.mime_type === 'text/csv' ||
             file.mime_type === 'application/json' ||
             file.mime_type?.startsWith('text/') ||
             file.original_name?.endsWith('.txt') ||
             file.original_name?.endsWith('.md') ||
             file.original_name?.endsWith('.csv') ||
             file.original_name?.endsWith('.json')) {
        logger.info(`[ProcessFileSkills] Processando arquivo de texto: ${file.original_name}`)
        textContent = await fileData.text()
        logger.info(`[ProcessFileSkills] Texto extraído: ${textContent.length} caracteres`)
    } else {
        // Tenta ler como texto de qualquer jeito
        logger.warn(`[ProcessFileSkills] Tipo de arquivo não reconhecido, tentando ler como texto`)
        try {
            textContent = await fileData.text()
            if (!textContent || textContent.trim().length === 0) {
                throw new Error('Arquivo vazio ou sem texto extraível')
            }
        } catch (err: any) {
            logger.error(`[ProcessFileSkills] Falha ao ler arquivo: ${err.message}`)
            throw new Error(`Formato de arquivo não suportado. Formatos suportados: TXT, MD, CSV, JSON, PDF, DOCX.`)
        }
    }

    if (!textContent || textContent.trim().length === 0) {
        throw new Error('Arquivo vazio ou sem texto extraível')
    }

    return textContent
}

/**
 * Processa um arquivo para extrair skills usando LLM
 */
export async function processFileForSkills(
    fileId: string, 
    companiesId: string
): Promise<{ success: boolean; skills: number; error?: string }> {
    try {
        logger.info(`[ProcessFileSkills] Iniciando extração de skills do arquivo ${fileId}`)

        // 1. Buscar metadados do arquivo
        const { data: file, error: fileError } = await supabase
            .from('tb_files')
            .select('*')
            .eq('id', fileId)
            .eq('companies_id', companiesId)
            .single()

        if (fileError || !file) {
            throw new Error(`Arquivo não encontrado: ${fileError?.message}`)
        }

        // 2. Baixar conteúdo do arquivo
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(file.bucket)
            .download(file.path)

        if (downloadError) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
        }

        // 3. Extrair texto do arquivo
        const textContent = await extractTextFromFile(file, fileData)

        // 4. Limitar tamanho do texto para não exceder limites do LLM (ex: 50k caracteres)
        const maxTextLength = 50000
        const truncatedText = textContent.length > maxTextLength 
            ? textContent.substring(0, maxTextLength) + '\n\n[... texto truncado ...]'
            : textContent

        // 5. Usar LLM para extrair skills estruturados
        const skillsPrompt = `Analise o seguinte documento e extraia todas as habilidades (skills), capacidades, funções, ferramentas, ações ou competências mencionadas.

Documento:
${truncatedText}

INSTRUÇÕES:
- Extraia TODAS as habilidades, capacidades, funções ou ferramentas mencionadas no documento
- Inclua habilidades técnicas, soft skills, funções de sistema, APIs, ferramentas, processos, etc.
- Inclua também políticas, regras de atendimento, scripts e condutas (ex.: descontos, promoções, SLA, escalação): use um name curto e em "description" copie ou resuma fielmente o que o documento manda fazer ou dizer — isso será usado pelo agente como instrução.
- Se o documento menciona números, contatos, ou informações operacionais, considere "consultar informações" ou "acessar dados" como skills
- Seja abrangente: qualquer capacidade ou regra operacional mencionada deve ser extraída

Retorne APENAS um JSON array válido com objetos no formato:
[
  {
    "name": "Nome da skill",
    "description": "Descrição breve da skill",
    "type": "function|capability|tool|other"
  }
]

EXEMPLOS DE SKILLS:
- "Consultar banco de dados" (se menciona dados/números)
- "Enviar email" (se menciona email)
- "Processar pagamento" (se menciona pagamento)
- "Atender cliente" (se é sobre atendimento)
- "Consultar informações" (se menciona informações/dados)

Se não encontrar nenhum skill, retorne um array vazio: [].`

        logger.info(`[ProcessFileSkills] Chamando LLM para extrair skills...`)

        // Buscar API key da empresa (se disponível) ou usar variável de ambiente
        let apiKey: string | undefined = undefined
        
        // Tenta buscar da tabela tb_api_keys primeiro
        try {
            const { data: apiKeys, error: apiKeysError } = await supabase
                .from('tb_api_keys')
                .select('api_key')
                .eq('companies_id', companiesId)
                .eq('provider', 'openai')
                .maybeSingle()

            if (!apiKeysError && apiKeys?.api_key) {
                apiKey = apiKeys.api_key
                logger.info(`[ProcessFileSkills] ✅ API key da empresa encontrada na tabela`)
            } else {
                logger.info(`[ProcessFileSkills] ℹ️ API key não encontrada na tabela, usando variável de ambiente`)
            }
        } catch (keyError: any) {
            logger.warn(`[ProcessFileSkills] ⚠️ Erro ao buscar API key da tabela: ${keyError.message}`)
            // Continua sem API key, vai usar variável de ambiente
        }

        // Se não encontrou na tabela, verifica variável de ambiente
        if (!apiKey && !process.env.OPENAI_API_KEY) {
            throw new Error('API key do OpenAI não configurada. Configure OPENAI_API_KEY no ambiente ou adicione uma API key da empresa nas configurações.')
        }

        const llmResponse = await chatText({
            system: 'Você é um especialista em extração de informações estruturadas. Sempre retorne JSON válido, sem markdown ou texto adicional.',
            user: skillsPrompt,
            model: 'gpt-4o-mini', // Modelo mais barato para extração
            temperature: 0.1, // Baixa temperatura para respostas consistentes
            maxTokens: 2000,
            apiKey: apiKey // Passa a API key da empresa ou undefined (usa env)
        })

        if (!llmResponse.success || !llmResponse.content) {
            throw new Error(`Erro ao extrair skills: ${llmResponse.error || 'Resposta vazia do LLM'}`)
        }

        // 6. Parse do JSON retornado
        let skills: Array<{ name: string; description?: string; type?: string }> = []
        
        try {
            const skillsText = llmResponse.content.trim()
            logger.info(`[ProcessFileSkills] Resposta do LLM (primeiros 500 chars): ${skillsText.substring(0, 500)}`)
            
            // Remove markdown code blocks se houver
            const jsonText = skillsText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()
            
            // Tenta parse direto
            const parsed = JSON.parse(jsonText)
            
            // Se retornou um objeto com array dentro, extrai o array
            if (parsed.skills && Array.isArray(parsed.skills)) {
                skills = parsed.skills
            } else if (Array.isArray(parsed)) {
                skills = parsed
            } else if (parsed.name) {
                // Se retornou um único objeto, transforma em array
                skills = [parsed]
            } else {
                logger.warn(`[ProcessFileSkills] Formato inesperado do LLM:`, JSON.stringify(parsed, null, 2))
                skills = []
            }
        } catch (parseError: any) {
            logger.error(`[ProcessFileSkills] Erro ao fazer parse do JSON: ${parseError.message}`)
            logger.error(`[ProcessFileSkills] Conteúdo completo recebido: ${llmResponse.content}`)
            // Não lança erro, apenas loga e continua com array vazio
            skills = []
        }

        logger.info(`[ProcessFileSkills] ${skills.length} skills extraídos pelo LLM`)

        // 7. Limpar skills antigos deste arquivo
        const { error: deleteError } = await supabase
            .from('tb_file_skills')
            .delete()
            .eq('file_id', fileId)

        if (deleteError) {
            logger.warn(`[ProcessFileSkills] Erro ao limpar skills antigos: ${deleteError.message}`)
        }

        // 8. Salvar skills no banco
        let savedSkills = 0
        for (const skill of skills) {
            // Validar skill antes de salvar
            if (!skill.name || skill.name.trim().length === 0) {
                logger.warn(`[ProcessFileSkills] Skill sem nome ignorado:`, skill)
                continue
            }

            const { error: insertError } = await supabase
                .from('tb_file_skills')
                .insert({
                    file_id: fileId,
                    companies_id: companiesId,
                    skill_name: skill.name.trim(),
                    skill_description: skill.description?.trim() || null,
                    skill_type: skill.type || 'other',
                    extraction_metadata: {
                        extracted_at: new Date().toISOString(),
                        model: 'gpt-4o-mini',
                        original_text_length: textContent.length
                    }
                })

            if (insertError) {
                // Se for erro de duplicata (UNIQUE constraint), ignora
                if (insertError.code === '23505') {
                    logger.warn(`[ProcessFileSkills] Skill duplicado ignorado: ${skill.name}`)
                } else {
                    logger.warn(`[ProcessFileSkills] Erro ao salvar skill "${skill.name}": ${insertError.message}`)
                }
            } else {
                savedSkills++
            }
        }

        logger.info(`[ProcessFileSkills] Processamento concluído. ${savedSkills}/${skills.length} skills salvos.`)
        return { success: true, skills: savedSkills }

    } catch (error: any) {
        logger.error(`[ProcessFileSkills] Erro fatal: ${error.message}`)
        logger.error(`[ProcessFileSkills] Stack:`, error.stack)
        return { success: false, skills: 0, error: error.message }
    }
}
