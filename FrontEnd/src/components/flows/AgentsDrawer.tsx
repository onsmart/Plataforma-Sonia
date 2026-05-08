import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet'
import { Bot, Loader2, Users } from 'lucide-react'
import { cn } from '../ui/utils'
import {
  flowAccentVars,
  flowBlockSubtitleClass,
  flowBlockTitleClass,
  getFlowTheme,
  FLOW_NODE_SHELL_BG,
  NodeIconWell,
  paletteRowClassName,
} from './flowBlockTheme'
import { flowDrawerHeaderStyle, flowDrawerShellStyle } from './flowDesignTokens'

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

interface AgentsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddAgent: (agent: AvailableAgent) => void
  agents: AvailableAgent[]
  loading: boolean
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
  isDark,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  isDark: boolean
  iconClassName?: string
}) {
  return (
    <div
      className={cn(
        'mb-4 rounded-[1.45rem] border px-4 py-3.5 backdrop-blur-xl sm:mb-5 sm:rounded-2xl',
        isDark
          ? 'border-white/10 bg-[#17191d]/94 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.82)]'
          : 'border-[#E2E8F0] bg-white/92 shadow-[0_22px_58px_-38px_rgba(148,163,184,0.28)]',
      )}
    >
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div
          className={cn(
            'flow-drawer-category-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11',
            isDark ? 'bg-white/6 text-zinc-100' : 'bg-slate-100 text-slate-700',
          )}
        >
          <Icon className={cn('h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]', iconClassName)} />
        </div>
        <div className="min-w-0">
          <h3
            className="flow-premium-title text-sm font-semibold tracking-tight sm:text-[0.9375rem]"
            style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
          >
            {title}
          </h3>
          <p
            className="flow-premium-subtitle mt-1 text-xs leading-relaxed sm:text-[13px]"
            style={{ color: isDark ? 'rgba(203, 213, 225, 0.82)' : '#64748b', opacity: 1 }}
          >
            {hint}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message, submessage, isDark }: { message: string; submessage: string; isDark: boolean }) {
  const t = getFlowTheme(!isDark)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border px-4 py-10 text-center',
        t.surfaceInner,
        t.borderSubtle,
      )}
    >
      <Bot className={cn('mb-3 h-10 w-10', t.textMuted)} strokeWidth={1.5} />
      <p className={cn('text-sm font-medium', t.textPrimary)}>{message}</p>
      <p className={cn('mt-1.5 max-w-[18rem] text-xs leading-relaxed', t.textMuted)}>{submessage}</p>
    </div>
  )
}

export function AgentsDrawer({
  isOpen,
  onClose,
  onAddAgent,
  agents,
  loading,
}: AgentsDrawerProps) {
  const { t } = useTranslation('flows')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const theme = getFlowTheme(isDark)
  const [draggingAgentId, setDraggingAgentId] = React.useState<string | null>(null)

  const handleAgentClick = (agent: AvailableAgent) => {
    onAddAgent(agent)
    onClose()
  }

  const handleDragStart = (e: React.DragEvent, agent: AvailableAgent) => {
    e.dataTransfer.setData('agentId', agent.id)
    e.dataTransfer.setData('agentName', agent.name)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggingAgentId(agent.id)
  }

  const renderAgentRow = (agent: AvailableAgent) => (
    <button
      key={agent.id}
      type="button"
      onClick={() => handleAgentClick(agent)}
      onDragStart={(e) => handleDragStart(e, agent)}
      onDragEnd={() => setDraggingAgentId(null)}
      draggable
      data-dragging={draggingAgentId === agent.id ? 'true' : 'false'}
      style={{
        ...flowAccentVars('emerald'),
        backgroundColor: isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light,
        backgroundImage: isDark
          ? 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.16) 0%, rgba(255, 255, 255, 0.46) 18%, rgba(var(--flow-accent-rgb), 0.08) 46%, rgba(255, 255, 255, 0) 84%)'
          : 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.26) 0%, rgba(var(--flow-accent-rgb), 0.1) 34%, rgba(255, 255, 255, 0.04) 56%, rgba(0, 0, 0, 0) 84%)',
        color: isDark ? '#111827' : '#F8FAFC',
        borderRadius: '1rem',
      }}
      className={cn(
        paletteRowClassName(isDark),
        'flex w-full cursor-grab items-center gap-4 px-4 py-3.5 text-left sm:gap-5 sm:px-5 sm:py-4',
      )}
    >
      <NodeIconWell accent="emerald" isDark={isDark} size="lg">
        <Bot className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
      </NodeIconWell>
      <div className="min-w-0 flex-1 py-0.5">
        <div className={cn('flow-premium-title truncate text-[0.9375rem] font-semibold leading-snug tracking-tight sm:text-base', flowBlockTitleClass('emerald', isDark))}>
          {agent.name}
        </div>
        {agent.bio && (
          <div className={cn('flow-premium-subtitle mt-1 line-clamp-2 text-[13px] leading-relaxed sm:text-[0.8125rem]', flowBlockSubtitleClass('emerald', isDark))}>
            {agent.bio}
          </div>
        )}
      </div>
    </button>
  )

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        style={flowDrawerShellStyle(isDark)}
        className={cn(
          'flow-editor-drawer flow-blocks-drawer-scroll flex w-[min(100vw-0.5rem,22.5rem)] max-w-[100vw] flex-col gap-0 overflow-y-auto overflow-x-hidden p-0 sm:w-[25rem] lg:w-[27rem]',
          theme.borderPanel,
        )}
      >
        <SheetHeader
          style={flowDrawerHeaderStyle(isDark)}
          className={cn('shrink-0 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7', theme.borderHeader)}
        >
          <div
            className={cn(
              'rounded-[1.7rem] border px-5 py-5 backdrop-blur-xl sm:rounded-3xl',
              isDark
                ? 'border-white/10 bg-[#17191d]/94 shadow-[0_28px_72px_-40px_rgba(0,0,0,0.9)]'
                : 'border-[#E2E8F0] bg-white/92 shadow-[0_24px_62px_-40px_rgba(148,163,184,0.3)]',
            )}
          >
            <SheetTitle
              className="flow-premium-title text-lg font-semibold tracking-tight sm:text-xl"
              style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              {t('drawer.agents.title', { defaultValue: 'Agentes' })}
            </SheetTitle>
            <SheetDescription
              className="flow-premium-subtitle mt-2 max-w-[95%] text-sm leading-relaxed sm:text-[0.9375rem]"
              style={{ color: isDark ? 'rgba(203, 213, 225, 0.82)' : '#64748b', opacity: 1 }}
            >
              {t('drawer.agents.descriptionAgentsOnly', {
                defaultValue: 'Arraste um agente para o fluxo. Os nós usam apenas agentes cadastrados.',
              })}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-10 px-5 py-8 sm:space-y-11 sm:px-7 sm:py-10">
          <section>
            <SectionHeader
              icon={Users}
              title={t('drawer.agents.sectionAgents', { defaultValue: 'Agentes' })}
              hint={t('drawer.agents.hintAgents', {
                defaultValue: 'Cada bloco executa o runtime completo do agente selecionado.',
              })}
              isDark={isDark}
              iconClassName="text-emerald-300"
            />
            {loading ? (
              <div className={cn('flex flex-col items-center justify-center py-12', theme.textMuted)}>
                <Loader2 className="mb-3 h-7 w-7 animate-spin" />
                <p className="text-sm">{t('drawer.agents.loading')}</p>
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                isDark={isDark}
                message={t('drawer.agents.emptyAgents', { defaultValue: 'Nenhum agente disponível' })}
                submessage={t('drawer.agents.emptyAgentsHint', {
                  defaultValue: 'Crie agentes no Hub ou use Criar com IA para gerar um fluxo com agentes novos.',
                })}
              />
            ) : (
              <div className="flex flex-col gap-4 sm:gap-5">{agents.map(renderAgentRow)}</div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
