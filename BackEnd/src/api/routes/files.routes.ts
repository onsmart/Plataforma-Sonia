
import { Router } from 'express'
import { FilesController } from '../controllers/files.controller'
import { requireAuth, requireWorkspace, requirePermission } from '../../middleware/auth.middleware'

const filesRoutes = Router()
const filesController = new FilesController()

/** @deprecated Prefer POST /files/create-text — upload legado (.txt/.pdf) */
filesRoutes.post('/upload', requireAuth, requireWorkspace, requirePermission('basic.write'), (req, res) =>
  filesController.upload(req, res)
)

filesRoutes.post('/create-text', requireAuth, requireWorkspace, requirePermission('basic.write'), (req, res) =>
  filesController.createText(req, res)
)

filesRoutes.post('/:fileId/process', requireAuth, requireWorkspace, requirePermission('basic.write'), (req, res) =>
  filesController.process(req, res)
)

filesRoutes.get('/:fileId/skills', requireAuth, requireWorkspace, requirePermission('basic.read'), (req, res) =>
  filesController.getSkills(req, res)
)

filesRoutes.get('/:fileId/readiness', requireAuth, requireWorkspace, requirePermission('basic.read'), (req, res) =>
  filesController.readiness(req, res)
)

filesRoutes.delete('/:fileId', requireAuth, requireWorkspace, requirePermission('basic.write'), (req, res) =>
  filesController.delete(req, res)
)

export default filesRoutes
