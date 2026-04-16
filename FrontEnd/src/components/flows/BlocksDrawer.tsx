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
import {
  Play,
  Square,
  GitBranch,
  Repeat,
  Bot,
  Zap,
  Database,
  MessageSquare,
  Settings,
  Clock,
  Bug,
  LayoutTemplate,
  Timer,
} from 'lucide-react'
import { cn } from '../ui/utils'
import {
  flowAccentVars,
  flowBlockSubtitleClass,
  flowBlockTitleClass,
  getFlowTheme,
  FLOW_NODE_SHELL_BG,
  NodeIconWell,
  paletteRowClassName,
  type FlowAccent,
} from './flowBlockTheme'
import { flowDrawerHeaderStyle, flowDrawerShellStyle } from './flowDesignTokens'

interface BlockType {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  description: string
  category: 'control' | 'action' | 'integration'
}

const blockPalette: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
    accent: FlowAccent
    roundWell?: boolean
  }
> = {
  start: { icon: Play, accent: 'blue', roundWell: true },
  stop: { icon: Square, accent: 'red', roundWell: true },
  'if-else': { icon: GitBranch, accent: 'orange' },
  loop: { icon: Repeat, accent: 'purple' },
  comment: { icon: MessageSquare, accent: 'amber' },
  delay: { icon: Clock, accent: 'cyan' },
  debug: { icon: Bug, accent: 'purple' },
  agent: { icon: Bot, accent: 'emerald' },
  wa_template: { icon: LayoutTemplate, accent: 'purple' },
  wa_session_window: { icon: Timer, accent: 'orange' },
}

interface BlocksDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddBlock: (blockType: string) => void
}

function CategorySection({
  icon: Icon,
  children,
  blocks,
  isDark,
  iconClassName,
  chipTint,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  blocks: React.ReactNode
  isDark: boolean
  iconClassName?: string
  /** Fundo sólido do ícone da categoria (sem borda pesada) */
  chipTint: { light: string; dark: string }
}) {
  return (
    <section className="relative">
      <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-3.5">
        <div
          className={cn(
            'flow-drawer-category-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11',
            isDark ? chipTint.dark : chipTint.light,
          )}
        >
          <Icon className={cn('h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]', iconClassName)} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs sm:tracking-[0.18em]',
              isDark ? 'text-zinc-300' : 'text-slate-800',
            )}
          >
            {children}
          </h3>
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:gap-5">{blocks}</div>
    </section>
  )
}

export function BlocksDrawer({ isOpen, onClose, onAddBlock }: BlocksDrawerProps) {
  const { t } = useTranslation('flows')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const theme = getFlowTheme(isDark)

  const BLOCK_TYPES: BlockType[] = [
    {
      id: 'start',
      label: t('drawer.blocks.block.start', { defaultValue: 'Início' }),
      icon: Play,
      description: t('drawer.blocks.block.startDesc', { defaultValue: 'Ponto de entrada do fluxo.' }),
      category: 'control',
    },
    {
      id: 'stop',
      label: t('drawer.blocks.block.stop', { defaultValue: 'Parar' }),
      icon: Square,
      description: t('drawer.blocks.block.stopDesc', { defaultValue: 'Encerra a execução do fluxo.' }),
      category: 'control',
    },
    {
      id: 'if-else',
      label: t('drawer.blocks.block.ifElse', { defaultValue: 'Condicional' }),
      icon: GitBranch,
      description: t('drawer.blocks.block.ifElseDesc', {
        defaultValue: 'Ramifica o fluxo com base em uma condição.',
      }),
      category: 'control',
    },
    {
      id: 'loop',
      label: t('drawer.blocks.block.loop', { defaultValue: 'Loop' }),
      icon: Repeat,
      description: t('drawer.blocks.block.loopDesc', {
        defaultValue: 'Repete um subfluxo um número fixo de vezes ou em modo infinito.',
      }),
      category: 'control',
    },
    {
      id: 'comment',
      label: t('drawer.blocks.block.comment', { defaultValue: 'Comentário' }),
      icon: MessageSquare,
      description: t('drawer.blocks.block.commentDesc', {
        defaultValue: 'Anotação no diagrama; não é executada.',
      }),
      category: 'action',
    },
    {
      id: 'delay',
      label: t('drawer.blocks.block.delay', { defaultValue: 'Aguardar' }),
      icon: Clock,
      description: t('drawer.blocks.block.delayDesc', {
        defaultValue: 'Pausa a execução pelo tempo configurado.',
      }),
      category: 'action',
    },
    {
      id: 'debug',
      label: t('drawer.blocks.block.debug', { defaultValue: 'Debug' }),
      icon: Bug,
      description: t('drawer.blocks.block.debugDesc', {
        defaultValue: 'Registra um snapshot do contexto no histórico, sem alterar dados.',
      }),
      category: 'action',
    },
    {
      id: 'agent',
      label: t('drawer.blocks.block.agent', { defaultValue: 'Agente IA' }),
      icon: Bot,
      description: t('drawer.blocks.block.agentDesc', {
        defaultValue: 'Executa um agente ou template de automação interna.',
      }),
      category: 'action',
    },
    {
      id: 'wa_template',
      label: t('drawer.blocks.block.waTemplate', { defaultValue: 'Template Meta (WhatsApp)' }),
      icon: LayoutTemplate,
      description: t('drawer.blocks.block.waTemplateDesc', {
        defaultValue: 'Envia message template aprovado pela Meta durante o fluxo.',
      }),
      category: 'integration',
    },
    {
      id: 'wa_session_window',
      label: t('drawer.blocks.block.waSession', { defaultValue: 'Janela 24h (WhatsApp)' }),
      icon: Timer,
      description: t('drawer.blocks.block.waSessionDesc', {
        defaultValue: 'Ramifica o fluxo: dentro da janela de atendimento vs fora.',
      }),
      category: 'integration',
    },
  ]

  const controlBlocks = BLOCK_TYPES.filter((b) => b.category === 'control')
  const actionBlocks = BLOCK_TYPES.filter((b) => b.category === 'action')
  const integrationBlocks = BLOCK_TYPES.filter((b) => b.category === 'integration')

  const handleBlockClick = (blockId: string) => {
    onAddBlock(blockId)
  }

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('blockType', blockId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const renderBlock = (block: BlockType) => {
    const cfg = blockPalette[block.id] ?? blockPalette.start
    const Icon = cfg.icon
    const accent = cfg.accent

    return (
      <button
        key={block.id}
        type="button"
        onClick={() => handleBlockClick(block.id)}
        onDragStart={(e) => handleDragStart(e, block.id)}
        draggable
        style={{
          ...flowAccentVars(accent),
          backgroundColor: isDark ? FLOW_NODE_SHELL_BG.dark : FLOW_NODE_SHELL_BG.light,
          color: isDark ? '#fafafa' : '#000000',
          borderRadius: '1rem',
        }}
        className={cn(
          paletteRowClassName(isDark),
          'flex min-h-[4.75rem] w-full cursor-grab items-center gap-4 px-4 py-3.5 sm:min-h-[5rem] sm:gap-5 sm:px-5 sm:py-4',
        )}
      >
        <NodeIconWell accent={accent} isDark={isDark} round={cfg.roundWell} size="lg">
          <Icon className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} />
        </NodeIconWell>
        <div className="min-w-0 flex-1 py-0.5 text-left">
          <div
            className={cn(
              'text-[0.9375rem] font-semibold leading-snug tracking-tight sm:text-base',
              flowBlockTitleClass(accent, isDark),
            )}
          >
            {block.label}
          </div>
          <div
            className={cn(
              'mt-1.5 line-clamp-3 text-[13px] leading-relaxed sm:line-clamp-2 sm:text-[0.8125rem]',
              flowBlockSubtitleClass(accent, isDark),
            )}
          >
            {block.description}
          </div>
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
          'flow-editor-drawer flow-blocks-drawer-scroll flex w-[min(100vw-0.5rem,22.5rem)] max-w-[100vw] flex-col gap-0 overflow-y-auto overflow-x-hidden p-0 sm:w-[25rem] lg:w-[27rem]',
          theme.borderPanel,
        )}
      >
        <SheetHeader
          style={flowDrawerHeaderStyle(isDark)}
          className={cn('shrink-0 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7', theme.borderHeader)}
        >
          <SheetTitle className={cn('text-lg font-semibold tracking-tight sm:text-xl', theme.textPrimary)}>
            {t('drawer.blocks.title', { defaultValue: 'Blocos' })}
          </SheetTitle>
          <SheetDescription className={cn('mt-2 max-w-[95%] text-sm leading-relaxed sm:text-[0.9375rem]', theme.textMuted)}>
            {t('drawer.blocks.description', {
              defaultValue: 'Arraste ou clique para adicionar blocos ao fluxo.',
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-11 px-5 py-8 sm:space-y-12 sm:px-7 sm:py-10">
          <CategorySection
            icon={Zap}
            isDark={isDark}
            iconClassName="text-blue-600 dark:text-blue-400"
            chipTint={{ light: 'bg-[#dbeafe]', dark: 'bg-zinc-800' }}
            blocks={<>{controlBlocks.map(renderBlock)}</>}
          >
            {t('drawer.blocks.category.control', { defaultValue: 'Controle' })}
          </CategorySection>

          <CategorySection
            icon={Settings}
            isDark={isDark}
            iconClassName="text-emerald-600 dark:text-emerald-400"
            chipTint={{ light: 'bg-[#d1fae5]', dark: 'bg-zinc-800' }}
            blocks={<>{actionBlocks.map(renderBlock)}</>}
          >
            {t('drawer.blocks.category.action', { defaultValue: 'Ações' })}
          </CategorySection>

          {integrationBlocks.length > 0 && (
            <CategorySection
              icon={Database}
              isDark={isDark}
              iconClassName="text-violet-600 dark:text-violet-400"
              chipTint={{ light: 'bg-[#ede9fe]', dark: 'bg-zinc-800' }}
              blocks={<>{integrationBlocks.map(renderBlock)}</>}
            >
              {t('drawer.blocks.category.integration', { defaultValue: 'Integrações' })}
            </CategorySection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
