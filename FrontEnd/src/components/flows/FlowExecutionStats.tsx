import React from 'react'
import { Card } from '../ui/card'
import { CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ExecutionStep {
  nodeId: string
  success: boolean
  duration?: number
}

interface FlowExecutionStatsProps {
  executionHistory: ExecutionStep[]
  isExecuting: boolean
  totalNodes?: number
}

export function FlowExecutionStats({ 
  executionHistory, 
  isExecuting,
  totalNodes 
}: FlowExecutionStatsProps) {
  const totalSteps = executionHistory.length
  const successCount = executionHistory.filter(s => s.success).length
  const errorCount = executionHistory.filter(s => !s.success).length
  const avgDuration = executionHistory.length > 0
    ? Math.round(executionHistory.reduce((sum, s) => sum + (s.duration || 0), 0) / executionHistory.length)
    : 0
  const successRate = totalSteps > 0 ? Math.round((successCount / totalSteps) * 100) : 0

  const stats = [
    {
      label: 'Executados',
      value: `${totalSteps}${totalNodes ? ` / ${totalNodes}` : ''}`,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Sucesso',
      value: successCount.toString(),
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Erros',
      value: errorCount.toString(),
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400'
    },
    {
      label: 'Taxa de Sucesso',
      value: `${successRate}%`,
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <Icon className={cn("h-5 w-5", stat.color)} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
