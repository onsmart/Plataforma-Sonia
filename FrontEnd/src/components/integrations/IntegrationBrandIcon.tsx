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

const BRAND_LABELS: Record<IntegrationBrandKey, string> = {
  calendly: 'Calendly',
  hubspot: 'HubSpot',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  mailchimp: 'Mailchimp',
  gmail: 'Gmail',
  microsoft365: 'Microsoft 365',
  microsoft: 'Microsoft',
  google: 'Google',
  yahoo: 'Yahoo',
  generic: 'E-mail',
}

/** Logos oficiais em /public/integrations (Simple Icons + marcas em cores) */
const BRAND_LOGO_SRC: Record<IntegrationBrandKey, string> = {
  calendly: '/integrations/calendly.svg',
  hubspot: '/integrations/hubspot.svg',
  whatsapp: '/integrations/whatsapp.svg',
  mailchimp: '/integrations/mailchimp.svg',
  gmail: '/integrations/gmail.svg',
  google: '/integrations/google.svg',
  microsoft365: '/integrations/microsoft.svg',
  microsoft: '/integrations/microsoft.svg',
  yahoo: '/integrations/yahoo.svg',
  email: '/integrations/email.svg',
  generic: '/integrations/email.svg',
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
  if (raw.includes('gmail')) return 'gmail'
  if (raw === 'google') return 'google'
  if (raw.includes('yahoo')) return 'yahoo'
  if (raw.includes('email') || raw.includes('mail') || raw.includes('smtp')) {
    return 'email'
  }

  return 'generic'
}

export function getIntegrationBrandLabel(key: IntegrationBrandKey): string {
  return BRAND_LABELS[key] || BRAND_LABELS.generic
}

export function getIntegrationLogoSrc(key: IntegrationBrandKey): string {
  return BRAND_LOGO_SRC[key] || BRAND_LOGO_SRC.generic
}

export function getIntegrationIconBoxStyle(
  _key: IntegrationBrandKey,
  isDark?: boolean
): { backgroundColor: string } {
  return {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.96)' : '#ffffff',
  }
}

export interface IntegrationBrandIconProps {
  provider?: string | null
  slug?: string | null
  preset?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Quadrado com fundo claro (estilo card de integração) */
  boxed?: boolean
  isDark?: boolean
}

const SIZE_MAP = {
  xs: { box: 'h-7 w-7', pad: 'p-1', img: 'max-h-[70%] max-w-[70%]' },
  sm: { box: 'h-8 w-8', pad: 'p-1', img: 'max-h-[72%] max-w-[72%]' },
  md: { box: 'h-10 w-10', pad: 'p-1.5', img: 'max-h-[76%] max-w-[76%]' },
  lg: { box: 'h-14 w-14', pad: 'p-2', img: 'max-h-[78%] max-w-[78%]' },
  xl: { box: 'h-16 w-16', pad: 'p-2.5', img: 'max-h-[80%] max-w-[80%]' },
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
  const src = getIntegrationLogoSrc(brandKey)
  const label = getIntegrationBrandLabel(brandKey)
  const sizes = SIZE_MAP[size]

  const image = (
    <img
      src={src}
      alt=""
      aria-hidden
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn(
        'h-full w-full object-contain object-center',
        boxed ? sizes.img : sizes.img,
        className
      )}
    />
  )

  if (!boxed) {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', sizes.box, className)}
        title={label}
      >
        {image}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/5 shadow-sm dark:border-white/10',
        sizes.box,
        sizes.pad,
        className
      )}
      style={getIntegrationIconBoxStyle(brandKey, isDark)}
      title={label}
    >
      {image}
    </span>
  )
}
