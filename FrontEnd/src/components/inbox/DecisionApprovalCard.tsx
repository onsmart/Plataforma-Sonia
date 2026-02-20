import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, FileText, User, Bot, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../utils/supabase/client'

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
      toast.error('Email do usuário não disponível')
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
      toast.error('Erro ao buscar usuário')
      return
    }

    if (!userData?.id) {
      console.warn('[DecisionApprovalCard] Usuário não encontrado na tb_users para email:', user.email)
      toast.error('Usuário não encontrado')
      return
    }

    finalUserId = userData.id
    console.log('[DecisionApprovalCard] user_id encontrado na tb_users:', finalUserId)

    setIsApproving(true)
    try {
      // Usar o backend local (mesmo que o Playground usa)
      const BASE_URL = 'http://192.168.15.31:3333'

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
        let errorMessage = 'Erro ao aprovar decisão'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast.success('Mensagem aprovada e enviada com sucesso!')
      onApproved()
    } catch (error: any) {
      console.error('[DecisionApprovalCard] Erro:', error)
      toast.error('Erro ao aprovar: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    // SEMPRE buscar user_id da tabela tb_users pelo email (não usar Supabase Auth)
    if (!user?.email) {
      toast.error('Email do usuário não disponível')
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
        toast.error('Erro ao buscar usuário')
        return
      }

      if (!userData?.id) {
        console.warn('[DecisionApprovalCard] Usuário não encontrado na tb_users para email:', user.email)
        toast.error('Usuário não encontrado')
        return
      }

      finalUserId = userData.id
      console.log('[DecisionApprovalCard] user_id encontrado na tb_users:', finalUserId)

      // Usar o backend local (mesmo que o Playground usa)
      const BASE_URL = 'http://192.168.15.31:3333'

      console.log('[DecisionApprovalCard] Chamando API:', `${BASE_URL}/agents/decisions/${decision.id}/reject`)

      const response = await fetch(`${BASE_URL}/agents/decisions/${decision.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: finalUserId })
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao rejeitar decisão'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      toast.success('Mensagem rejeitada')
      onRejected()
    } catch (error: any) {
      console.error('[DecisionApprovalCard] Erro:', error)
      toast.error('Erro ao rejeitar')
    } finally {
      setIsRejecting(false)
    }
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return 'bg-emerald-500'
    if (score >= 0.5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'low_context': 'Pouco contexto',
      'ambiguous': 'Mensagem ambígua',
      'high_match': 'Alta confiança',
      'insufficient_data': 'Dados insuficientes'
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
    <Card className={`mb-6 overflow-hidden border-none shadow-soft transition-all hover:shadow-md ${decision.confidence_score < 0.5 ? 'ring-1 ring-red-500/20' : ''}`}>
      <div className="p-1 bg-muted/30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Decisão Pendente</span>
          <span className="text-[10px] text-muted-foreground/50">•</span>
          <span className="text-[10px] text-muted-foreground font-medium">{formatDate(decision.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <svg className="h-full w-full" viewBox="0 0 36 36">
                <path
                  className="text-muted/30 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`${getConfidenceColor(decision.confidence_score).replace('bg-', 'text-')} stroke-current transition-all duration-1000 ease-out`}
                  strokeWidth="3.5"
                  strokeDasharray={`${decision.confidence_score * 100}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                {(decision.confidence_score * 100).toFixed(0)}%
              </div>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground hidden sm:inline">CONFIANÇA</span>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Chat-like Interface */}
        <div className="space-y-4">
          {/* Pergunta do Cliente (Esquerda) */}
          <div className="flex flex-col items-start max-w-[85%]">
            <div className="flex items-center gap-2 mb-1.5 ml-1">
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Cliente</span>
            </div>
            <div className="relative p-3.5 bg-muted/50 rounded-2xl rounded-tl-none text-sm text-foreground shadow-sm border border-border/20">
              {extractOriginalMessage(decision.original_message)}
            </div>
          </div>

          {/* Resposta da IA (Direita) */}
          <div className="flex flex-col items-end w-full">
            <div className="max-w-[85%] w-full">
              <div className="flex items-center justify-end gap-2 mb-1.5 mr-1 text-right">
                <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Sonia AI</span>
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              </div>
              <div className="relative group">
                <Textarea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  className="min-h-[140px] rounded-2xl rounded-tr-none text-sm bg-primary/5 border-primary/20 focus-visible:ring-primary/20 p-4 leading-relaxed ring-offset-background transition-all hover:bg-primary/[0.07]"
                  placeholder="Edite a resposta da Sonia se necessário..."
                />
                {editedAnswer !== decision.answer && (
                  <div className="absolute -top-2 -left-2 scale-75">
                    <Badge className="bg-yellow-500 text-white border-none shadow-sm gap-1">
                      <AlertTriangle className="h-3 w-3" /> Editado
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Bars */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="text-[10px] py-0 h-5 border-border/50 bg-background font-medium">
            <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
            {getReasonLabel(decision.reason)}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 h-5 border-border/50 bg-background font-medium">
            <MessageSquare className="h-3 w-3 mr-1 text-blue-500" />
            Canal: {decision.channel}
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
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/5 font-bold uppercase tracking-tight text-[11px] h-10 border border-transparent hover:border-destructive/20"
          >
            {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <XCircle className="h-3.5 w-3.5 mr-2" />}
            Ignorar Decisão
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isRejecting || isApproving}
            className="flex-[1.5] bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-tight text-[11px] h-10 shadow-lg shadow-primary/20"
          >
            {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
            Aprovar e Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
