import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, FileText, User, Bot, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../utils/supabase/client'
import { BASE_URL } from '../../services/api'

interface Decision {
  id: string
  original_message: string
  answer: string
  confidence_score: number
  reason: string
  channel: string
  contact_id: string
  integrations_id?: string
  agent_id: string
  created_at: string
  sources?: string[] | null // ✅ IDs dos arquivos usados no RAG
}

interface DecisionApprovalCardProps {
  decision: Decision
  onApproved: () => void
  onRejected: () => void
}

export function DecisionApprovalCard({ decision, onApproved, onRejected }: DecisionApprovalCardProps) {
  const { user, userId } = useAuth()
  const { t } = useTranslation('inbox')
  const [editedAnswer, setEditedAnswer] = useState(decision.answer)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [sourceNames, setSourceNames] = useState<string[]>([])

  // Buscar nomes dos arquivos quando houver sources
  useEffect(() => {
    const fetchSourceNames = async () => {
      if (decision.sources && decision.sources.length > 0) {
        try {
          const { data, error } = await supabase
            .from('tb_files')
            .select('original_name, id')
            .in('id', decision.sources)

          if (!error && data) {
            setSourceNames(data.map(f => f.original_name || f.id))
          }
        } catch (error) {
          console.error('[DecisionApprovalCard] Erro ao buscar nomes dos arquivos:', error)
        }
      }
    }

    fetchSourceNames()
  }, [decision.sources])

  const handleApprove = async () => {
    // SEMPRE buscar user_id da tabela tb_users pelo email (não usar Supabase Auth)
    if (!user?.email) {
      toast.error(t('errors.emailNotAvailable'))
      return
    }

    let finalUserId: string | undefined

    // Buscar user_id da tabela tb_users usando email
    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (userError) {
      console.error('[DecisionApprovalCard] Erro ao buscar user_id da tb_users:', userError)
      toast.error(t('errors.fetchUser'))
      return
    }

    if (!userData?.id) {
      console.warn('[DecisionApprovalCard] Usuário não encontrado na tb_users para email:', user.email)
      toast.error(t('errors.userNotFound'))
      return
    }

    finalUserId = userData.id
    console.log('[DecisionApprovalCard] user_id encontrado na tb_users:', finalUserId)

    setIsApproving(true)
    try {
      console.log('[DecisionApprovalCard] Chamando API:', `${BASE_URL}/agents/decisions/${decision.id}/approve`)
      console.log('[DecisionApprovalCard] Dados enviados:', {
        decision_id: decision.id,
        user_id: finalUserId,
        edited_answer: editedAnswer !== decision.answer ? editedAnswer : undefined
      })

      const response = await fetch(`${BASE_URL}/agents/decisions/${decision.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          edited_answer: editedAnswer !== decision.answer ? editedAnswer : undefined,
          user_id: finalUserId
        })
      })

      if (!response.ok) {
        let errorMessage = t('errors.approveDecision')
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (e) {
          errorMessage = `${t('errors.error')} ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast.success(t('success.messageApproved'))
      onApproved()
    } catch (error: any) {
      console.error('[DecisionApprovalCard] Erro:', error)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        toast.error('Erro de conexão: Backend não está acessível. Verifique se o servidor está rodando.')
      } else {
        toast.error(t('errors.approveError') + ': ' + (error.message || t('errors.unknownError')))
      }
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    // SEMPRE buscar user_id da tabela tb_users pelo email (não usar Supabase Auth)
    if (!user?.email) {
      toast.error(t('errors.emailNotAvailable'))
      return
    }

    setIsRejecting(true)
    try {
      let finalUserId: string | undefined

      // Buscar user_id da tabela tb_users usando email
      const { data: userData, error: userError } = await supabase
        .from('tb_users')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (userError) {
        console.error('[DecisionApprovalCard] Erro ao buscar user_id da tb_users:', userError)
        toast.error(t('errors.fetchUser'))
        return
      }

      if (!userData?.id) {
        console.warn('[DecisionApprovalCard] Usuário não encontrado na tb_users para email:', user.email)
        toast.error(t('errors.userNotFound'))
        return
      }

      finalUserId = userData.id
      console.log('[DecisionApprovalCard] user_id encontrado na tb_users:', finalUserId)

      console.log('[DecisionApprovalCard] Chamando API:', `${BASE_URL}/agents/decisions/${decision.id}/reject`)

      const response = await fetch(`${BASE_URL}/agents/decisions/${decision.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: finalUserId })
      })

      if (!response.ok) {
        let errorMessage = t('errors.rejectDecision')
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (e) {
          errorMessage = `${t('errors.error')} ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      toast.success(t('success.messageRejected'))
      onRejected()
    } catch (error: any) {
      console.error('[DecisionApprovalCard] Erro:', error)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        toast.error('Erro de conexão: Backend não está acessível. Verifique se o servidor está rodando.')
      } else {
        toast.error(t('errors.rejectError') + ': ' + (error.message || 'Erro desconhecido'))
      }
    } finally {
      setIsRejecting(false)
    }
  }

  const getConfidenceColor = (score: number) => {
    // Ciano se >= 50%, amarelo se < 50%
    if (score >= 0.5) return '#06b6d4' // cyan-500
    return '#eab308' // yellow-500
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'low_context': t('decision.reason.lowContext'),
      'ambiguous': t('decision.reason.ambiguous'),
      'high_match': t('decision.reason.highMatch'),
      'insufficient_data': t('decision.reason.insufficientData')
    }
    return labels[reason] || reason
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Extrai a mensagem original do cliente, removendo instruções do flow
  const extractOriginalMessage = (rawMessage: string): string => {
    // Se a mensagem contém instrução do flow, tenta extrair a mensagem original
    if (rawMessage.includes('Execute sua tarefa como agente') || rawMessage.includes('Dados recebidos dos nodes anteriores')) {
      try {
        // Procura por blocos JSON no texto (pode ter múltiplos blocos)
        const jsonBlocks = rawMessage.match(/\{[\s\S]*?\}/g)

        if (jsonBlocks) {
          // Tenta fazer parse de cada bloco JSON
          for (const jsonBlock of jsonBlocks) {
            try {
              const parsed = JSON.parse(jsonBlock)

              // Procura o campo "message" em qualquer nível do objeto
              const findMessage = (obj: any): string | null => {
                if (typeof obj === 'string') return null
                if (typeof obj !== 'object' || obj === null) return null

                // Se tem campo "message" diretamente
                if (obj.message && typeof obj.message === 'string') {
                  return obj.message
                }

                // Procura recursivamente em objetos aninhados
                for (const key in obj) {
                  if (key === 'message' && typeof obj[key] === 'string') {
                    return obj[key]
                  }
                  if (typeof obj[key] === 'object') {
                    const found = findMessage(obj[key])
                    if (found) return found
                  }
                }

                return null
              }

              const message = findMessage(parsed)
              if (message) {
                return message
              }
            } catch (e) {
              // Continua tentando outros blocos
              continue
            }
          }
        }

        // Fallback: Tenta encontrar o campo "message" usando regex
        // Procura por padrões como: "message": "Pode ser?"
        const messageMatch = rawMessage.match(/"message"\s*:\s*"([^"]+)"/i)
        if (messageMatch && messageMatch[1]) {
          return messageMatch[1]
        }

        // Tenta encontrar em arrays de mensagens (history)
        const contentMatch = rawMessage.match(/"content"\s*:\s*"([^"]+)"/i)
        if (contentMatch && contentMatch[1]) {
          return contentMatch[1]
        }
      } catch (e) {
        // Se falhar, retorna a mensagem original
        console.warn('[DecisionApprovalCard] Erro ao extrair mensagem do flow:', e)
      }
    }

    // Se não for uma instrução do flow, retorna a mensagem original
    return rawMessage
  }

  return (
    <Card className={`mb-6 overflow-hidden border-none shadow-soft transition-all hover:shadow-md ${decision.confidence_score < 0.5 ? 'ring-1 ring-red-500/20' : ''}`} style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
      <div className="p-1 flex items-center justify-between px-4" style={{ backgroundColor: '#334155' }}>
        <div className="flex items-center gap-2 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#cbd5e1' }}>{t('decision.pending')}</span>
          <span className="text-[10px]" style={{ color: '#64748b' }}>•</span>
          <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{formatDate(decision.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Círculo de fundo */}
                <path
                  style={{ stroke: '#334155', strokeWidth: '3.5' }}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Círculo de progresso */}
                <path
                  style={{
                    stroke: getConfidenceColor(decision.confidence_score),
                    strokeWidth: '3.5',
                    strokeDasharray: `${decision.confidence_score * 100}, 100`,
                    strokeLinecap: 'round',
                    transition: 'stroke-dasharray 1s ease-out'
                  }}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color: getConfidenceColor(decision.confidence_score) }}>
                {(decision.confidence_score * 100).toFixed(0)}%
              </div>
            </div>
            <span className="text-[10px] font-bold hidden sm:inline" style={{ color: '#94a3b8' }}>{t('decision.confidence')}</span>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Chat-like Interface */}
        <div className="space-y-4">
          {/* Pergunta do Cliente (Esquerda) */}
          <div className="flex flex-col items-start max-w-[85%]">
            <div className="flex items-center gap-2 mb-1.5 ml-1">
              <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                <User className="h-3 w-3" style={{ color: '#cbd5e1' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: '#94a3b8' }}>{t('decision.client')}</span>
            </div>
            <div className="relative p-3.5 rounded-2xl rounded-tl-none text-sm shadow-sm border" style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}>
              {extractOriginalMessage(decision.original_message)}
            </div>
          </div>

          {/* Resposta da IA (Direita) */}
          <div className="flex flex-col items-end w-full">
            <div className="max-w-[85%] w-full">
              <div className="flex items-center justify-end gap-2 mb-1.5 mr-1 text-right">
                <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: '#06b6d4' }}>{t('decision.soniaAI')}</span>
                <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(6, 182, 212, 0.2)' }}>
                  <Bot className="h-3 w-3" style={{ color: '#06b6d4' }} />
                </div>
              </div>
              <div className="relative group">
                <Textarea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  className="min-h-[140px] rounded-2xl rounded-tr-none text-sm p-4 leading-relaxed transition-all"
                  style={{ 
                    backgroundColor: '#334155', 
                    borderColor: '#06b6d4',
                    color: '#f1f5f9',
                    borderWidth: '1px'
                  }}
                  placeholder={t('decision.editPlaceholder')}
                />
                {editedAnswer !== decision.answer && (
                  <div className="absolute -top-2 -left-2 scale-75">
                    <Badge className="bg-yellow-500 text-white border-none shadow-sm gap-1">
                      <AlertTriangle className="h-3 w-3" /> {t('decision.edited')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Bars */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="text-[10px] py-0 h-5 font-medium" style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}>
            <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
            {getReasonLabel(decision.reason)}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 h-5 font-medium" style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}>
            <MessageSquare className="h-3 w-3 mr-1 text-blue-500" />
            {t('decision.channel')}: {decision.channel}
          </Badge>
          {decision.sources && decision.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 w-full">
              {sourceNames.length > 0 ? (
                sourceNames.map((name, index) => (
                  <Badge key={index} variant="secondary" className="text-[10px] py-0 h-5 bg-indigo-500/10 text-indigo-600 border-none">
                    <FileText className="h-2.5 w-2.5 mr-1" />
                    {name}
                  </Badge>
                ))
              ) : (
                decision.sources.map((sourceId, index) => (
                  <Badge key={index} variant="secondary" className="text-[10px] py-0 h-5 bg-indigo-500/10 text-indigo-600 border-none">
                    <FileText className="h-2.5 w-2.5 mr-1" />
                    {sourceId.substring(0, 8)}...
                  </Badge>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #334155' }}>
          <Button
            variant="ghost"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/5 font-bold uppercase tracking-tight text-[11px] h-10 border border-transparent hover:border-destructive/20"
          >
            {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <XCircle className="h-3.5 w-3.5 mr-2" />}
            {t('decision.ignore')}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isRejecting || isApproving}
            className="flex-[1.5] font-bold uppercase tracking-tight text-[11px] h-10 shadow-lg transition-all duration-300 hover:scale-105 border-none"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: '#000000',
              boxShadow: '0 10px 15px -3px rgba(6, 182, 212, 0.4), 0 4px 6px -2px rgba(6, 182, 212, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 15px 20px -3px rgba(6, 182, 212, 0.5), 0 6px 8px -2px rgba(6, 182, 212, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(6, 182, 212, 0.4), 0 4px 6px -2px rgba(6, 182, 212, 0.2)'
            }}
          >
            {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" style={{ color: '#000000' }} /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" style={{ color: '#000000' }} />}
            <span style={{ color: '#000000' }}>{t('decision.approveAndSend')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
