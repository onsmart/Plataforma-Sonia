import React from 'react'
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
  Code,
  Calendar,
  Bot,
  Zap,
  Database,
  Mail,
  MessageSquare,
  FileText,
  Settings,
} from 'lucide-react'

interface BlockType {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
  category: 'control' | 'action' | 'integration'
}

const BLOCK_TYPES: BlockType[] = [
  {
    id: 'start',
    label: 'Início',
    icon: Play,
    color: 'bg-green-500',
    description: 'Ponto de partida do fluxo',
    category: 'control',
  },
  {
    id: 'stop',
    label: 'Fim',
    icon: Square,
    color: 'bg-red-500',
    description: 'Finaliza a execução',
    category: 'control',
  },
  {
    id: 'if-else',
    label: 'Condicional',
    icon: GitBranch,
    color: 'bg-blue-500',
    description: 'Executa lógica condicional (Condição)',
    category: 'control',
  },
  {
    id: 'loop',
    label: 'Loop',
    icon: Repeat,
    color: 'bg-purple-500',
    description: 'Repete ações múltiplas vezes',
    category: 'control',
  },
  {
    id: 'code',
    label: 'Código',
    icon: Code,
    color: 'bg-orange-500',
    description: 'Executa código customizado',
    category: 'action',
  },
  {
    id: 'delay',
    label: 'Aguardar',
    icon: Calendar,
    color: 'bg-yellow-500',
    description: 'Aguarda um tempo antes de continuar',
    category: 'action',
  },
  {
    id: 'agent',
    label: 'Agente IA',
    icon: Bot,
    color: 'bg-indigo-500',
    description: 'Executa um agente de IA',
    category: 'action',
  },
]

interface BlocksDrawerProps {
  isOpen: boolean
  onClose: () => void
  onAddBlock: (blockType: string) => void
}

export function BlocksDrawer({ isOpen, onClose, onAddBlock }: BlocksDrawerProps) {
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
    const Icon = block.icon
    return (
      <button
        key={block.id}
        onClick={() => handleBlockClick(block.id)}
        onDragStart={(e) => handleDragStart(e, block.id)}
        draggable
        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-all text-left group cursor-grab active:cursor-grabbing"
      >
        <div className={`p-2 rounded-lg ${block.color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{block.label}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">{block.description}</div>
        </div>
      </button>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[320px] sm:w-[400px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Blocos de Funções</SheetTitle>
          <SheetDescription>
            Arraste ou clique para adicionar blocos ao fluxo
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Controle de Fluxo */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Controle de Fluxo
            </h3>
            <div className="space-y-2">
              {controlBlocks.map(renderBlock)}
            </div>
          </div>

          {/* Ações */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Ações
            </h3>
            <div className="space-y-2">
              {actionBlocks.map(renderBlock)}
            </div>
          </div>

          {/* Integrações (se houver) */}
          {integrationBlocks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Integrações
              </h3>
              <div className="space-y-2">
                {integrationBlocks.map(renderBlock)}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
