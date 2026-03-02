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
      rgba(14, 116, 144, 0.3) 25%,
      rgba(14, 116, 144, 0.6) 50%,
      rgba(14, 116, 144, 0.3) 75%,
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

  /* GARANTE QUE TODOS OS TEXTOS SEJAM VISÍVEIS NO FUNDO CYAN, INDEPENDENTE DO TEMA */
  /* Força cor branca em todos os textos da sidebar */
  [data-sidebar="sidebar"] {
    color: #ffffff !important;
  }

  /* Mantém cores específicas para elementos que já têm cor definida */
  [data-sidebar="sidebar"] .text-cyan-300 {
    color: rgb(165, 243, 252) !important;
  }

  [data-sidebar="sidebar"] .text-cyan-200 {
    color: rgb(165, 243, 252) !important;
  }

  [data-sidebar="sidebar"] .text-cyan-100 {
    color: rgb(207, 250, 254) !important;
  }

  [data-sidebar="sidebar"] .text-cyan-400 {
    color: rgb(34, 211, 238) !important;
  }

  /* Botão ativo mantém texto e ícone escuros */
  [data-sidebar="menu-button"][data-active="true"],
  [data-sidebar="menu-button"][data-active="true"] * {
    color: #0e7490 !important;
  }

  /* Ícones dos botões inativos */
  [data-sidebar="menu-button"]:not([data-active="true"]) svg {
    color: #60a5fa !important;
  }
`

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme, theme } = useTheme()
  const { navigate, currentRoute } = useNavigation()
  const { userId, firstName, lastName, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = React.useState(false)
  
  const getUserInitials = () => (firstName && lastName ? `${firstName[0]}${lastName[0]}` : "AD").toUpperCase();
  const getUserFullName = () => (firstName && lastName ? `${firstName} ${lastName}` : "Admin User");

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

  return (
    <>
      <style>{energyAnimationStyle}</style>
      <Sidebar 
        collapsible="icon" 
        {...props}
        className="sticky top-0 h-screen !bg-[#0e7490]"
        style={{
          backgroundColor: '#0e7490',
          "--sidebar-background": '#0e7490', // Força a cor interna do componente
          "--sidebar-foreground": "#ffffff",
        } as React.CSSProperties}
      >
      {/* HEADER: LOGO */}
      <SidebarHeader className="p-8 shrink-0 flex items-center justify-center group-data-[collapsible=icon]:p-4">
          <div 
            className="flex items-center gap-4 cursor-pointer group w-full justify-center group-data-[collapsible=icon]:justify-center"
            onClick={() => navigate('cockpit')}
          >
            <div className="flex aspect-square size-10 items-center justify-center rounded-2xl bg-white shadow-xl shrink-0">
              <Command className="size-6" style={{ color: '#0e7490' }} strokeWidth={3} />
            </div>
            <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-black text-xl tracking-tighter uppercase !text-white">SONIA</span>
              <span className="truncate text-[10px] font-black uppercase tracking-[0.2em] !text-cyan-300">Platform Pro</span>
            </div>
          </div>
      </SidebarHeader>

      {/* CONTEÚDO DA NAVEGAÇÃO */}
      <SidebarContent className="px-4 space-y-10 custom-scrollbar">
        {[
          { label: "Operations", items: [
            { id: 'cockpit', name: 'Cockpit', icon: LayoutDashboard },
            { id: 'inbox', name: 'Universal Inbox', icon: MessageSquare },
            { id: 'playground', name: 'Playground', icon: Terminal },
          ]},
          { label: "AI Strategy", items: [
            { id: 'agents', name: 'Agents Hub', icon: Bot },
            { id: 'flows', name: 'Lógica de Fluxos', icon: GitBranch },
            { id: 'governance', name: 'Governança', icon: ShieldCheck },
          ]},
          { label: "Intelligence", items: [
            { id: 'knowledge', name: 'Knowledge Base', icon: Database },
            { id: 'insights', name: 'Insights & Data', icon: PieChart },
          ]},
          { label: "Admin", items: [
            ...(isAdmin ? [{ id: 'configuration', name: 'Configuration', icon: Settings2 }] : []),
          ]}
        ].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.4em] mb-4 !text-cyan-100/30 group-data-[collapsible=icon]:hidden">
              {group.label}
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
                        "h-12 !transition-all !duration-300 flex items-center px-4 rounded-xl",
                        isActive 
                          ? "!bg-white !text-[#0e7490] shadow-2xl scale-[1.05]" 
                          : "text-white/70 hover:!bg-white/10 hover:!text-white"
                      )}
                    >
                      <item.icon 
                        size={20} 
                        strokeWidth={isActive ? 3 : 2.5}
                        style={{ color: isActive ? '#0e7490' : '#60a5fa' }} 
                      />
                      <span className={cn(
                        "font-black text-sm tracking-tight group-data-[collapsible=icon]:hidden ml-3",
                        isActive ? "!text-[#0e7490]" : "!text-white"
                      )}>
                        {item.name}
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
      <SidebarFooter className="p-4 space-y-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="user-menu-trigger bg-white/10 p-4 rounded-[2rem] border border-white/10 flex items-center justify-between group hover:bg-white/20 transition-all cursor-pointer">
               <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center font-black text-xs text-[#0e7490] shadow-lg shrink-0">
                    {getUserInitials()}
                  </div>
                  <div className="min-w-0 user-menu-text">
                    <p className="text-xs font-black !text-white truncate leading-none mb-1">{getUserFullName()}</p>
                    <p className="text-[10px] !text-cyan-300 font-bold uppercase truncate">Enterprise Plan</p>
                  </div>
               </div>
               <ChevronsUpDown size={14} className="!text-cyan-200 user-menu-chevron" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
            <DropdownMenuItem 
              onClick={() => navigate('profile')}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <User size={16} />
              <span>Profile</span>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem 
                onClick={() => {
                  navigate('configuration?tab=billing')
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CreditCard size={16} />
                <span>Faturamento</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={signOut}
              className="flex items-center gap-2 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div 
          className="bg-white/10 p-2 rounded-full border border-white/10 flex items-center justify-between px-5 group-data-[collapsible=icon]:hidden" 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
           <div className="flex items-center gap-2 !text-cyan-100 cursor-pointer">
              {theme === 'dark' ? <Sun size={16} className="!text-cyan-100" /> : <Moon size={16} className="!text-cyan-100" />}
              <span className="text-[9px] font-black uppercase tracking-widest !text-cyan-100">Tema</span>
           </div>
           <Switch checked={theme === 'dark'} className="scale-75 data-[state=checked]:!bg-white [&_span]:data-[state=checked]:!bg-[#0e7490]" />
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}
