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
  surfaceApp: 'bg-[#F7F8FA]',
  surfaceHeader: 'bg-white/60',
  surfaceNode: 'bg-white/60',
  surfaceInner: 'bg-white/38',
  surfaceChip: 'bg-white/72',
  borderSubtle: 'border-[#E0E4E8]/90',
  borderStrong: 'border-[#E0E4E8]',
  textPrimary: 'text-[#1A202C]',
  textSecondary: 'text-[#2D3748]',
  textMuted: 'text-[#4A5568]/90',
  textEyebrow: 'text-[#4A5568]',
  shadowNode: 'shadow-[0_34px_84px_-40px_rgba(74,85,104,0.24)]',
  shadowNodeHover: 'shadow-[0_40px_108px_-42px_rgba(74,85,104,0.28)]',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-white/50',
  focusRingOffset: 'focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F8FA]',
  labelIf:
    'rounded-full border border-white/50 bg-[#3B7663] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_14px_34px_-18px_rgba(59,118,99,0.55)]',
  labelElse:
    'rounded-full border border-white/50 bg-[#8C3B4A] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_14px_34px_-18px_rgba(140,59,74,0.52)]',
  badgeModel:
    'rounded-full border border-white/60 bg-[#4A5B83]/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#32415f] shadow-[0_12px_28px_-18px_rgba(74,91,131,0.3)]',
  badgeAccount:
    'rounded-full border border-white/60 bg-[#3B7663]/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#275244] shadow-[0_12px_28px_-18px_rgba(59,118,99,0.3)]',
  badgeDecision:
    'inline-flex w-fit rounded-full border border-white/55 bg-white/52 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1A202C] backdrop-blur-md',
  badgeExpression:
    'inline-flex w-fit rounded-full border border-white/55 bg-white/52 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1A202C] backdrop-blur-md',
  borderPanel: 'border-r border-[#E0E4E8]',
  borderHeader: 'border-b border-[#E0E4E8]',
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
  neutralLight: '#94A3B8',
} as const

export const FLOW_DRAWER_SHELL_HEX = {
  light: 'rgba(247, 248, 250, 0.76)',
  dark: 'rgba(10, 10, 11, 0.72)',
} as const

export const FLOW_DRAWER_HEADER_HEX = {
  light: 'rgba(255, 255, 255, 0.62)',
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
    backdropFilter: 'blur(15px) saturate(140%)',
    WebkitBackdropFilter: 'blur(15px) saturate(140%)',
  }
}

export function flowDrawerHeaderStyle(isDark: boolean): {
  backgroundColor: string
  backdropFilter: string
  WebkitBackdropFilter: string
} {
  return {
    backgroundColor: isDark ? FLOW_DRAWER_HEADER_HEX.dark : FLOW_DRAWER_HEADER_HEX.light,
    backdropFilter: 'blur(15px) saturate(138%)',
    WebkitBackdropFilter: 'blur(15px) saturate(138%)',
  }
}
