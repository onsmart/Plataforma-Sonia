import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const storageUploadMock = vi.fn()
  const rpcMock = vi.fn()
  const fromMaybeSingleMock = vi.fn()
  const fromMock = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: fromMaybeSingleMock,
  }))
  return {
    canUseRAGMock: vi.fn(),
    getCompanyIdByEmailMock: vi.fn(),
    storageUploadMock,
    rpcMock,
    fromMock,
    fromMaybeSingleMock,
  }
})

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: mocks.getCompanyIdByEmailMock,
}))

vi.mock('../utils/plan-helper', () => ({
  canUseRAG: mocks.canUseRAGMock,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mocks.storageUploadMock,
        remove: vi.fn(),
        download: vi.fn(),
      })),
    },
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}))

vi.mock('../services/files/validate-knowledge-file.service', () => ({
  validateKnowledgeFileContent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  formatValidationErrorResponse: vi.fn(),
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

describe('FilesController.createText', () => {
  const controller = new FilesController()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCompanyIdByEmailMock.mockResolvedValue('company-1')
    mocks.canUseRAGMock.mockResolvedValue({ allowed: true })
    mocks.storageUploadMock.mockResolvedValue({ error: null })
    mocks.rpcMock.mockResolvedValue({ data: 'file-uuid-1', error: null })
  })

  it('retorna 400 quando título é curto', async () => {
    const res = createRes()
    await controller.createText(
      {
        user: { email: 'user@test.com' },
        body: { title: 'ab', content: 'x'.repeat(220), purpose: 'rag' },
      } as any,
      res
    )
    expect(res.statusCode).toBe(400)
  })

  it('cria entrada de texto com título e retorna indexing', async () => {
    const res = createRes()
    const content = `${'Conteudo de teste para RAG com informacoes uteis. '.repeat(8)}`.trim()

    await controller.createText(
      {
        user: { email: 'user@test.com' },
        body: { title: 'FAQ Atendimento', content, purpose: 'rag' },
      } as any,
      res
    )

    expect(res.statusCode).toBe(201)
    expect(res.body.fileId).toBe('file-uuid-1')
    expect(res.body.title).toBe('FAQ Atendimento')
    expect(res.body.status).toBe('indexing')
    expect(mocks.rpcMock).toHaveBeenCalledWith(
      'sp_create_file',
      expect.objectContaining({
        p_original_name: 'FAQ Atendimento',
        p_file_purpose: 'rag',
        p_mime_type: 'text/plain',
      })
    )
  })

  it('bloqueia quando plano não permite RAG', async () => {
    mocks.canUseRAGMock.mockResolvedValue({
      allowed: false,
      reason: 'Plano Start',
      upgradePlan: 'rec_growth',
    })
    const res = createRes()
    const content = `${'Conteudo de teste para RAG com informacoes uteis. '.repeat(8)}`.trim()

    await controller.createText(
      {
        user: { email: 'user@test.com' },
        body: { title: 'FAQ', content, purpose: 'rag' },
      } as any,
      res
    )

    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe('PLAN_RAG_REQUIRED')
  })
})

describe('FilesController.process plan gate', () => {
  const controller = new FilesController()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canUseRAGMock.mockResolvedValue({
      allowed: false,
      reason: 'Base indisponível',
      upgradePlan: 'rec_growth',
    })
    mocks.fromMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'file-1',
        original_name: 'FAQ',
        mime_type: 'text/plain',
        bucket: 'sonia-kb',
        path: 'company-1/1_faq.txt',
        file_purpose: 'rag',
      },
      error: null,
    })
  })

  it('retorna 403 quando plano não permite processar', async () => {
    const res = createRes()
    await controller.process(
      {
        user: { email: 'user@test.com', companiesId: 'company-1' },
        params: { fileId: 'file-1' },
        body: { purpose: 'rag' },
      } as any,
      res
    )

    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe('PLAN_RAG_REQUIRED')
  })
})
