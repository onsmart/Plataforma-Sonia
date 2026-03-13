"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileForSkills = processFileForSkills;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const openai_1 = require("../llm/openai");
const mammoth_1 = __importDefault(require("mammoth"));
// Importação para pdf-parse (v2 API - CommonJS)
const { PDFParse } = require('pdf-parse');
/**
 * Extrai texto de um arquivo (reutiliza lógica do RAG)
 */
async function extractTextFromFile(file, fileData) {
    let textContent = '';
    const isPdfByMime = file.mime_type === 'application/pdf';
    const isPdfByExt = file.original_name?.toLowerCase().endsWith('.pdf');
    // PDF
    if (isPdfByMime || isPdfByExt) {
        let parser = null;
        try {
            logger_1.default.info(`[ProcessFileSkills] Processando arquivo PDF: ${file.original_name}`);
            const pdfBuffer = await fileData.arrayBuffer();
            parser = new PDFParse({ data: Buffer.from(pdfBuffer) });
            const result = await parser.getText();
            textContent = result.text;
            logger_1.default.info(`[ProcessFileSkills] PDF processado: ${textContent.length} caracteres`);
        }
        catch (error) {
            logger_1.default.error(`[ProcessFileSkills] Erro ao processar PDF:`, error);
            throw new Error(`Erro ao processar PDF: ${error.message}`);
        }
        finally {
            if (parser) {
                try {
                    await parser.destroy();
                }
                catch (destroyError) {
                    logger_1.default.warn(`[ProcessFileSkills] Erro ao destruir parser PDF: ${destroyError.message}`);
                }
            }
        }
    }
    // DOCX
    else if (file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.original_name?.toLowerCase().endsWith('.docx')) {
        try {
            logger_1.default.info(`[ProcessFileSkills] Processando arquivo DOCX: ${file.original_name}`);
            const docxBuffer = await fileData.arrayBuffer();
            const result = await mammoth_1.default.extractRawText({ arrayBuffer: docxBuffer });
            textContent = result.value;
            logger_1.default.info(`[ProcessFileSkills] DOCX processado: ${textContent.length} caracteres`);
        }
        catch (error) {
            throw new Error(`Erro ao processar DOCX: ${error.message}`);
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
        logger_1.default.info(`[ProcessFileSkills] Processando arquivo de texto: ${file.original_name}`);
        textContent = await fileData.text();
        logger_1.default.info(`[ProcessFileSkills] Texto extraído: ${textContent.length} caracteres`);
    }
    else {
        // Tenta ler como texto de qualquer jeito
        logger_1.default.warn(`[ProcessFileSkills] Tipo de arquivo não reconhecido, tentando ler como texto`);
        try {
            textContent = await fileData.text();
            if (!textContent || textContent.trim().length === 0) {
                throw new Error('Arquivo vazio ou sem texto extraível');
            }
        }
        catch (err) {
            logger_1.default.error(`[ProcessFileSkills] Falha ao ler arquivo: ${err.message}`);
            throw new Error(`Formato de arquivo não suportado. Formatos suportados: TXT, MD, CSV, JSON, PDF, DOCX.`);
        }
    }
    if (!textContent || textContent.trim().length === 0) {
        throw new Error('Arquivo vazio ou sem texto extraível');
    }
    return textContent;
}
/**
 * Processa um arquivo para extrair skills usando LLM
 */
async function processFileForSkills(fileId, companiesId) {
    try {
        logger_1.default.info(`[ProcessFileSkills] Iniciando extração de skills do arquivo ${fileId}`);
        // 1. Buscar metadados do arquivo
        const { data: file, error: fileError } = await supabase_1.supabase
            .from('tb_files')
            .select('*')
            .eq('id', fileId)
            .eq('companies_id', companiesId)
            .single();
        if (fileError || !file) {
            throw new Error(`Arquivo não encontrado: ${fileError?.message}`);
        }
        // 2. Baixar conteúdo do arquivo
        const { data: fileData, error: downloadError } = await supabase_1.supabase.storage
            .from(file.bucket)
            .download(file.path);
        if (downloadError) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
        }
        // 3. Extrair texto do arquivo
        const textContent = await extractTextFromFile(file, fileData);
        // 4. Limitar tamanho do texto para não exceder limites do LLM (ex: 50k caracteres)
        const maxTextLength = 50000;
        const truncatedText = textContent.length > maxTextLength
            ? textContent.substring(0, maxTextLength) + '\n\n[... texto truncado ...]'
            : textContent;
        // 5. Usar LLM para extrair skills estruturados
        const skillsPrompt = `Analise o seguinte documento e extraia todas as habilidades (skills), capacidades, funções, ferramentas, ações ou competências mencionadas.

Documento:
${truncatedText}

INSTRUÇÕES:
- Extraia TODAS as habilidades, capacidades, funções ou ferramentas mencionadas no documento
- Inclua habilidades técnicas, soft skills, funções de sistema, APIs, ferramentas, processos, etc.
- Se o documento menciona números, contatos, ou informações operacionais, considere "consultar informações" ou "acessar dados" como skills
- Seja abrangente: qualquer capacidade mencionada deve ser extraída

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

Se não encontrar nenhum skill, retorne um array vazio: [].`;
        logger_1.default.info(`[ProcessFileSkills] Chamando LLM para extrair skills...`);
        // Buscar API key da empresa (se disponível) ou usar variável de ambiente
        let apiKey = undefined;
        // Tenta buscar da tabela tb_api_keys primeiro
        try {
            const { data: apiKeys, error: apiKeysError } = await supabase_1.supabase
                .from('tb_api_keys')
                .select('api_key')
                .eq('companies_id', companiesId)
                .eq('provider', 'openai')
                .maybeSingle();
            if (!apiKeysError && apiKeys?.api_key) {
                apiKey = apiKeys.api_key;
                logger_1.default.info(`[ProcessFileSkills] ✅ API key da empresa encontrada na tabela`);
            }
            else {
                logger_1.default.info(`[ProcessFileSkills] ℹ️ API key não encontrada na tabela, usando variável de ambiente`);
            }
        }
        catch (keyError) {
            logger_1.default.warn(`[ProcessFileSkills] ⚠️ Erro ao buscar API key da tabela: ${keyError.message}`);
            // Continua sem API key, vai usar variável de ambiente
        }
        // Se não encontrou na tabela, verifica variável de ambiente
        if (!apiKey && !process.env.OPENAI_API_KEY) {
            throw new Error('API key do OpenAI não configurada. Configure OPENAI_API_KEY no ambiente ou adicione uma API key da empresa nas configurações.');
        }
        const llmResponse = await (0, openai_1.chatText)({
            system: 'Você é um especialista em extração de informações estruturadas. Sempre retorne JSON válido, sem markdown ou texto adicional.',
            user: skillsPrompt,
            model: 'gpt-4o-mini', // Modelo mais barato para extração
            temperature: 0.1, // Baixa temperatura para respostas consistentes
            maxTokens: 2000,
            apiKey: apiKey // Passa a API key da empresa ou undefined (usa env)
        });
        if (!llmResponse.success || !llmResponse.content) {
            throw new Error(`Erro ao extrair skills: ${llmResponse.error || 'Resposta vazia do LLM'}`);
        }
        // 6. Parse do JSON retornado
        let skills = [];
        try {
            const skillsText = llmResponse.content.trim();
            logger_1.default.info(`[ProcessFileSkills] Resposta do LLM (primeiros 500 chars): ${skillsText.substring(0, 500)}`);
            // Remove markdown code blocks se houver
            const jsonText = skillsText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            // Tenta parse direto
            const parsed = JSON.parse(jsonText);
            // Se retornou um objeto com array dentro, extrai o array
            if (parsed.skills && Array.isArray(parsed.skills)) {
                skills = parsed.skills;
            }
            else if (Array.isArray(parsed)) {
                skills = parsed;
            }
            else if (parsed.name) {
                // Se retornou um único objeto, transforma em array
                skills = [parsed];
            }
            else {
                logger_1.default.warn(`[ProcessFileSkills] Formato inesperado do LLM:`, JSON.stringify(parsed, null, 2));
                skills = [];
            }
        }
        catch (parseError) {
            logger_1.default.error(`[ProcessFileSkills] Erro ao fazer parse do JSON: ${parseError.message}`);
            logger_1.default.error(`[ProcessFileSkills] Conteúdo completo recebido: ${llmResponse.content}`);
            // Não lança erro, apenas loga e continua com array vazio
            skills = [];
        }
        logger_1.default.info(`[ProcessFileSkills] ${skills.length} skills extraídos pelo LLM`);
        // 7. Limpar skills antigos deste arquivo
        const { error: deleteError } = await supabase_1.supabase
            .from('tb_file_skills')
            .delete()
            .eq('file_id', fileId);
        if (deleteError) {
            logger_1.default.warn(`[ProcessFileSkills] Erro ao limpar skills antigos: ${deleteError.message}`);
        }
        // 8. Salvar skills no banco
        let savedSkills = 0;
        for (const skill of skills) {
            // Validar skill antes de salvar
            if (!skill.name || skill.name.trim().length === 0) {
                logger_1.default.warn(`[ProcessFileSkills] Skill sem nome ignorado:`, skill);
                continue;
            }
            const { error: insertError } = await supabase_1.supabase
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
            });
            if (insertError) {
                // Se for erro de duplicata (UNIQUE constraint), ignora
                if (insertError.code === '23505') {
                    logger_1.default.warn(`[ProcessFileSkills] Skill duplicado ignorado: ${skill.name}`);
                }
                else {
                    logger_1.default.warn(`[ProcessFileSkills] Erro ao salvar skill "${skill.name}": ${insertError.message}`);
                }
            }
            else {
                savedSkills++;
            }
        }
        logger_1.default.info(`[ProcessFileSkills] Processamento concluído. ${savedSkills}/${skills.length} skills salvos.`);
        return { success: true, skills: savedSkills };
    }
    catch (error) {
        logger_1.default.error(`[ProcessFileSkills] Erro fatal: ${error.message}`);
        logger_1.default.error(`[ProcessFileSkills] Stack:`, error.stack);
        return { success: false, skills: 0, error: error.message };
    }
}
