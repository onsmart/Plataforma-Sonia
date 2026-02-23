import React from 'react'
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

/**
 * Edge animado com efeito de "energia correndo" / "sabre de luz"
 * Mostra o fluxo de dados através das conexões
 */
export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  sourceHandle,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Define cores baseadas no sourceHandle (para if-else)
  let baseColor = '#3b82f6' // Azul padrão (cabos de energia)
  let gradientId = 'gradient'
  let gradientSelectedId = 'gradient-selected'
  
  if (sourceHandle === 'true') {
    // Verde para IF (verdadeiro)
    baseColor = '#22c55e'
    gradientId = 'gradient-green'
    gradientSelectedId = 'gradient-green-selected'
  } else if (sourceHandle === 'false') {
    // Vermelho para ELSE (falso)
    baseColor = '#ef4444'
    gradientId = 'gradient-red'
    gradientSelectedId = 'gradient-red-selected'
  } else if (selected) {
    baseColor = '#3b82f6' // Azul quando selecionado
  }

  return (
    <>
      {/* Linha base (mais escura, sempre visível) */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: baseColor,
          opacity: 0.3,
          filter: selected ? 'drop-shadow(0 0 4px ' + baseColor + ')' : 'none',
        }}
      />
      
      {/* Linha animada (energia correndo) */}
      <path
        id={`${id}-animated`}
        d={edgePath}
        fill="none"
        strokeWidth={selected ? 4 : 3}
        stroke={selected ? `url(#${gradientSelectedId})` : `url(#${gradientId})`}
        style={{
          filter: selected 
            ? `blur(0.5px) drop-shadow(0 0 6px ${baseColor}) drop-shadow(0 0 3px ${baseColor})`
            : `blur(0.3px) drop-shadow(0 0 3px ${baseColor})`,
        }}
        className="energy-flow"
      />
      
      {/* Gradientes para o efeito de energia */}
      <defs>
        {/* Gradiente azul padrão */}
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0} />
          <stop offset="20%" stopColor="#3b82f6" stopOpacity={1} />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="80%" stopColor="#3b82f6" stopOpacity={1} />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente azul selecionado */}
        <linearGradient id="gradient-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity={0} />
          <stop offset="20%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="50%" stopColor="#93c5fd" stopOpacity={1} />
          <stop offset="80%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente verde para IF (verdadeiro) */}
        <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#86efac" stopOpacity={0} />
          <stop offset="20%" stopColor="#22c55e" stopOpacity={1} />
          <stop offset="50%" stopColor="#4ade80" stopOpacity={1} />
          <stop offset="80%" stopColor="#22c55e" stopOpacity={1} />
          <stop offset="100%" stopColor="#86efac" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente verde selecionado */}
        <linearGradient id="gradient-green-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bbf7d0" stopOpacity={0} />
          <stop offset="20%" stopColor="#4ade80" stopOpacity={1} />
          <stop offset="50%" stopColor="#86efac" stopOpacity={1} />
          <stop offset="80%" stopColor="#4ade80" stopOpacity={1} />
          <stop offset="100%" stopColor="#bbf7d0" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente vermelho para ELSE (falso) */}
        <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity={0} />
          <stop offset="20%" stopColor="#ef4444" stopOpacity={1} />
          <stop offset="50%" stopColor="#f87171" stopOpacity={1} />
          <stop offset="80%" stopColor="#ef4444" stopOpacity={1} />
          <stop offset="100%" stopColor="#fca5a5" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente vermelho selecionado */}
        <linearGradient id="gradient-red-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fecaca" stopOpacity={0} />
          <stop offset="20%" stopColor="#f87171" stopOpacity={1} />
          <stop offset="50%" stopColor="#fca5a5" stopOpacity={1} />
          <stop offset="80%" stopColor="#f87171" stopOpacity={1} />
          <stop offset="100%" stopColor="#fecaca" stopOpacity={0} />
        </linearGradient>
      </defs>
    </>
  )
}
