import React from 'react'
import { Handle, Position } from 'reactflow'
import { 
  Play, Square, GitBranch, Repeat, 
  Code, Calendar, Bot, Zap 
} from 'lucide-react'

// Node de Início
export function StartNode({ data, selected }: any) {
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[140px] bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-500 ${selected ? 'ring-2 ring-green-400 shadow-lg' : ''} transition-all`}
    >
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" style={{ bottom: -6 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-green-500 text-white">
          <Play className="h-3.5 w-3.5 fill-white" />
        </div>
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">Início</p>
      </div>
      {data.label && data.label !== 'Início' && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">{data.label}</p>
      )}
    </div>
  )
}

// Node de Fim
export function StopNode({ data, selected }: any) {
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[140px] bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border-red-500 ${selected ? 'ring-2 ring-red-400 shadow-lg' : ''} transition-all`}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-red-500 text-white">
          <Square className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Fim</p>
      </div>
      {data.label && data.label !== 'Fim' && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{data.label}</p>
      )}
    </div>
  )
}

// Node Condicional (If-Else) - MELHORADO
export function IfElseNode({ data, selected, id }: any) {
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[200px] bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-500 ${selected ? 'ring-2 ring-blue-400 shadow-lg' : ''} transition-all cursor-pointer`}
      title="Clique com botão direito para editar"
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-blue-500 text-white">
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Condição</p>
      </div>
      {data.condition && (
        <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-xs text-blue-800 dark:text-blue-200">
          {data.condition}
        </div>
      )}
      <div className="flex items-center justify-between mt-4 gap-2 relative pb-2">
        <div className="flex flex-col items-center gap-1.5 flex-1 relative">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="true"
            className="!bg-green-500 !w-4 !h-4 !border-2 !border-white !z-10"
            style={{ bottom: -6 }}
          />
          <span className="text-xs font-semibold text-green-700 dark:text-green-300">IF</span>
          <span className="text-[10px] text-muted-foreground">Verdadeiro</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1 relative">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false"
            className="!bg-red-500 !w-4 !h-4 !border-2 !border-white !z-10"
            style={{ bottom: -6 }}
          />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">ELSE</span>
          <span className="text-[10px] text-muted-foreground">Falso</span>
        </div>
      </div>
    </div>
  )
}

// Node de Loop
export function LoopNode({ data, selected, id }: any) {
  const displayIterations = data.infinite ? '∞ (Infinito)' : `${data.iterations || '10'} ${data.iterations === '1' ? 'iteração' : 'iterações'}`
  const agentName = data.agentName || (data.agentId ? 'Agente selecionado' : null)
  
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[160px] bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 border-purple-500 ${selected ? 'ring-2 ring-purple-400 shadow-lg' : ''} transition-all cursor-pointer`}
      title="Clique com botão direito para editar"
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-purple-500 text-white">
          <Repeat className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Loop</p>
      </div>
      {agentName && (
        <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-xs text-purple-800 dark:text-purple-200 font-medium">
          {agentName}
        </div>
      )}
      <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-xs text-purple-800 dark:text-purple-200">
        {displayIterations}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" style={{ bottom: -6 }} />
    </div>
  )
}

// Node de Código
export function CodeNode({ data, selected, id }: any) {
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[160px] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-500 ${selected ? 'ring-2 ring-orange-400 shadow-lg' : ''} transition-all cursor-pointer`}
      title="Clique com botão direito para editar"
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-orange-500 text-white">
          <Code className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Código</p>
      </div>
      {data.code && (
        <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-xs text-orange-800 dark:text-orange-200 font-mono">
          {data.code.substring(0, 30)}...
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" style={{ bottom: -6 }} />
    </div>
  )
}

// Node de Delay/Aguardar
export function DelayNode({ data, selected, id }: any) {
  return (
    <div 
      className={`rounded-xl border-2 p-4 shadow-sm min-w-[160px] bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border-yellow-500 ${selected ? 'ring-2 ring-yellow-400 shadow-lg' : ''} transition-all cursor-pointer`}
      title="Clique com botão direito para editar"
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-yellow-500 text-white">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Aguardar</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          data-slot="input"
          className="text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-16 min-w-0 rounded-md border px-2 py-1 text-sm bg-input-background transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive text-center"
          min="1"
          max="9999"
          placeholder="10"
          value={data.duration || ''}
          readOnly
          onClick={(e) => e.stopPropagation()}
        />
        <label className="text-xs text-yellow-700 dark:text-yellow-300 font-medium whitespace-nowrap">segundos</label>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-white" style={{ bottom: -6 }} />
    </div>
  )
}
