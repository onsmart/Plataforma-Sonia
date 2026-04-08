import * as React from "react"
import { createPortal } from "react-dom"
import {
  Bot,
  Command,
  PieChart,
  Settings2,
  ShieldCheck,
  LayoutDashboard,
  Sun,
  Moon,
  ChevronsUpDown,
  MessageSquare,
  Database,
  GitBranch,
  Terminal,
  User,
  CreditCard,
  LogOut
} from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { useNavigation } from "../../contexts/NavigationContext"
import { useAuth } from "../../contexts/AuthContext"
import { AgentService } from "../../services/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SidebarGroupLabel
} from "../ui/sidebar"
import { cn } from "../ui/utils"
import { Switch } from "../ui/switch"

// Animação de energia passando no botão ativo + Ajuste de largura quando compactado
const energyAnimationStyle = `
  @keyframes energyFlow {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  [data-sidebar="menu-button"][data-active="true"] {
    position: relative;
    overflow: hidden;
  }

  [data-sidebar="menu-button"][data-active="true"]::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.03) 75%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: energyFlow 2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }

  [data-sidebar="menu-button"][data-active="true"] > * {
    position: relative;
    z-index: 1;
  }

  /* Aumenta a largura da sidebar quando está compactada (modo ícone) */
  [data-collapsible="icon"] [data-slot="sidebar-container"] {
    width: 5rem !important;
    min-width: 5rem !important;
    max-width: 5rem !important;
  }

  /* Garante que os ícones fiquem centralizados e não cortados */
  [data-collapsible="icon"] [data-sidebar="menu-button"] {
    justify-content: center !important;
    padding: 0.75rem !important;
  }

  /* Remove o card do usuário quando compactado e centraliza o avatar */
  [data-collapsible="icon"] .user-menu-trigger {
    padding: 0 !important;
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

  /* Esconde o texto e ícone do dropdown quando compactado */
  [data-collapsible="icon"] .user-menu-text,
  [data-collapsible="icon"] .user-menu-chevron {
    display: none !important;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 #090b10;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #090b10;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 9999px;
    border: 2px solid #090b10;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  .custom-scrollbar.light-scrollbar {
    scrollbar-color: #94a3b8 #e2e8f0;
  }

  .custom-scrollbar.light-scrollbar::-webkit-scrollbar-track {
    background: #e2e8f0;
  }

  .custom-scrollbar.light-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border: 2px solid #e2e8f0;
  }

  .custom-scrollbar.light-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
`

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const isLight =
    theme === 'light' ||
    resolvedTheme === 'light' ||
    (theme === 'system' && resolvedTheme !== 'dark')
  const { navigate, currentRoute } = useNavigation()
  const { userId, firstName, lastName, signOut } = useAuth()
  const { t, i18n } = useTranslation('sidebar')
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [translationsReady, setTranslationsReady] = React.useState(false)
  const iconRef = React.useRef<HTMLElement>(null)
  
  const getUserInitials = () => (firstName && lastName ? `${firstName[0]}${lastName[0]}` : "AD").toUpperCase();
  const getUserFullName = () => (firstName && lastName ? `${firstName} ${lastName}` : "Admin User");
  const sidebarPalette = isLight
    ? {
        shell: '#e2e8f0',
        shellHsl: '220 13% 91%',
        foregroundHsl: '222 47% 11%',
        borderHsl: '215 20% 82%',
        accentHsl: '220 14% 96%',
        accentForegroundHsl: '222 47% 11%',
        ringHsl: '215 20% 55%',
        edgeClass: 'border-slate-300',
        headerBorderClass: 'border-slate-300',
        logoBadgeClass: 'border-slate-300 bg-white shadow-[0_12px_28px_-22px_rgba(15,23,42,0.2)]',
        subLabelClass: '!text-slate-600',
        groupLabelClass: '!text-slate-500',
        activeButtonClass: '!bg-white !text-slate-950 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.2)] scale-[1.02] border-slate-300',
        idleButtonClass: 'border-transparent text-slate-700 hover:!bg-white/80 hover:!text-slate-950 hover:border-slate-300',
        activeIcon: '#0f172a',
        idleIcon: '#64748b',
        activeTextClass: '!text-slate-950',
        idleTextClass: '!text-slate-800',
        userCardClass: 'border-slate-300 bg-white hover:bg-slate-50',
        userAvatarClass: 'bg-slate-950 text-white',
        userNameClass: '!text-slate-900',
        userSubtextClass: '!text-slate-600',
        chevronClass: '!text-slate-500',
        themeCardClass: 'border-slate-300 bg-white',
        themeTextClass: '!text-slate-800',
        switchClass: 'scale-75 data-[state=checked]:!bg-slate-900 [&_span]:data-[state=checked]:!bg-white',
      }
    : {
        shell: '#05070b',
        shellHsl: '220 38% 3%',
        foregroundHsl: '210 20% 98%',
        borderHsl: '220 13% 13%',
        accentHsl: '220 16% 8%',
        accentForegroundHsl: '210 20% 98%',
        ringHsl: '217 10% 64%',
        edgeClass: 'border-white/5',
        headerBorderClass: 'border-white/5',
        logoBadgeClass: 'border-white/10 bg-white/5',
        subLabelClass: '!text-zinc-400',
        groupLabelClass: '!text-zinc-500',
        activeButtonClass: '!bg-[#111318] !text-white shadow-[0_12px_28px_-24px_rgba(0,0,0,0.9)] scale-[1.02] border-white/8',
        idleButtonClass: 'border-transparent text-white/70 hover:!bg-[#0d1015] hover:!text-white hover:border-white/6',
        activeIcon: '#f8fafc',
        idleIcon: '#94a3b8',
        activeTextClass: '!text-white',
        idleTextClass: '!text-zinc-100',
        userCardClass: 'border-white/8 bg-[#0c0f14] hover:bg-[#10141b]',
        userAvatarClass: 'bg-zinc-100 text-black',
        userNameClass: '!text-white',
        userSubtextClass: '!text-zinc-400',
        chevronClass: '!text-zinc-400',
        themeCardClass: 'border-white/8 bg-[#0c0f14]',
        themeTextClass: '!text-zinc-200',
        switchClass: 'scale-75 data-[state=checked]:!bg-zinc-700 [&_span]:data-[state=checked]:!bg-white',
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
          setIsAdmin(false)
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
        setTranslationsReady(true)
      } else {
        const { loadTranslationsFromDatabase } = await import('../../i18n/config')
        const companiesId = localStorage.getItem('companies_id') || undefined
        await loadTranslationsFromDatabase(currentLang, companiesId)
        i18n.emit('loaded')
        setTranslationsReady(true)
      }
    }
    
    if (userId) {
      checkTranslations()
    }

    const handleLanguageChanged = () => { 
      checkTranslations() 
    }
    const handleLoaded = () => {
      const currentLang = i18n.language || 'pt-BR'
      const translations = i18n.getResourceBundle(currentLang, 'sidebar')
      if (translations && Object.keys(translations).length > 0) {
        setTranslationsReady(true)
      }
    }
    const handleAdded = () => { 
      handleLoaded() 
    }
    
    i18n.on('languageChanged', handleLanguageChanged)
    i18n.on('loaded', handleLoaded)
    i18n.on('added', handleAdded)
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
      i18n.off('loaded', handleLoaded)
      i18n.off('added', handleAdded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <>
      <style>{energyAnimationStyle}</style>
      <Sidebar 
        collapsible="icon" 
        {...props}
        className={cn("sticky top-0 h-screen !bg-transparent", sidebarPalette.edgeClass)}
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
      {/* HEADER: LOGO */}
      <SidebarHeader
        className={cn("flex items-center justify-center border-b p-8 shrink-0 group-data-[collapsible=icon]:p-4", sidebarPalette.headerBorderClass)}
        style={{ backgroundColor: sidebarPalette.shell }}
      >
          <div 
            className="flex items-center gap-4 cursor-pointer group w-full justify-center group-data-[collapsible=icon]:justify-center"
            onClick={() => navigate('cockpit')}
          >
            <div className={cn(
              "flex aspect-square size-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-sm shrink-0",
              sidebarPalette.logoBadgeClass
            )}>
              <Command className={cn("size-5", isLight ? "text-slate-900" : "text-white")} strokeWidth={2.5} />
            </div>
            <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className={cn("truncate font-black text-xl tracking-tighter uppercase", isLight ? "!text-slate-900" : "!text-white")}>SONIA</span>
              <span className={cn("truncate text-[10px] font-black uppercase tracking-[0.2em]", sidebarPalette.subLabelClass)}>Platform Pro</span>
            </div>
          </div>
      </SidebarHeader>

      {/* CONTEÚDO DA NAVEGAÇÃO */}
      <SidebarContent
        className={cn('space-y-10 px-4 custom-scrollbar', isLight && 'light-scrollbar')}
        style={{ backgroundColor: sidebarPalette.shell }}
      >
        {[
          { labelKey: "groups.operations", items: [
            { id: 'cockpit', nameKey: 'menuItems.cockpit', icon: LayoutDashboard },
            { id: 'inbox', nameKey: 'menuItems.inbox', icon: MessageSquare },
            { id: 'playground', nameKey: 'menuItems.playground', icon: Terminal },
          ]},
          { labelKey: "groups.aiStrategy", items: [
            { id: 'agents', nameKey: 'menuItems.agents', icon: Bot },
            { id: 'flows', nameKey: 'menuItems.flows', icon: GitBranch },
            { id: 'governance', nameKey: 'menuItems.governance', icon: ShieldCheck },
          ]},
          { labelKey: "groups.intelligence", items: [
            { id: 'knowledge', nameKey: 'menuItems.knowledge', icon: Database },
            { id: 'insights', nameKey: 'menuItems.insights', icon: PieChart },
          ]},
          { labelKey: "groups.admin", items: [
            ...(isAdmin ? [{ id: 'configuration', nameKey: 'menuItems.configuration', icon: Settings2 }] : []),
          ]}
        ].map((group, groupIndex) => (
          <SidebarGroup key={group.labelKey || groupIndex}>
            <SidebarGroupLabel className={cn("mb-4 px-4 text-[10px] font-black uppercase tracking-[0.4em] group-data-[collapsible=icon]:hidden", sidebarPalette.groupLabelClass)}>
              {t(group.labelKey, { defaultValue: group.labelKey })}
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-2">
              {group.items.map((item) => {
                const isActive = currentRoute === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.id)}
                      isActive={isActive}
                      className={cn(
                        "flex h-12 items-center rounded-xl border px-4 !transition-all !duration-300",
                        isActive 
                          ? sidebarPalette.activeButtonClass
                          : sidebarPalette.idleButtonClass
                      )}
                    >
                      <item.icon 
                        size={20} 
                        strokeWidth={isActive ? 3 : 2.5}
                        style={{ color: isActive ? sidebarPalette.activeIcon : sidebarPalette.idleIcon }} 
                      />
                      <span className={cn(
                        "font-black text-sm tracking-tight group-data-[collapsible=icon]:hidden ml-3",
                        isActive ? sidebarPalette.activeTextClass : sidebarPalette.idleTextClass
                      )}>
                        {t(item.nameKey, { defaultValue: item.nameKey })}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* RODAPÉ: USER & THEME */}
      <SidebarFooter className="p-4 space-y-3 shrink-0" style={{ backgroundColor: sidebarPalette.shell }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={cn("user-menu-trigger flex items-center justify-between rounded-[2rem] border p-4 transition-all cursor-pointer", sidebarPalette.userCardClass)}>
               <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-lg", sidebarPalette.userAvatarClass)}>
                    {getUserInitials()}
                  </div>
                  <div className="min-w-0 user-menu-text">
                    <p className={cn("mb-1 truncate text-xs font-black leading-none", sidebarPalette.userNameClass)}>{getUserFullName()}</p>
                    <p className={cn("text-[10px] font-bold uppercase truncate", sidebarPalette.userSubtextClass)}>{t('userMenu.enterprisePlan', { defaultValue: 'Enterprise Plan' })}</p>
                  </div>
               </div>
               <ChevronsUpDown size={14} className={cn("user-menu-chevron", sidebarPalette.chevronClass)} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
            <DropdownMenuItem 
              onClick={() => navigate('profile')}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <User size={16} />
              <span>{t('userMenu.profile', { defaultValue: 'Profile' })}</span>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem 
                onClick={() => {
                  navigate('configuration?tab=billing')
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CreditCard size={16} />
                <span>{t('userMenu.billing', { defaultValue: 'Faturamento' })}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={signOut}
              className="flex items-center gap-2 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            >
              <LogOut size={16} />
              <span>{t('userMenu.logout', { defaultValue: 'Logout' })}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div 
          className={cn("flex items-center justify-between rounded-full border p-2 px-5 group-data-[collapsible=icon]:hidden", sidebarPalette.themeCardClass)} 
          onClick={(e) => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            
            // Captura a posição do ícone para usar como origem da animação
            let iconX = '50%';
            let iconY = '50%';
            
            if (iconRef.current) {
              const iconRect = iconRef.current.getBoundingClientRect();
              const iconCenterX = iconRect.left + iconRect.width / 2;
              const iconCenterY = iconRect.top + iconRect.height / 2;
              
              // Calcula a posição relativa à viewport em porcentagem
              iconX = `${(iconCenterX / window.innerWidth) * 100}%`;
              iconY = `${(iconCenterY / window.innerHeight) * 100}%`;
            }
            
            // Anima o ícone com rotação de 360 graus
            if (iconRef.current) {
              const iconElement = iconRef.current;
              iconElement.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
              iconElement.style.transform = 'rotate(360deg)';
              
              // Reseta a rotação após a animação
              setTimeout(() => {
                if (iconElement) {
                  iconElement.style.transition = 'none';
                  iconElement.style.transform = 'rotate(0deg)';
                  // Força re-render para resetar
                  requestAnimationFrame(() => {
                    if (iconElement) {
                      iconElement.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                    }
                  });
                }
              }, 600);
            }
            
            // Usar View Transitions API para animação de varredura
            if (typeof document !== 'undefined' && document.startViewTransition) {
              const transition = document.startViewTransition(() => {
                setTheme(newTheme);
              });
              
              transition.ready.then(() => {
                // Adiciona estilos inline para garantir que a animação funcione
                const style = document.createElement('style');
                style.textContent = `
                  ::view-transition-old(root) {
                    animation: themeSweepOut 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                  }
                  ::view-transition-new(root) {
                    animation: themeSweepIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                  }
                  @keyframes themeSweepOut {
                    from {
                      clip-path: circle(100% at ${iconX} ${iconY});
                      opacity: 1;
                    }
                    to {
                      clip-path: circle(0% at ${iconX} ${iconY});
                      opacity: 0;
                    }
                  }
                  @keyframes themeSweepIn {
                    from {
                      clip-path: circle(0% at ${iconX} ${iconY});
                      opacity: 0;
                    }
                    to {
                      clip-path: circle(150% at ${iconX} ${iconY});
                      opacity: 1;
                    }
                  }
                `;
                document.head.appendChild(style);
                
                // Remove o estilo após a transição
                transition.finished.finally(() => {
                  if (document.head.contains(style)) {
                    document.head.removeChild(style);
                  }
                });
              });
            } else {
              // Fallback se a API não estiver disponível
              setTheme(newTheme);
            }
          }}
        >
           <div className={cn("flex items-center gap-2 cursor-pointer", sidebarPalette.themeTextClass)}>
              <div ref={iconRef as React.RefObject<HTMLDivElement>} className="inline-flex">
                {theme === 'dark' ? (
                  <Sun 
                    size={16} 
                    className={sidebarPalette.themeTextClass} 
                  />
                ) : (
                  <Moon 
                    size={16} 
                    className={sidebarPalette.themeTextClass} 
                  />
                )}
              </div>
              <span className={cn("text-[9px] font-black uppercase tracking-widest", sidebarPalette.themeTextClass)}>{t('theme.label', { defaultValue: 'Tema' })}</span>
           </div>
           <Switch checked={theme === 'dark'} className={sidebarPalette.switchClass} />
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}
