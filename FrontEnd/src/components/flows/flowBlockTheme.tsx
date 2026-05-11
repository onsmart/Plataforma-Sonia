import React, { type CSSProperties } from 'react'
import { Handle, type HandleProps } from 'reactflow'
import { cn } from '../ui/utils'
import { getFlowTheme } from './flowDesignTokens'

export type FlowAccent =
  | 'blue'
  | 'red'
  | 'orange'
  | 'purple'
  | 'amber'
  | 'cyan'
  | 'emerald'
  | 'indigo'
  | 'rose'
  | 'teal'
  | 'sky'
  | 'green'

export const FLOW_RADIUS = {
  shell: 'rounded-2xl',
  inner: 'rounded-xl',
  inset: 'rounded-lg',
} as const

export const ACCENT_BAR: Record<FlowAccent, { idle: string; selected: string; rgb: string }> = {
  blue: { idle: '#5A78FF', selected: '#4662E5', rgb: '90,120,255' },
  red: { idle: '#E1586A', selected: '#C64355', rgb: '225,88,106' },
  orange: { idle: '#F59A45', selected: '#DC7E2C', rgb: '245,154,69' },
  purple: { idle: '#8C63F8', selected: '#7448EE', rgb: '140,99,248' },
  amber: { idle: '#F1B547', selected: '#D99820', rgb: '241,181,71' },
  cyan: { idle: '#33BEE3', selected: '#149FC7', rgb: '51,190,227' },
  emerald: { idle: '#2DC58D', selected: '#18A876', rgb: '45,197,141' },
  indigo: { idle: '#646DFF', selected: '#4E56EA', rgb: '100,109,255' },
  rose: { idle: '#F05A93', selected: '#D83F79', rgb: '240,90,147' },
  teal: { idle: '#2AB9AA', selected: '#189B8E', rgb: '42,185,170' },
  sky: { idle: '#49A7FF', selected: '#2F8AE4', rgb: '73,167,255' },
  green: { idle: '#3FCF67', selected: '#28B34F', rgb: '63,207,103' },
}

export function flowAccentVars(accent: FlowAccent): CSSProperties {
  const { idle, selected, rgb } = ACCENT_BAR[accent]
  return {
    '--flow-accent': idle,
    '--flow-accent-sel': selected,
    '--flow-accent-rgb': rgb,
    '--flow-accent-glow-soft': `rgba(${rgb}, 0.2)`,
    '--flow-accent-glow-strong': `rgba(${rgb}, 0.42)`,
  } as CSSProperties
}

const motionShell =
  'transition-[box-shadow,transform,border-color,filter,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0'

/** Fundos do shell — hex opacos (evitam “vidro” / herança frágil do canvas) */
export const FLOW_NODE_SHELL_BG = {
  light: 'rgba(16, 23, 36, 0.92)',
  dark: 'rgba(248, 250, 252, 0.78)',
} as const

export function flowNodeShellClassName(isDark: boolean, selected: boolean): string {
  const t = getFlowTheme(!isDark)
  return cn(
    'flow-node-root flow-node-shell flow-premium-shell group/node relative isolate overflow-visible',
    FLOW_RADIUS.shell,
    motionShell,
    'border border-solid',
    t.surfaceNode,
    t.textPrimary,
    t.borderStrong,
    t.shadowNode,
    'supports-[backdrop-filter:blur(0px)]:bg-white/10',
    selected && 'flow-premium-selected',
    selected && [
      'ring-2 ring-[var(--flow-accent-sel)] ring-offset-2',
      isDark ? 'ring-offset-[#0a0a0b]' : 'ring-offset-[#F7F8FA]',
    ],
  )
}

export function paletteCardClassName(isDark: boolean): string {
  const t = getFlowTheme(!isDark)
  return cn(
    'flow-palette-root flow-palette-card flow-premium-card group/palette relative isolate w-full min-w-0 overflow-hidden text-left outline-none',
    FLOW_RADIUS.shell,
    'border border-solid',
    motionShell,
    t.surfaceNode,
    t.textPrimary,
    t.borderStrong,
    t.shadowNode,
    t.focusRing,
    isDark ? 'focus-visible:ring-offset-[#0a0a0b]' : 'focus-visible:ring-offset-[#F7F8FA]',
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
  indigo: { light: 'bg-indigo-50 text-indigo-700', dark: 'bg-indigo-950 text-indigo-100' },
  rose: { light: 'bg-rose-50 text-rose-700', dark: 'bg-rose-950 text-rose-100' },
  teal: { light: 'bg-teal-50 text-teal-700', dark: 'bg-teal-950 text-teal-100' },
  sky: { light: 'bg-sky-50 text-sky-700', dark: 'bg-sky-950 text-sky-100' },
  green: { light: 'bg-green-50 text-green-700', dark: 'bg-green-950 text-green-100' },
}

/**
 * Título principal do bloco — cores “de código”, legíveis em claro (700–800) e escuro (200–400).
 */
export const FLOW_BLOCK_TITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  red: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  orange: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  purple: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  amber: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  cyan: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  emerald: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  indigo: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  rose: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  teal: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  sky: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
  green: { light: 'text-[#1A202C]', dark: 'text-zinc-50' },
}

/** Subtítulo / rótulo secundário — mesmo matiz, um passo mais suave */
export const FLOW_BLOCK_SUBTITLE: Record<FlowAccent, { light: string; dark: string }> = {
  blue: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  red: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  orange: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  purple: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  amber: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  cyan: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  emerald: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  indigo: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  rose: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  teal: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  sky: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
  green: { light: 'text-[#4A5568]', dark: 'text-zinc-300' },
}

export function flowBlockTitleClass(accent: FlowAccent, isDark: boolean): string {
  const row = FLOW_BLOCK_TITLE[accent]
  return isDark ? row.light : row.dark
}

export function flowBlockSubtitleClass(accent: FlowAccent, isDark: boolean): string {
  const row = FLOW_BLOCK_SUBTITLE[accent]
  return isDark ? row.light : row.dark
}

export function nodeShellBorderRgb(isDark: boolean): string {
  return isDark ? 'rgb(224 228 232)' : 'rgb(51 65 85)'
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
  const tone = ICON_WELL[accent][isDark ? 'dark' : 'light']
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
      style={{
        backgroundImage: isDark
          ? 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(var(--flow-accent-rgb),0.18) 48%, rgba(255,255,255,0.04) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(var(--flow-accent-rgb),0.14) 52%, rgba(255,255,255,0.78) 100%)',
        boxShadow: isDark
          ? 'inset 0 0.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.28), 0 18px 34px -24px rgba(var(--flow-accent-rgb),0.78), 0 0 0 1px rgba(255,255,255,0.06)'
          : 'inset 0 0.5px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(148,163,184,0.12), 0 16px 28px -24px rgba(var(--flow-accent-rgb),0.42), 0 0 0 1px rgba(255,255,255,0.62)',
        filter: 'drop-shadow(0 10px 22px rgba(var(--flow-accent-rgb),0.12))',
      }}
    >
      {children}
    </div>
  )
}

type FlowHandleProps = Omit<HandleProps, 'className'> & {
  isDark: boolean
  className?: string
  fill: string
  style?: CSSProperties
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>
}

export function FlowHandle({ isDark, fill, className, style, ...rest }: FlowHandleProps) {
  const ring = nodeShellBorderRgb(isDark)
  return (
    <Handle
      {...rest}
      className={cn(
        'flow-handle !h-4 !w-4 !min-h-[16px] !min-w-[16px] !rounded-full opacity-0',
        'shadow-sm',
        'transition-[transform,opacity,filter,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
        'hover:scale-110 motion-reduce:hover:scale-100',
        className,
      )}
      style={{
        ...style,
        backgroundColor: fill,
        border: `2px solid ${ring}`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 0 0 6px rgba(255,255,255,0.03), 0 0 24px -6px ${fill}`,
        zIndex: 6,
      }}
    />
  )
}

export { getFlowTheme, FLOW_HANDLE } from './flowDesignTokens'
export type { FlowThemeTokens, FlowThemeMode } from './flowDesignTokens'
