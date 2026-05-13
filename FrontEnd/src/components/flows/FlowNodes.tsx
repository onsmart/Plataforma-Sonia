import React from 'react'
import { Position } from 'reactflow'
import { useTheme } from 'next-themes'
import {
  Play,
  Square,
  Workflow,
  Route,
  Repeat,
  Bot,
  Infinity,
  Hash,
  Clock,
  CalendarClock,
  MessageSquare,
  Bug,
  LayoutTemplate,
  Timer,
  SendHorizontal,
  Link2,
  BellRing,
  Mail,
  Inbox,
  Database,
  FileText,
  UserRound,
} from 'lucide-react'
import { cn } from '../ui/utils'
import {
  flowAccentVars,
  flowBlockSubtitleClass,
  flowBlockTitleClass,
  FLOW_RADIUS,
  FLOW_NODE_SHELL_BG,
  flowNodeShellClassName,
  FlowHandle,
  NodeIconWell,
  getFlowTheme,
  FLOW_HANDLE,
  type FlowAccent,
} from './flowBlockTheme'

function useFlowIsDark() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark'
}

function neutralHandleFill(isDark: boolean) {
  return isDark ? FLOW_HANDLE.neutralDark : FLOW_HANDLE.neutralLight
}

/** Bloco interno - fundo e borda dos tokens (sem transparência no wrapper) */
function innerSurface(isDark: boolean, className?: string) {
  const t = getFlowTheme(!isDark)
  return cn(FLOW_RADIUS.inner, 'border px-3.5 py-2.5', t.surfaceInner, t.borderSubtle, className)
}

type ShellProps = {
  accent: FlowAccent
  isDark: boolean
  selected: boolean
  width: number
  maxWidth?: number
  children: React.ReactNode
  className?: string
}

function FlowNodeFrame({ accent, isDark, selected, width, maxWidth, className, children }: ShellProps) {
  const shellBg = isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light
  const shellFg = isDark ? '#1A202C' : '#FAFAFA'
  const responsiveWidth = `min(${width}px, calc(100vw - 2rem))`
  const responsiveMaxWidth = maxWidth ? `min(${maxWidth}px, calc(100vw - 2rem))` : 'calc(100vw - 2rem)'
  const shellTint = isDark
    ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(var(--flow-accent-rgb), 0.16) 20%, rgba(var(--flow-accent-rgb), 0.06) 44%, rgba(0, 0, 0, 0) 84%)'
    : 'linear-gradient(180deg, rgba(var(--flow-accent-rgb), 0.24) 0%, rgba(var(--flow-accent-rgb), 0.1) 34%, rgba(0, 0, 0, 0) 84%)'
  return (
    <div
      data-flow-custom-node=""
      className={cn(flowNodeShellClassName(isDark, selected), className)}
      style={{
        ...flowAccentVars(accent),
        width: responsiveWidth,
        maxWidth: responsiveMaxWidth,
        backgroundColor: shellBg,
        backgroundImage: shellTint,
        color: shellFg,
        borderRadius: '1rem',
      }}
    >
      {children}
    </div>
  )
}

/** Cabeçalho: sem divisória - hierarquia por espaçamento e badge sólido */
function NodeHeader({
  isDark,
  accent,
  icon,
  title,
  eyebrow,
  helperText,
}: {
  isDark: boolean
  accent: FlowAccent
  icon: React.ReactNode
  title: string
  eyebrow?: string
  helperText?: string
}) {
  const t = getFlowTheme(!isDark)
  return (
    <div className="px-5 pb-4 pt-5">
      <div className="flex items-center gap-3.5">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className={cn('flow-premium-title truncate text-[0.95rem] font-semibold leading-snug tracking-tight', flowBlockTitleClass(accent, isDark))}>
              {title}
            </p>
            {eyebrow && <span className={cn('shrink-0', t.badgeDecision)}>{eyebrow}</span>}
          </div>
        </div>
        {helperText ? (
          <p className={cn('max-w-[9rem] text-right text-[11px] leading-relaxed', flowBlockSubtitleClass(accent, isDark))}>
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function formatIntegrationToolBadge(data: any): string | null {
  if (data?.integrationToolEnabled !== true) return null
  const provider = String(data.integrationToolProvider || '').trim()
  const toolName = String(data.integrationToolName || '').trim()
  if (!provider || !toolName) return 'Tool pendente'
  return `${provider}:${toolName}`
}

function formatBranchPreviewList(value: unknown, fallback: string) {
  const items = String(value || '')
    .split(/[,\n;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return items.length > 0 ? items.join(', ') : fallback
}

// Node de Início
export function StartNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  return (
    <FlowNodeFrame accent="blue" isDark={isDark} selected={!!selected} width={188}>
      <div className="flex items-center gap-3.5 px-5 py-4">
        <NodeIconWell accent="blue" isDark={isDark} round size="sm">
          <Play className="h-4 w-4" strokeWidth={2.25} />
        </NodeIconWell>
        <div className="min-w-0 flex-1 text-left">
          <p className={cn('flow-premium-title text-[0.9375rem] font-semibold leading-tight tracking-tight', flowBlockTitleClass('blue', isDark))}>
            Início
          </p>
          {data.label && data.label !== 'Início' && (
            <p className={cn('mt-1.5 truncate text-xs font-medium leading-snug', flowBlockSubtitleClass('blue', isDark))}>
              {data.label}
            </p>
          )}
        </div>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#4A5B83"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

// Node de Fim
export function StopNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  return (
    <FlowNodeFrame accent="red" isDark={isDark} selected={!!selected} width={188}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <div className="flex items-center gap-3.5 px-5 py-4">
        <NodeIconWell accent="red" isDark={isDark} round size="sm">
          <Square className="h-4 w-4" strokeWidth={2.25} />
        </NodeIconWell>
        <div className="min-w-0 flex-1 text-left">
          <p className={cn('flow-premium-title text-[0.9375rem] font-semibold leading-tight tracking-tight', flowBlockTitleClass('red', isDark))}>Fim</p>
          {data.label && data.label !== 'Fim' && (
            <p className={cn('mt-1.5 truncate text-xs font-medium leading-snug', flowBlockSubtitleClass('red', isDark))}>
              {data.label}
            </p>
          )}
        </div>
      </div>
    </FlowNodeFrame>
  )
}

// Node Condicional (If-Else)
export function IfElseNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const title = String(data.label || 'Condicional').trim() || 'Condicional'
  const branchField =
    data.branchField === 'custom'
      ? data.branchCustomField || 'valor'
      : data.branchField || 'message'
  const ifValue = formatBranchPreviewList(data.ifValue, 'sim, 1')
  const elseLabel = String(data.elseLabel || 'não, 2').trim() || 'não, 2'

  return (
    <FlowNodeFrame accent="orange" isDark={isDark} selected={!!selected} width={276}>
      <NodeHeader
        isDark={isDark}
        accent="orange"
        eyebrow="Decisão"
        title={title}
        icon={
          <NodeIconWell accent="orange" isDark={isDark} size="sm">
            <Workflow className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className={cn('border px-3.5 py-3', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle)}>
          <div className={cn('space-y-1.5 font-mono text-[11px] leading-relaxed', flowBlockTitleClass('orange', isDark))}>
            <div>
              <span className={cn('font-semibold', 'text-amber-200')}>{branchField}</span>
              <span>{' -> IF = {'}</span>
              <span className={cn('font-semibold', 'text-emerald-200')}>{ifValue}</span>
              <span>{'}'}</span>
            </div>
            <div>
              <span>ELSE = </span>
              <span className={cn('font-semibold', 'text-rose-200')}>{elseLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <FlowHandle
        type="source"
        position={Position.Left}
        id="true"
        isDark={isDark}
        fill="#3B7663"
        style={{ left: -7, top: '50%', transform: 'translateY(-50%)' }}
      />
      <div className="pointer-events-none absolute z-20 flex items-center" style={{ left: -50, top: '50%', transform: 'translateY(-50%)' }}>
        <span className={t.labelIf}>IF</span>
      </div>

      <FlowHandle
        type="source"
        position={Position.Right}
        id="false"
        isDark={isDark}
        fill="#8C3B4A"
        style={{ right: -7, top: '50%', transform: 'translateY(-50%)' }}
      />
      <div className="pointer-events-none absolute z-20 flex items-center whitespace-nowrap" style={{ left: 'calc(100% + 14px)', top: '50%', transform: 'translateY(-50%)' }}>
        <span className={t.labelElse}>ELSE</span>
      </div>
    </FlowNodeFrame>
  )
}

export function SwitchNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const title = String(data.label || 'Múltiplas opções').trim() || 'Múltiplas opções'
  const branchField =
    data.branchField === 'custom'
      ? data.branchCustomField || 'valor'
      : data.branchField || 'message'
  const cases = Array.isArray(data.switchCases) ? data.switchCases : []
  const defaultLabel = String(data.switchDefaultLabel || 'Outros').trim() || 'Outros'
  const colors = ['#6B668D', '#3B7663', '#B7794F', '#4A5B83', '#8C3B4A', '#567786']

  return (
    <FlowNodeFrame accent="indigo" isDark={isDark} selected={!!selected} width={300}>
      <NodeHeader
        isDark={isDark}
        accent="indigo"
        eyebrow="Roteamento"
        title={title}
        icon={
          <NodeIconWell accent="indigo" isDark={isDark} size="sm">
            <Route className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className={cn('border px-3.5 py-3', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle)}>
          <p className={cn('font-mono text-[11px]', flowBlockTitleClass('indigo', isDark))}>
            observa: {branchField}
          </p>
        </div>
        <div className="space-y-2">
          {cases.slice(0, 6).map((item: any, index: number) => (
            <div key={item.id || index} className={cn('border px-3 py-2 text-[11px]', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle)}>
              <span className={cn('font-semibold', flowBlockTitleClass('indigo', isDark))}>
                {item.label || `Opção ${index + 1}`}
              </span>
              <span className={cn('ml-2', flowBlockSubtitleClass('indigo', isDark))}>
                {formatBranchPreviewList(item.value, String(index + 1))}
              </span>
            </div>
          ))}
          <div className={cn('border px-3 py-2 text-[11px]', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle)}>
            <span className={cn('font-semibold', 'text-rose-200')}>Padrão</span>
            <span className={cn('ml-2', flowBlockSubtitleClass('indigo', isDark))}>{defaultLabel}</span>
          </div>
        </div>
      </div>

      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      {cases.slice(0, 6).map((item: any, index: number) => {
        const top = `${18 + index * 12}%`
        return (
          <React.Fragment key={`switch-handle-${item.id || index}`}>
            <FlowHandle
              type="source"
              position={Position.Right}
              id={`case:${item.id || index}`}
              isDark={isDark}
              fill={colors[index % colors.length]}
              style={{ right: -7, top, transform: 'translateY(-50%)' }}
            />
            <div
              className="pointer-events-none absolute z-20 flex items-center whitespace-nowrap"
              style={{ left: 'calc(100% + 14px)', top, transform: 'translateY(-50%)' }}
            >
              <span className={t.labelElse}>{item.label || `Opção ${index + 1}`}</span>
            </div>
          </React.Fragment>
        )
      })}

      <FlowHandle
        type="source"
        position={Position.Bottom}
        id="default"
        isDark={isDark}
        fill="#8C3B4A"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <div className="pointer-events-none absolute z-20 flex items-center" style={{ bottom: -34, left: '50%', transform: 'translateX(-50%)' }}>
        <span className={t.labelElse}>{defaultLabel}</span>
      </div>
    </FlowNodeFrame>
  )
}

// Node de Loop
export function LoopNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const flowName = data.flowName || (data.flowId ? 'Fluxo selecionado' : null)

  return (
    <FlowNodeFrame accent="purple" isDark={isDark} selected={!!selected} width={236}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <NodeHeader
        isDark={isDark}
        accent="purple"
        title="Loop"
        icon={
          <NodeIconWell accent="purple" isDark={isDark} size="sm">
            <Repeat className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-3 px-5 pb-5 pt-1">
        {flowName && (
          <div
            className={cn(
              'truncate border px-3.5 py-2 text-xs font-semibold',
              FLOW_RADIUS.inner,
              t.surfaceInner,
              t.borderSubtle,
              flowBlockTitleClass('purple', isDark),
            )}
          >
            {flowName}
          </div>
        )}
        <div className={cn('flex items-center gap-3', innerSurface(isDark))}>
          {data.infinite ? (
            <>
              <Infinity className={cn('h-4 w-4 shrink-0', flowBlockSubtitleClass('purple', isDark))} strokeWidth={2.25} />
              <span className={cn('text-sm font-semibold tabular-nums', flowBlockTitleClass('purple', isDark))}>∞</span>
            </>
          ) : (
            <>
              <Hash className={cn('h-4 w-4 shrink-0', flowBlockSubtitleClass('purple', isDark))} strokeWidth={2.25} />
              <span className={cn('text-sm font-semibold tabular-nums', flowBlockTitleClass('purple', isDark))}>
                {data.iterations || '10'}×
              </span>
            </>
          )}
        </div>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#8b5cf6"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function SubflowNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const flowName = String(data.subflowName || data.flowName || '').trim()
  const resultKey = String(data.subflowResultKey || 'subflow_result').trim() || 'subflow_result'

  return (
    <FlowNodeFrame accent="indigo" isDark={isDark} selected={!!selected} width={286}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <NodeHeader
        isDark={isDark}
        accent="indigo"
        eyebrow="Subfluxo"
        title={data.label || 'Executar subfluxo'}
        icon={
          <NodeIconWell accent="indigo" isDark={isDark} size="sm">
            <Workflow className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className={cn('border px-3 py-2.5 text-[11px] leading-relaxed', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle, flowBlockTitleClass('indigo', isDark))}>
          <p className="truncate font-semibold">{flowName || 'Nenhum fluxo selecionado'}</p>
          <p className={cn('mt-1 truncate', flowBlockSubtitleClass('indigo', isDark))}>
            resultado: {resultKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('indigo', isDark))}>
            contexto completo
          </span>
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('indigo', isDark))}>
            {data.subflowFailOnError === false ? 'continua se falhar' : 'falha se quebrar'}
          </span>
        </div>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#6366f1"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

// Node de Comentário
export function CommentNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  return (
    <FlowNodeFrame accent="amber" isDark={isDark} selected={!!selected} width={260} maxWidth={320}>
      <NodeHeader
        isDark={isDark}
        accent="amber"
        title="Comentário"
        icon={
          <NodeIconWell accent="amber" isDark={isDark} size="sm">
            <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="px-5 pb-5 pt-1">
        {data.comment && (
          <div
            className={cn(
              'border px-3.5 py-3 text-sm font-medium leading-relaxed',
              FLOW_RADIUS.inner,
              t.surfaceInner,
              t.borderSubtle,
              flowBlockTitleClass('amber', isDark),
            )}
          >
            {data.comment}
          </div>
        )}
        {!data.comment && (
          <div
            className={cn(
              'border px-3.5 py-3 text-xs font-medium italic',
              FLOW_RADIUS.inner,
              t.surfaceInner,
              t.borderSubtle,
              t.textMuted,
            )}
          >
            Sem texto
          </div>
        )}
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        id="pointer"
        isDark={isDark}
        fill="#f59e0b"
        className="!h-4 !w-4 !min-h-[16px] !min-w-[16px] cursor-grab"
        style={{ bottom: -8, left: '50%', transform: 'translateX(-50%)' }}
        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation()
        }}
      />
    </FlowNodeFrame>
  )
}

// Node de Debug (inspeção - não altera dados em tempo de execução)
export function DebugNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const keysHint = (data.debugKeys || '').toString().trim()
  return (
    <FlowNodeFrame accent="purple" isDark={isDark} selected={!!selected} width={240}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <NodeHeader
        isDark={isDark}
        accent="purple"
        eyebrow="Depuração"
        title="Debug"
        icon={
          <NodeIconWell accent="purple" isDark={isDark} size="sm">
            <Bug className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-2 px-5 pb-5 pt-0">
        <p
          className={cn(
            'truncate text-xs font-medium',
            flowBlockSubtitleClass('purple', isDark),
          )}
        >
          {data.label || 'Debug'}
        </p>
        <div
          className={cn(
            'font-mono text-[10px] leading-relaxed border px-2.5 py-2',
            FLOW_RADIUS.inset,
            getFlowTheme(!isDark).surfaceInner,
            getFlowTheme(!isDark).borderSubtle,
            flowBlockSubtitleClass('purple', isDark),
          )}
        >
          {keysHint ? keysHint : 'Todas as chaves do contexto'}
        </div>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#9333ea"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

// Node de Delay/Aguardar
export function DelayNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  return (
    <FlowNodeFrame accent="cyan" isDark={isDark} selected={!!selected} width={212}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <NodeHeader
        isDark={isDark}
        accent="cyan"
        title="Aguardar"
        icon={
          <NodeIconWell accent="cyan" isDark={isDark} size="sm">
            <Clock className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="px-5 pb-5 pt-1">
        <div className={cn('flex items-center justify-center py-4', innerSurface(isDark))}>
          <span className={cn('text-lg font-semibold tabular-nums tracking-tight', flowBlockTitleClass('cyan', isDark))}>
            {(() => {
              const seconds = parseInt(data.duration) || 0
              if (seconds === 0) return '0s'
              if (seconds < 60) return `${seconds}s`
              const minutes = Math.floor(seconds / 60)
              const remainingSeconds = seconds % 60
              if (minutes < 60) {
                if (remainingSeconds === 0) return `${minutes}min`
                return `${minutes}min ${remainingSeconds}s`
              }
              const hours = Math.floor(minutes / 60)
              const remainingMinutes = minutes % 60
              if (remainingMinutes === 0) return `${hours}h`
              return `${hours}h ${remainingMinutes}min`
            })()}
          </span>
        </div>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#06b6d4"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

// Node de Agente
export function AgentNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const executionMode = data.executionMode === 'template' || (!!data.templateId && !data.agentId) ? 'template' : 'agent'
  const integrationToolBadge = formatIntegrationToolBadge(data)
  const runtimeName =
    executionMode === 'template'
      ? String(data.templateName || data.templateId || 'Template').trim() || 'Template'
      : String(data.agentName || data.agentId || 'Agente').trim() || 'Agente'
  const instructions = String(data.additionalInstructions || '').trim()

  return (
    <FlowNodeFrame accent="emerald" isDark={isDark} selected={!!selected} width={268}>
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start gap-3.5">
          <NodeIconWell accent="emerald" isDark={isDark} size="sm">
            <Bot className="h-[18px] w-[18px]" strokeWidth={2} />
          </NodeIconWell>
          <div className="min-w-0 flex-1 pt-0.5">
            <span
              className={cn(
                'flow-agent-mode-badge inline-flex items-center',
                executionMode === 'template' ? t.badgeModel : t.badgeAccount,
              )}
              style={undefined}
            >
              {executionMode === 'template' ? 'Modelo' : 'Conta'}
            </span>
            <p
              className={cn(
                'flow-premium-title mt-2.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight',
                flowBlockTitleClass('emerald', isDark),
              )}
            >
              {data.label || 'Agente IA'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('emerald', isDark))}>
            {executionMode === 'template' ? 'Template' : 'Agente'}
          </span>
          {integrationToolBadge ? (
            <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('emerald', isDark))}>
              {integrationToolBadge}
            </span>
          ) : null}
        </div>
        <div className={cn('border px-3 py-2.5 text-[11px] leading-relaxed', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle, flowBlockTitleClass('emerald', isDark))}>
          <p className="font-semibold">{runtimeName}</p>
          <p className="mt-1 line-clamp-3">{instructions || 'Sem instruções complementares neste bloco.'}</p>
        </div>
      </div>

      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#10b981"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function WaTemplateNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const name = (data.waTemplateName || '').toString().trim()
  const lang = (data.waTemplateLanguage || '').toString().trim()
  return (
    <FlowNodeFrame accent="purple" isDark={isDark} selected={!!selected} width={280}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="purple"
        eyebrow="WhatsApp"
        title="Template WhatsApp"
        icon={
          <NodeIconWell accent="purple" isDark={isDark} size="sm">
            <LayoutTemplate className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2 px-5 pb-5 pt-0">
        <p className={cn('text-xs font-medium', flowBlockSubtitleClass('purple', isDark))}>
          {data.label || 'Enviar template'}
        </p>
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('purple', isDark),
          )}
        >
          {name ? (
            <>
              <span className={cn('font-semibold', flowBlockTitleClass('purple', isDark))}>{name}</span>
              {lang ? <span className="text-muted-foreground"> · {lang}</span> : null}
            </>
          ) : (
            <span className={cn('italic', t.textMuted)}>Nenhum template selecionado</span>
          )}
        </div>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#8b5cf6"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function ScheduleNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const scheduleAt = String(data.scheduleAt || '').trim()
  const timezone = String(data.scheduleTimezone || 'America/Sao_Paulo').trim()

  return (
    <FlowNodeFrame accent="sky" isDark={isDark} selected={!!selected} width={248}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />

      <NodeHeader
        isDark={isDark}
        accent="sky"
        title="Agendar"
        icon={
          <NodeIconWell accent="sky" isDark={isDark} size="sm">
            <CalendarClock className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-2 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('sky', isDark),
          )}
        >
          {scheduleAt || <span className={cn('italic', t.textMuted)}>Data e hora não configuradas</span>}
        </div>
        <p className={cn('text-[11px] leading-relaxed', flowBlockSubtitleClass('sky', isDark))}>
          Executa a próxima etapa no fuso <span className="font-semibold">{timezone}</span>.
        </p>
      </div>

      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#0ea5e9"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function HubSpotWhatsAppCampaignNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const filterValue = String(data.crmFilterValue || '').trim()
  return (
    <FlowNodeFrame accent="teal" isDark={isDark} selected={!!selected} width={304}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="teal"
        eyebrow="HubSpot"
        title="Contatos por tag"
        icon={
          <NodeIconWell accent="teal" isDark={isDark} size="sm">
            <Database className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('teal', isDark),
          )}
        >
          {filterValue ? (
            <>
              Tag <span className={cn('font-semibold', flowBlockTitleClass('teal', isDark))}>{filterValue}</span>
            </>
          ) : (
            <span className={cn('italic', t.textMuted)}>Tag do HubSpot não configurada</span>
          )}
        </div>
        <p className={cn('text-[11px] leading-relaxed', flowBlockSubtitleClass('teal', isDark))}>
          Prepara a audiência por tag para WhatsApp template e email.
        </p>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#0f766e"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function CrmContactNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const operation = String(data.crmOperation || 'lookup').trim() || 'lookup'
  const label =
    operation === 'create'
      ? 'Criar paciente'
      : operation === 'update'
        ? 'Atualizar paciente'
        : operation === 'upsert'
          ? 'Sincronizar paciente'
          : 'Consultar paciente'

  return (
    <FlowNodeFrame accent="teal" isDark={isDark} selected={!!selected} width={304}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="teal"
        eyebrow="CRM"
        title="Contato CRM"
        icon={
          <NodeIconWell accent="teal" isDark={isDark} size="sm">
            <Database className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('teal', isDark))}>
            {label}
          </span>
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('teal', isDark))}>
            {String(data.crmIntegrationId || 'sem integração').trim() ? 'Integração configurada' : 'Sem integração'}
          </span>
        </div>
        <div className={cn('border px-3 py-2.5 text-[11px] leading-relaxed', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle, flowBlockTitleClass('teal', isDark))}>
          <p className="font-semibold">{String(data.originTag || 'Sem tag de origem').trim() || 'Sem tag de origem'}</p>
          <p className={cn('mt-1', flowBlockTitleClass('teal', isDark))}>
            lookup: {Array.isArray(data.lookupFields) && data.lookupFields.length > 0 ? data.lookupFields.join(', ') : 'sem chaves'}
          </p>
        </div>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#0f766e"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function AppointmentNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const operation = String(data.appointmentOperation || 'availability').trim() || 'availability'
  const label =
    operation === 'book'
      ? 'Criar booking'
      : operation === 'reschedule'
        ? 'Remarcar booking'
        : operation === 'cancel'
          ? 'Cancelar booking'
          : 'Consultar disponibilidade'
  const providerLabel = 'Calendly'
  const primaryField = String(data.specialtyField || 'appointment_resource').trim() || 'appointment_resource'
  const ownerField = String(data.doctorField || 'appointment_owner').trim() || 'appointment_owner'
  const typeField = String(data.consultationTypeField || 'appointment_kind').trim() || 'appointment_kind'
  const locationField = String(data.unitField || 'appointment_location').trim() || 'appointment_location'

  return (
    <FlowNodeFrame accent="sky" isDark={isDark} selected={!!selected} width={304}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="sky"
        eyebrow="Agenda"
        title="Ação de agenda"
        icon={
          <NodeIconWell accent="sky" isDark={isDark} size="sm">
            <CalendarClock className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('sky', isDark))}>
            {label}
          </span>
          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('sky', isDark))}>
            {providerLabel}
          </span>
        </div>
        <div className={cn('border px-3 py-2.5 text-[11px] leading-relaxed', FLOW_RADIUS.inner, t.surfaceInner, t.borderSubtle, flowBlockTitleClass('sky', isDark))}>
          <p className="font-semibold">recurso: {primaryField}</p>
          <p className="mt-1">responsável: {ownerField}</p>
          <p className="mt-1">tipo: {typeField} · local: {locationField}</p>
        </div>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#0ea5e9"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function DocumentIntakeNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const kinds = Array.isArray(data.documentKinds) ? data.documentKinds.filter(Boolean) : []
  return (
    <FlowNodeFrame accent="amber" isDark={isDark} selected={!!selected} width={304}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="amber"
        eyebrow="Documentos"
        title="Document Intake"
        icon={
          <NodeIconWell accent="amber" isDark={isDark} size="sm">
            <FileText className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('amber', isDark),
          )}
        >
          {kinds.length > 0 ? kinds.join(', ') : 'exam, pedido_medico, document'}
        </div>
        <p className={cn('text-[11px] leading-relaxed', flowBlockSubtitleClass('amber', isDark))}>
          Registra metadados do arquivo e prepara a integração real de upload depois.
        </p>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#f59e0b"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function HumanHandoffNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  return (
    <FlowNodeFrame accent="rose" isDark={isDark} selected={!!selected} width={304}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="rose"
        eyebrow="Humano"
        title="Handoff"
        icon={
          <NodeIconWell accent="rose" isDark={isDark} size="sm">
            <UserRound className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('rose', isDark),
          )}
        >
          <span className={cn('font-semibold', flowBlockTitleClass('rose', isDark))}>
            {String(data.handoffPriority || 'medium').trim() || 'medium'}
          </span>
          <span className={cn('ml-2', flowBlockSubtitleClass('rose', isDark))}>
            {String(data.handoffReasonField || 'handoff_reason').trim() || 'handoff_reason'}
          </span>
        </div>
        <p className={cn('text-[11px] leading-relaxed', flowBlockSubtitleClass('rose', isDark))}>
          Registra a transferência, notifica a equipe e responde ao paciente com mensagem segura.
        </p>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#e11d48"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function WaSessionWindowNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  return (
    <FlowNodeFrame accent="sky" isDark={isDark} selected={!!selected} width={276}>
      <NodeHeader
        isDark={isDark}
        accent="sky"
        eyebrow="WhatsApp"
        title="Janela 24h"
        icon={
          <NodeIconWell accent="sky" isDark={isDark} size="sm">
            <Timer className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2 px-5 pb-5 pt-0">
        <p className={cn('text-xs leading-relaxed', flowBlockSubtitleClass('sky', isDark))}>
          {data.label || 'Verifica se a conversa ainda está dentro da janela de 24h.'}
        </p>
      </div>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <FlowHandle
        type="source"
        position={Position.Left}
        id="true"
        isDark={isDark}
        fill="#10b981"
        style={{ left: -7, top: '50%', transform: 'translateY(-50%)' }}
      />
      <div
        className="pointer-events-none absolute z-20 flex items-center"
        style={{ left: -56, top: '50%', transform: 'translateY(-50%)' }}
      >
        <span
          className={t.labelIf}
          style={{ backgroundColor: '#15803d', color: '#ffffff', borderColor: '#14532d' }}
        >
          24h
        </span>
      </div>
      <FlowHandle
        type="source"
        position={Position.Right}
        id="false"
        isDark={isDark}
        fill="#ef4444"
        style={{ right: -7, top: '50%', transform: 'translateY(-50%)' }}
      />
      <div
        className="pointer-events-none absolute z-20 flex items-center whitespace-nowrap"
        style={{ left: 'calc(100% + 14px)', top: '50%', transform: 'translateY(-50%)' }}
      >
        <span
          className={t.labelElse}
          style={{ backgroundColor: '#b91c1c', color: '#ffffff', borderColor: '#7f1d1d' }}
        >
          Fora
        </span>
      </div>
    </FlowNodeFrame>
  )
}

export function WhatsAppMessageNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const windowMode = String(data.waWindowMode || 'session_only').trim() || 'session_only'
  const messageType = String(data.waMessageType || 'text').trim() || 'text'
  const messageText = String(data.waMessageText || '').trim()
  const buttons = Array.isArray(data.waButtons) ? data.waButtons.filter((button: any) => String(button?.text || '').trim()) : []
  const linkUrl = String(data.waLinkUrl || '').trim()
  const typeLabel =
    messageType === 'buttons'
      ? 'Texto com botões'
      : messageType === 'link'
        ? 'Texto com link'
        : messageType === 'reminder'
          ? 'Lembrete'
          : 'Texto simples'
  const integrationToolBadge = formatIntegrationToolBadge(data)

  return (
    <FlowNodeFrame accent="green" isDark={isDark} selected={!!selected} width={292}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="green"
        eyebrow="WhatsApp"
        title="Mensagem 24h"
        icon={
          <NodeIconWell accent="green" isDark={isDark} size="sm">
            <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
              t.borderSubtle,
              flowBlockTitleClass('green', isDark),
              isDark ? 'bg-white/72' : 'bg-white/10',
            )}
          >
            {typeLabel}
          </span>
          <span className={cn('text-[10px]', flowBlockSubtitleClass('green', isDark))}>
            {windowMode === 'auto_template' ? 'Legado' : 'Janela aberta'}
          </span>
          {integrationToolBadge ? (
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', t.borderSubtle, flowBlockTitleClass('green', isDark))}>
              {integrationToolBadge}
            </span>
          ) : null}
          {messageType === 'link' && linkUrl ? <Link2 className={cn('h-3.5 w-3.5', flowBlockSubtitleClass('green', isDark))} /> : null}
          {messageType === 'reminder' ? <BellRing className={cn('h-3.5 w-3.5', flowBlockSubtitleClass('green', isDark))} /> : null}
        </div>
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('green', isDark),
          )}
        >
          {messageText || <span className={cn('italic', t.textMuted)}>Nenhuma mensagem configurada</span>}
        </div>
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buttons.slice(0, 3).map((button: any, index: number) => (
              <span
                key={`${button.id || index}-${button.text}`}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                  t.borderSubtle,
                  isDark ? 'bg-white/72 text-slate-800' : 'bg-white/10 text-zinc-100',
                )}
              >
                {button.text}
              </span>
            ))}
          </div>
        )}
        {linkUrl ? (
          <p className={cn('truncate text-[11px]', flowBlockSubtitleClass('green', isDark))}>{linkUrl}</p>
        ) : null}
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#16a34a"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function EmailSendNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const to = String(data.emailTo || '').trim()
  const subject = String(data.emailSubject || '').trim()

  return (
    <FlowNodeFrame accent="amber" isDark={isDark} selected={!!selected} width={292}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="amber"
        eyebrow="Email"
        title="Enviar email"
        icon={
          <NodeIconWell accent="amber" isDark={isDark} size="sm">
            <Mail className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-3 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('amber', isDark),
          )}
        >
          <p className={cn('font-semibold', flowBlockTitleClass('amber', isDark))}>
            {subject || 'Sem assunto configurado'}
          </p>
          <p className={cn('mt-1 truncate text-[11px]', flowBlockSubtitleClass('amber', isDark))}>
            {to || 'Destinatário não definido'}
          </p>
        </div>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#f59e0b"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}

export function EmailReadNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(!isDark)
  const limit = String(data.emailReadLimit || '5').trim() || '5'

  return (
    <FlowNodeFrame accent="rose" isDark={isDark} selected={!!selected} width={292}>
      <FlowHandle
        type="target"
        position={Position.Top}
        isDark={isDark}
        fill={neutralHandleFill(isDark)}
        style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
      <NodeHeader
        isDark={isDark}
        accent="rose"
        eyebrow="Email"
        title="Ler inbox"
        icon={
          <NodeIconWell accent="rose" isDark={isDark} size="sm">
            <Inbox className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-3 px-5 pb-5 pt-0">
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            flowBlockTitleClass('rose', isDark),
          )}
        >
          Ler as <span className={cn('font-semibold', flowBlockTitleClass('rose', isDark))}>{limit}</span> mensagens mais recentes
        </div>
      </div>
      <FlowHandle
        type="source"
        position={Position.Bottom}
        isDark={isDark}
        fill="#e11d48"
        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      />
    </FlowNodeFrame>
  )
}



