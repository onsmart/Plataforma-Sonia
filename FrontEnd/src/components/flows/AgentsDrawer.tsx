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
import { Bot, Loader2, Users, LayoutTemplate } from 'lucide-react'
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

interface AvailableTemplate {
  id: string
  name: string
  description: string | null
}

interface AgentsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddAgent: (agent: AvailableAgent) => void
  onAddTemplate: (template: AvailableTemplate) => void
  agents: AvailableAgent[]
  templates: AvailableTemplate[]
  loading: boolean
  loadingTemplates?: boolean
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
  isDark,
  chipTint,
  iconClassName,
  titleAccent,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  isDark: boolean
  chipTint: { light: string; dark: string }
  iconClassName?: string
  titleAccent: 'emerald' | 'blue'
}) {
  return (
    <div className="mb-4 space-y-2 sm:mb-5">
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div
          className={cn(
            'flow-drawer-category-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11',
            isDark ? chipTint.dark : chipTint.light,
          )}
        >
          <Icon className={cn('h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]', iconClassName)} />
        </div>
        <h3
          className={cn(
            'text-sm font-semibold tracking-tight sm:text-[0.9375rem]',
            flowBlockTitleClass(titleAccent, isDark),
          )}
        >
          {title}
        </h3>
      </div>
      <p className={cn('pl-[3.25rem] text-xs leading-relaxed sm:pl-[3.5rem] sm:text-[13px]', flowBlockSubtitleClass(titleAccent, isDark))}>
        {hint}
      </p>
    </div>
  )
}

function EmptyState({ message, submessage, isDark }: { message: string; submessage: string; isDark: boolean }) {
  const t = getFlowTheme(isDark)
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
  onAddTemplate,
  agents,
  templates,
  loading,
  loadingTemplates = false,
}: AgentsDrawerProps) {
  const { t } = useTranslation('flows')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const theme = getFlowTheme(isDark)

  const handleAgentClick = (agent: AvailableAgent) => {
    onAddAgent(agent)
    onClose()
  }

  const handleTemplateClick = (template: AvailableTemplate) => {
    onAddTemplate(template)
    onClose()
  }

  const handleDragStart = (e: React.DragEvent, agent: AvailableAgent) => {
    e.dataTransfer.setData('agentId', agent.id)
    e.dataTransfer.setData('agentName', agent.name)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleTemplateDragStart = (e: React.DragEvent, template: AvailableTemplate) => {
    e.dataTransfer.setData('templateId', template.id)
    e.dataTransfer.setData('templateName', template.name)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const renderAgentRow = (agent: AvailableAgent) => (
    <button
      key={agent.id}
      type="button"
      onClick={() => handleAgentClick(agent)}
      onDragStart={(e) => handleDragStart(e, agent)}
      draggable
      style={{
        ...flowAccentVars('emerald'),
        backgroundColor: isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light,
        color: isDark ? '#fafafa' : '#000000',
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
        <div className={cn('text-[0.9375rem] font-semibold leading-snug tracking-tight sm:text-base', theme.textPrimary)}>
          {agent.name}
        </div>
        {agent.bio && (
          <div className={cn('mt-1 line-clamp-2 text-[13px] leading-relaxed sm:text-[0.8125rem]', theme.textMuted)}>
            {agent.bio}
          </div>
        )}
      </div>
    </button>
  )

  const renderTemplateRow = (template: AvailableTemplate) => (
    <button
      key={template.id}
      type="button"
      onClick={() => handleTemplateClick(template)}
      onDragStart={(e) => handleTemplateDragStart(e, template)}
      draggable
      style={{
        ...flowAccentVars('blue'),
        backgroundColor: isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light,
        color: isDark ? '#fafafa' : '#000000',
        borderRadius: '1rem',
      }}
      className={cn(
        paletteRowClassName(isDark),
        'flex w-full cursor-grab items-center gap-4 px-4 py-3.5 text-left sm:gap-5 sm:px-5 sm:py-4',
      )}
    >
      <NodeIconWell accent="blue" isDark={isDark} size="lg">
        <Bot className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
      </NodeIconWell>
      <div className="min-w-0 flex-1 py-0.5">
        <div
          className={cn(
            'text-[0.9375rem] font-semibold leading-snug tracking-tight sm:text-base',
            flowBlockTitleClass('blue', isDark),
          )}
        >
          {template.name}
        </div>
        {template.description && (
          <div
            className={cn(
              'mt-1 line-clamp-3 text-[13px] leading-relaxed sm:line-clamp-2 sm:text-[0.8125rem]',
              flowBlockSubtitleClass('blue', isDark),
            )}
          >
            {template.description}
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
          <SheetTitle className={cn('text-lg font-semibold tracking-tight sm:text-xl', theme.textPrimary)}>
            {t('drawer.agents.title')}
          </SheetTitle>
          <SheetDescription className={cn('mt-2 max-w-[95%] text-sm leading-relaxed sm:text-[0.9375rem]', theme.textMuted)}>
            {t('drawer.agents.description', {
              defaultValue: 'Arraste um agente existente ou um template para o fluxo.',
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-10 px-5 py-8 sm:space-y-11 sm:px-7 sm:py-10">
          <section>
            <SectionHeader
              icon={Users}
              title={t('drawer.agents.sectionAgents', { defaultValue: 'Agentes existentes' })}
              hint={t('drawer.agents.hintAgents', {
                defaultValue: 'Usa o runtime completo atual por agentId.',
              })}
              isDark={isDark}
              titleAccent="emerald"
              chipTint={{ light: 'bg-[#d1fae5]', dark: 'bg-zinc-800' }}
              iconClassName="text-emerald-600 dark:text-emerald-400"
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
                  defaultValue: 'Crie um agente no Hub se quiser reutilizar um runtime completo.',
                })}
              />
            ) : (
              <div className="flex flex-col gap-4 sm:gap-5">{agents.map(renderAgentRow)}</div>
            )}
          </section>

          <section>
            <SectionHeader
              icon={LayoutTemplate}
              title={t('drawer.agents.sectionTemplates', { defaultValue: 'Templates' })}
              hint={t('drawer.agents.hintTemplates', {
                defaultValue: 'Cria um node nativo por templateId, sem gerar agente no banco.',
              })}
              isDark={isDark}
              titleAccent="blue"
              chipTint={{ light: 'bg-[#dbeafe]', dark: 'bg-zinc-800' }}
              iconClassName="text-blue-600 dark:text-blue-400"
            />
            {loadingTemplates ? (
              <div className={cn('flex flex-col items-center justify-center py-12', theme.textMuted)}>
                <Loader2 className="mb-3 h-7 w-7 animate-spin" />
                <p className="text-sm">{t('drawer.agents.loadingTemplates', { defaultValue: 'Carregando templates...' })}</p>
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                isDark={isDark}
                message={t('drawer.agents.emptyTemplates', { defaultValue: 'Nenhum template disponível' })}
                submessage={t('drawer.agents.emptyTemplatesHint', {
                  defaultValue: 'Crie templates para montar blocos reutilizáveis direto no fluxo.',
                })}
              />
            ) : (
              <div className="flex flex-col gap-4 sm:gap-5">{templates.map(renderTemplateRow)}</div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
