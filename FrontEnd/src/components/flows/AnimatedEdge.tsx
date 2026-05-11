import React, { useMemo } from 'react'
import { BaseEdge, EdgeProps, Position } from 'reactflow'
import { useTheme } from 'next-themes'

type EdgeTone = {
  base: string
  glow: string
  travel: string
  rgb: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const safe = normalized.length === 3
    ? normalized
        .split('')
        .map((chunk) => `${chunk}${chunk}`)
        .join('')
    : normalized

  const value = Number.parseInt(safe, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `${r}, ${g}, ${b}`
}

function withAlpha(rgb: string, alpha: number) {
  return `rgba(${rgb}, ${alpha})`
}

function toneForHandle(sourceHandle: string | null | undefined, isDark: boolean, selected: boolean): EdgeTone {
  const neutral = isDark
    ? { base: '#8791A3', glow: '#A8B0BE', travel: '#D7DFEC' }
    : { base: '#4A5568', glow: '#64748B', travel: '#F8FAFC' }

  let palette = neutral

  if (sourceHandle === 'true') {
    palette = { base: '#3B7663', glow: '#5A9380', travel: '#E7FFF5' }
  } else if (sourceHandle === 'false') {
    palette = { base: '#8C3B4A', glow: '#AF6170', travel: '#FFF1F4' }
  } else if (sourceHandle === 'default') {
    palette = { base: '#B7794F', glow: '#CC9571', travel: '#FFF5EA' }
  } else if (String(sourceHandle || '').startsWith('case:')) {
    palette = { base: '#6B668D', glow: '#8C88A8', travel: '#F1EEFF' }
  } else if (selected) {
    palette = neutral
  }

  return {
    ...palette,
    rgb: hexToRgb(palette.base),
  }
}

function pointWithOffset(x: number, y: number, position: Position, offset: number) {
  switch (position) {
    case Position.Left:
      return { x: x - offset, y }
    case Position.Right:
      return { x: x + offset, y }
    case Position.Top:
      return { x, y: y - offset }
    case Position.Bottom:
      return { x, y: y + offset }
    default:
      return { x: x + offset, y }
  }
}

function buildAdaptiveBezierPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: Pick<
  EdgeProps,
  'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
>) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const distance = Math.hypot(dx, dy)
  const horizontalBias = Math.abs(dx)
  const verticalBias = Math.abs(dy)

  const baseOffset = clamp(distance * 0.22, 34, 210)
  const horizontalOffset = clamp(horizontalBias * 0.34 + verticalBias * 0.08, 38, 220)
  const verticalOffset = clamp(verticalBias * 0.3 + horizontalBias * 0.07, 34, 190)

  const sourceOffset =
    sourcePosition === Position.Left || sourcePosition === Position.Right
      ? horizontalOffset
      : verticalOffset
  const targetOffset =
    targetPosition === Position.Left || targetPosition === Position.Right
      ? horizontalOffset
      : verticalOffset

  const proximityMultiplier = distance < 180 ? 0.72 : distance > 520 ? 1.14 : 1
  const cp1 = pointWithOffset(sourceX, sourceY, sourcePosition, clamp(sourceOffset * proximityMultiplier, 30, 228))
  const cp2 = pointWithOffset(targetX, targetY, targetPosition, clamp(targetOffset * proximityMultiplier, 30, 228))

  const midX = sourceX + dx / 2
  const midY = sourceY + dy / 2
  const shoulder = clamp(baseOffset * 0.18, 6, 22)

  const c1x = sourcePosition === Position.Top || sourcePosition === Position.Bottom ? cp1.x + (midX - sourceX) * 0.08 : cp1.x
  const c1y = sourcePosition === Position.Left || sourcePosition === Position.Right ? cp1.y + (midY - sourceY) * 0.08 : cp1.y
  const c2x = targetPosition === Position.Top || targetPosition === Position.Bottom ? cp2.x - (targetX - midX) * 0.08 : cp2.x
  const c2y = targetPosition === Position.Left || targetPosition === Position.Right ? cp2.y - (targetY - midY) * 0.08 : cp2.y

  return `M ${sourceX},${sourceY} C ${c1x},${c1y + shoulder} ${c2x},${c2y - shoulder} ${targetX},${targetY}`
}

type AnimatedEdgeProps = EdgeProps & {
  sourceHandle?: string | null
}

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
  interactionWidth = 26,
}: AnimatedEdgeProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const edgePath = useMemo(
    () =>
      buildAdaptiveBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      }),
    [sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY],
  )

  const tone = toneForHandle(sourceHandle, isDark, Boolean(selected))
  const gradientId = useMemo(() => `flow-edge-gradient-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`, [id])
  const travelId = useMemo(() => `flow-edge-travel-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`, [id])

  const baseOpacity = isDark ? (selected ? 0.84 : 0.58) : selected ? 0.92 : 0.76
  const strokeWidth = selected ? 2.6 : 2
  const glowWidth = selected ? 5.5 : 4.25
  const travelWidth = selected ? 3.4 : 2.8

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={withAlpha(tone.rgb, 0.06)} />
          <stop offset="26%" stopColor={withAlpha(tone.rgb, isDark ? 0.2 : 0.18)} />
          <stop offset="62%" stopColor={withAlpha(tone.rgb, isDark ? 0.5 : 0.38)} />
          <stop offset="100%" stopColor={withAlpha(tone.rgb, 0.12)} />
        </linearGradient>
        <linearGradient id={travelId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={withAlpha(tone.rgb, 0)} />
          <stop offset="36%" stopColor={tone.travel} />
          <stop offset="100%" stopColor={withAlpha(tone.rgb, 0)} />
        </linearGradient>
      </defs>

      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={glowWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flow-edge-glow"
        style={{
          opacity: selected ? (isDark ? 0.56 : 0.44) : isDark ? 0.3 : 0.2,
          pointerEvents: 'none',
        }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
        style={{
          ...style,
          strokeWidth,
          stroke: tone.base,
          opacity: baseOpacity,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${travelId})`}
        strokeWidth={travelWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.14 0.92"
        className={selected ? 'flow-edge-travel is-active' : 'flow-edge-travel'}
        style={{
          opacity: selected ? 0.92 : 0.34,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
