import React from 'react'
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
          <SheetTitle>Agentes Disponíveis</SheetTitle>
          <SheetDescription>
            Arraste ou clique para adicionar agentes ao fluxo
          </SheetDescription>
        </SheetHeader>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              <p className="text-sm">Carregando agentes...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">Nenhum agente disponível</p>
              <p className="text-xs text-center">
                Crie agentes primeiro para adicioná-los ao fluxo
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent)}
                  onDragStart={(e) => handleDragStart(e, agent)}
                  draggable
                  className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-muted transition-all text-left group cursor-grab active:cursor-grabbing"
                >
                  <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-1">{agent.name}</div>
                    {agent.bio && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {agent.bio}
                      </div>
                    )}
                    {!agent.bio && (
                      <div className="text-xs text-muted-foreground italic">
                        Sem descrição
                      </div>
                    )}
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
