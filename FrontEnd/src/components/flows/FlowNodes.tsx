import React from 'react'
import { Handle, Position } from 'reactflow'
import { 
  Play, Square, GitBranch, Repeat, 
  Code, Calendar, Bot, Zap 
} from 'lucide-react'
import { Badge } from '../ui/badge'

// Node de Início
export function StartNode({ data, selected }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[180px] overflow-hidden relative ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'rgba(59, 130, 246, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible'
      }}
    >
      
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Play size={20} strokeWidth={2.5} style={{ color: '#2563eb' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Início</h4>
            {data.label && data.label !== 'Início' && (
              <p className="font-bold text-sm text-slate-800 truncate">{data.label}</p>
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
      className={`shadow-xl border-2 min-w-[180px] overflow-hidden relative ${selected ? 'ring-2 ring-red-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible'
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
      
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <Square size={20} strokeWidth={2.5} style={{ color: '#dc2626' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Fim</h4>
            {data.label && data.label !== 'Fim' && (
              <p className="font-bold text-sm text-slate-800 truncate">{data.label}</p>
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
        borderColor: 'rgba(249, 115, 22, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(249, 115, 22, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
        overflow: 'visible'
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
        
        <p className="text-xs font-mono bg-slate-900 text-orange-300 p-3 rounded-xl shadow-inner break-all">
          {data.condition || "{{mensagem}} contém 'carlos'"}
        </p>
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
        borderColor: 'rgba(139, 92, 246, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(139, 92, 246, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
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
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Repeat size={20} strokeWidth={2.5} style={{ color: '#9333ea' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Loop</h4>
          </div>
        </div>
        {flowName && (
          <div className="mb-3 p-2 bg-purple-50 rounded-lg text-xs text-purple-800 font-medium border border-purple-100">
            {flowName}
          </div>
        )}
        <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-600">
          {displayIterations}
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

// Node de Código
export function CodeNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[200px] overflow-hidden relative ${selected ? 'ring-2 ring-emerald-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
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
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Code size={20} strokeWidth={2.5} style={{ color: '#10b981' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Código</h4>
          </div>
        </div>
        {data.code && (
          <div className="p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800 font-mono border border-emerald-100 break-all">
            {data.code.substring(0, 50)}...
          </div>
        )}
      </div>
      
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

// Node de Delay/Aguardar
export function DelayNode({ data, selected, id }: any) {
  return (
    <div 
      className={`shadow-xl border-2 min-w-[200px] overflow-hidden relative ${selected ? 'ring-2 ring-cyan-400' : ''}`}
      style={{
        borderRadius: '1.5rem',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        borderColor: 'rgba(6, 182, 212, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(6, 182, 212, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
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
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
            <Calendar size={20} strokeWidth={2.5} style={{ color: '#06b6d4' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-1">Aguardar</h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            data-slot="input"
            className="text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-16 min-w-0 rounded-lg border px-2 py-1 text-sm bg-slate-50 transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-cyan-300 focus-visible:ring-cyan-300/50 focus-visible:ring-[3px] text-center"
            min="1"
            max="9999"
            placeholder="10"
            value={data.duration || ''}
            readOnly
            onClick={(e) => e.stopPropagation()}
          />
          <label className="text-xs text-slate-600 font-medium whitespace-nowrap">segundos</label>
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
        borderColor: 'rgba(16, 185, 129, 0.2)',
        boxShadow: selected ? '0 10px 25px -5px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
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
