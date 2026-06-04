import * as React from "react"
import {
  Bot,
  Command,
  PieChart,
  Settings2,
  Plug,
  ShieldCheck,
  LayoutDashboard,
  Home,
  Sun,
  Moon,
  ChevronsUpDown,
  MessageSquare,
  Database,
  GitBranch,
  Terminal,
  User,
  CreditCard,
  LogOut,
  Activity,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { useNavigation, type RoutePath } from "../../contexts/NavigationContext"
import { useAuth } from "../../contexts/AuthContext"
import { usePlanCapabilities } from "../../hooks/usePlanCapabilities"
import { AgentService } from "../../services/api"
import { buildDisplayName, buildInitials } from "../../lib/user-display"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "../ui/sidebar"
import { cn } from "../ui/utils"
import { Switch } from "../ui/switch"

const SIDEBAR_NAV_GROUPS: Array<{
  labelKey: string
  items: Array<{ id: RoutePath; nameKey: string; icon: React.ElementType }>
}> = [
  {
    labelKey: "groups.operations",
    items: [
      { id: "home", nameKey: "menuItems.home", icon: Home },
      { id: "cockpit", nameKey: "menuItems.cockpit", icon: LayoutDashboard },
      { id: "inbox", nameKey: "menuItems.inbox", icon: MessageSquare },
      { id: "playground", nameKey: "menuItems.playground", icon: Terminal },
    ],
  },
  {
    labelKey: "groups.aiStrategy",
    items: [
      { id: "agents", nameKey: "menuItems.agents", icon: Bot },
      { id: "flows", nameKey: "menuItems.flows", icon: GitBranch },
      { id: "governance", nameKey: "menuItems.governance", icon: ShieldCheck },
    ],
  },
  {
    labelKey: "groups.intelligence",
    items: [
      { id: "knowledge", nameKey: "menuItems.knowledge", icon: Database },
      { id: "insights", nameKey: "menuItems.insights", icon: PieChart },
    ],
  },
  {
    labelKey: "groups.admin",
    items: [
      { id: "integrations", nameKey: "menuItems.integrations", icon: Plug },
      { id: "configuration", nameKey: "menuItems.configuration", icon: Settings2 },
    ],
  },
]

const appSidebarStyles = `
  @keyframes sidebarNavEnter {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes sidebarActivePulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.72;
    }
  }

  @keyframes sidebarLogoGlow {
    0%, 100% {
      box-shadow: var(--sidebar-logo-shadow-idle);
    }
    50% {
      box-shadow: var(--sidebar-logo-shadow-active);
    }
  }

  .app-sidebar-shell {
    --sidebar-accent-bar: #2563eb;
    --sidebar-nav-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --sidebar-collapse-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --sidebar-collapse-duration: 420ms;
    --sidebar-collapse-fade: 300ms;
  }

  .app-sidebar-shell[data-theme-mode="light"] {
    --sidebar-accent-bar: #1d4ed8;
    --sidebar-logo-shadow-idle: 0 10px 24px -18px rgba(15, 23, 42, 0.18);
    --sidebar-logo-shadow-active: 0 14px 32px -16px rgba(37, 99, 235, 0.28);
    --sidebar-scrollbar-track: #e2e8f0;
    --sidebar-scrollbar-thumb: #94a3b8;
    --sidebar-scrollbar-thumb-hover: #64748b;
  }

  .app-sidebar-shell[data-theme-mode="dark"] {
    --sidebar-accent-bar: #3b82f6;
    --sidebar-logo-shadow-idle: 0 0 0 1px rgba(255, 255, 255, 0.06);
    --sidebar-logo-shadow-active: 0 0 24px -6px rgba(59, 130, 246, 0.45);
    --sidebar-scrollbar-track: #090b10;
    --sidebar-scrollbar-thumb: #3f3f46;
    --sidebar-scrollbar-thumb-hover: #52525b;
  }

  [data-sidebar="menu-button"].app-sidebar-nav-btn {
    height: auto;
    min-height: 2.75rem;
    align-items: center;
    position: relative;
    isolation: isolate;
    transition:
      background-color 0.24s var(--sidebar-nav-ease),
      border-color 0.24s var(--sidebar-nav-ease),
      color 0.24s var(--sidebar-nav-ease),
      transform 0.24s var(--sidebar-nav-ease),
      box-shadow 0.24s var(--sidebar-nav-ease);
  }

  [data-sidebar="menu-button"].app-sidebar-nav-btn:hover:not([data-active="true"]) {
    transform: translateX(3px);
  }

  [data-sidebar="menu-button"].app-sidebar-nav-btn:active {
    transform: scale(0.985);
  }

  [data-sidebar="menu-button"].app-sidebar-nav-btn[data-active="true"]::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 58%;
    border-radius: 0 999px 999px 0;
    transform: translateY(-50%) scaleY(0);
    transform-origin: center;
    background: var(--sidebar-accent-bar);
    animation: sidebarActiveBarIn 0.32s var(--sidebar-nav-ease) forwards;
    z-index: 2;
    pointer-events: none;
  }

  @keyframes sidebarActiveBarIn {
    from {
      transform: translateY(-50%) scaleY(0);
      opacity: 0;
    }
    to {
      transform: translateY(-50%) scaleY(1);
      opacity: 1;
    }
  }

  [data-sidebar="menu-button"].app-sidebar-nav-btn[data-active="true"] > * {
    position: relative;
    z-index: 1;
  }

  .app-sidebar-group {
    animation: sidebarNavEnter 0.42s var(--sidebar-nav-ease) both;
  }

  .app-sidebar-logo-badge {
    transition: transform 0.28s var(--sidebar-nav-ease), box-shadow 0.28s var(--sidebar-nav-ease);
  }

  .app-sidebar-logo-badge:hover {
    transform: translateY(-1px);
    animation: sidebarLogoGlow 2.4s ease-in-out infinite;
  }

  .app-sidebar-reveal-text {
    overflow: hidden;
    white-space: nowrap;
    max-width: 280px;
    opacity: 1;
    transform: translateX(0);
    transition:
      opacity var(--sidebar-collapse-fade) var(--sidebar-collapse-ease),
      max-width var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      transform var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      margin var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      padding var(--sidebar-collapse-duration) var(--sidebar-collapse-ease);
  }

  .app-sidebar-brand-copy {
    overflow: hidden;
    max-width: 240px;
    opacity: 1;
    transform: translateX(0);
    transition:
      opacity var(--sidebar-collapse-fade) var(--sidebar-collapse-ease),
      max-width var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      transform var(--sidebar-collapse-duration) var(--sidebar-collapse-ease);
  }

  [data-collapsible="icon"] .app-sidebar-reveal-text,
  [data-collapsible="icon"] .app-sidebar-brand-copy {
    max-width: 0;
    opacity: 0;
    transform: translateX(-10px);
    pointer-events: none;
  }

  [data-collapsible="icon"] [data-sidebar="menu-button"] .app-sidebar-reveal-text {
    flex: 0 0 0;
    min-width: 0;
    margin: 0;
    padding: 0;
  }

  [data-collapsible="icon"] [data-sidebar="menu-button"] {
    justify-content: center !important;
    padding: 0.65rem !important;
    min-height: 2.75rem;
  }

  [data-collapsible="icon"] .user-menu-trigger {
    padding: 0.35rem !important;
    background: transparent !important;
    border: none !important;
    justify-content: center !important;
    width: 100% !important;
  }

  [data-collapsible="icon"] .user-menu-trigger > div {
    justify-content: center !important;
    width: 100% !important;
    gap: 0 !important;
  }

  [data-collapsible="icon"] .user-menu-text,
  [data-collapsible="icon"] .user-menu-chevron {
    max-width: 0;
    opacity: 0;
    transform: translateX(-8px);
    overflow: hidden;
    pointer-events: none;
  }

  .user-menu-text,
  .user-menu-chevron {
    transition:
      opacity var(--sidebar-collapse-fade) var(--sidebar-collapse-ease),
      max-width var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      transform var(--sidebar-collapse-duration) var(--sidebar-collapse-ease);
  }

  .user-menu-text {
    max-width: 200px;
    opacity: 1;
    transform: translateX(0);
  }

  .user-menu-chevron {
    opacity: 1;
    transform: translateX(0) scale(1);
  }

  .app-sidebar-theme-toggle {
    transition:
      padding var(--sidebar-collapse-duration) var(--sidebar-collapse-ease),
      background-color 0.24s var(--sidebar-nav-ease),
      border-color 0.24s var(--sidebar-nav-ease),
      box-shadow 0.24s var(--sidebar-nav-ease);
  }

  [data-collapsible="icon"] .app-sidebar-theme-toggle {
    justify-content: center;
    padding: 0.625rem;
  }

  /* Scrollbar discreta no lado ESQUERDO via direction:rtl */
  .app-sidebar-scroll {
    direction: rtl;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.18) transparent;
  }

  /* Inverte o conteúdo de volta para ltr */
  .app-sidebar-scroll > * {
    direction: ltr;
  }

  .app-sidebar-scroll::-webkit-scrollbar {
    width: 3px;
  }

  .app-sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .app-sidebar-scroll::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.20);
    border-radius: 9999px;
  }

  .app-sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.38);
  }

  .app-sidebar-shell[data-theme-mode="dark"] .app-sidebar-scroll {
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  .app-sidebar-shell[data-theme-mode="dark"] .app-sidebar-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
  }

  .app-sidebar-shell[data-theme-mode="dark"] .app-sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  /* ─── Glass Sidebar System ───────────────────────────────────────────────
     Sobrescreve o bg-sidebar sólido do shadcn com rgba + backdrop-blur para
     que a Aurora apareça por trás. O blur fica no [data-sidebar="sidebar"]
     (o elemento visível) e não no container externo.

     CAMADAS: Aurora (z:0) → Sidebar container (z:10). O backdrop-filter
     captura a Aurora diretamente por ser posterior na ordem de pintagem.
  ─────────────────────────────────────────────────────────────────────────── */

  /* Remove a borda direita sólida que divide sidebar do conteúdo */
  .app-sidebar-shell {
    border-right: none !important;
  }

  /*
    ── Tema claro: quase invisível como painel ──
    Fundo mínimo (6% branco) para não criar uma "faixa branca".
    O blur (16px) mostra a Aurora borrada atrás, dando o efeito de vidro
    sem adicionar uma camada branca opaca por cima da Aurora.
    Borda muito sutil delimita o painel sem criar separação pesada.
  */
  /* ── Sidebar light: fundo 100% transparente ── */
  .app-sidebar-shell[data-theme-mode="light"] [data-sidebar="sidebar"] {
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-right: none !important;
  }

  /* Texto escuro com leve halo sutil — contraste alto sobre fundo azul-lavanda */
  .app-sidebar-shell[data-theme-mode="light"] [data-sidebar="sidebar"] * {
    color: #1a2540 !important;
    text-shadow: 0 0 8px rgba(241, 242, 253, 0.7) !important;
  }

  /* Ícones: azul profundo, sem halo agressivo */
  .app-sidebar-shell[data-theme-mode="light"] [data-sidebar="sidebar"] svg {
    color: #1e3a6e !important;
    text-shadow: none !important;
    filter: none !important;
  }

  /*
    ── Tema escuro: quase invisível como painel ──
    12% preto-azul para não criar uma "faixa preta" sobre a Aurora.
    O blur (24px) mostra os blues da Aurora atrás, efeito premium.
  */
  /* ── Sidebar dark: fundo 100% transparente ── */
  .app-sidebar-shell[data-theme-mode="dark"] [data-sidebar="sidebar"] {
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-right: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .app-sidebar-group,
    [data-sidebar="menu-button"].app-sidebar-nav-btn,
    .app-sidebar-logo-badge,
    .app-sidebar-reveal-text,
    .app-sidebar-brand-copy,
    .user-menu-text,
    .user-menu-chevron,
    .app-sidebar-theme-toggle {
      animation: none !important;
      transition: none !important;
    }

    [data-sidebar="menu-button"].app-sidebar-nav-btn:hover:not([data-active="true"]) {
      transform: none;
    }
  }
`

/** Enquanto o bundle do Supabase não chega, evita mostrar chaves cruas como `menuItems.home`. */
const SIDEBAR_FALLBACK: Record<string, string> = {
  "groups.operations": "Operations",
  "groups.aiStrategy": "AI Strategy",
  "groups.intelligence": "Intelligence",
  "groups.admin": "Admin",
  "menuItems.home": "Home",
  "menuItems.cockpit": "Cockpit",
  "menuItems.inbox": "Universal Inbox",
  "menuItems.playground": "Playground",
  "menuItems.agents": "Agents Hub",
  "menuItems.flows": "Flow Logic",
  "menuItems.governance": "Governance",
  "menuItems.knowledge": "Knowledge Base",
  "menuItems.insights": "Insights & Data",
  "menuItems.configuration": "Configuration",
  "menuItems.integrations": "Integrações",
  "menuItems.platformHealth": "Saúde da plataforma",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const isLight =
    theme === 'light' ||
    resolvedTheme === 'light' ||
    (theme === 'system' && resolvedTheme !== 'dark')
  const { navigate, currentRoute } = useNavigation()
  const { isMobile, setOpenMobile } = useSidebar()
  const { userId, firstName, lastName, signOut, signingOut, user } = useAuth()
  const planCaps = usePlanCapabilities()
  const { t, i18n } = useTranslation('sidebar')
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)

  const handleNavigate = React.useCallback(
    (route: RoutePath) => {
      navigate(route)
      if (isMobile) {
        setOpenMobile(false)
      }
    },
    [navigate, isMobile, setOpenMobile]
  )

  const handleThemeToggle = React.useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'

    let iconX = '50%'
    let iconY = '50%'

    const iconElement = document.getElementById('sidebar-theme-toggle-icon')
    if (iconElement) {
      const iconRect = iconElement.getBoundingClientRect()
      iconX = `${((iconRect.left + iconRect.width / 2) / window.innerWidth) * 100}%`
      iconY = `${((iconRect.top + iconRect.height / 2) / window.innerHeight) * 100}%`
      iconElement.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
      iconElement.style.transform = 'rotate(360deg) scale(1.08)'
      window.setTimeout(() => {
        iconElement.style.transition = 'transform 0.2s ease'
        iconElement.style.transform = 'rotate(0deg) scale(1)'
      }, 550)
    }

    if (typeof document !== 'undefined' && document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        setTheme(newTheme)
      })

      transition.ready.then(() => {
        const style = document.createElement('style')
        style.textContent = `
          ::view-transition-old(root) {
            animation: themeSweepOut 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          ::view-transition-new(root) {
            animation: themeSweepIn 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          @keyframes themeSweepOut {
            from { clip-path: circle(100% at ${iconX} ${iconY}); opacity: 1; }
            to { clip-path: circle(0% at ${iconX} ${iconY}); opacity: 0; }
          }
          @keyframes themeSweepIn {
            from { clip-path: circle(0% at ${iconX} ${iconY}); opacity: 0; }
            to { clip-path: circle(150% at ${iconX} ${iconY}); opacity: 1; }
          }
        `
        document.head.appendChild(style)
        transition.finished.finally(() => {
          if (document.head.contains(style)) {
            document.head.removeChild(style)
          }
        })
      })
    } else {
      setTheme(newTheme)
    }
  }, [setTheme, theme])
  
  const getUserInitials = () => buildInitials(firstName, lastName, user?.email);
  const getUserFullName = () => buildDisplayName(firstName, lastName, user?.email?.split("@")[0] || "Usuário");
  const sidebarPalette = isLight
    ? {
        shell: 'transparent',
        shellHsl: '210 40% 98%',
        foregroundHsl: '222 47% 11%',
        borderHsl: '214 32% 86%',
        accentHsl: '214 32% 94%',
        accentForegroundHsl: '222 47% 11%',
        ringHsl: '215 20% 48%',
        edgeClass: '',
        headerBorderClass: 'border-slate-200/80',
        logoBadgeClass: 'border-slate-200/80 bg-white',
        // slate-600 = contraste 5.8:1 em fundo branco → passa WCAG AA para texto pequeno
        subLabelClass: '!text-slate-600',
        groupLabelClass: '!text-slate-600',
        // item ativo: branco bem opaco para destacar sem deixar o painel sólido
        activeButtonClass: '!bg-white/80 !text-slate-950 shadow-[0_4px_16px_-12px_rgba(15,23,42,0.22)] border-white/60',
        // item idle: sem fundo, hover mostra 35% branco — combina com painel 6%
        idleButtonClass: 'border-transparent text-slate-700 hover:!bg-white/35 hover:!text-slate-950 hover:border-white/40',
        activeIcon: '#1d4ed8',
        idleIcon: '#475569',
        activeTextClass: '!text-slate-950',
        idleTextClass: '!text-slate-800',
        userCardClass: 'border-transparent bg-transparent hover:bg-black/[0.04] transition-colors duration-200',
        userAvatarClass: 'bg-primary text-white',
        userNameClass: '!text-slate-900',
        userSubtextClass: '!text-slate-500',
        chevronClass: '!text-slate-400',
        themeCardClass: 'border-transparent bg-transparent hover:bg-black/[0.04] transition-colors duration-200',
        themeCompactClass: 'border-transparent bg-transparent hover:bg-black/[0.04] transition-colors duration-200',
        themeTextClass: '!text-slate-700',
        switchClass: 'scale-[0.82] data-[state=checked]:!bg-primary [&_span]:data-[state=checked]:!bg-white',
        userMenuContentClass:
          'w-[calc(var(--radix-dropdown-menu-trigger-width)-0px)] min-w-[12.5rem] rounded-2xl border border-slate-200/80 bg-white/97 p-1.5 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.32)] backdrop-blur-md',
        userMenuItemClass:
          'cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-950 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 [&_svg]:text-slate-500',
        userMenuItemDestructiveClass:
          'cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 [&_svg]:!text-red-500',
        userMenuSeparatorClass: 'my-1 bg-slate-200',
      }
    : {
        shell: 'transparent',
        shellHsl: '222 47% 4%',
        foregroundHsl: '210 20% 98%',
        borderHsl: '220 13% 13%',
        accentHsl: '220 16% 8%',
        accentForegroundHsl: '210 20% 98%',
        ringHsl: '217 10% 64%',
        edgeClass: 'border-white/[0.06]',
        headerBorderClass: 'border-white/[0.06]',
        logoBadgeClass: 'border-white/10 bg-white/[0.04]',
        subLabelClass: '!text-zinc-500',
        groupLabelClass: '!text-zinc-600',
        // dark mode: item ativo com 12% branco, visível mas sem criar bloco sólido
        activeButtonClass: '!bg-white/[0.12] !text-white border-white/[0.10]',
        idleButtonClass: 'border-transparent text-zinc-400 hover:!bg-white/[0.06] hover:!text-zinc-100 hover:border-white/[0.06]',
        activeIcon: '#60a5fa',
        idleIcon: '#71717a',
        activeTextClass: '!text-white',
        idleTextClass: '!text-zinc-300',
        userCardClass: 'border-transparent bg-transparent hover:bg-white/[0.06] transition-colors duration-200',
        userAvatarClass: 'bg-zinc-100 text-black',
        userNameClass: '!text-white',
        userSubtextClass: '!text-zinc-500',
        chevronClass: '!text-zinc-500',
        themeCardClass: 'border-transparent bg-transparent hover:bg-white/[0.06] transition-colors duration-200',
        themeCompactClass: 'border-transparent bg-transparent hover:bg-white/[0.06] transition-colors duration-200',
        themeTextClass: '!text-zinc-300',
        switchClass: 'scale-[0.82] data-[state=checked]:!bg-blue-600 [&_span]:data-[state=checked]:!bg-white',
        userMenuContentClass:
          'w-[calc(var(--radix-dropdown-menu-trigger-width)-0px)] min-w-[12.5rem] rounded-2xl border border-white/10 bg-[#0c1018]/95 p-1.5 shadow-[0_24px_56px_-32px_rgba(0,0,0,0.95)] backdrop-blur-md',
        userMenuItemClass:
          'cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-300 focus:bg-white/[0.06] focus:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white [&_svg]:text-zinc-500',
        userMenuItemDestructiveClass:
          'cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 focus:bg-red-500/10 focus:text-red-300 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-300 [&_svg]:!text-red-400',
        userMenuSeparatorClass: 'my-1 bg-white/[0.08]',
      }

  // Verifica se o usuário é admin
  React.useEffect(() => {
    const checkAdmin = async () => {
      if (userId) {
        try {
          const adminStatus = await AgentService.checkUserIsAdmin()
          setIsAdmin(adminStatus)
        } catch (error) {
          console.error('Erro ao verificar se é admin:', error)
          setIsAdmin(null)
        }
      }
    }
    checkAdmin()
  }, [userId])

  // Carregar traduções do banco
  React.useEffect(() => {
    const checkTranslations = async () => {
      const currentLang = i18n.language || 'pt-BR'
      const sidebarTranslations = i18n.getResourceBundle(currentLang, 'sidebar')

      if (sidebarTranslations && Object.keys(sidebarTranslations).length > 0) {
        return
      } else {
        const { loadTranslationsFromDatabase } = await import('../../i18n/config')
        const companiesId = localStorage.getItem('companies_id') || undefined
        await loadTranslationsFromDatabase(currentLang, companiesId)
        i18n.emit('loaded')
      }
    }
    
    if (userId) {
      checkTranslations()
    }

    const handleLanguageChanged = () => { 
      checkTranslations() 
    }
    
    i18n.on('languageChanged', handleLanguageChanged)
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const navGroups = React.useMemo(() => {
    const adminItems =
      isAdmin === true
        ? [{ id: 'platform-health' as const, nameKey: 'menuItems.platformHealth', icon: Activity }]
        : []
    return SIDEBAR_NAV_GROUPS.map((group) =>
      group.labelKey === 'groups.admin'
        ? { ...group, items: [...group.items, ...adminItems] }
        : group
    )
  }, [isAdmin])

  return (
    <>
      <style>{appSidebarStyles}</style>
      <Sidebar
        collapsible="icon"
        {...props}
        className={cn(
          "app-sidebar-shell sticky top-0 h-screen",
          sidebarPalette.edgeClass,
        )}
        data-theme-mode={isLight ? 'light' : 'dark'}
        style={{
          backgroundColor: sidebarPalette.shell,
          "--sidebar-background": sidebarPalette.shellHsl,
          "--sidebar-foreground": sidebarPalette.foregroundHsl,
          "--sidebar-border": sidebarPalette.borderHsl,
          "--sidebar-accent": sidebarPalette.accentHsl,
          "--sidebar-accent-foreground": sidebarPalette.accentForegroundHsl,
          "--sidebar-primary": sidebarPalette.accentHsl,
          "--sidebar-primary-foreground": sidebarPalette.accentForegroundHsl,
          "--sidebar-ring": sidebarPalette.ringHsl,
        } as React.CSSProperties}
      >
      <SidebarHeader
        className="h-[4.25rem] shrink-0 items-stretch justify-center bg-transparent px-3 transition-[height,padding] duration-[var(--sidebar-collapse-duration,420ms)] ease-[var(--sidebar-collapse-ease,cubic-bezier(0.22,1,0.36,1))] group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:px-2"
      >
          <div 
            className="group flex h-full min-h-0 w-full cursor-pointer items-center gap-3 justify-start pl-0.5 transition-transform duration-300 hover:opacity-95 group-data-[collapsible=icon]:justify-center"
            onClick={() => handleNavigate('home')}
          >
            <div className={cn(
              "app-sidebar-logo-badge flex aspect-square size-10 items-center justify-center rounded-xl border shrink-0",
              sidebarPalette.logoBadgeClass
            )}>
              <Command className={cn("size-5 transition-transform duration-300 group-hover:scale-105", isLight ? "text-slate-900" : "text-blue-400")} strokeWidth={2.25} />
            </div>
            <div className="app-sidebar-brand-copy grid flex-1 text-left leading-tight">
              <span className={cn("truncate text-lg font-bold tracking-tight uppercase", isLight ? "!text-slate-900" : "!text-white")}>SONIA</span>
              <span className={cn("truncate text-[10px] font-semibold uppercase tracking-[0.22em]", sidebarPalette.subLabelClass)}>Platform Pro</span>
            </div>
          </div>
      </SidebarHeader>

      <SidebarContent
        className="app-sidebar-scroll space-y-6 bg-transparent px-2 py-2"
      >
        {navGroups.map((group, groupIndex) => (
          <SidebarGroup
            key={group.labelKey || groupIndex}
            className="app-sidebar-group p-0"
            style={{ animationDelay: `${groupIndex * 55}ms` }}
          >
            <SidebarGroupLabel className={cn(
              "app-sidebar-group-label-text mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.28em]",
              sidebarPalette.groupLabelClass
            )}>
              {t(group.labelKey, { defaultValue: SIDEBAR_FALLBACK[group.labelKey] ?? group.labelKey })}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const isActive = currentRoute === item.id;
                const label = t(item.nameKey, { defaultValue: SIDEBAR_FALLBACK[item.nameKey] ?? item.nameKey })
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      tooltip={label}
                      onClick={() => handleNavigate(item.id)}
                      isActive={isActive}
                      className={cn(
                        "app-sidebar-nav-btn flex w-full justify-start gap-2.5 rounded-xl border py-2.5 pl-2.5 pr-2.5",
                        "[&>span:last-child]:!ml-0 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 [&>span:last-child]:!whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:leading-snug [&>span:last-child]:text-left",
                        isActive 
                          ? sidebarPalette.activeButtonClass
                          : sidebarPalette.idleButtonClass
                      )}
                    >
                      <item.icon 
                        className={cn(
                          "shrink-0 transition-transform duration-300",
                          isActive && "scale-105"
                        )}
                        size={18} 
                        strokeWidth={isActive ? 2.5 : 2}
                        style={{ color: isActive ? sidebarPalette.activeIcon : sidebarPalette.idleIcon }} 
                      />
                      <span className={cn(
                        "app-sidebar-reveal-text text-[13px] font-medium tracking-tight",
                        isActive ? sidebarPalette.activeTextClass : sidebarPalette.idleTextClass
                      )}>
                        {label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="shrink-0 space-y-2.5 bg-transparent px-2 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={cn(
              "user-menu-trigger flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all duration-300",
              sidebarPalette.userCardClass
            )}>
               <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-sm", sidebarPalette.userAvatarClass)}>
                    {getUserInitials()}
                  </div>
                  <div className="min-w-0 user-menu-text">
                    <p className={cn("mb-0.5 truncate text-xs font-semibold leading-none", sidebarPalette.userNameClass)}>{getUserFullName()}</p>
                    <p className={cn("truncate text-[10px] font-medium uppercase tracking-wide", sidebarPalette.userSubtextClass)}>
                      {planCaps.loading ? '…' : planCaps.planTitle}
                    </p>
                  </div>
               </div>
               <ChevronsUpDown size={14} className={cn("user-menu-chevron transition-transform duration-300", sidebarPalette.chevronClass)} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="center"
            sideOffset={10}
            className={cn(
              'overflow-hidden border-0 bg-transparent text-inherit shadow-none',
              sidebarPalette.userMenuContentClass
            )}
          >
            <DropdownMenuItem
              onClick={() => handleNavigate('profile')}
              className={sidebarPalette.userMenuItemClass}
            >
              <User size={16} strokeWidth={2.25} />
              <span>{t('userMenu.profile', { defaultValue: 'Meu Perfil' })}</span>
            </DropdownMenuItem>
            {isAdmin === true && (
              <DropdownMenuItem
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                  navigate('configuration?tab=billing')
                }}
                className={sidebarPalette.userMenuItemClass}
              >
                <CreditCard size={16} strokeWidth={2.25} />
                <span>{t('userMenu.billing', { defaultValue: 'Faturamento' })}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className={sidebarPalette.userMenuSeparatorClass} />
            <DropdownMenuItem
              onClick={() => void signOut()}
              disabled={signingOut}
              variant="destructive"
              className={sidebarPalette.userMenuItemDestructiveClass}
            >
              <LogOut size={16} strokeWidth={2.25} />
              <span>
                {signingOut
                  ? t("userMenu.loggingOut", { defaultValue: "Saindo…" })
                  : t("userMenu.logout", { defaultValue: "Sair" })}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          role="button"
          tabIndex={0}
          className={cn(
            "app-sidebar-theme-toggle flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-2.5 group-data-[collapsible=icon]:rounded-xl",
            sidebarPalette.themeCardClass,
          )}
          onClick={handleThemeToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleThemeToggle()
            }
          }}
        >
          <div className={cn("flex min-w-0 items-center gap-2.5", sidebarPalette.themeTextClass)}>
            <div id="sidebar-theme-toggle-icon" className="inline-flex shrink-0">
              {theme === 'dark' ? (
                <Sun size={16} className={sidebarPalette.themeTextClass} />
              ) : (
                <Moon size={16} className={sidebarPalette.themeTextClass} />
              )}
            </div>
            <span className={cn("app-sidebar-reveal-text text-[10px] font-semibold uppercase tracking-[0.18em]", sidebarPalette.themeTextClass)}>
              {t('theme.label', { defaultValue: 'Tema' })}
            </span>
          </div>
          <Switch checked={theme === 'dark'} className={cn("app-sidebar-reveal-text shrink-0", sidebarPalette.switchClass, "pointer-events-none")} />
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}
