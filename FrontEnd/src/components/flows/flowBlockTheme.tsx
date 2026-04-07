import React, { type CSSProperties } from 'react'
import { Handle, type HandleProps } from 'reactflow'
import { cn } from '../ui/utils'
import { getFlowTheme } from './flowDesignTokens'

export type FlowAccent = 'blue' | 'red' | 'orange' | 'purple' | 'amber' | 'cyan' | 'emerald'

export const FLOW_RADIUS = {
  shell: 'rounded-3xl',
  inner: 'rounded-2xl',
  inset: 'rounded-xl',
} as const

export const ACCENT_BAR: Record<FlowAccent, { idle: string; selected: string }> = {
  blue: { idle: '#3b82f6', selected: '#2563eb' },
  red: { idle: '#f87171', selected: '#ef4444' },
  orange: { idle: '#fb923c', selected: '#ea580c' },
  purple: { idle: '#a78bfa', selected: '#7c3aed' },
  amber: { idle: '#fbbf24', selected: '#d97706' },
  cyan: { idle: '#22d3ee', selected: '#0891b2' },
  emerald: { idle: '#34d399', selected: '#10b981' },
}

export function flowAccentVars(accent: FlowAccent): CSSProperties {
  const { idle, selected } = ACCENT_BAR[accent]
  return {
    '--flow-accent': idle,
    '--flow-accent-sel': selected,
  } as CSSProperties
}

const motionShell =
  'transition-[box-shadow,transform,border-color] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0'

/** Fundos do shell — hex opacos (evitam “vidro” / herança frágil do canvas) */
export const FLOW_NODE_SHELL_BG = {
  light: '#ffffff',
  dark: '#18181b',
} as const

export function flowNodeShellClassName(isDark: boolean, selected: boolean): string {
  const t = getFlowTheme(isDark)
  return cn(
    'flow-node-root flow-node-shell group/node relative overflow-visible',
    FLOW_RADIUS.shell,
    motionShell,
    'border border-solid',
    t.surfaceNode,
    t.textPrimary,
    t.borderStrong,
    t.shadowNode,
    'before:pointer-events-none before:absolute before:left-5 before:right-5 before:top-0 before:z-[1] before:h-0.5 before:rounded-full before:bg-[var(--flow-accent)] before:content-[""]',
    selected && [
      'ring-2 ring-[var(--flow-accent-sel)] ring-offset-2',
      isDark ? 'ring-offset-[#18181b]' : 'ring-offset-[#ffffff]',
      'before:bg-[var(--flow-accent-sel)]',
    ],
  )
}

export function paletteCardClassName(isDark: boolean): string {
  const t = getFlowTheme(isDark)
  return cn(
    'flow-palette-root flow-palette-card group/palette relative w-full min-w-0 overflow-hidden text-left outline-none',
    FLOW_RADIUS.shell,
    'border border-solid',
    motionShell,
    t.surfaceNode,
    t.textPrimary,
    t.borderStrong,
    t.shadowNode,
    'before:pointer-events-none before:absolute before:left-5 before:right-5 before:top-0 before:z-[1] before:h-0.5 before:rounded-full before:bg-[var(--flow-accent)] before:content-[""]',
    t.focusRing,
    isDark ? 'focus-visible:ring-offset-[#18181b]' : 'focus-visible:ring-offset-[#ffffff]',
    isDark ? 'hover:border-zinc-500' : 'hover:border-slate-300',
    'hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.16)] dark:hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.65)]',
    'active:scale-[0.995] motion-reduce:active:scale-100',
  )
}

/** Cartões da biblioteca lateral: mesmo sistema do canvas, raio 2xl (menos “cápsula” que o node no grafo) */
export function paletteRowClassName(isDark: boolean): string {
  return cn(paletteCardClassName(isDark), FLOW_RADIUS.inner)
}

export const ICON_WELL: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'bg-[#dbeafe] text-[#1e3a8a]', dark: 'bg-[#27272a] text-blue-300' },
  red: { light: 'bg-[#ffe4e6] text-[#9f1239]', dark: 'bg-[#27272a] text-rose-300' },
  orange: { light: 'bg-[#ffedd5] text-[#9a3412]', dark: 'bg-[#27272a] text-orange-300' },
  purple: { light: 'bg-[#ede9fe] text-[#5b21b6]', dark: 'bg-[#27272a] text-violet-300' },
  amber: { light: 'bg-[#fef3c7] text-[#78350f]', dark: 'bg-[#27272a] text-amber-200' },
  cyan: { light: 'bg-[#cffafe] text-[#155e75]', dark: 'bg-[#27272a] text-cyan-300' },
  emerald: { light: 'bg-[#d1fae5] text-[#065f46]', dark: 'bg-[#27272a] text-emerald-300' },
}

/**
 * Título principal do bloco — cores “de código”, legíveis em claro (700–800) e escuro (200–400).
 */
export const FLOW_BLOCK_TITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-blue-800', dark: 'text-blue-300' },
  red: { light: 'text-rose-700', dark: 'text-rose-300' },
  orange: { light: 'text-orange-700', dark: 'text-orange-300' },
  purple: { light: 'text-violet-700', dark: 'text-violet-300' },
  amber: { light: 'text-amber-800', dark: 'text-amber-200' },
  cyan: { light: 'text-cyan-800', dark: 'text-cyan-300' },
  emerald: { light: 'text-emerald-700', dark: 'text-emerald-300' },
}

/** Subtítulo / rótulo secundário — mesmo matiz, um passo mais suave */
export const FLOW_BLOCK_SUBTITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-blue-700', dark: 'text-blue-400' },
  red: { light: 'text-rose-600', dark: 'text-rose-400' },
  orange: { light: 'text-orange-600', dark: 'text-orange-400' },
  purple: { light: 'text-violet-600', dark: 'text-violet-400' },
  amber: { light: 'text-amber-700', dark: 'text-amber-300' },
  cyan: { light: 'text-cyan-700', dark: 'text-cyan-400' },
  emerald: { light: 'text-emerald-600', dark: 'text-emerald-400' },
}

export function flowBlockTitleClass(accent: FlowAccent, isDark: boolean): string {
  const row = FLOW_BLOCK_TITLE[accent]
  return isDark ? row.dark : row.light
}

export function flowBlockSubtitleClass(accent: FlowAccent, isDark: boolean): string {
  const row = FLOW_BLOCK_SUBTITLE[accent]
  return isDark ? row.dark : row.light
}

export function nodeShellBorderRgb(isDark: boolean): string {
  return isDark ? 'rgb(24 24 27)' : 'rgb(255 255 255)'
}

export function NodeIconWell({
  accent,
  isDark,
  children,
  round = false,
  size = 'md',
}: {
  accent: FlowAccent
  isDark: boolean
  children: React.ReactNode
  round?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const tone = isDark ? ICON_WELL[accent].dark : ICON_WELL[accent].light
  return (
    <div
      className={cn(
        'flow-node-icon-well flex shrink-0 items-center justify-center border-0 shadow-none ring-0 outline-none',
        '[&_svg]:shrink-0 [&_svg]:overflow-visible',
        size === 'sm' && 'h-10 w-10',
        size === 'md' && 'h-11 w-11',
        size === 'lg' && 'h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]',
        round ? 'rounded-full' : FLOW_RADIUS.inner,
        tone,
      )}
    >
      {children}
    </div>
  )
}

type FlowHandleProps = Omit<HandleProps, 'className'> & {
  isDark: boolean
  className?: string
  fill: string
}

export function FlowHandle({ isDark, fill, className, style, ...rest }: FlowHandleProps) {
  const ring = nodeShellBorderRgb(isDark)
  return (
    <Handle
      {...rest}
      className={cn(
        'flow-handle !h-3.5 !w-3.5 !min-h-[14px] !min-w-[14px] !rounded-full',
        'shadow-sm',
        'transition-transform duration-200 ease-out motion-reduce:transition-none',
        'hover:scale-110 motion-reduce:hover:scale-100',
        className,
      )}
      style={{
        ...style,
        backgroundColor: fill,
        border: `2px solid ${ring}`,
      }}
    />
  )
}

export { getFlowTheme, FLOW_HANDLE } from './flowDesignTokens'
export type { FlowThemeTokens, FlowThemeMode } from './flowDesignTokens'
