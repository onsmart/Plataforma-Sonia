
import { Request, Response } from 'express'
import { processFileForRAG } from '../../services/files/process-file.service'
import { processFileForSkills } from '../../services/files/process-file-skills.service'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

export class FilesController {
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

            // Ler purpose do body (rag ou skills)
            const { purpose = 'rag' } = req.body

            // Processar baseado no purpose
            let result
            if (purpose === 'skills') {
                // Processar como Skills
                result = await processFileForSkills(String(fileId), String(companiesId))
            } else {
                // Processar como RAG (comportamento padrão)
                result = await processFileForRAG(String(fileId), String(companiesId))
            }

            if (result.success) {
                return res.json({
                    success: true,
                    message: 'File processed successfully',
                    chunks: 'chunks' in result ? result.chunks : undefined,
                    skills: 'skills' in result ? result.skills : undefined
                })
            } else {
                return res.status(500).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error: any) {
            logger.error(`[FilesController] Erro: ${error.message}`)
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
