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
  Clock,
  SendHorizontal,
  Mail,
  Inbox,
  MessageSquare,
  Bug,
  FileText,
  UserRound,
  Sparkles,
  Settings2,
  GitBranch,
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
  canvasFlowKind?: 'main' | 'subflow'
}

function fixedSidebarCardClass(isDark: boolean) {
  return isDark
    ? 'border-white/12 bg-[#1d2229]/96 shadow-[0_22px_58px_-38px_rgba(0,0,0,0.84)]'
    : 'border-[#E2E8F0] bg-white/92 shadow-[0_22px_58px_-38px_rgba(148,163,184,0.28)]'
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
    <div
      className={cn(
        'flex items-start gap-3 rounded-[1.15rem] border px-3.5 py-2.5 backdrop-blur-xl sm:rounded-[1.25rem]',
        fixedSidebarCardClass(isDark),
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem]',
        isDark ? 'bg-white/8 text-zinc-100' : 'bg-slate-100 text-slate-700',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p
          className="flow-premium-title text-[10px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
        >
          {title}
        </p>
        <p
          className="flow-premium-subtitle mt-1 text-[11px] leading-relaxed"
          style={{ color: isDark ? 'rgba(203, 213, 225, 0.8)' : '#64748b', opacity: 1 }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export function BlocksDrawer({ isOpen, onClose, onAddBlock, canvasFlowKind = 'main' }: BlocksDrawerProps) {
  const { t } = useTranslation('flows')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const theme = getFlowTheme(isDark)
  const [draggingBlockId, setDraggingBlockId] = React.useState<string | null>(null)

  const isSubflowCanvas = canvasFlowKind === 'subflow'

  const blockTypes: BlockType[] = [
    {
      id: 'start',
      label: t('drawer.blocks.block.start', { defaultValue: 'Início' }),
      description: t('drawer.blocks.block.startDesc', { defaultValue: 'Ponto de partida do fluxo.' }),
      icon: Play,
      accent: 'blue',
      category: 'control',
    },
    ...(isSubflowCanvas
      ? [
          {
            id: 'stop',
            label: t('drawer.blocks.block.subflowExit', { defaultValue: 'Saída do subfluxo' }),
            description: t('drawer.blocks.block.subflowExitDesc', {
              defaultValue: 'Encerra só esta etapa e retorna ao fluxo principal.',
            }),
            icon: Square,
            accent: 'red' as const,
            category: 'control' as const,
          },
        ]
      : [
          {
            id: 'stop',
            label: t('drawer.blocks.block.stop', { defaultValue: 'Fim' }),
            description: t('drawer.blocks.block.stopDesc', {
              defaultValue: 'Finaliza a execução.',
            }),
            icon: Square,
            accent: 'red' as const,
            category: 'control' as const,
          },
        ]),
    {
      id: 'step',
      label: t('drawer.blocks.block.step', { defaultValue: 'Próximo passo' }),
      description: t('drawer.blocks.block.stepDesc', {
        defaultValue: 'Conecta ao próximo bloco do fluxograma sem encerrar o atendimento.',
      }),
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
      id: 'subflow',
      label: t('drawer.blocks.block.subflow', { defaultValue: 'Subfluxo' }),
      description: t('drawer.blocks.block.subflowDesc', {
        defaultValue: 'Executa outro fluxo e retorna ao canvas principal.',
      }),
      icon: GitBranch,
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
      id: 'comment',
      label: t('drawer.blocks.block.comment', { defaultValue: 'Comentário' }),
      description: t('drawer.blocks.block.commentDesc', {
        defaultValue: 'Documenta partes do fluxo sem afetar a execução.',
      }),
      icon: MessageSquare,
      accent: 'amber',
      category: 'action',
    },
    {
      id: 'delay',
      label: t('drawer.blocks.block.delay', { defaultValue: 'Aguardar' }),
      description: t('drawer.blocks.block.delayDesc', {
        defaultValue: 'Cria uma pausa curta antes do próximo bloco.',
      }),
      icon: Clock,
      accent: 'cyan',
      category: 'action',
    },
    {
      id: 'debug',
      label: t('drawer.blocks.block.debug', { defaultValue: 'Debug' }),
      description: t('drawer.blocks.block.debugDesc', {
        defaultValue: 'Inspeciona o contexto do fluxo durante testes.',
      }),
      icon: Bug,
      accent: 'purple',
      category: 'action',
    },
    {
      id: 'schedule',
      label: t('drawer.blocks.block.schedule', { defaultValue: 'Agendar data e hora' }),
      description: t('drawer.blocks.block.scheduleDesc', {
        defaultValue: 'Pausa o fluxo e retoma na data e no horário definidos.',
      }),
      icon: Clock,
      accent: 'sky',
      category: 'control',
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
      id: 'wa_session_window',
      label: t('drawer.blocks.block.waSession', { defaultValue: 'Janela 24h' }),
      description: t('drawer.blocks.block.waSessionDesc', {
        defaultValue: 'Verifica se a conversa ainda estA dentro da janela de 24 horas do WhatsApp.',
      }),
      icon: Clock,
      accent: 'sky',
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
      label: t('drawer.blocks.block.hubspotWhatsappCampaign', { defaultValue: 'Audiência HubSpot' }),
      description: t('drawer.blocks.block.hubspotWhatsappCampaignDesc', {
        defaultValue: 'Busca clientes por tag para os próximos envios.',
      }),
      icon: Database,
      accent: 'teal',
      category: 'integration',
    },
    {
      id: 'crm_contact',
      label: t('drawer.blocks.block.crmContact', { defaultValue: 'Contato CRM' }),
      description: t('drawer.blocks.block.crmContactDesc', {
        defaultValue: 'Consulta, cria ou atualiza o paciente no CRM.',
      }),
      icon: Database,
      accent: 'teal',
      category: 'integration',
    },
    {
      id: 'appointment',
      label: t('drawer.blocks.block.appointment', { defaultValue: 'Appointment' }),
      description: t('drawer.blocks.block.appointmentDesc', {
        defaultValue: 'Busca horários e agenda usando Calendly real.',
      }),
      icon: Clock,
      accent: 'sky',
      category: 'integration',
    },
    {
      id: 'document_intake',
      label: t('drawer.blocks.block.documentIntake', { defaultValue: 'Document Intake' }),
      description: t('drawer.blocks.block.documentIntakeDesc', {
        defaultValue: 'Registra exames ou documentos com placeholder de upload.',
      }),
      icon: FileText,
      accent: 'amber',
      category: 'integration',
    },
    {
      id: 'human_handoff',
      label: t('drawer.blocks.block.humanHandoff', { defaultValue: 'Handoff Humano' }),
      description: t('drawer.blocks.block.humanHandoffDesc', {
        defaultValue: 'Transfere o caso para a equipe humana com notificação interna.',
      }),
      icon: UserRound,
      accent: 'rose',
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
            ? 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.16) 0%, rgba(255, 255, 255, 0.46) 18%, rgba(var(--flow-accent-rgb), 0.08) 46%, rgba(255, 255, 255, 0) 84%)'
            : 'linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.26) 0%, rgba(var(--flow-accent-rgb), 0.1) 34%, rgba(255, 255, 255, 0.04) 56%, rgba(0, 0, 0, 0) 84%)',
          color: isDark ? '#111827' : '#F8FAFC',
        }}
        className={cn(
          paletteRowClassName(isDark),
          'flex min-h-[5rem] w-full items-center gap-4 px-4 py-4 text-left sm:min-h-[5.15rem] sm:px-4 sm:py-4',
        )}
      >
        <NodeIconWell accent={block.accent} isDark={isDark} size="lg">
          <Icon className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2.15} />
        </NodeIconWell>
        <div className="min-w-0 flex-1">
          <p className={cn('flow-premium-title truncate text-[0.97rem] font-semibold leading-snug tracking-tight', flowBlockTitleClass(block.accent, isDark))}>
            {block.label}
          </p>
          <p className={cn('flow-premium-subtitle mt-1.5 line-clamp-2 text-[13px] leading-relaxed', flowBlockSubtitleClass(block.accent, isDark))}>
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
          'flow-editor-drawer flow-blocks-drawer-scroll flex w-[min(100vw-0.5rem,24rem)] max-w-[100vw] flex-col overflow-y-auto overflow-x-hidden p-0 sm:w-[26rem] sm:max-w-none lg:w-[28rem]',
          theme.borderPanel,
        )}
      >
        <SheetHeader
          style={flowDrawerHeaderStyle(isDark)}
          className={cn('shrink-0 px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7', theme.borderHeader)}
        >
          <div
            className={cn(
              'rounded-[1.3rem] border px-4 py-4 backdrop-blur-xl sm:rounded-[1.45rem]',
              fixedSidebarCardClass(isDark),
            )}
          >
            <div className="flex items-start gap-3.5">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem]',
                isDark ? 'bg-amber-500/14 text-amber-300' : 'bg-amber-100 text-amber-700',
              )}>
                <Sparkles className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <SheetTitle
                  className="flow-premium-title text-[1.05rem] font-semibold tracking-tight sm:text-[1.1rem]"
                  style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                >
                  {t('drawer.blocks.title', { defaultValue: 'Blocos de Funções' })}
                </SheetTitle>
                <SheetDescription
                  className="flow-premium-subtitle mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: isDark ? 'rgba(203, 213, 225, 0.82)' : '#64748b', opacity: 1 }}
                >
                  {t('drawer.blocks.description', {
                    defaultValue: 'Arraste ou clique para adicionar blocos ao fluxo',
                  })}
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-8 px-5 py-6 sm:px-7 sm:py-8">
          <section className="space-y-3">
            <SectionHeader
              icon={Workflow}
              title={t('drawer.blocks.category.control', { defaultValue: 'Controle de fluxo' })}
              subtitle="Entradas e roteamentos."
              isDark={isDark}
            />
            <div className="space-y-3">{grouped.control.map(renderBlock)}</div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              icon={Settings2}
              title={t('drawer.blocks.category.action', { defaultValue: 'Ações' })}
              subtitle="Execução principal do fluxo."
              isDark={isDark}
            />
            <div className="space-y-3">{grouped.action.map(renderBlock)}</div>
          </section>

          <section className="space-y-3">
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
