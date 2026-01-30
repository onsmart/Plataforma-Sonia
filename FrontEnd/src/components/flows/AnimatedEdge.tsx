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
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

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
          stroke: selected ? '#3b82f6' : '#94a3b8',
          opacity: 0.4,
        }}
      />
      
      {/* Linha animada (energia correndo) */}
      <path
        id={`${id}-animated`}
        d={edgePath}
        fill="none"
        strokeWidth={selected ? 4 : 3}
        stroke={selected ? "url(#gradient-selected)" : "url(#gradient)"}
        style={{
          filter: selected ? 'blur(0.5px)' : 'blur(0.3px)',
        }}
        className="energy-flow"
      />
      
      {/* Gradiente para o efeito de energia */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0} />
          <stop offset="20%" stopColor="#3b82f6" stopOpacity={1} />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="80%" stopColor="#3b82f6" stopOpacity={1} />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
        </linearGradient>
        
        {/* Gradiente para edges selecionadas (mais brilhante) */}
        <linearGradient id="gradient-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity={0} />
          <stop offset="20%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="50%" stopColor="#93c5fd" stopOpacity={1} />
          <stop offset="80%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
        </linearGradient>
      </defs>
    </>
  )
}
