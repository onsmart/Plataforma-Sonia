import { describe, it, expect } from 'vitest'
import {
  buildConditionalSwitchTestFlowPreset,
  type TestFlowGeneratedAgent,
} from '../services/flows/flow-generate-test-conditional-switch.service'

function buildAgent(key: TestFlowGeneratedAgent['key']): TestFlowGeneratedAgent {
  return {
    key,
    id: `${key}-id`,
    name: `${key}-name`,
    bio: `${key}-bio`,
    additionalInstructions: `${key}-instructions`,
  }
}

describe('buildConditionalSwitchTestFlowPreset', () => {
  it('monta um fluxo com condicional, múltiplas opções e 4 agentes', () => {
    const flow = buildConditionalSwitchTestFlowPreset({
      templateId: 'template-1',
      templateName: 'Template Compartilhado',
      agents: [
        buildAgent('classifier'),
        buildAgent('commercial'),
        buildAgent('support'),
        buildAgent('financial'),
      ],
    })

    expect(flow.startNodeId).toBe('n-start')
    expect(flow.nodes).toHaveLength(8)
    expect(flow.edges).toHaveLength(11)

    const conditionNode = flow.nodes.find((node) => node.id === 'n-intent-detected')
    expect(conditionNode?.type).toBe('if-else')
    expect(conditionNode?.data.branchCustomField).toBe('intent_detected')
    expect(conditionNode?.data.ifValue).toContain('true')

    const switchNode = flow.nodes.find((node) => node.id === 'n-intent-switch')
    expect(switchNode?.type).toBe('switch')
    expect(switchNode?.data.switchCases).toHaveLength(3)
    expect(switchNode?.data.switchCases?.map((item) => item.id)).toEqual([
      'commercial',
      'support',
      'financial',
    ])

    const supportFallback = flow.edges.find(
      (edge) => edge.source === 'n-intent-detected' && edge.sourceHandle === 'false'
    )
    expect(supportFallback?.target).toBe('n-support')

    const defaultSwitch = flow.edges.find(
      (edge) => edge.source === 'n-intent-switch' && edge.sourceHandle === 'default'
    )
    expect(defaultSwitch?.target).toBe('n-support')

    const classifierNode = flow.nodes.find((node) => node.id === 'n-classifier')
    expect(classifierNode?.data.executionMode).toBe('template')
    expect(classifierNode?.data.templateId).toBe('template-1')
    expect(classifierNode?.data.skipReplyConfidence).toBe(true)
  })
})
