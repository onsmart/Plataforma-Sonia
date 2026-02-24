import React from 'react'
import { Handle, Position } from 'reactflow'
import { 
  Play, Square, GitBranch, Repeat, 
  Code, Calendar, Bot, Zap, Infinity, Hash, Clock, MessageSquare, ArrowDown
} from 'lucide-react'
import { Badge } from '../ui/badge'

// Node de Início
export function StartNode({ data, selected }: any) {
  return (
    <div 
      className={`shadow-xl border-2 overflow-hidden relative ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: selected ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.2)',
        borderWidth: selected ? '3px' : '2px',
        boxShadow: selected 
          ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 10px 30px -5px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible',
        minWidth: '160px',
        maxWidth: '180px',
        width: '170px',
        minHeight: '70px',
        maxHeight: '75px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Play size={20} strokeWidth={2.5} style={{ color: '#2563eb' }} />
          </div>
          <div className="text-center">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Início</h4>
            {data.label && data.label !== 'Início' && (
              <p className="font-bold text-sm text-slate-800">{data.label}</p>
            )}
          </div>
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#3b82f6', 
          border: '2px solid white',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
    </div>
  )
}

// Node de Fim
export function StopNode({ data, selected }: any) {
  return (
    <div 
      className={`shadow-xl border-2 overflow-hidden relative ${selected ? 'ring-2 ring-red-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible',
        minWidth: '160px',
        maxWidth: '180px',
        width: '170px',
        minHeight: '70px',
        maxHeight: '75px'
      }}
    >
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#e2e8f0', 
          border: '2px solid white',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%'
        }} 
      />
      
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <Square size={20} strokeWidth={2.5} style={{ color: '#dc2626' }} />
          </div>
          <div className="text-center">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Fim</h4>
            {data.label && data.label !== 'Fim' && (
              <p className="font-bold text-sm text-slate-800">{data.label}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Node Condicional (If-Else) - MELHORADO
export function IfElseNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[240px] relative ${selected ? 'ring-2 ring-orange-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(249, 115, 22, 0.08)',
        borderColor: selected ? 'rgba(249, 115, 22, 0.6)' : 'rgba(249, 115, 22, 0.2)',
        borderWidth: selected ? '3px' : '2px',
        boxShadow: selected 
          ? '0 0 0 3px rgba(249, 115, 22, 0.2), 0 10px 30px -5px rgba(249, 115, 22, 0.5), 0 0 20px rgba(249, 115, 22, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible',
        transition: 'all 0.2s ease-in-out'
      }}
      title="Clique com botão direito para editar"
    >
      
      <div className="p-5 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <GitBranch size={20} strokeWidth={2.5} style={{ color: '#f97316' }} />
          </div>
          <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Condicional</h4>
        </div>
        
        <div className="text-xs font-mono bg-slate-900 text-orange-300 p-3 rounded-xl shadow-inner break-all">
          {(() => {
            const condition = data.condition || "{{mensagem}} contém 'carlos'"
            // Divide o texto em partes, destacando variáveis {{...}} em laranja
            const parts = condition.split(/(\{\{[^}]+\}\})/g)
            return parts.map((part, i) => {
              if (part.match(/\{\{[^}]+\}\}/)) {
                return (
                  <span key={i} style={{ color: '#f97316', fontWeight: '600' }}>
                    {part}
                  </span>
                )
              }
              return <span key={i}>{part}</span>
            })
          })()}
        </div>
      </div>

      {/* Handle de entrada no topo */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#e2e8f0', 
          border: '2px solid white',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%'
        }} 
      />
      
      {/* Handle IF (Verdadeiro) - Lado Esquerdo da Caixa */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id="true" 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#10b981', 
          border: '2px solid white',
          left: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          position: 'absolute',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
      <div style={{
        position: 'absolute',
        left: '-48px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        <span style={{
          fontSize: '8px',
          fontWeight: '900',
          color: '#10b981',
          textTransform: 'uppercase',
          backgroundColor: '#ecfdf5',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap'
        }}>IF</span>
      </div>

      {/* Handle ELSE (Falso) - Lado Direito da Caixa */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false" 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#ef4444', 
          border: '2px solid white',
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
      <div style={{
        position: 'absolute',
        right: '-48px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        <span style={{
          fontSize: '8px',
          fontWeight: '900',
          color: '#ef4444',
          textTransform: 'uppercase',
          backgroundColor: '#fef2f2',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap'
        }}>ELSE</span>
      </div>
    </div>
  )
}

// Node de Loop
export function LoopNode({ data, selected, id }: any) {
  const displayIterations = data.infinite ? '∞ (Infinito)' : `${data.iterations || '10'} ${data.iterations === '1' ? 'iteração' : 'iterações'}`
  const flowName = data.flowName || (data.flowId ? 'Fluxo selecionado' : null)
  
  return (
    <div 
      className={`shadow-xl border-2 min-w-[200px] overflow-hidden relative ${selected ? 'ring-2 ring-purple-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderColor: selected ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.2)',
        borderWidth: selected ? '3px' : '2px',
        boxShadow: selected 
          ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 10px 30px -5px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible',
        transition: 'all 0.2s ease-in-out'
      }}
      title="Clique com botão direito para editar"
    >
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#e2e8f0', 
          border: '2px solid white',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%'
        }} 
      />
      
      <div className="p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
            <Repeat size={20} strokeWidth={2.5} style={{ color: '#9333ea' }} />
          </div>
          <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none">Loop</h4>
        </div>
        {flowName && (
          <div className="mb-3 p-2 bg-purple-50 rounded-lg text-xs text-purple-800 font-medium border border-purple-100">
            {flowName}
          </div>
        )}
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
          {data.infinite ? (
            <>
              <Infinity size={18} strokeWidth={3} style={{ color: '#9333ea' }} />
              <span className="text-xs text-slate-600 font-medium">Infinito</span>
            </>
          ) : (
            <>
              <Hash size={16} strokeWidth={2.5} style={{ color: '#9333ea' }} />
              <span className="text-xs text-slate-600 font-medium">
                {data.iterations || '10'} {data.iterations === '1' ? 'iteração' : 'iterações'}
              </span>
            </>
          )}
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#9333ea', 
          border: '2px solid white',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
    </div>
  )
}

// Node de Comentário
export function CommentNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[200px] max-w-[300px] overflow-hidden relative ${selected ? 'ring-2 ring-amber-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: '#fffbeb', // bg-amber-50
        borderColor: selected ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.3)',
        borderWidth: selected ? '3px' : '2px',
        borderStyle: 'solid',
        boxShadow: selected 
          ? '0 0 0 3px rgba(245, 158, 11, 0.2), 0 10px 30px -5px rgba(245, 158, 11, 0.4), 0 0 20px rgba(245, 158, 11, 0.2)' 
          : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(245, 158, 11, 0.1)',
        transition: 'all 0.2s ease-in-out',
        overflow: 'visible'
      }}
      title="Comentário - apenas documentação, não executa nada"
    >
      
      <div className="p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <MessageSquare size={20} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
          </div>
          <h4 className="font-black text-[10px] uppercase tracking-widest text-amber-700 leading-none">Comentário</h4>
        </div>
        {data.comment && (
          <div className="p-3 bg-white/60 rounded-lg text-sm text-amber-900 leading-relaxed border border-amber-200/50">
            {data.comment}
          </div>
        )}
        {!data.comment && (
          <div className="p-3 bg-white/60 rounded-lg text-xs text-amber-600 italic border border-amber-200/50">
            Clique para adicionar um comentário...
          </div>
        )}
      </div>
      
      {/* Handle de saída que pode ser arrastado para apontar, mas não cria conexão funcional */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="pointer"
        style={{ 
          width: '16px', 
          height: '16px', 
          backgroundColor: '#f59e0b', 
          border: '2px solid white',
          bottom: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          opacity: 0.7,
          cursor: 'grab'
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
      />
    </div>
  )
}

// Node de Delay/Aguardar
export function DelayNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[200px] overflow-hidden relative ${selected ? 'ring-2 ring-cyan-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        borderColor: selected ? 'rgba(6, 182, 212, 0.6)' : 'rgba(6, 182, 212, 0.2)',
        borderWidth: selected ? '3px' : '2px',
        boxShadow: selected 
          ? '0 0 0 3px rgba(6, 182, 212, 0.2), 0 10px 30px -5px rgba(6, 182, 212, 0.5), 0 0 20px rgba(6, 182, 212, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease-in-out',
        overflow: 'visible'
      }}
      title="Clique com botão direito para editar"
    >
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#e2e8f0', 
          border: '2px solid white',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%'
        }} 
      />
      
      <div className="p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 flex-shrink-0">
            <Clock size={20} strokeWidth={2.5} style={{ color: '#06b6d4' }} />
          </div>
          <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none">Aguardar</h4>
        </div>
        <div className="flex items-center justify-center p-3 bg-slate-50 rounded-lg">
          <span className="text-lg text-slate-700 font-bold">
            {(() => {
              const seconds = parseInt(data.duration) || 0
              if (seconds === 0) return '0s'
              if (seconds < 60) return `${seconds}s`
              const minutes = Math.floor(seconds / 60)
              const remainingSeconds = seconds % 60
              if (minutes < 60) {
                if (remainingSeconds === 0) return `${minutes}min`
                return `${minutes}min ${remainingSeconds}s`
              }
              const hours = Math.floor(minutes / 60)
              const remainingMinutes = minutes % 60
              if (remainingMinutes === 0) return `${hours}h`
              return `${hours}h ${remainingMinutes}min`
            })()}
          </span>
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#06b6d4', 
          border: '2px solid white',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
    </div>
  )
}

// Node de Agente
export function AgentNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 group transition-all hover:shadow-blue-500/10 relative ${selected ? 'ring-2 ring-emerald-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: selected ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.2)',
        borderWidth: selected ? '3px' : '2px',
        boxShadow: selected 
          ? '0 0 0 3px rgba(16, 185, 129, 0.2), 0 10px 30px -5px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease-in-out',
        minWidth: '240px',
        maxWidth: '280px',
        width: '260px',
        overflow: 'visible'
      }}
    >
      
      <div className="p-5 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Bot size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Agente</h4>
            <p className="font-bold text-sm text-slate-800 truncate">{data.label || 'Agente IA'}</p>
          </div>
        </div>
      </div>

      {/* Handles (Bolinhas de conexão) estilizadas */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#e2e8f0', 
          border: '2px solid white',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%'
        }} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          width: '12px', 
          height: '12px', 
          backgroundColor: '#10b981', 
          border: '2px solid white',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'absolute',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }} 
      />
    </div>
  )
}
