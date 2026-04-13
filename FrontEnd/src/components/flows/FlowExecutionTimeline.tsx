import React from 'react'
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import { cn } from '../../lib/utils'

interface ExecutionStep {
  nodeId: string
  executionMode?: 'agent' | 'template'
  agentId?: string
  templateId?: string
  nodeType?: string
  success: boolean
  output?: any
  error?: string
  qrCode?: string
  timestamp?: number
  duration?: number
  outputSummary?: string
  startedAt?: string
  finishedAt?: string
}

interface FlowExecutionTimelineProps {
  executionHistory: ExecutionStep[]
  isExecuting: boolean
  currentStepIndex?: number
}

function formatStepOutput(output: any): string {
  if (output === null || output === undefined) {
    return ''
  }

  return typeof output === 'string' ? output : JSON.stringify(output, null, 2)
}

export function FlowExecutionTimeline({
  executionHistory,
  isExecuting,
  currentStepIndex
}: FlowExecutionTimelineProps) {
  if (executionHistory.length === 0 && !isExecuting) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma execucao ainda</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      <div className="relative w-full max-w-full">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4 w-full max-w-full">
          {executionHistory.map((step, index) => {
            const isCurrent = isExecuting && index === currentStepIndex
            const isCompleted = step.success && !isCurrent
            const isError = !step.success
            const isPending = !isCompleted && !isError && !isCurrent
            const outputText = formatStepOutput(step.output)
            const stepTitle =
              step.output?.kind === 'debug'
                ? `Debug · ${step.nodeId || `passo ${index + 1}`}`
                : step.nodeId || `Node ${index + 1}`

            return (
              <div key={step.nodeId || index} className="relative flex gap-4 min-w-0 max-w-full">
                <div
                  className={cn(
                    'relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background',
                    isCurrent && 'border-primary bg-primary/10 animate-pulse',
                    isCompleted && 'border-green-500 bg-green-500/10',
                    isError && 'border-red-500 bg-red-500/10',
                    isPending && 'border-muted bg-muted/50'
                  )}
                >
                  {isCurrent ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isError ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <Card
                  className={cn(
                    'flex-1 p-4 transition-all min-w-0 max-w-full',
                    isCurrent && 'ring-2 ring-primary shadow-lg',
                    isError && 'border-red-500/50 bg-red-50 dark:bg-red-950/20',
                    isCompleted && 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <div className="flex-1 space-y-2 min-w-0 max-w-full">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm" style={{ color: '#0f172a' }}>
                          {stepTitle}
                        </h4>
                        {step.agentId && (
                          <Badge variant="outline" className="text-xs" style={{ color: '#0f172a' }}>
                            Agent: {step.agentId.substring(0, 8)}...
                          </Badge>
                        )}
                        {step.templateId && (
                          <Badge variant="outline" className="text-xs" style={{ color: '#0f172a' }}>
                            Template: {step.templateId.substring(0, 8)}...
                          </Badge>
                        )}
                      </div>

                      {isError && step.error && (
                        <div className="rounded-md bg-red-100 dark:bg-red-900/30 p-3 border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-red-950 dark:text-red-100 mb-2" style={{ color: '#0f172a' }}>
                                Erro na execucao
                              </p>
                              <ScrollArea className="max-h-96 w-full">
                                <pre
                                  className="text-xs whitespace-pre-wrap break-words break-all max-w-full"
                                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', color: '#0f172a' }}
                                >
                                  {step.error}
                                </pre>
                              </ScrollArea>
                            </div>
                          </div>
                        </div>
                      )}

                      {outputText && (
                        <div className="rounded-md bg-muted/50 p-3 border min-w-0 max-w-full">
                          <p className="text-xs mb-2" style={{ color: '#0f172a' }}>
                            Output:
                          </p>
                          <ScrollArea className="max-h-96 w-full">
                            <pre
                              className="text-xs font-mono whitespace-pre-wrap break-words break-all max-w-full"
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', color: '#0f172a' }}
                            >
                              {outputText}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}

                      {step.duration && (
                        <p className="text-xs" style={{ color: '#0f172a' }}>
                          Duracao: {step.duration}ms
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground animate-pulse">
                          Executando
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Concluido
                        </Badge>
                      )}
                      {isError && (
                        <Badge variant="outline" className="border-red-500 text-red-600">
                          Erro
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
