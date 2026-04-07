/**
 * Tokens semânticos do editor de fluxo — light / dark explícitos.
 * Regra: superfícies principais e textos usam cores sólidas (sem opacity no wrapper do conteúdo).
 */

export type FlowThemeMode = 'light' | 'dark'

export interface FlowThemeTokens {
  /** Fundo do painel lateral (biblioteca) */
  surfaceApp: string
  /** Cabeçalho do sheet */
  surfaceHeader: string
  /** Cartão node / item da paleta */
  surfaceNode: string
  /** Área interna (código, métricas) */
  surfaceInner: string
  /** Chip de categoria na sidebar */
  surfaceChip: string
  /** Borda direita do sheet da biblioteca */
  borderPanel: string
  /** Borda inferior do cabeçalho do sheet */
  borderHeader: string
  /** Borda sutil */
  borderSubtle: string
  /** Borda um pouco mais visível */
  borderStrong: string
  /** Título / corpo principal */
  textPrimary: string
  /** Subtítulo */
  textSecondary: string
  /** Meta / descrição — ainda legível */
  textMuted: string
  /** Eyebrow (DECISÃO, EXPRESSÃO) */
  textEyebrow: string
  /** Sombra do node/card */
  shadowNode: string
  /** Hover sombra */
  shadowNodeHover: string
  /** Foco teclado — offset combina com surfaceNode */
  focusRing: string
  focusRingOffset: string
  /** Labels de ramo — fundo e texto opacos, alto contraste */
  labelIf: string
  labelElse: string
  /** Badges (Modelo, Conta) */
  badgeModel: string
  badgeAccount: string
  badgeDecision: string
  badgeExpression: string
}

const light: FlowThemeTokens = {
  surfaceApp: 'bg-slate-100',
  surfaceHeader: 'bg-white',
  surfaceNode: 'bg-[#ffffff]',
  surfaceInner: 'bg-[#f1f5f9]',
  surfaceChip: 'bg-white',
  borderSubtle: 'border-slate-200',
  borderStrong: 'border-slate-300',
  /** Títulos dos blocos no claro: preto puro para contraste máximo no canvas */
  textPrimary: 'text-black',
  textSecondary: 'text-slate-800',
  textMuted: 'text-slate-600',
  textEyebrow: 'text-slate-700',
  shadowNode: 'shadow-[0_4px_16px_-4px_rgba(15,23,42,0.12)]',
  shadowNodeHover: 'shadow-[0_8px_24px_-6px_rgba(15,23,42,0.16)]',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-blue-600',
  focusRingOffset: 'focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff]',
  // IF/ELSE: fundo escuro + texto branco — sempre legível no canvas claro
  labelIf:
    'rounded-full border-2 border-white bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md',
  labelElse:
    'rounded-full border-2 border-white bg-rose-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md',
  badgeModel: 'rounded-full bg-sky-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white',
  badgeAccount: 'rounded-full bg-emerald-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white',
  badgeDecision:
    'inline-flex w-fit rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-black',
  badgeExpression:
    'inline-flex w-fit rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-black',
  borderPanel: 'border-r border-slate-200',
  borderHeader: 'border-b border-slate-200',
}

const dark: FlowThemeTokens = {
  surfaceApp: 'bg-zinc-950',
  surfaceHeader: 'bg-zinc-900',
  surfaceNode: 'bg-[#18181b]',
  surfaceInner: 'bg-[#09090b]',
  surfaceChip: 'bg-zinc-800',
  borderSubtle: 'border-zinc-700',
  borderStrong: 'border-zinc-600',
  textPrimary: 'text-zinc-50',
  textSecondary: 'text-zinc-200',
  textMuted: 'text-zinc-400',
  textEyebrow: 'text-zinc-400',
  shadowNode: 'shadow-[0_8px_28px_-6px_rgba(0,0,0,0.55)]',
  shadowNodeHover: 'shadow-[0_12px_36px_-8px_rgba(0,0,0,0.65)]',
  focusRing: 'focus-visible:ring-2 focus-visible:ring-blue-500',
  focusRingOffset: 'focus-visible:ring-offset-2 focus-visible:ring-offset-[#18181b]',
  labelIf:
    'rounded-full border border-emerald-950 bg-emerald-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md',
  labelElse:
    'rounded-full border border-red-950 bg-red-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md',
  badgeModel: 'rounded-full bg-sky-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white',
  badgeAccount: 'rounded-full bg-emerald-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white',
  badgeDecision:
    'inline-flex w-fit rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-100',
  badgeExpression:
    'inline-flex w-fit rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-200',
  borderPanel: 'border-r border-zinc-700',
  borderHeader: 'border-b border-zinc-700',
}

export function getFlowTheme(isDark: boolean): FlowThemeTokens {
  return isDark ? dark : light
}

/** Cores hex para handles (opacas) */
export const FLOW_HANDLE = {
  neutralDark: '#52525b',
  neutralLight: '#94a3b8',
} as const

/**
 * Fundos do Sheet (blocos / agentes) — hex sólidos, sem alpha.
 * Evita painel “vidro” quando bg-background ou utilities falham na cascata.
 */
export const FLOW_DRAWER_SHELL_HEX = {
  light: '#f1f5f9',
  dark: '#09090b',
} as const

export const FLOW_DRAWER_HEADER_HEX = {
  light: '#ffffff',
  dark: '#18181b',
} as const

export function flowDrawerShellStyle(isDark: boolean): { backgroundColor: string; opacity: number; backdropFilter: 'none' } {
  return {
    backgroundColor: isDark ? FLOW_DRAWER_SHELL_HEX.dark : FLOW_DRAWER_SHELL_HEX.light,
    opacity: 1,
    backdropFilter: 'none',
  }
}

export function flowDrawerHeaderStyle(isDark: boolean): { backgroundColor: string } {
  return {
    backgroundColor: isDark ? FLOW_DRAWER_HEADER_HEX.dark : FLOW_DRAWER_HEADER_HEX.light,
  }
}
