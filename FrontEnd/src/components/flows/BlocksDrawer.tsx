import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import {
  Play,
  Square,
  Workflow,
  Route,
  Bot,
  Database,
  SendHorizontal,
  Mail,
  Inbox,
  Sparkles,
  Settings2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import { cn } from '../ui/utils'
import {
  flowAccentVars,
  flowBlockSubtitleClass,
  flowBlockTitleClass,
  FLOW_NODE_SHELL_BG,
  getFlowTheme,
  NodeIconWell,
  paletteRowClassName,
  type FlowAccent,
} from './flowBlockTheme'
import { flowDrawerHeaderStyle, flowDrawerShellStyle } from './flowDesignTokens'

interface BlockType {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  accent: FlowAccent
  category: 'control' | 'action' | 'integration'
}

interface BlocksDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddBlock: (blockType: string) => void
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  isDark,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  isDark: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-slate-100 text-slate-700',
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className={cn('flow-premium-title text-[11px] font-semibold uppercase tracking-[0.22em]', isDark ? 'text-zinc-100' : 'text-slate-900')}>
          {title}
        </p>
        <p className={cn('flow-premium-subtitle mt-1 text-xs leading-relaxed', isDark ? 'text-zinc-400' : 'text-slate-600')}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export function BlocksDrawer({ isOpen, onClose, onAddBlock }: BlocksDrawerProps) {
  const { t } = useTranslation('flows')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const theme = getFlowTheme(isDark)
  const [draggingBlockId, setDraggingBlockId] = React.useState<string | null>(null)

  const blockTypes: BlockType[] = [
    {
      id: 'start',
      label: t('drawer.blocks.block.start', { defaultValue: 'Início' }),
      description: t('drawer.blocks.block.startDesc', { defaultValue: 'Ponto de partida do fluxo.' }),
      icon: Play,
      accent: 'blue',
      category: 'control',
    },
    {
      id: 'stop',
      label: t('drawer.blocks.block.stop', { defaultValue: 'Fim' }),
      description: t('drawer.blocks.block.stopDesc', { defaultValue: 'Finaliza a execução.' }),
      icon: Square,
      accent: 'red',
      category: 'control',
    },
    {
      id: 'if-else',
      label: t('drawer.blocks.block.ifElse', { defaultValue: 'Condicional' }),
      description: t('drawer.blocks.block.ifElseDesc', {
        defaultValue: 'Roteia entre IF e ELSE.',
      }),
      icon: Workflow,
      accent: 'orange',
      category: 'control',
    },
    {
      id: 'switch',
      label: t('drawer.blocks.block.switch', { defaultValue: 'Múltiplas opções' }),
      description: t('drawer.blocks.block.switchDesc', {
        defaultValue: 'Cria saídas para opções 1, 2, 3...',
      }),
      icon: Route,
      accent: 'indigo',
      category: 'control',
    },
    {
      id: 'agent',
      label: t('drawer.blocks.block.agent', { defaultValue: 'Agente IA' }),
      description: t('drawer.blocks.block.agentDesc', {
        defaultValue: 'Executa o agente com o contexto atual.',
      }),
      icon: Bot,
      accent: 'emerald',
      category: 'action',
    },
    {
      id: 'whatsapp_message',
      label: t('drawer.blocks.block.whatsappMessage', { defaultValue: 'Mensagem WhatsApp' }),
      description: t('drawer.blocks.block.whatsappMessageDesc', {
        defaultValue: 'Envia mensagem livre na janela aberta de 24h.',
      }),
      icon: SendHorizontal,
      accent: 'green',
      category: 'integration',
    },
    {
      id: 'wa_template',
      label: t('drawer.blocks.block.waTemplate', { defaultValue: 'Template WhatsApp' }),
      description: t('drawer.blocks.block.waTemplateDesc', {
        defaultValue: 'Envia um template aprovado pela Meta.',
      }),
      icon: SendHorizontal,
      accent: 'purple',
      category: 'integration',
    },
    {
      id: 'hubspot_whatsapp_campaign',
      label: t('drawer.blocks.block.hubspotWhatsappCampaign', { defaultValue: 'Contatos HubSpot' }),
      description: t('drawer.blocks.block.hubspotWhatsappCampaignDesc', {
        defaultValue: 'Busca contatos por tag para o próximo envio.',
      }),
      icon: Database,
      accent: 'teal',
      category: 'integration',
    },
    {
      id: 'email_send',
      label: t('drawer.blocks.block.emailSend', { defaultValue: 'Enviar email' }),
      description: t('drawer.blocks.block.emailSendDesc', {
        defaultValue: 'Envia um email pela integração escolhida.',
      }),
      icon: Mail,
      accent: 'amber',
      category: 'integration',
    },
    {
      id: 'email_read',
      label: t('drawer.blocks.block.emailRead', { defaultValue: 'Ler inbox email' }),
      description: t('drawer.blocks.block.emailReadDesc', {
        defaultValue: 'Lê mensagens recentes da caixa de entrada.',
      }),
      icon: Inbox,
      accent: 'rose',
      category: 'integration',
    },
  ]

  const grouped = {
    control: blockTypes.filter((block) => block.category === 'control'),
    action: blockTypes.filter((block) => block.category === 'action'),
    integration: blockTypes.filter((block) => block.category === 'integration'),
  }

  const renderBlock = (block: BlockType) => {
    const Icon = block.icon
    return (
      <button
        key={block.id}
        type="button"
        draggable
        onClick={() => onAddBlock(block.id)}
        onDragStart={(event) => {
          event.dataTransfer.setData('blockType', block.id)
          event.dataTransfer.effectAllowed = 'copy'
          setDraggingBlockId(block.id)
        }}
        onDragEnd={() => setDraggingBlockId(null)}
        data-dragging={draggingBlockId === block.id ? 'true' : 'false'}
        style={{
          ...flowAccentVars(block.accent),
          backgroundColor: isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light,
          backgroundImage: isDark
            ? 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.14) 0%, rgba(var(--flow-accent-rgb), 0.04) 42%, rgba(0, 0, 0, 0) 80%)'
            : 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.08) 0%, rgba(var(--flow-accent-rgb), 0.02) 40%, rgba(255, 255, 255, 0) 80%)',
          color: isDark ? '#fafafa' : '#000000',
        }}
        className={cn(
          paletteRowClassName(isDark),
          'flex min-h-[5.1rem] w-full items-center gap-4 px-4 py-4 text-left',
        )}
      >
        <NodeIconWell accent={block.accent} isDark={isDark} size="lg">
          <Icon className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2.15} />
        </NodeIconWell>
        <div className="min-w-0 flex-1">
          <p className={cn('flow-premium-title text-[0.97rem] font-semibold leading-snug tracking-tight', flowBlockTitleClass(block.accent, isDark))}>
            {block.label}
          </p>
          <p className={cn('flow-premium-subtitle mt-1.5 text-[13px] leading-relaxed', flowBlockSubtitleClass(block.accent, isDark))}>
            {block.description}
          </p>
        </div>
      </button>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        style={flowDrawerShellStyle(isDark)}
        className={cn(
          'flow-editor-drawer flow-blocks-drawer-scroll flex w-[min(100vw-0.5rem,24rem)] max-w-[100vw] flex-col overflow-y-auto overflow-x-hidden p-0 sm:w-[26rem] lg:w-[28rem]',
          theme.borderPanel,
        )}
      >
        <SheetHeader
          style={flowDrawerHeaderStyle(isDark)}
          className={cn('shrink-0 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7', theme.borderHeader)}
        >
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] px-5 py-5 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <SheetTitle className={cn('flow-premium-title text-xl font-semibold tracking-tight', theme.textPrimary)}>
                  {t('drawer.blocks.title', { defaultValue: 'Blocos do fluxo' })}
                </SheetTitle>
              <SheetDescription className={cn('flow-premium-subtitle mt-2 text-sm leading-relaxed', theme.textMuted)}>
                  {t('drawer.blocks.description', {
                    defaultValue: 'Escolha um bloco e adicione ao fluxo.',
                  })}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-8 px-5 py-6 sm:px-7 sm:py-8">
          <section className="space-y-4">
            <SectionHeader
              icon={Workflow}
              title={t('drawer.blocks.category.control', { defaultValue: 'Controle de fluxo' })}
              subtitle="Entradas e roteamentos."
              isDark={isDark}
            />
            <div className="space-y-3">{grouped.control.map(renderBlock)}</div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={Settings2}
              title={t('drawer.blocks.category.action', { defaultValue: 'Ações' })}
              subtitle="Execução principal do fluxo."
              isDark={isDark}
            />
            <div className="space-y-3">{grouped.action.map(renderBlock)}</div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={Database}
              title={t('drawer.blocks.category.integration', { defaultValue: 'Integrações' })}
              subtitle="Canais e integrações externas."
              isDark={isDark}
            />
            <div className="space-y-3">{grouped.integration.map(renderBlock)}</div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}


