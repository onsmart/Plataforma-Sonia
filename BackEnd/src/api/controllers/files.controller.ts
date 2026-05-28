
import { Request, Response } from 'express'
import { processFileForRAG } from '../../services/files/process-file.service'
import { processFileForSkills } from '../../services/files/process-file-skills.service'
import { extractTextFromBuffer } from '../../services/files/extract-file-text'
import {
    formatValidationErrorResponse,
    validateKnowledgeFileContent,
} from '../../services/files/validate-knowledge-file.service'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { canUseRAG } from '../../utils/plan-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const KB_BUCKET = 'sonia-kb'
const KB_MAX_BYTES = 10 * 1024 * 1024

export class FilesController {
    async upload(req: Request, res: Response) {
        const email = req.user?.email
        if (!email) {
            return res.status(401).json({ error: 'User email is required' })
        }

        const {
            fileName,
            mimeType,
            contentBase64,
            purpose = 'rag',
        } = req.body as {
            fileName?: string
            mimeType?: string
            contentBase64?: string
            purpose?: string
        }

        if (!fileName?.trim() || !contentBase64?.trim()) {
            return res.status(400).json({ error: 'fileName and contentBase64 are required' })
        }

        const filePurpose = String(purpose).toLowerCase() === 'skills' ? 'skills' : 'rag'

        let buffer: Buffer
        try {
            buffer = Buffer.from(contentBase64, 'base64')
        } catch {
            return res.status(400).json({ error: 'Invalid file payload (base64)' })
        }

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'Empty file' })
        }

        if (buffer.length > KB_MAX_BYTES) {
            return res.status(413).json({
                error: `Arquivo excede o limite de ${KB_MAX_BYTES / (1024 * 1024)} MB`,
            })
        }

        const resolvedMime = mimeType?.trim() || 'application/octet-stream'

        try {
            let extractedText = ''
            try {
                extractedText = await extractTextFromBuffer({
                    buffer,
                    originalName: fileName,
                    mimeType: resolvedMime,
                })
            } catch (extractErr: any) {
                logger.warn(`[FilesController.upload] Extração falhou: ${extractErr.message}`)
                return res.status(422).json({
                    error: 'Não foi possível ler o conteúdo do arquivo',
                    valid: false,
                    errors: [extractErr.message],
                    criteria: [
                        {
                            id: 'extract',
                            label: 'Conteúdo legível e formato suportado',
                            passed: false,
                            message: extractErr.message,
                        },
                    ],
                    suggestions: [
                        'Use TXT, MD, CSV, JSON, PDF ou DOCX com texto real.',
                        'Verifique se o arquivo não está corrompido.',
                    ],
                })
            }

            const validation = validateKnowledgeFileContent(extractedText, filePurpose)
            if (!validation.valid) {
                logger.info(`[FilesController.upload] Validação reprovada (${filePurpose})`, {
                    fileName,
                    errors: validation.errors,
                })
                return res.status(422).json(formatValidationErrorResponse(validation))
            }

            const companiesId = await getCompanyIdByEmail(email)
            if (!companiesId) {
                return res.status(403).json({ error: 'Empresa não encontrada para o usuário' })
            }

            if (filePurpose === 'rag' || filePurpose === 'skills') {
                const ragCheck = await canUseRAG(companiesId)
                if (!ragCheck.allowed) {
                    return res.status(403).json({
                        error: ragCheck.reason || 'Base de conhecimento não disponível no seu plano',
                        code: 'PLAN_RAG_REQUIRED',
                        upgradePlan: ragCheck.upgradePlan,
                    })
                }
            }

            const timestamp = Date.now()
            const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${companiesId}/${timestamp}_${sanitizedName}`

            const uploadOptions: { upsert: boolean; contentType?: string } = { upsert: false }
            if (!resolvedMime.startsWith('image/')) {
                uploadOptions.contentType = resolvedMime
            }

            const { error: uploadError } = await supabase.storage
                .from(KB_BUCKET)
                .upload(filePath, buffer, uploadOptions)

            if (uploadError) {
                logger.error(`[FilesController.upload] Storage: ${uploadError.message}`)
                return res.status(500).json({
                    error: 'Erro ao fazer upload no storage',
                    details: uploadError.message,
                })
            }

            const { data: fileId, error: dbError } = await supabase.rpc('sp_create_file', {
                p_email: email.trim(),
                p_bucket: KB_BUCKET,
                p_path: filePath,
                p_original_name: fileName,
                p_mime_type: resolvedMime,
                p_size_bytes: buffer.length,
                p_file_purpose: filePurpose,
            })

            if (dbError) {
                await supabase.storage.from(KB_BUCKET).remove([filePath])
                logger.error(`[FilesController.upload] sp_create_file: ${dbError.message}`)
                return res.status(500).json({
                    error: 'Erro ao salvar registro do arquivo',
                    details: dbError.message,
                })
            }

            return res.status(201).json({
                success: true,
                valid: true,
                validatedAtUpload: true,
                fileId,
                path: filePath,
                bucket: KB_BUCKET,
                originalName: fileName,
                mimeType: resolvedMime,
                sizeBytes: buffer.length,
                purpose: filePurpose,
            })
        } catch (error: any) {
            logger.error(`[FilesController.upload] Erro: ${error.message}`)
            return res.status(500).json({ error: error.message })
        }
    }

    async process(req: Request, res: Response) {
        const { fileId } = req.params
        // Espera-se que o middleware de auth popule req.user ou que venha no body/header por enquanto
        // Como o frontend manda email no header ou body, vamos simplificar
        // TODO: Usar middleware de auth real
        const emailHeader = req.headers['x-user-email']
        const email = ((Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email) as string

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' })
        }

        if (!email) {
            return res.status(401).json({ error: 'User email is required for context' })
        }

        try {
            // Validar acesso (basic)
            const companiesId = await getCompanyIdByEmail(email)

            if (!companiesId) {
                return res.status(403).json({ error: 'User does not belong to any company' })
            }

            const { purpose = 'rag' } = req.body
            const bodyPurpose = String(purpose).toLowerCase() === 'skills' ? 'skills' : 'rag'

            const { data: fileRow, error: fileRowError } = await supabase
                .from('tb_files')
                .select('id, original_name, mime_type, bucket, path, file_purpose')
                .eq('id', fileId)
                .eq('companies_id', companiesId)
                .maybeSingle()

            if (fileRowError || !fileRow) {
                return res.status(404).json({ error: 'Arquivo não encontrado' })
            }

            const filePurpose =
                fileRow.file_purpose === 'skills' || fileRow.file_purpose === 'rag'
                    ? fileRow.file_purpose
                    : bodyPurpose

            const { data: blob, error: downloadError } = await supabase.storage
                .from(fileRow.bucket)
                .download(fileRow.path)

            if (downloadError || !blob) {
                return res.status(500).json({ error: 'Erro ao baixar arquivo para validação' })
            }

            const buffer = Buffer.from(await blob.arrayBuffer())
            let extractedText = ''
            try {
                extractedText = await extractTextFromBuffer({
                    buffer,
                    originalName: fileRow.original_name,
                    mimeType: fileRow.mime_type,
                })
            } catch (extractErr: any) {
                return res.status(422).json({
                    error: 'Não foi possível ler o conteúdo do arquivo',
                    valid: false,
                    errors: [extractErr.message],
                })
            }

            const validation = validateKnowledgeFileContent(extractedText, filePurpose)
            if (!validation.valid) {
                return res.status(422).json(formatValidationErrorResponse(validation))
            }

            let result
            if (filePurpose === 'skills') {
                // Processar como Skills
                result = await processFileForSkills(String(fileId), String(companiesId))
            } else {
                // Processar como RAG (comportamento padrão)
                result = await processFileForRAG(String(fileId), String(companiesId))
            }

            if (result.success) {
                const chunks = 'chunks' in result ? result.chunks : 0
                const skills = 'skills' in result ? result.skills : 0

                if (filePurpose === 'rag' && (!chunks || chunks === 0)) {
                    return res.status(422).json({
                        error: 'Arquivo RAG não gerou trechos indexáveis',
                        valid: false,
                        errors: ['Nenhum chunk foi salvo. O conteúdo pode estar vazio após extração.'],
                    })
                }
                if (filePurpose === 'skills' && (!skills || skills === 0)) {
                    return res.status(422).json({
                        error: 'Arquivo Skill não gerou regras utilizáveis',
                        valid: false,
                        errors: [
                            'Nenhuma skill foi extraída. Reformule o arquivo com regras explícitas (permitido/proibido/fallback).',
                        ],
                    })
                }

                return res.json({
                    success: true,
                    message: 'File processed successfully',
                    valid: true,
                    chunks: chunks || undefined,
                    skills: skills || undefined,
                })
            } else {
                return res.status(422).json({
                    success: false,
                    valid: false,
                    error: result.error,
                })
            }
        } catch (error: any) {
            logger.error(`[FilesController] Erro: ${error.message}`)
            return res.status(500).json({ error: error.message })
        }
    }

    async readiness(req: Request, res: Response) {
        const { fileId } = req.params
        const email = req.user?.email
        if (!email) {
            return res.status(401).json({ error: 'User email is required' })
        }
        try {
            const companiesId = await getCompanyIdByEmail(email)
            if (!companiesId) {
                return res.status(403).json({ error: 'Empresa não encontrada' })
            }
            const { getFileReadiness } = await import('../../services/files/file-readiness.service')
            const status = await getFileReadiness(String(fileId), String(companiesId))
            return res.json(status)
        } catch (error: any) {
            logger.error(`[FilesController.readiness] ${error.message}`)
            return res.status(500).json({ error: error.message })
        }
    }

    async getSkills(req: Request, res: Response) {
        const { fileId } = req.params
        const emailHeader = req.headers['x-user-email']
        const email = ((Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email) as string

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' })
        }

        if (!email) {
            return res.status(401).json({ error: 'User email is required' })
        }

        try {
            const companiesId = await getCompanyIdByEmail(email)

            if (!companiesId) {
                return res.status(403).json({ error: 'User does not belong to any company' })
            }

            // Buscar skills do arquivo
            const { data: skills, error } = await supabase
                .from('tb_file_skills')
                .select('*')
                .eq('file_id', fileId)
                .eq('companies_id', companiesId)
                .order('skill_name', { ascending: true })

            if (error) {
                logger.error(`[FilesController.getSkills] Erro: ${error.message}`)
                return res.status(500).json({ error: error.message })
            }

            return res.json({
                success: true,
                skills: skills || [],
                count: skills?.length || 0
            })
        } catch (error: any) {
            logger.error(`[FilesController.getSkills] Erro: ${error.message}`)
            return res.status(500).json({ error: error.message })
        }
    }

    async delete(req: Request, res: Response) {
        const { fileId } = req.params
        const emailHeader = req.headers['x-user-email']
        const email = (req.user?.email || (Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email) as string

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' })
        }

        if (!email) {
            return res.status(401).json({ error: 'User email is required' })
        }

        try {
            const companiesId = await getCompanyIdByEmail(email)

            if (!companiesId) {
                return res.status(403).json({ error: 'User does not belong to any company' })
            }

            const { data: file, error: fileError } = await supabase
                .from('tb_files')
                .select('id, bucket, path, original_name')
                .eq('id', fileId)
                .eq('companies_id', companiesId)
                .maybeSingle()

            if (fileError) {
                logger.error(`[FilesController.delete] Erro ao buscar arquivo: ${fileError.message}`)
                return res.status(500).json({ error: fileError.message })
            }

            if (!file) {
                return res.status(404).json({ error: 'File not found' })
            }

            if (file.bucket && file.path) {
                const { error: storageError } = await supabase.storage
                    .from(file.bucket)
                    .remove([file.path])

                if (storageError) {
                    logger.error(`[FilesController.delete] Erro ao remover storage: ${storageError.message}`)
                    return res.status(500).json({
                        error: 'Failed to delete file from storage',
                        details: storageError.message
                    })
                }
            }

            const dependentDeletes = [
                {
                    label: 'tb_agent_files',
                    run: () => supabase
                        .from('tb_agent_files')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                },
                {
                    label: 'tb_file_sections',
                    run: () => supabase
                        .from('tb_file_sections')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                },
                {
                    label: 'tb_file_skills',
                    run: () => supabase
                        .from('tb_file_skills')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                }
            ]

            for (const item of dependentDeletes) {
                const { error } = await item.run()
                if (error) {
                    logger.error(`[FilesController.delete] Erro ao limpar ${item.label}: ${error.message}`)
                    return res.status(500).json({
                        error: `Failed to delete related records from ${item.label}`,
                        details: error.message
                    })
                }
            }

            const { error: deleteFileError } = await supabase
                .from('tb_files')
                .delete()
                .eq('id', fileId)
                .eq('companies_id', companiesId)

            if (deleteFileError) {
                logger.error(`[FilesController.delete] Erro ao deletar arquivo: ${deleteFileError.message}`)
                return res.status(500).json({ error: deleteFileError.message })
            }

            logger.info(`[FilesController.delete] Arquivo deletado definitivamente`, {
                fileId,
                companiesId,
                originalName: file.original_name
            })

            return res.json({
                success: true,
                deleted_file_id: fileId,
                deleted_from_storage: Boolean(file.bucket && file.path)
            })
        } catch (error: any) {
            logger.error(`[FilesController.delete] Erro: ${error.message}`)
            return res.status(500).json({ error: error.message })
        }
    }
}
