import { beforeEach, describe, expect, it, vi } from 'vitest'

const { canUseRAGMock, getCompanyIdByEmailMock } = vi.hoisted(() => ({
  canUseRAGMock: vi.fn(),
  getCompanyIdByEmailMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: getCompanyIdByEmailMock,
}))

vi.mock('../utils/plan-helper', () => ({
  canUseRAG: canUseRAGMock,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() }, from: vi.fn() },
}))

vi.mock('../services/files/extract-file-text', () => ({
  extractTextFromBuffer: vi.fn().mockResolvedValue('texto de teste com conteudo suficiente para validacao'),
}))

vi.mock('../services/files/validate-knowledge-file.service', () => ({
  validateKnowledgeFileContent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  formatValidationErrorResponse: vi.fn(),
}))

vi.mock('../services/files/process-file.service', () => ({
  processFileForRAG: vi.fn(),
}))

vi.mock('../services/files/process-file-skills.service', () => ({
  processFileForSkills: vi.fn(),
}))

import { FilesController } from '../api/controllers/files.controller'

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload
      return res
    }),
  }
  return res
}

describe('FilesController.upload plan gate', () => {
  const controller = new FilesController()

  beforeEach(() => {
    vi.clearAllMocks()
    getCompanyIdByEmailMock.mockResolvedValue('company-rec-start')
    canUseRAGMock.mockResolvedValue({
      allowed: false,
      reason: 'Base de conhecimento não disponível no REC Start',
      upgradePlan: 'rec_growth',
    })
  })

  it('retorna 403 PLAN_RAG_REQUIRED para rec_start', async () => {
    const res = createRes()
    const content = Buffer.from('conteudo teste').toString('base64')

    await controller.upload(
      {
        user: { email: 'user@test.com' },
        body: {
          fileName: 'doc.txt',
          mimeType: 'text/plain',
          contentBase64: content,
          purpose: 'rag',
        },
      } as any,
      res
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body?.code).toBe('PLAN_RAG_REQUIRED')
    expect(res.body?.upgradePlan).toBe('rec_growth')
  })
})
