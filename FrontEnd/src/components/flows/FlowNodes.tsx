import React from 'react'
import { Position } from 'reactflow'
import { useTheme } from 'next-themes'
import {
  Play,
  Square,
  GitBranch,
  Repeat,
  Bot,
  Infinity,
  Hash,
  Clock,
  MessageSquare,
  Bug,
  LayoutTemplate,
  Timer,
  SendHorizontal,
  Link2,
  BellRing,
  Mail,
  Inbox,
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

/** Bloco interno — fundo e borda dos tokens (sem transparência no wrapper) */
function innerSurface(isDark: boolean, className?: string) {
  const t = getFlowTheme(isDark)
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
  const shellFg = isDark ? '#fafafa' : '#000000'
  return (
    <div
      data-flow-custom-node=""
      className={cn(flowNodeShellClassName(isDark, selected), className)}
      style={{
        ...flowAccentVars(accent),
        width,
        ...(maxWidth ? { maxWidth } : {}),
        backgroundColor: shellBg,
        color: shellFg,
        borderRadius: '1.5rem',
      }}
    >
      {children}
    </div>
  )
}

/** Cabeçalho: sem divisória — hierarquia por espaçamento e badge sólido */
function NodeHeader({
  isDark,
  accent,
  icon,
  title,
  eyebrow,
}: {
  isDark: boolean
  accent: FlowAccent
  icon: React.ReactNode
  title: string
  eyebrow?: string
}) {
  const t = getFlowTheme(isDark)
  return (
    <div className="px-5 pb-5 pt-5">
      <div className="flex items-start gap-3.5">
        {icon}
        <div className="min-w-0 flex-1 pt-0.5">
          {eyebrow && <p className={cn('mb-2', t.badgeDecision)}>{eyebrow}</p>}
          <p className={cn('text-[0.9375rem] font-semibold leading-snug tracking-tight', flowBlockTitleClass(accent, isDark))}>
            {title}
          </p>
        </div>
      </div>
    </div>
  )
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
          <p className={cn('text-[0.9375rem] font-semibold leading-tight tracking-tight', flowBlockTitleClass('blue', isDark))}>
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
        fill="#3b82f6"
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
          <p className={cn('text-[0.9375rem] font-semibold leading-tight tracking-tight', flowBlockTitleClass('red', isDark))}>Fim</p>
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
  const t = getFlowTheme(isDark)
  return (
    <FlowNodeFrame accent="orange" isDark={isDark} selected={!!selected} width={276}>
      <NodeHeader
        isDark={isDark}
        accent="orange"
        eyebrow="Decisão"
        title="Condicional"
        icon={
          <NodeIconWell accent="orange" isDark={isDark} size="sm">
            <GitBranch className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />

      <div className="space-y-3 px-5 pb-5 pt-0">
        <p className={cn('inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest', flowBlockTitleClass('orange', isDark), isDark ? 'bg-zinc-800' : 'bg-orange-100')}>
          Expressão
        </p>
        <div
          className={cn(
            'font-mono break-all border px-3.5 py-3 text-[11px] leading-relaxed',
            FLOW_RADIUS.inset,
            t.surfaceInner,
            t.borderSubtle,
            isDark ? 'text-zinc-200' : 'text-slate-800',
          )}
        >
          {(() => {
            const condition = data.condition || "{{mensagem}} contém 'carlos'"
            const parts = condition.split(/(\{\{[^}]+\}\})/g)
            return parts.map((part: string, i: number) => {
              if (part.match(/\{\{[^}]+\}\}/)) {
                return (
                  <span key={i} className={cn('font-semibold', isDark ? 'text-orange-300' : 'text-orange-600')}>
                    {part}
                  </span>
                )
              }
              return <span key={i}>{part}</span>
            })
          })()}
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
        fill="#10b981"
        style={{ left: -7, top: '50%', transform: 'translateY(-50%)' }}
      />
      <div
        className="pointer-events-none absolute z-20 flex items-center"
        style={{ left: -50, top: '50%', transform: 'translateY(-50%)' }}
      >
        <span
          className={t.labelIf}
          style={
            isDark
              ? { backgroundColor: '#15803d', color: '#ffffff', borderColor: '#14532d' }
              : { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#ffffff' }
          }
        >
          IF
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
          style={
            isDark
              ? { backgroundColor: '#b91c1c', color: '#ffffff', borderColor: '#7f1d1d' }
              : { backgroundColor: '#9f1239', color: '#ffffff', borderColor: '#ffffff' }
          }
        >
          ELSE
        </span>
      </div>
    </FlowNodeFrame>
  )
}

// Node de Loop
export function LoopNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(isDark)
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
              isDark ? 'border-violet-600' : 'border-violet-300',
              flowBlockTitleClass('purple', isDark),
            )}
          >
            {flowName}
          </div>
        )}
        <div className={cn('flex items-center gap-3', innerSurface(isDark))}>
          {data.infinite ? (
            <>
              <Infinity className={cn('h-4 w-4 shrink-0', isDark ? 'text-violet-300' : 'text-violet-600')} strokeWidth={2.25} />
              <span className={cn('text-sm font-semibold tabular-nums', flowBlockTitleClass('purple', isDark))}>∞</span>
            </>
          ) : (
            <>
              <Hash className={cn('h-4 w-4 shrink-0', isDark ? 'text-violet-300' : 'text-violet-600')} strokeWidth={2.25} />
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

// Node de Comentário
export function CommentNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(isDark)
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
              isDark ? 'border-amber-600' : 'border-amber-300',
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
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
      />
    </FlowNodeFrame>
  )
}

// Node de Debug (inspeção — não altera dados em runtime)
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
            getFlowTheme(isDark).surfaceInner,
            getFlowTheme(isDark).borderSubtle,
            isDark ? 'text-zinc-300' : 'text-slate-600',
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
  const t = getFlowTheme(isDark)
  const executionMode = data.executionMode === 'template' || (!!data.templateId && !data.agentId) ? 'template' : 'agent'

  return (
    <FlowNodeFrame accent="emerald" isDark={isDark} selected={!!selected} width={268}>
      <div className="px-5 pb-5 pt-5">
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
              style={
                isDark
                  ? undefined
                  : executionMode === 'template'
                    ? { backgroundColor: '#075985', color: '#ffffff' }
                    : { backgroundColor: '#065f46', color: '#ffffff' }
              }
            >
              {executionMode === 'template' ? 'Modelo' : 'Conta'}
            </span>
            <p
              className={cn(
                'mt-2.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight',
                flowBlockTitleClass('emerald', isDark),
              )}
            >
              {data.label || 'Agente IA'}
            </p>
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
  const t = getFlowTheme(isDark)
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
            isDark ? 'text-zinc-200' : 'text-slate-800',
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

export function WaSessionWindowNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(isDark)
  return (
    <FlowNodeFrame accent="orange" isDark={isDark} selected={!!selected} width={276}>
      <NodeHeader
        isDark={isDark}
        accent="orange"
        eyebrow="WhatsApp"
        title="Janela 24h"
        icon={
          <NodeIconWell accent="orange" isDark={isDark} size="sm">
            <Timer className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-2 px-5 pb-5 pt-0">
        <p className={cn('text-xs leading-relaxed', flowBlockSubtitleClass('orange', isDark))}>
          {data.label || 'Dentro da janela de atendimento vs fora (use template no ramo fora).'}
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
          style={
            isDark
              ? { backgroundColor: '#15803d', color: '#ffffff', borderColor: '#14532d' }
              : { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#ffffff' }
          }
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
          style={
            isDark
              ? { backgroundColor: '#b91c1c', color: '#ffffff', borderColor: '#7f1d1d' }
              : { backgroundColor: '#9f1239', color: '#ffffff', borderColor: '#ffffff' }
          }
        >
          Fora
        </span>
      </div>
    </FlowNodeFrame>
  )
}

export function WhatsAppMessageNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(isDark)
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

  return (
    <FlowNodeFrame accent="purple" isDark={isDark} selected={!!selected} width={292}>
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
        title="Mensagem livre"
        icon={
          <NodeIconWell accent="purple" isDark={isDark} size="sm">
            <SendHorizontal className="h-4 w-4" strokeWidth={2.25} />
          </NodeIconWell>
        }
      />
      <div className="space-y-3 px-5 pb-5 pt-0">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest', flowBlockTitleClass('purple', isDark), isDark ? 'bg-zinc-800' : 'bg-violet-100')}>
            {typeLabel}
          </span>
          {messageType === 'link' && linkUrl ? <Link2 className={cn('h-3.5 w-3.5', flowBlockSubtitleClass('purple', isDark))} /> : null}
          {messageType === 'reminder' ? <BellRing className={cn('h-3.5 w-3.5', flowBlockSubtitleClass('purple', isDark))} /> : null}
        </div>
        <div
          className={cn(
            'border px-3 py-2.5 text-[11px] leading-relaxed',
            FLOW_RADIUS.inner,
            t.surfaceInner,
            t.borderSubtle,
            isDark ? 'text-zinc-200' : 'text-slate-800',
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
                  isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-700',
                )}
              >
                {button.text}
              </span>
            ))}
          </div>
        )}
        {linkUrl ? (
          <p className={cn('truncate text-[11px]', flowBlockSubtitleClass('purple', isDark))}>{linkUrl}</p>
        ) : null}
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

export function EmailSendNode({ data, selected }: any) {
  const isDark = useFlowIsDark()
  const t = getFlowTheme(isDark)
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
            isDark ? 'text-zinc-200' : 'text-slate-800',
          )}
        >
          <p className={cn('font-semibold', flowBlockTitleClass('amber', isDark))}>
            {subject || 'Sem assunto configurado'}
          </p>
          <p className={cn('mt-1 truncate text-[11px]', flowBlockSubtitleClass('amber', isDark))}>
            {to || 'DestinatÃ¡rio nÃ£o definido'}
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
  const t = getFlowTheme(isDark)
  const limit = String(data.emailReadLimit || '5').trim() || '5'

  return (
    <FlowNodeFrame accent="cyan" isDark={isDark} selected={!!selected} width={292}>
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
        eyebrow="Email"
        title="Ler inbox"
        icon={
          <NodeIconWell accent="cyan" isDark={isDark} size="sm">
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
            isDark ? 'text-zinc-200' : 'text-slate-800',
          )}
        >
          Ler as <span className={cn('font-semibold', flowBlockTitleClass('cyan', isDark))}>{limit}</span> mensagens mais recentes
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
