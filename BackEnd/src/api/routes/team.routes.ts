import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
import {
  deleteTeamMember,
  getTeamMembers,
  getTeamPermissions,
  getTeamWorkspace,
  postTeamInvite,
  putTeamMemberPermission,
} from '../controllers/team.controller'

const router = Router()

router.get('/workspace', requireAuth, requireWorkspace, getTeamWorkspace)
router.get('/members', requireAuth, requireWorkspace, getTeamMembers)
router.get('/permissions', requireAuth, requireWorkspace, getTeamPermissions)
router.post('/invite', requireAuth, requireWorkspace, postTeamInvite)
router.put('/member-permission', requireAuth, requireWorkspace, putTeamMemberPermission)
router.delete('/members/:email', requireAuth, requireWorkspace, deleteTeamMember)

export default router
