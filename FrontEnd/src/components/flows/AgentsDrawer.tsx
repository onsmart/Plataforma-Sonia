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

interface AgentsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddAgent: (agent: AvailableAgent) => void
  agents: AvailableAgent[]
  loading: boolean
}

export function AgentsDrawer({ 
  isOpen, 
  onClose, 
  onAddAgent, 
  agents, 
  loading 
}: AgentsDrawerProps) {
  const { t } = useTranslation('flows')
  const handleAgentClick = (agent: AvailableAgent) => {
    onAddAgent(agent)
    onClose()
  }

  const handleDragStart = (e: React.DragEvent, agent: AvailableAgent) => {
    e.dataTransfer.setData('agentId', agent.id)
    e.dataTransfer.setData('agentName', agent.name)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[320px] sm:w-[400px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>{t('drawer.agents.title')}</SheetTitle>
          <SheetDescription>
            {t('drawer.agents.description')}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              <p className="text-sm">{t('drawer.agents.loading')}</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">{t('drawer.agents.empty.title')}</p>
              <p className="text-xs text-center">
                {t('drawer.agents.empty.description')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent)}
                  onDragStart={(e) => handleDragStart(e, agent)}
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
                    style={{ backgroundColor: '#f0fdf4' }}
                    className="h-14 w-14 rounded-2xl flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform"
                  >
                    <Bot 
                      size={24} 
                      style={{ color: '#10b981', strokeWidth: 3 }}
                      strokeWidth={3} 
                    />
                  </div>
                  <div className="text-center w-full">
                    <div style={{ fontWeight: 900, fontSize: '0.875rem', color: '#0f172a' }} className="text-sm line-clamp-2">{agent.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
