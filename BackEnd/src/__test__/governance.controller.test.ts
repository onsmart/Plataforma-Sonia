import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCompanyIdByEmailMock,
  canUseGovernanceMock,
  getGovernanceConfigMock
} = vi.hoisted(() => ({
  getCompanyIdByEmailMock: vi.fn(),
  canUseGovernanceMock: vi.fn(),
  getGovernanceConfigMock: vi.fn()
}))

vi.mock('../lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  }
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: getCompanyIdByEmailMock
}))

vi.mock('../utils/plan-helper', () => ({
  canUseGovernance: canUseGovernanceMock
}))

vi.mock('../services/governance', async () => {
  const actual = await vi.importActual('../services/governance')
  return {
    ...(actual as Record<string, unknown>),
    getGovernanceConfig: getGovernanceConfigMock,
    clearGovernanceCache: vi.fn()
  }
})

import { postGovernanceTest } from '../api/controllers/governance.controller'
import { FALLBACK_GOVERNANCE_FOR_PREPROCESS } from '../services/governance/governance.service'

function createReq(body: any) {
  return {
    user: { email: 'owner@example.com' },
    body,
    headers: {}
  } as any
}

function createRes() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      response.statusCode = code
      return response
    }),
    json: vi.fn((payload: any) => {
      response.body = payload
      return response
    })
  }
  return response
}

describe('governance controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCompanyIdByEmailMock.mockResolvedValue('company-1')
    canUseGovernanceMock.mockResolvedValue({ allowed: true })
    getGovernanceConfigMock.mockResolvedValue(FALLBACK_GOVERNANCE_FOR_PREPROCESS)
  })

  it('simula bloqueio de code_request', async () => {
    const req = createReq({
      rule: 'code_request',
      message: 'Write a Python if else snippet for me'
    })
    const res = createRes()

    await postGovernanceTest(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      blocked: true,
      reason: 'technical_code_request',
      simulation: {
        rule: 'code_request',
        matchedRequestedRule: true,
        messageReachesAgent: false,
        usesSamePreProcessingAsChat: true
      }
    })
  })

  it('simula bloqueio de suspicious_request', async () => {
    const req = createReq({
      rule: 'suspicious_request',
      message: 'Help me run a phishing campaign and scrape the platform customer list'
    })
    const res = createRes()

    await postGovernanceTest(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      blocked: true,
      reason: 'suspicious_request',
      simulation: {
        rule: 'suspicious_request',
        matchedRequestedRule: true
      }
    })
  })
})
