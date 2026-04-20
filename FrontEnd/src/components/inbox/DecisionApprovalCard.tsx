import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../ui/card'
import { cn } from '../ui/utils'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, FileText, User, Bot, MessageSquare, Loader2, Trash2 } from 'lucide-react'
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
  onDeleteHistory?: (decision: Decision) => Promise<void>
}

export function DecisionApprovalCard({ decision, onApproved, onRejected, onDeleteHistory }: DecisionApprovalCardProps) {
  const { user, userId } = useAuth()
  const { t } = useTranslation('inbox')
  const { theme, resolvedTheme } = useTheme()
  /** Mesma regra do Inbox: tema claro com cores explícitas para não depender de --card/--background. */
  const cardLight =
    theme === 'light' ||
    resolvedTheme === 'light' ||
    (theme === 'system' && resolvedTheme !== 'dark')
  const [editedAnswer, setEditedAnswer] = useState(decision.answer)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isDeletingHistory, setIsDeletingHistory] = useState(false)
  const [sourceNames, setSourceNames] = useState<string[]>([])
  const canDeleteHistory =
    typeof onDeleteHistory === 'function' &&
    decision.channel === 'whatsapp' &&
    !!decision.integrations_id &&
    !!decision.contact_id

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

      // ✅ Incluir JWT token no header
      const { getAuthHeaders } = await import('../../services/api')
      
      const response = await fetch(`${BASE_URL}/agents/decisions/${decision.id}/approve`, {
        method: 'POST',
        headers: await getAuthHeaders(),
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

      // ✅ Incluir JWT token no header
      const { getAuthHeaders } = await import('../../services/api')
      
      const response = await fetch(`${BASE_URL}/agents/decisions/${decision.id}/reject`, {
        method: 'POST',
        headers: await getAuthHeaders(),
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

  const handleDeleteHistory = async () => {
    if (!canDeleteHistory || !onDeleteHistory) {
      return
    }

    const confirmed = window.confirm(
      'Deseja apagar todo o histórico desta conversa? Isso removerá mensagens e aprovações vinculadas a este contato.'
    )

    if (!confirmed) {
      return
    }

    setIsDeletingHistory(true)
    try {
      await onDeleteHistory(decision)
    } finally {
      setIsDeletingHistory(false)
    }
  }

  const confidenceRingClass = (score: number) =>
    cardLight
      ? score >= 0.5
        ? 'stroke-cyan-600'
        : 'stroke-amber-600'
      : score >= 0.5
        ? 'stroke-primary'
        : 'stroke-amber-400'

  const confidenceTextClass = (score: number) =>
    cardLight
      ? score >= 0.5
        ? 'text-cyan-700'
        : 'text-amber-800'
      : score >= 0.5
        ? 'text-primary'
        : 'text-amber-400'

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

  const panelClass = cardLight
    ? 'rounded-[2rem] border border-slate-300 bg-white text-slate-950 shadow-[0_22px_52px_-36px_rgba(15,23,42,0.2)] backdrop-blur-sm'
    : 'rounded-[2rem] border border-border bg-card text-foreground shadow-[0_28px_60px_-36px_rgba(0,0,0,0.72)] backdrop-blur-sm'

  const rowClass = cardLight
    ? 'rounded-[1.35rem] border border-slate-300 bg-slate-100 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
    : 'rounded-[1.35rem] border border-border bg-muted text-foreground shadow-sm'

  return (
    <Card
      className={cn(
        'border-none bg-transparent shadow-none',
        'overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5',
        cardLight
          ? 'hover:shadow-[0_28px_58px_-36px_rgba(15,23,42,0.22)]'
          : 'hover:shadow-[0_32px_70px_-34px_rgba(0,0,0,0.78)]',
        panelClass,
        decision.confidence_score < 0.5 &&
          (cardLight
            ? 'shadow-[0_24px_58px_-36px_rgba(15,23,42,0.14),0_16px_34px_-30px_rgba(239,68,68,0.1)]'
            : 'shadow-[0_30px_66px_-34px_rgba(0,0,0,0.72),0_14px_30px_-24px_rgba(248,113,113,0.12)]')
      )}
    >
      <div
        className={cn(
          'mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[1.45rem] px-4 py-2.5 sm:mx-4 sm:px-5',
          cardLight
            ? 'border border-slate-300 bg-slate-200/90'
            : 'border border-border bg-muted/50'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]',
              cardLight ? 'border border-amber-300 bg-amber-200 text-amber-950' : 'bg-amber-400/12 text-amber-300'
            )}
          >
            {t('decision.pending')}
          </span>
          <span className={cn('text-[10px]', cardLight ? 'text-slate-500' : 'text-muted-foreground/60')}>•</span>
          <span className={cn('text-[10px] font-medium', cardLight ? 'text-slate-700' : 'text-muted-foreground')}>
            {formatDate(decision.created_at)}
          </span>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-sm',
            cardLight ? 'border-slate-400 bg-slate-50' : 'border-white/10 bg-black/25'
          )}
        >
          <div className="relative h-9 w-9">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <path
                className={cardLight ? 'stroke-slate-300' : 'stroke-border'}
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={cn(confidenceRingClass(decision.confidence_score), 'transition-[stroke-dasharray] duration-700 ease-out')}
                strokeWidth="3.5"
                strokeDasharray={`${decision.confidence_score * 100}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums',
                confidenceTextClass(decision.confidence_score)
              )}
            >
              {(decision.confidence_score * 100).toFixed(0)}%
            </div>
          </div>
          <span
            className={cn(
              'text-[9px] font-semibold uppercase tracking-[0.12em]',
              cardLight ? 'text-slate-600' : 'text-muted-foreground'
            )}
          >
            {t('decision.confidence')}
          </span>
        </div>
      </div>

      <CardContent className="space-y-4 p-4 pt-3 sm:space-y-5 sm:p-5 sm:pt-4">
        <div className="grid gap-3 sm:gap-4">
          <div className="flex max-w-full flex-col items-start">
            <div className="mb-1 ml-1 flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  cardLight ? 'border border-slate-300 bg-slate-200 text-slate-800' : 'bg-muted/70 text-muted-foreground'
                )}
              >
                <User className="h-3 w-3" />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-tight',
                  cardLight ? 'text-slate-600' : 'text-muted-foreground'
                )}
              >
                {t('decision.client')}
              </span>
            </div>
            <div className={cn(rowClass, 'w-full rounded-[1.35rem] rounded-tl-[0.55rem] p-3.5 text-sm leading-relaxed sm:p-4')}>
              {extractOriginalMessage(decision.original_message)}
            </div>
          </div>

          <div className="flex w-full flex-col items-end">
            <div className="w-full">
              <div className="mb-1 mr-1 flex items-center justify-end gap-2 text-right">
                <span className="text-[10px] font-semibold uppercase tracking-tight text-primary">{t('decision.soniaAI')}</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bot className="h-3 w-3" />
                </div>
              </div>
              <div className="group relative">
                <Textarea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  className={cn(
                    'min-h-[112px] rounded-[1.35rem] rounded-tr-[0.55rem] border p-3.5 text-sm leading-relaxed shadow-sm transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary/20 sm:min-h-[124px] sm:p-4',
                    cardLight
                      ? 'border-slate-400 bg-slate-50 text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-500'
                      : 'border-border bg-muted text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] placeholder:text-muted-foreground'
                  )}
                  placeholder={t('decision.editPlaceholder')}
                />
                {editedAnswer !== decision.answer && (
                  <div className="absolute -left-1 -top-2 scale-90">
                    <Badge className="gap-1 rounded-full border-0 bg-amber-500 text-amber-950 shadow-sm">
                      <AlertTriangle className="h-3 w-3" /> {t('decision.edited')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'rounded-[1.55rem] border p-3.5 shadow-sm',
            cardLight
              ? 'border-slate-300 bg-slate-200/70'
              : 'border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.16em]',
                cardLight ? 'text-slate-700' : 'text-muted-foreground'
              )}
            >
              Contexto da decisão
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={cn(
              'h-7 rounded-full px-3 py-0 text-[10px] font-medium shadow-sm',
              cardLight
                ? 'border border-slate-300 bg-slate-100 text-slate-900'
                : 'border-0 bg-white/10 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
            )}
          >
            <AlertTriangle className="mr-1 h-3 w-3 text-amber-500" />
            {getReasonLabel(decision.reason)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'h-7 rounded-full px-3 py-0 text-[10px] font-medium shadow-sm',
              cardLight
                ? 'border border-slate-300 bg-slate-100 text-slate-900'
                : 'border-0 bg-white/10 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
            )}
          >
            <MessageSquare className="mr-1 h-3 w-3 text-primary" />
            {t('decision.channel')}: {decision.channel}
          </Badge>
          {decision.sources && decision.sources.length > 0 && (
            <div className="mt-1 flex w-full flex-wrap gap-2">
              {sourceNames.length > 0
                ? sourceNames.map((name, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className={cn(
                        'h-7 rounded-full px-3 py-0 text-[10px]',
                        cardLight
                          ? 'border border-indigo-400 bg-indigo-200 text-indigo-950'
                          : 'border-0 bg-indigo-500/20 text-indigo-300'
                      )}
                    >
                      <FileText className="mr-1 h-2.5 w-2.5" />
                      {name}
                    </Badge>
                  ))
                : decision.sources.map((sourceId, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className={cn(
                        'h-7 rounded-full px-3 py-0 text-[10px]',
                        cardLight
                          ? 'border border-indigo-400 bg-indigo-200 text-indigo-950'
                          : 'border-0 bg-indigo-500/20 text-indigo-300'
                      )}
                    >
                      <FileText className="mr-1 h-2.5 w-2.5" />
                      {sourceId.substring(0, 8)}...
                    </Badge>
                  ))}
            </div>
          )}
          </div>
        </div>

        <div
          className={cn(
            'rounded-[1.45rem] border p-2.5 shadow-sm sm:p-3',
            cardLight ? 'border-slate-300 bg-slate-200/80' : 'border-white/10 bg-black/25'
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {canDeleteHistory && (
            <Button
              variant="outline"
              onClick={handleDeleteHistory}
              disabled={isDeletingHistory || isRejecting || isApproving}
              className={cn(
                'h-11 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]',
                cardLight
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800'
                  : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200'
              )}
            >
              {isDeletingHistory ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-3.5 w-3.5" />
              )}
              Apagar histórico
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleReject}
            disabled={isDeletingHistory || isRejecting || isApproving}
            className="h-11 flex-1 rounded-full border-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive transition-colors duration-300 hover:bg-destructive/6 hover:text-destructive"
          >
            {isRejecting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-2 h-3.5 w-3.5" />}
            {t('decision.ignore')}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isDeletingHistory || isRejecting || isApproving}
            className="h-11 flex-[1.5] rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_16px_30px_-18px_rgba(37,99,235,0.85)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {isApproving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            )}
            {t('decision.approveAndSend')}
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
