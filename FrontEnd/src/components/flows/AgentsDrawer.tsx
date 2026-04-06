import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet'
import { Bot, Loader2 } from 'lucide-react'

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

export function AgentsDrawer({ 
  isOpen, 
  onClose, 
  onAddAgent, 
  onAddTemplate,
  agents, 
  templates,
  loading,
  loadingTemplates = false
}: AgentsDrawerProps) {
  const { t } = useTranslation('flows')
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

  const renderCard = (
    id: string,
    name: string,
    onClick: () => void,
    onDragStart: (e: React.DragEvent) => void,
    accent: { background: string; color: string },
    subtitle?: string
  ) => (
    <button
      key={id}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable
      className="w-full aspect-square flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing group bg-white"
      style={{
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.12)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div
        style={{ backgroundColor: accent.background }}
        className="h-14 w-14 rounded-2xl flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform"
      >
        <Bot
          size={24}
          style={{ color: accent.color, strokeWidth: 3 }}
          strokeWidth={3}
        />
      </div>
      <div className="text-center w-full">
        <div style={{ fontWeight: 900, fontSize: '0.875rem', color: '#0f172a' }} className="text-sm line-clamp-2">{name}</div>
        {subtitle && (
          <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{subtitle}</div>
        )}
      </div>
    </button>
  )

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[320px] sm:w-[400px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>{t('drawer.agents.title')}</SheetTitle>
          <SheetDescription>
            Arraste um agente existente ou um template para o fluxo.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Agentes existentes</h3>
              <p className="text-xs text-slate-500 mt-1">Usa o runtime completo atual por `agentId`.</p>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-3" />
                <p className="text-sm">{t('drawer.agents.loading')}</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border rounded-2xl">
                <Bot className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">Nenhum agente disponível</p>
                <p className="text-xs text-center px-4">
                  Crie um agente no Hub se quiser reutilizar um runtime completo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {agents.map((agent) =>
                  renderCard(
                    agent.id,
                    agent.name,
                    () => handleAgentClick(agent),
                    (e) => handleDragStart(e, agent),
                    { background: '#f0fdf4', color: '#10b981' }
                  )
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Templates</h3>
              <p className="text-xs text-slate-500 mt-1">Cria um node nativo por `templateId`, sem gerar agente no banco.</p>
            </div>
            {loadingTemplates ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-3" />
                <p className="text-sm">Carregando templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border rounded-2xl">
                <Bot className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">Nenhum template disponível</p>
                <p className="text-xs text-center px-4">
                  Crie templates para montar blocos reutilizáveis direto no flow.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((template) =>
                  renderCard(
                    template.id,
                    template.name,
                    () => handleTemplateClick(template),
                    (e) => handleTemplateDragStart(e, template),
                    { background: '#eff6ff', color: '#2563eb' },
                    template.description || undefined
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
