import React from 'react'
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

/**
 * Conexão com leitura clara e animação discreta (respeita prefers-reduced-motion via globals.css)
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

  let baseColor = '#6478c8'
  let gradientId = 'gradient'
  let gradientSelectedId = 'gradient-selected'

  if (sourceHandle === 'true') {
    baseColor = '#22c55e'
    gradientId = 'gradient-green'
    gradientSelectedId = 'gradient-green-selected'
  } else if (sourceHandle === 'false') {
    baseColor = '#ef4444'
    gradientId = 'gradient-red'
    gradientSelectedId = 'gradient-red-selected'
  } else if (selected) {
    baseColor = '#3b82f6'
  }

  const baseOpacity = selected ? 0.62 : 0.42
  const strokeW = selected ? 2.5 : 2
  const glowStrokeW = selected ? 3 : 2.25

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: strokeW,
          stroke: baseColor,
          opacity: baseOpacity,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />

      <path
        id={`${id}-animated`}
        d={edgePath}
        fill="none"
        strokeWidth={glowStrokeW}
        stroke={selected ? `url(#${gradientSelectedId})` : `url(#${gradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="energy-flow"
        style={{
          opacity: selected ? 0.48 : 0.32,
        }}
      />

      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity={0} />
          <stop offset="35%" stopColor="#3b82f6" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="gradient-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity={0} />
          <stop offset="40%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#86efac" stopOpacity={0} />
          <stop offset="40%" stopColor="#22c55e" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#86efac" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="gradient-green-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bbf7d0" stopOpacity={0} />
          <stop offset="45%" stopColor="#4ade80" stopOpacity={1} />
          <stop offset="100%" stopColor="#bbf7d0" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity={0} />
          <stop offset="40%" stopColor="#ef4444" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#fca5a5" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="gradient-red-selected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fecaca" stopOpacity={0} />
          <stop offset="45%" stopColor="#f87171" stopOpacity={1} />
          <stop offset="100%" stopColor="#fecaca" stopOpacity={0} />
        </linearGradient>
      </defs>
    </>
  )
}
