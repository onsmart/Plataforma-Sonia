import path from 'path'
import { FlowNode } from './flow.types'
import { buildFlowIntegrationResult, FlowIntegrationResult } from './flow-node-result'

function classifyDocumentKind(input: {
  fileName: string
  mime: string
  allowedKinds: string[]
}): string {
  const lowercaseName = input.fileName.toLowerCase()
  const lowercaseMime = input.mime.toLowerCase()
  const ext = path.extname(lowercaseName).replace('.', '')
  const hints = [lowercaseName, lowercaseMime, ext].join(' ')

  const matched = input.allowedKinds.find((kind) => hints.includes(kind.toLowerCase()))
  if (matched) return matched
  if (hints.includes('exam') || hints.includes('exame')) return 'exam'
  if (hints.includes('pedido')) return 'pedido_medico'
  if (hints.includes('doc') || hints.includes('pdf')) return 'document'
  return 'other'
}

export async function executeDocumentIntakeNode(params: {
  node: FlowNode
  contextData: Record<string, any>
}): Promise<FlowIntegrationResult> {
  const nodeData = params.node.data || {}
  const allowedKinds = Array.isArray(nodeData.documentKinds) && nodeData.documentKinds.length > 0
    ? nodeData.documentKinds.map((kind) => String(kind || '').trim()).filter(Boolean)
    : ['exam', 'pedido_medico', 'document']
  const attachmentUrl = String(
    params.contextData.attachment_url ||
      params.contextData.document_url ||
      params.contextData.file_url ||
      ''
  ).trim()
  const attachmentName = String(
    params.contextData.attachment_name ||
      params.contextData.document_name ||
      params.contextData.file_name ||
      ''
  ).trim()
  const attachmentMime = String(
    params.contextData.attachment_mime ||
      params.contextData.document_mime ||
      params.contextData.file_mime ||
      ''
  ).trim()
  const attachmentSource = String(
    params.contextData.attachment_source ||
      params.contextData.document_source ||
      params.contextData.channel_origin ||
      'whatsapp'
  ).trim()

  if (!attachmentUrl && !nodeData.acceptWithoutFile) {
    return buildFlowIntegrationResult('document_intake', {
      success: false,
      status: 'pending_upload',
      error_code: 'attachment_missing',
      user_safe_message: 'Ainda precisamos receber o arquivo para continuar.',
      retryable: false,
      integration_status: 'mocked',
      document_status: 'pending_upload',
      attachment_source: attachmentSource,
    })
  }

  const documentKind = classifyDocumentKind({
    fileName: attachmentName,
    mime: attachmentMime,
    allowedKinds,
  })

  return buildFlowIntegrationResult('document_intake', {
    success: true,
    status: attachmentUrl ? 'received' : 'metadata_only',
    user_safe_message: attachmentUrl
      ? 'Documento recebido e registrado para a equipe.'
      : 'Fluxo preparado para receber o documento posteriormente.',
    retryable: false,
    integration_status: 'mocked',
    document_status: attachmentUrl ? 'received' : 'pending_upload',
    document_kind: documentKind,
    attachment_url: attachmentUrl || null,
    attachment_name: attachmentName || null,
    attachment_mime: attachmentMime || null,
    attachment_source: attachmentSource,
    notify_team: nodeData.notifyTeam === true,
  })
}

