export type FlowThemeMode = 'light' | 'dark'

export interface FlowThemeTokens {
  surfaceApp: string
  surfaceHeader: string
  surfaceNode: string
  surfaceInner: string
  surfaceChip: string
  borderPanel: string
  borderHeader: string
  borderSubtle: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textEyebrow: string
  shadowNode: string
  shadowNodeHover: string
  focusRing: string
  focusRingOffset: string
  labelIf: string
  labelElse: string
  badgeModel: string
  badgeAccount: string
  badgeDecision: string
  badgeExpression: string
}

const light: FlowThemeTokens = {
  surfaceApp: 'bg-[#eef2f7]',
  surfaceHeader: 'bg-white/70',
  surfaceNode: 'bg-white/70',
  surfaceInner: 'bg-white/10',
  surfaceChip: 'bg-white/65',
  borderSubtle: 'border-white/10',
  borderStrong: 'border-white/14',
  textPrimary: 'text-slate-950',
  textSecondary: 'text-slate-800',
  textMuted: 'text-slate-600/90',
  textEyebrow: 'text-slate-600',
  shadowNode: 'shadow-[0_28px_80px_-44px_rgba(15,23,42,0.35)]',
  shadowNodeHover: 'shadow-[0_36px_96px_-44px_rgba(15,23,42,0.4)]',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-white/40',
  focusRingOffset: 'focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef2f7]',
  labelIf:
    'rounded-full border border-white/15 bg-emerald-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_-14px_rgba(16,185,129,0.75)]',
  labelElse:
    'rounded-full border border-white/15 bg-rose-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_10px_30px_-14px_rgba(244,63,94,0.75)]',
  badgeModel:
    'rounded-full border border-white/12 bg-sky-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-sky-100 shadow-[0_12px_28px_-18px_rgba(14,165,233,0.65)]',
  badgeAccount:
    'rounded-full border border-white/12 bg-emerald-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-100 shadow-[0_12px_28px_-18px_rgba(16,185,129,0.65)]',
  badgeDecision:
    'inline-flex w-fit rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-900 backdrop-blur-md',
  badgeExpression:
    'inline-flex w-fit rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-900 backdrop-blur-md',
  borderPanel: 'border-r border-white/10',
  borderHeader: 'border-b border-white/10',
}

const dark: FlowThemeTokens = {
  surfaceApp: 'bg-[#0a0a0b]',
  surfaceHeader: 'bg-[#0f1012]/72',
  surfaceNode: 'bg-[#101114]/65',
  surfaceInner: 'bg-white/[0.045]',
  surfaceChip: 'bg-white/[0.055]',
  borderSubtle: 'border-white/[0.09]',
  borderStrong: 'border-white/[0.12]',
  textPrimary: 'text-zinc-50',
  textSecondary: 'text-zinc-100',
  textMuted: 'text-zinc-300/85',
  textEyebrow: 'text-zinc-400',
  shadowNode: 'shadow-[0_26px_84px_-42px_rgba(0,0,0,0.95)]',
  shadowNodeHover: 'shadow-[0_40px_110px_-46px_rgba(0,0,0,1)]',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-white/25',
  focusRingOffset: 'focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]',
  labelIf:
    'rounded-full border border-white/10 bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-50 shadow-[0_10px_32px_-16px_rgba(16,185,129,0.88)] backdrop-blur-md',
  labelElse:
    'rounded-full border border-white/10 bg-rose-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-rose-50 shadow-[0_10px_32px_-16px_rgba(244,63,94,0.88)] backdrop-blur-md',
  badgeModel:
    'rounded-full border border-white/10 bg-sky-500/16 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-sky-50 shadow-[0_14px_32px_-18px_rgba(14,165,233,0.72)] backdrop-blur-md',
  badgeAccount:
    'rounded-full border border-white/10 bg-emerald-500/16 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-50 shadow-[0_14px_32px_-18px_rgba(16,185,129,0.72)] backdrop-blur-md',
  badgeDecision:
    'inline-flex w-fit rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-100 backdrop-blur-md',
  badgeExpression:
    'inline-flex w-fit rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-100 backdrop-blur-md',
  borderPanel: 'border-r border-white/[0.08]',
  borderHeader: 'border-b border-white/[0.08]',
}

export function getFlowTheme(isDark: boolean): FlowThemeTokens {
  return isDark ? dark : light
}

export const FLOW_HANDLE = {
  neutralDark: '#5f6472',
  neutralLight: '#8c95a6',
} as const

export const FLOW_DRAWER_SHELL_HEX = {
  light: 'rgba(244, 247, 251, 0.72)',
  dark: 'rgba(10, 10, 11, 0.72)',
} as const

export const FLOW_DRAWER_HEADER_HEX = {
  light: 'rgba(255, 255, 255, 0.66)',
  dark: 'rgba(15, 16, 18, 0.6)',
} as const

export function flowDrawerShellStyle(isDark: boolean): {
  backgroundColor: string
  opacity: number
  backdropFilter: string
  WebkitBackdropFilter: string
} {
  return {
    backgroundColor: isDark ? FLOW_DRAWER_SHELL_HEX.dark : FLOW_DRAWER_SHELL_HEX.light,
    opacity: 1,
    backdropFilter: 'blur(18px) saturate(145%)',
    WebkitBackdropFilter: 'blur(18px) saturate(145%)',
  }
}

export function flowDrawerHeaderStyle(isDark: boolean): {
  backgroundColor: string
  backdropFilter: string
  WebkitBackdropFilter: string
} {
  return {
    backgroundColor: isDark ? FLOW_DRAWER_HEADER_HEX.dark : FLOW_DRAWER_HEADER_HEX.light,
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  }
}
