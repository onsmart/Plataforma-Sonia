
import { Router } from 'express'
import { FilesController } from '../controllers/files.controller'
import { requireAuth } from '../../middleware/auth.middleware'

const filesRoutes = Router()
const filesController = new FilesController()

// Upload KB via service role (contorna RLS do Storage no browser)
// POST /files/upload
filesRoutes.post('/upload', requireAuth, (req, res) => filesController.upload(req, res))

// Rota para processar vetorização de arquivo
// POST /files/:fileId/process
filesRoutes.post('/:fileId/process', (req, res) => filesController.process(req, res))

// Rota para listar skills de um arquivo
// GET /files/:fileId/skills
filesRoutes.get('/:fileId/skills', (req, res) => filesController.getSkills(req, res))

// GET /files/:fileId/readiness — arquivo processado e pronto para o agente
filesRoutes.get('/:fileId/readiness', requireAuth, (req, res) => filesController.readiness(req, res))

// Rota para deletar arquivo definitivamente (Storage + metadados + chunks + vínculos)
// DELETE /files/:fileId
filesRoutes.delete('/:fileId', requireAuth, (req, res) => filesController.delete(req, res))

export default filesRoutes
