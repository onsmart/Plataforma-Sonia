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
  X,
  RefreshCw,
  Clock,
} from 'lucide-react'


interface BlockType {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
  category: 'control' | 'action' | 'integration'
}

// Configuração de cores e ícones para cada tipo de bloco
const blockIcons: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, bg: string }> = {
  start: { icon: Play, color: '#3b82f6', bg: '#eff6ff' },    // Azul
  stop: { icon: X, color: '#ef4444', bg: '#fef2f2' },      // Vermelho
  'if-else': { icon: GitBranch, color: '#f97316', bg: '#fff7ed' }, // Laranja
  loop: { icon: RefreshCw, color: '#8b5cf6', bg: '#f5f3ff' }, // Roxo
  code: { icon: Code, color: '#10b981', bg: '#f0fdf4' },   // Verde
  delay: { icon: Clock, color: '#06b6d4', bg: '#ecfeff' },  // Ciano
  agent: { icon: Bot, color: '#10b981', bg: '#f0fdf4' },   // Verde (Agente)
}

const BLOCK_TYPES: BlockType[] = [
  {
    id: 'start',
    label: 'Início',
    icon: Play,
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    description: 'Ponto de partida do fluxo',
    category: 'control',
  },
  {
    id: 'stop',
    label: 'Fim',
    icon: Square,
    color: 'bg-gradient-to-br from-purple-500 to-violet-600',
    description: 'Finaliza a execução',
    category: 'control',
  },
  {
    id: 'if-else',
    label: 'Condicional',
    icon: GitBranch,
    color: 'bg-gradient-to-br from-orange-500 to-amber-600',
    description: 'Executa lógica condicional (Condição)',
    category: 'control',
  },
  {
    id: 'loop',
    label: 'Loop',
    icon: Repeat,
    color: 'bg-gradient-to-br from-blue-600 to-purple-600',
    description: 'Repete ações múltiplas vezes',
    category: 'control',
  },
  {
    id: 'code',
    label: 'Código',
    icon: Code,
    color: 'bg-gradient-to-br from-green-500 to-emerald-600',
    description: 'Executa código customizado',
    category: 'action',
  },
  {
    id: 'delay',
    label: 'Aguardar',
    icon: Calendar,
    color: 'bg-gradient-to-br from-cyan-500 to-teal-600',
    description: 'Aguarda um tempo antes de continuar',
    category: 'action',
  },
  {
    id: 'agent',
    label: 'Agente IA',
    icon: Bot,
    color: 'bg-gradient-to-br from-green-500 to-cyan-500',
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
    const blockConfig = blockIcons[block.id] || { icon: Icon, color: '#3b82f6', bg: '#eff6ff' }
    const BlockIcon = blockConfig.icon
    
    return (
      <button
        key={block.id}
        onClick={() => handleBlockClick(block.id)}
        onDragStart={(e) => handleDragStart(e, block.id)}
        draggable
        className="w-full aspect-square flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing group bg-white"
        style={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        <div 
          style={{ backgroundColor: blockConfig.bg }}
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform"
        >
          <BlockIcon 
            size={24} 
            style={{ color: blockConfig.color }}
            strokeWidth={2.5} 
          />
        </div>
        <div className="text-center">
          <div className="font-semibold text-sm text-slate-800">{block.label}</div>
          <div className="text-xs text-slate-500 mt-1 line-clamp-2">{block.description}</div>
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
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Controle de Fluxo
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {controlBlocks.map(renderBlock)}
            </div>
          </div>

          {/* Ações */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4 text-green-600" />
              Ações
            </h3>
            <div className="grid grid-cols-2 gap-3">
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
