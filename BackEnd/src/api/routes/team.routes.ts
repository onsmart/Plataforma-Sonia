import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  deleteTeamMember,
  getTeamMembers,
  getTeamPermissions,
  getTeamWorkspace,
  postTeamInvite,
  putTeamMemberPermission,
} from '../controllers/team.controller'

const router = Router()

router.get('/workspace', requireAuth, getTeamWorkspace)
router.get('/members', requireAuth, getTeamMembers)
router.get('/permissions', requireAuth, getTeamPermissions)
router.post('/invite', requireAuth, postTeamInvite)
router.put('/member-permission', requireAuth, putTeamMemberPermission)
router.delete('/members/:email', requireAuth, deleteTeamMember)

export default router
