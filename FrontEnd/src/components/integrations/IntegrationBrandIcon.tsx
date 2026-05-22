import type { ComponentType } from 'react'
import { Mail } from 'lucide-react'
import { cn } from '../../lib/utils'

export type IntegrationBrandKey =
  | 'calendly'
  | 'hubspot'
  | 'whatsapp'
  | 'email'
  | 'mailchimp'
  | 'gmail'
  | 'microsoft365'
  | 'microsoft'
  | 'google'
  | 'yahoo'
  | 'generic'

const BRAND_COLORS: Record<IntegrationBrandKey, string> = {
  calendly: '#006BFF',
  hubspot: '#FF7A59',
  whatsapp: '#25D366',
  email: '#64748b',
  mailchimp: '#FFE01B',
  gmail: '#EA4335',
  microsoft365: '#0078D4',
  microsoft: '#0078D4',
  google: '#4285F4',
  yahoo: '#6001D2',
  generic: '#64748b',
}

export function normalizeIntegrationBrandKey(
  input?: string | null
): IntegrationBrandKey {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

  if (!raw) return 'generic'

  if (raw.includes('calendly')) return 'calendly'
  if (raw.includes('hubspot')) return 'hubspot'
  if (raw.includes('mailchimp')) return 'mailchimp'
  if (raw.includes('whatsapp') || raw === 'wa') return 'whatsapp'
  if (
    raw.includes('microsoft') ||
    raw.includes('office365') ||
    raw === 'outlook' ||
    raw === 'outlook_personal' ||
    raw === 'hotmail' ||
    raw.includes('m365')
  ) {
    return 'microsoft365'
  }
  if (raw.includes('gmail') || raw === 'google') return 'gmail'
  if (raw.includes('yahoo')) return 'yahoo'
  if (raw.includes('email') || raw.includes('mail') || raw.includes('smtp')) {
    return 'email'
  }

  return 'generic'
}

export function getIntegrationBrandColor(key: IntegrationBrandKey): string {
  return BRAND_COLORS[key] || BRAND_COLORS.generic
}

export function getIntegrationIconBoxStyle(
  key: IntegrationBrandKey,
  isDark?: boolean
): { backgroundColor: string } {
  const color = getIntegrationBrandColor(key)
  if (key === 'mailchimp') {
    return {
      backgroundColor: isDark ? 'rgba(255, 224, 27, 0.22)' : 'rgba(255, 224, 27, 0.35)',
    }
  }
  if (key === 'whatsapp') {
    return {
      backgroundColor: isDark ? 'rgba(37, 211, 102, 0.18)' : 'rgba(37, 211, 102, 0.14)',
    }
  }
  if (key === 'hubspot') {
    return {
      backgroundColor: isDark ? 'rgba(255, 122, 89, 0.18)' : 'rgba(255, 122, 89, 0.14)',
    }
  }
  if (key === 'calendly') {
    return {
      backgroundColor: isDark ? 'rgba(0, 107, 255, 0.18)' : 'rgba(0, 107, 255, 0.12)',
    }
  }
  if (key === 'gmail') {
    return {
      backgroundColor: isDark ? 'rgba(234, 67, 53, 0.18)' : 'rgba(234, 67, 53, 0.12)',
    }
  }
  if (key === 'microsoft365' || key === 'microsoft') {
    return {
      backgroundColor: isDark ? 'rgba(0, 120, 212, 0.18)' : 'rgba(0, 120, 212, 0.12)',
    }
  }
  return {
    backgroundColor: isDark ? `${color}22` : `${color}18`,
  }
}

type IconSvgProps = { className?: string }

function SvgCalendly({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M19.655 0H4.345C1.946 0 0 1.946 0 4.345v15.31C0 21.054 1.946 23 4.345 23h15.31c2.399 0 4.345-1.946 4.345-4.345V4.345C24 1.946 22.054 0 19.655 0zm-2.635 16.55c-2.944 0-5.33-2.386-5.33-5.33s2.386-5.33 5.33-5.33 5.33 2.386 5.33 5.33-2.386 5.33-5.33 5.33zm0-8.72c-1.816 0-3.29 1.474-3.29 3.29s1.474 3.29 3.29 3.29 3.29-1.474 3.29-3.29-1.474-3.29-3.29-3.29z"
      />
    </svg>
  )
}

function SvgHubSpot({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M17.164 8.349v-3.535a2.483 2.483 0 1 0-1.656 0v3.535a6.757 6.757 0 0 0-3.129 3.129h-3.535a2.483 2.483 0 1 0 0 1.656h3.535a6.757 6.757 0 0 0 3.129 3.13v3.535a2.483 2.483 0 1 0 1.656 0v-3.535a6.757 6.757 0 0 0 3.13-3.129h3.535a2.483 2.483 0 1 0 0-1.656h-3.535a6.757 6.757 0 0 0-3.13-3.13z"
      />
    </svg>
  )
}

function SvgWhatsApp({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.148-.014-.223.065-.297.08-.075.173-.198.26-.297.086-.099.115-.148.173-.05.644.297 1.255.463 2.39 1.475.883.788 1.48 1.761 1.653 2.059.174.148.014.223-.065.297-.08.075-.173.198-.26.297-.086.099-.115.148-.173.05-.644-.298-1.255-.464-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.148-.014-.223.065-.297.08-.075.173-.198.26-.297.086-.099.115-.148.173-.05.644-.297 1.255-.463 2.39-1.475.883-.788 1.48-1.761 1.653-2.059.174-.148.014-.223-.065-.297.08-.075.173-.198.26-.297.086-.099.115-.148.173-.05.644.075.297.149 1.758.867 2.03.967.273.099.471.148.67-.15.197-.297.767-.966.94-1.164.173-.199.347-.223.644-.075.297-.15 1.255-.463 2.39-1.475.883-.788 1.48-1.761 1.653-2.059.173-.148.014-.223-.065-.297.08-.075.173-.198.26-.297.086-.099.115-.148.173-.05.644-.297-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.148-.014-.223.065-.297.08-.075.173-.198.26-.297.086-.099.115-.148.173-.05.644.297-1.255.463 2.39 1.475.883.788 1.48 1.761 1.653 2.059zM12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.117 1.518 5.874L.06 23.98l6.305-1.654A11.93 11.93 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.009-1.362l-.36-.214-3.742.98 1-3.647-.234-.375A9.818 9.818 0 0 1 2.182 12c0-5.422 4.396-9.818 9.818-9.818 5.422 0 9.818 4.396 9.818 9.818 0 5.422-4.396 9.818-9.818 9.818z"
      />
    </svg>
  )
}

function SvgMailchimp({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.26 7.5c.2-.11.43-.17.67-.17.55 0 1.06.3 1.33.77l-2.9 5.34-2.7-4.7c-.27-.47-.78-.77-1.33-.77-.24 0-.47.06-.67.17-.59.32-.95.93-.95 1.6v8.7c0 1.1.9 2 2 2s2-.9 2-2v-6.2l1.8 3c.32.55.9.9 1.53.9.63 0 1.21-.35 1.53-.9l1.8-3v6.2c0 1.1.9 2 2 2s2-.9 2-2V9.1c0-.67-.36-1.28-.95-1.6z"
      />
    </svg>
  )
}

function SvgGmail({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 5.457v13.91c0 .904-.732 1.637-1.637 1.637H1.637A1.636 1.636 0 0 1 0 19.367V5.457c0-2.017 2.425-3.096 3.901-1.743L12 12.853l8.099-9.14C21.575 2.361 24 3.44 24 5.457z" />
      <path fill="#34A853" d="M12 12.853 3.901 3.714 1.637 5.457A1.636 1.636 0 0 0 0 7.094v12.273h24V7.094a1.636 1.636 0 0 0-1.637-1.637L20.099 3.714 12 12.853z" />
      <path fill="#FBBC05" d="M12 12.853v11.09H1.637A1.636 1.636 0 0 1 0 22.307V7.094l12 5.759z" />
      <path fill="#4285F4" d="M24 7.094v15.213c0 .904-.732 1.637-1.637 1.637H12V12.853L24 7.094z" />
    </svg>
  )
}

function SvgMicrosoft({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

function SvgYahoo({ className }: IconSvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M2.048 4.55h4.39L12.21 16.9 17.77 4.55h4.39L14.396 20.45H9.824L2.048 4.55zM20.814 4.55h2.138v15.9h-2.138V4.55z"
      />
    </svg>
  )
}

const BRAND_SVG: Record<IntegrationBrandKey, ComponentType<IconSvgProps>> = {
  calendly: SvgCalendly,
  hubspot: SvgHubSpot,
  whatsapp: SvgWhatsApp,
  mailchimp: SvgMailchimp,
  gmail: SvgGmail,
  google: SvgGmail,
  microsoft365: SvgMicrosoft,
  microsoft: SvgMicrosoft,
  yahoo: SvgYahoo,
  email: ({ className }) => <Mail className={className} strokeWidth={2.2} />,
  generic: ({ className }) => <Mail className={className} strokeWidth={2.2} />,
}

export interface IntegrationBrandIconProps {
  provider?: string | null
  slug?: string | null
  preset?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Quadrado com fundo da marca (estilo página Integrações) */
  boxed?: boolean
  isDark?: boolean
}

const SIZE_MAP = {
  xs: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
  sm: { box: 'h-8 w-8', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { box: 'h-14 w-14', icon: 'h-7 w-7' },
  xl: { box: 'h-16 w-16', icon: 'h-8 w-8' },
}

export function IntegrationBrandIcon({
  provider,
  slug,
  preset,
  size = 'md',
  className,
  boxed = false,
  isDark = false,
}: IntegrationBrandIconProps) {
  const brandKey = normalizeIntegrationBrandKey(slug || preset || provider)
  const color = getIntegrationBrandColor(brandKey)
  const IconSvg = BRAND_SVG[brandKey]
  const sizes = SIZE_MAP[size]

  const iconEl = (
    <IconSvg
      className={cn(sizes.icon, 'shrink-0', className)}
      style={
        brandKey === 'gmail' || brandKey === 'microsoft365' || brandKey === 'microsoft'
          ? undefined
          : { color }
      }
    />
  )

  if (!boxed) return iconEl

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm',
        sizes.box
      )}
      style={getIntegrationIconBoxStyle(brandKey, isDark)}
    >
      {iconEl}
    </span>
  )
}
