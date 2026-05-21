import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFlowAccessibleByUserMock, executeFlowForChannelMock } = vi.hoisted(() => ({
  findFlowAccessibleByUserMock: vi.fn(),
  executeFlowForChannelMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../services/flows', () => ({
  FlowService: {
    findFlowAccessibleByUser: findFlowAccessibleByUserMock,
  },
}))

vi.mock('../services/flows/flow-channel-runtime', () => ({
  executeFlowForChannel: executeFlowForChannelMock,
  parseFlowResumeSession: vi.fn((value: unknown) => value),
}))

import { executeFlow } from '../api/controllers/flows.controller'

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

describe('executeFlow JWT / tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeFlowForChannelMock.mockResolvedValue({
      context: {
        flowId: 'flow-a',
        executionId: 'exec-1',
        executionHistory: [],
        data: {},
      },
      outboundMessage: '',
      delivery: null,
    })
  })

  it('retorna 401 sem usuário autenticado no JWT', async () => {
    const res = createRes()
    await executeFlow({ body: { flow_id: 'flow-a' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.body?.code).toBe('AUTH_REQUIRED')
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
  })

  it('retorna 403 quando body.email diverge do JWT', async () => {
    const res = createRes()
    await executeFlow(
      {
        user: { email: 'user-a@company-a.com', userId: 'u-a' },
        body: {
          flow_id: 'flow-b',
          email: 'attacker@company-b.com',
        },
      } as any,
      res
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body?.code).toBe('FLOW_EXECUTE_EMAIL_MISMATCH')
    expect(findFlowAccessibleByUserMock).not.toHaveBeenCalled()
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
  })

  it('retorna 403 quando fluxo não pertence à empresa do JWT', async () => {
    findFlowAccessibleByUserMock.mockResolvedValue(null)

    const res = createRes()
    await executeFlow(
      {
        user: { email: 'user-a@company-a.com', userId: 'u-a' },
        body: { flow_id: 'flow-b' },
      } as any,
      res
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body?.code).toBe('FLOW_EXECUTE_FORBIDDEN')
    expect(findFlowAccessibleByUserMock).toHaveBeenCalledWith('flow-b', 'user-a@company-a.com')
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
  })

  it('executa com req.user.email mesmo se body.email for omitido', async () => {
    findFlowAccessibleByUserMock.mockResolvedValue({
      id: 'flow-a',
      flowKind: 'main',
      parentFlowId: null,
      parentFlowName: null,
    })

    const res = createRes()
    await executeFlow(
      {
        user: { email: 'user-a@company-a.com', userId: 'u-a' },
        body: {
          flow_id: 'flow-a',
          initial_data: { message: 'oi' },
          execution_mode: 'test',
        },
      } as any,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(findFlowAccessibleByUserMock).toHaveBeenCalledWith('flow-a', 'user-a@company-a.com')
    expect(executeFlowForChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: 'flow-a',
        userEmail: 'user-a@company-a.com',
      })
    )
  })

  it('ignora body.email quando coincide com JWT e usa sessão autenticada', async () => {
    findFlowAccessibleByUserMock.mockResolvedValue({
      id: 'flow-a',
      flowKind: 'main',
      parentFlowId: null,
      parentFlowName: null,
    })

    const res = createRes()
    await executeFlow(
      {
        user: { email: 'User-A@Company-A.com', userId: 'u-a' },
        body: {
          flow_id: 'flow-a',
          email: 'user-a@company-a.com',
        },
      } as any,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(executeFlowForChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'User-A@Company-A.com',
      })
    )
  })
})
