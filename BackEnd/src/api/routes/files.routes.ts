
import { Router } from 'express'
import { FilesController } from '../controllers/files.controller'

const filesRoutes = Router()
const filesController = new FilesController()

// Rota para processar vetorização de arquivo
// POST /files/:fileId/process
filesRoutes.post('/:fileId/process', (req, res) => filesController.process(req, res))

// Rota para listar skills de um arquivo
// GET /files/:fileId/skills
filesRoutes.get('/:fileId/skills', (req, res) => filesController.getSkills(req, res))

export default filesRoutes
