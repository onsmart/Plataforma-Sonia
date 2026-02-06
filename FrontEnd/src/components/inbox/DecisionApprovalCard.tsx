import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
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
    <Card className="mb-4 border-l-4 border-l-yellow-500">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-medium">Decisão Pendente</span>
          <Badge className={`${getConfidenceColor(decision.confidence_score)} text-white`}>
            {(decision.confidence_score * 100).toFixed(0)}% confiança
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pergunta Original */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
            <span>❓</span> Pergunta do Cliente:
          </label>
          <div className="p-3 bg-muted rounded-md text-sm">
            {extractOriginalMessage(decision.original_message)}
          </div>
        </div>

        {/* Resposta da IA (Editável) */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
            <span>🤖</span> Resposta da IA:
          </label>
          <Textarea
            value={editedAnswer}
            onChange={(e) => setEditedAnswer(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            placeholder="Edite a resposta se necessário..."
          />
          {editedAnswer !== decision.answer && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Resposta editada
            </p>
          )}
        </div>

        {/* Metadados */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <span>📊</span> Confiança: {(decision.confidence_score * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <span>⚠️</span> Motivo: {getReasonLabel(decision.reason)}
          </span>
          <span className="flex items-center gap-1">
            <span>📱</span> Canal: {decision.channel}
          </span>
          <span className="flex items-center gap-1">
            <span>🕐</span> {formatDate(decision.created_at)}
          </span>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {isRejecting ? 'Rejeitando...' : 'Rejeitar'}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isRejecting || isApproving}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isApproving ? 'Enviando...' : 'Aprovar e Enviar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
