import React, { type CSSProperties } from 'react'
import { Handle, type HandleProps } from 'reactflow'
import { cn } from '../ui/utils'
import { getFlowTheme } from './flowDesignTokens'

export type FlowAccent = 'blue' | 'red' | 'orange' | 'purple' | 'amber' | 'cyan' | 'emerald'

export const FLOW_RADIUS = {
  shell: 'rounded-2xl',
  inner: 'rounded-xl',
  inset: 'rounded-lg',
} as const

export const ACCENT_BAR: Record<FlowAccent, { idle: string; selected: string; rgb: string }> = {
  blue: { idle: '#64748b', selected: '#475569', rgb: '100,116,139' },
  red: { idle: '#be123c', selected: '#9f1239', rgb: '190,18,60' },
  orange: { idle: '#b45309', selected: '#92400e', rgb: '180,83,9' },
  purple: { idle: '#7e22ce', selected: '#6b21a8', rgb: '126,34,206' },
  amber: { idle: '#a16207', selected: '#854d0e', rgb: '161,98,7' },
  cyan: { idle: '#0f766e', selected: '#115e59', rgb: '15,118,110' },
  emerald: { idle: '#047857', selected: '#065f46', rgb: '4,120,87' },
}

export function flowAccentVars(accent: FlowAccent): CSSProperties {
  const { idle, selected, rgb } = ACCENT_BAR[accent]
  return {
    '--flow-accent': idle,
    '--flow-accent-sel': selected,
    '--flow-accent-rgb': rgb,
  } as CSSProperties
}

const motionShell =
  'transition-[box-shadow,transform,border-color] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0'

/** Fundos do shell — hex opacos (evitam “vidro” / herança frágil do canvas) */
export const FLOW_NODE_SHELL_BG = {
  light: '#ffffff',
  dark: '#1b1b1f',
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
    'before:pointer-events-none before:absolute before:left-4 before:right-4 before:top-0 before:z-[1] before:h-1 before:rounded-b-full before:bg-[var(--flow-accent)] before:content-[""]',
    selected && [
      'ring-2 ring-[var(--flow-accent-sel)] ring-offset-2',
      isDark ? 'ring-offset-[#1b1b1f]' : 'ring-offset-[#ffffff]',
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
    'before:pointer-events-none before:absolute before:left-4 before:right-4 before:top-0 before:z-[1] before:h-1 before:rounded-b-full before:bg-[var(--flow-accent)] before:content-[""]',
    t.focusRing,
    isDark ? 'focus-visible:ring-offset-[#1b1b1f]' : 'focus-visible:ring-offset-[#ffffff]',
    isDark ? 'hover:border-zinc-500 hover:bg-[#222226]' : 'hover:border-slate-300 hover:bg-slate-50',
    'hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] dark:hover:shadow-[0_16px_38px_-14px_rgba(0,0,0,0.9)]',
    'active:translate-y-px motion-reduce:active:translate-y-0',
  )
}

/** Cartões da biblioteca lateral: mesmo sistema do canvas, raio 2xl (menos “cápsula” que o node no grafo) */
export function paletteRowClassName(isDark: boolean): string {
  return cn(paletteCardClassName(isDark), FLOW_RADIUS.inner)
}

export const ICON_WELL: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'bg-slate-100 text-slate-700', dark: 'bg-zinc-800 text-zinc-100' },
  red: { light: 'bg-rose-50 text-rose-700', dark: 'bg-rose-950 text-rose-100' },
  orange: { light: 'bg-amber-50 text-amber-800', dark: 'bg-amber-950 text-amber-100' },
  purple: { light: 'bg-violet-50 text-violet-700', dark: 'bg-violet-950 text-violet-100' },
  amber: { light: 'bg-yellow-50 text-yellow-800', dark: 'bg-yellow-950 text-yellow-100' },
  cyan: { light: 'bg-teal-50 text-teal-700', dark: 'bg-teal-950 text-teal-100' },
  emerald: { light: 'bg-emerald-50 text-emerald-700', dark: 'bg-emerald-950 text-emerald-100' },
}

/**
 * Título principal do bloco — cores “de código”, legíveis em claro (700–800) e escuro (200–400).
 */
export const FLOW_BLOCK_TITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-slate-900', dark: 'text-zinc-50' },
  red: { light: 'text-slate-900', dark: 'text-zinc-50' },
  orange: { light: 'text-slate-900', dark: 'text-zinc-50' },
  purple: { light: 'text-slate-900', dark: 'text-zinc-50' },
  amber: { light: 'text-slate-900', dark: 'text-zinc-50' },
  cyan: { light: 'text-slate-900', dark: 'text-zinc-50' },
  emerald: { light: 'text-slate-900', dark: 'text-zinc-50' },
}

/** Subtítulo / rótulo secundário — mesmo matiz, um passo mais suave */
export const FLOW_BLOCK_SUBTITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-slate-600', dark: 'text-zinc-300' },
  red: { light: 'text-slate-600', dark: 'text-zinc-300' },
  orange: { light: 'text-slate-600', dark: 'text-zinc-300' },
  purple: { light: 'text-slate-600', dark: 'text-zinc-300' },
  amber: { light: 'text-slate-600', dark: 'text-zinc-300' },
  cyan: { light: 'text-slate-600', dark: 'text-zinc-300' },
  emerald: { light: 'text-slate-600', dark: 'text-zinc-300' },
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
