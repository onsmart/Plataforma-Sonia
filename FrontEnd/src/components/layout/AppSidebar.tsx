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

// Animação de brilho para botões ativos
  const shimmerStyle = `
    @keyframes shimmer {
      0% {
        transform: translateX(-100%) translateY(-100%) rotate(45deg);
      }
      100% {
        transform: translateX(200%) translateY(200%) rotate(45deg);
      }
    }
    
    /* View Transitions API - CSS necessário para funcionar sem piscar */
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    
    /* O tema antigo fica parado no fundo */
    ::view-transition-old(root) {
      z-index: 1;
    }
    
    /* O tema novo expande por cima */
    ::view-transition-new(root) {
      z-index: 9999;
    }

  /* Quando está mudando para dark, inverte a ordem */
  .dark ::view-transition-old(root) {
    z-index: 9999;
  }
  .dark ::view-transition-new(root) {
    z-index: 1;
  }
  
  @keyframes rotateAndScale {
    0% {
      transform: rotate(0deg) scale(1);
    }
    50% {
      transform: rotate(180deg) scale(1.3);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }
  
  @keyframes sunRays {
    0%, 100% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
    25% {
      opacity: 0.8;
      transform: scale(1.2) rotate(90deg);
    }
    50% {
      opacity: 1;
      transform: scale(1.4) rotate(180deg);
    }
    75% {
      opacity: 0.8;
      transform: scale(1.2) rotate(270deg);
    }
  }
  
  @keyframes moonRotate {
    0% {
      transform: rotate(0deg) scale(1);
    }
    50% {
      transform: rotate(180deg) scale(1.2);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }
  
  /* Sobrescreve estilos padrão do SidebarMenuButton */
  [data-sidebar="menu-button"] {
    background-color: transparent !important;
  }
  
  [data-sidebar="menu-button"]:hover:not([data-active="true"]) {
    background-color: rgba(255, 255, 255, 0.1) !important;
    color: #ffffff !important;
  }
  
  [data-sidebar="menu-button"][data-active="true"] {
    background: linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%) !important;
    color: #000000 !important;
  }
  
  /* Garante que ícones sejam visíveis quando colapsado */
  [data-sidebar="menu-button"] svg {
    color: inherit !important;
    stroke: inherit !important;
  }
  
  /* Item ativo - ícone PRETO - FORÇA MÁXIMA */
  [data-sidebar="menu-button"][data-active="true"] svg,
  [data-sidebar="menu-button"][data-active="true"] svg path,
  [data-sidebar="menu-button"][data-active="true"] svg line,
  [data-sidebar="menu-button"][data-active="true"] svg circle,
  [data-sidebar="menu-button"][data-active="true"] svg rect,
  [data-sidebar="menu-button"][data-active="true"] svg polygon,
  [data-sidebar="menu-button"][data-active="true"] svg polyline,
  [data-sidebar="menu-button"][data-active="true"] svg * {
    color: #000000 !important;
    stroke: #000000 !important;
    fill: none !important;
  }
  
  /* Item inativo - ícone AZUL */
  [data-sidebar="menu-button"]:not([data-active="true"]) svg,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg path,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg line,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg circle,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg rect,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg polygon,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg polyline,
  [data-sidebar="menu-button"]:not([data-active="true"]) svg * {
    color: #60a5fa !important;
    stroke: #60a5fa !important;
    fill: none !important;
  }
  
  /* Ajusta tamanho quando colapsado - usando seletor do grupo */
  [data-sidebar="menu-button"] {
    min-width: auto !important;
  }
  
  /* Quando sidebar está colapsada, ajusta botões - CENTRALIZADO E REDUZIDO */
  [data-collapsible="icon"] [data-sidebar="menu-button"] {
    width: 3.25rem !important; /* Reduzido de 3.5rem para 3.25rem */
    height: 3.25rem !important;
    padding: 0.625rem !important; /* Padding ligeiramente maior para centralizar melhor */
    justify-content: center !important; /* Centraliza o conteúdo */
    align-items: center !important;
    border-radius: 9999px !important;
    min-width: 3.25rem !important;
    margin-left: auto !important; /* Centraliza o botão */
    margin-right: auto !important;
  }
  
  /* Garante que a sidebar colapsada tenha largura suficiente */
  [data-collapsible="icon"] {
    width: 4.5rem !important;
    min-width: 4.5rem !important;
  }
  
  /* Reduz padding do conteúdo quando colapsado e aumenta espaçamento entre grupos */
  [data-collapsible="icon"] [data-sidebar="content"] {
    padding-left: 0.5rem !important;
    padding-right: 0.5rem !important;
  }
  
  /* Aumenta espaçamento entre grupos quando colapsado */
  [data-collapsible="icon"] [data-sidebar="group"] {
    margin-bottom: 1.5rem !important;
  }
  
  /* Aumenta espaçamento entre itens do menu quando colapsado */
  [data-collapsible="icon"] [data-sidebar="menu"] {
    gap: 0.75rem !important;
  }
  
  /* Alinha logo do header com os ícones quando colapsado */
  [data-collapsible="icon"] [data-sidebar="header"] {
    display: flex !important;
    justify-content: center !important;
    padding: 1rem !important;
  }
  
  /* Alinha o logo com o centro dos botões - mesmo posicionamento */
  [data-collapsible="icon"] [data-sidebar="header"] .flex.aspect-square {
    margin-left: auto !important;
    margin-right: auto !important;
    /* Mesmo offset que os botões para alinhar perfeitamente */
    position: relative !important;
    left: 0 !important;
  }
  
  /* Garante que o container do logo também esteja alinhado */
  [data-collapsible="icon"] [data-sidebar="header"] > ul > li > div {
    justify-content: center !important;
    width: 100% !important;
  }
  
  /* Alinha avatar do footer com os ícones quando colapsado */
  [data-collapsible="icon"] [data-sidebar="footer"] {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    padding: 0.5rem !important;
  }
  
  [data-collapsible="icon"] [data-sidebar="footer"] .h-9.w-9 {
    margin-left: auto !important;
    margin-right: auto !important;
  }
  
  /* Remove fundo e bordas do card do usuário quando colapsado */
  [data-collapsible="icon"] [data-sidebar="footer"] [data-slot="dropdown-menu-trigger"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    width: auto !important;
    height: auto !important;
  }
  
  /* Aplica gradiente ciano no avatar quando colapsado - FORÇA MÁXIMA */
  [data-collapsible="icon"] [data-sidebar="footer"] .h-9.w-9 {
    background: linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%) !important;
    border: 3px solid rgba(255, 255, 255, 0.3) !important;
    box-shadow: 0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.2) !important;
    backdrop-filter: blur(10px) !important;
    color: white !important;
    width: 3.5rem !important;
    height: 3.5rem !important;
    border-radius: 50% !important;
  }
  
  /* Texto branco no avatar quando colapsado */
  [data-collapsible="icon"] [data-sidebar="footer"] .h-9.w-9,
  [data-collapsible="icon"] [data-sidebar="footer"] .h-9.w-9 span,
  [data-collapsible="icon"] [data-sidebar="footer"] .h-9.w-9 * {
    color: white !important;
  }
  
  /* Item ativo quando colapsado - mantém gradiente e ícone preto */
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] {
    background: linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%) !important;
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.4) !important;
  }
  
  /* FORÇA ÍCONE PRETO quando colapsado e ativo */
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg path,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg line,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg circle,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg rect,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg polygon,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg polyline,
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] svg * {
    color: #000000 !important;
    stroke: #000000 !important;
    fill: none !important;
  }
  
  /* Ajusta tamanho dos ícones quando colapsado - ligeiramente menor para não cortar */
  [data-collapsible="icon"] [data-sidebar="menu-button"] svg {
    margin: 0 !important;
    display: block !important;
    width: 24px !important; /* Reduzido de 26px para 24px */
    height: 24px !important;
  }
  
  /* Centraliza o wrapper do ícone quando colapsado */
  [data-collapsible="icon"] [data-sidebar="menu-button"] .sidebar-icon-active,
  [data-collapsible="icon"] [data-sidebar="menu-button"] .sidebar-icon-inactive {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important; /* Centraliza */
    width: 100% !important;
    height: 100% !important;
  }
  
  /* Centraliza o botão ativo quando colapsado */
  [data-collapsible="icon"] [data-sidebar="menu-button"][data-active="true"] {
    margin-left: auto !important;
    margin-right: auto !important;
  }
  
  /* Classes específicas para forçar cores dos ícones */
  .sidebar-icon-active svg,
  .sidebar-icon-active svg path,
  .sidebar-icon-active svg line,
  .sidebar-icon-active svg circle,
  .sidebar-icon-active svg rect,
  .sidebar-icon-active svg polygon,
  .sidebar-icon-active svg polyline,
  .sidebar-icon-active svg * {
    color: #000000 !important;
    stroke: #000000 !important;
    fill: none !important;
  }
  
  .sidebar-icon-inactive svg,
  .sidebar-icon-inactive svg path,
  .sidebar-icon-inactive svg line,
  .sidebar-icon-inactive svg circle,
  .sidebar-icon-inactive svg rect,
  .sidebar-icon-inactive svg polygon,
  .sidebar-icon-inactive svg polyline,
  .sidebar-icon-inactive svg * {
    color: #60a5fa !important;
    stroke: #60a5fa !important;
    fill: none !important;
  }
`

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme, theme } = useTheme()
  const { navigate, currentRoute } = useNavigation()
  const { userId, firstName, lastName, signOut } = useAuth()
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)
  
  // Função para obter as iniciais do usuário
  const getUserInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase()
    }
    if (lastName) {
      return lastName.substring(0, 2).toUpperCase()
    }
    return "AD"
  }
  
  // Função para obter o nome completo do usuário
  const getUserFullName = () => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    }
    if (firstName) {
      return firstName
    }
    if (lastName) {
      return lastName
    }
    return "Admin User"
  }

  // COR DA GOVERNANÇA (Ciano Vibrante Sonia)
  const SONIA_CYAN = "#0891b2"; 
  const SONIA_DARK_CYAN = "#0e7490";

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

  // Função mestre da animação usando View Transitions API
  const toggleTheme = (event: React.MouseEvent | React.ChangeEvent) => {
    // Inicia animação do ícone
    setIsAnimating(true)
    
    // 1. Captura a posição do clique (ou do switch)
    const isMouseEvent = 'clientX' in event && 'clientY' in event
    const x = isMouseEvent 
      ? (event as React.MouseEvent).clientX 
      : window.innerWidth / 2
    const y = isMouseEvent 
      ? (event as React.MouseEvent).clientY 
      : window.innerHeight / 2

    // 2. Fallback para navegadores que não suportam a API
    if (typeof document === 'undefined' || !document.startViewTransition) {
      setTheme(theme === "dark" ? "light" : "dark")
      setTimeout(() => setIsAnimating(false), 700)
      return
    }

    // 3. A Mágica: Tira um snapshot e troca o tema
    const transition = document.startViewTransition(() => {
      setTheme(theme === "dark" ? "light" : "dark")
    })

    // 4. Anima o "círculo" expandindo
    transition.ready.then(() => {
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 700,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          // Define qual camada animar (a nova que entra)
          pseudoElement: "::view-transition-new(root)",
        }
      ).finished.then(() => {
        setIsAnimating(false)
      })
    })
  }

  return (
    <>
      <style>{shimmerStyle}</style>
      <Sidebar 
        collapsible="icon" 
        {...props}
        className="!bg-[#0e7490] [&>div]:!bg-[#0e7490] border-r-4 border-white/10 shadow-2xl"
        style={{
          backgroundColor: '#0e7490',
          "--sidebar-background": '#0e7490',
          "--sidebar-foreground": "#ffffff",
          "--sidebar-accent": "transparent",
          "--sidebar-accent-foreground": "#ffffff",
          "--sidebar-border": "rgba(255, 255, 255, 0.1)",
          "--sidebar-width-icon": "4.5rem", // Aumenta de 3rem para 4.5rem (72px)
        } as React.CSSProperties}
      >
      {/* HEADER: LOGO */}
      <SidebarHeader className="p-8 group-data-[collapsible=icon]:p-4 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <div 
              className="flex items-center gap-4 cursor-pointer group group-data-[collapsible=icon]:justify-center"
              onClick={() => navigate('cockpit')}
            >
              <div className="flex aspect-square size-10 items-center justify-center rounded-2xl bg-white shadow-xl group-hover:scale-110 transition-transform shrink-0 group-data-[collapsible=icon]:mx-auto">
                <Command className="size-5" strokeWidth={3} style={{ color: '#0e7490' }} />
              </div>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-black text-xl tracking-tighter uppercase" style={{ color: '#0e7490' }}>SONIA</span>
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#0e7490' }}>Platform Pro</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* CONTEÚDO: NAVEGAÇÃO COM CONTRASTE TOTAL */}
      <SidebarContent className="px-4 space-y-10 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:space-y-6">
        {[
          { 
            label: "Operations", 
            items: [
              { id: 'cockpit', name: 'Cockpit', icon: LayoutDashboard },
              { id: 'inbox', name: 'Universal Inbox', icon: MessageSquare },
              { id: 'playground', name: 'Playground', icon: Terminal },
            ] 
          },
          { 
            label: "AI Strategy", 
            items: [
              { id: 'agents', name: 'Agents Hub', icon: Bot },
              { id: 'flows', name: 'Lógica de Fluxos', icon: GitBranch },
              { id: 'governance', name: 'Governança', icon: ShieldCheck },
            ] 
          },
          { 
            label: "Intelligence", 
            items: [
              { id: 'knowledge', name: 'Knowledge Base', icon: Database },
              { id: 'insights', name: 'Insights & Data', icon: PieChart },
            ] 
          },
          { 
            label: "Admin", 
            items: [
              ...(isAdmin ? [{ id: 'configuration', name: 'Configuration', icon: Settings2 }] : []),
            ] 
          }
        ].map((group) => (
          <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:mb-6">
            <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.4em] mb-4 !text-cyan-100/50 group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = currentRoute === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.id)}
                      isActive={isActive}
                      tooltip={item.name}
                      size="lg"
                      className={cn(
                        "h-12 transition-all duration-300 relative overflow-hidden !bg-transparent",
                        isActive 
                          ? "rounded-[2rem] shadow-2xl scale-[1.05] px-5" 
                          : "rounded-2xl px-5 text-white/70 hover:!bg-white/10 hover:!text-white"
                      )}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%) !important',
                        color: '#000000 !important',
                        boxShadow: '0 0 30px rgba(6, 182, 212, 0.6), 0 0 60px rgba(6, 182, 212, 0.4), 0 10px 40px -10px rgba(14, 116, 144, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                      } : {
                        backgroundColor: 'transparent !important',
                        color: '#ffffff !important'
                      } as React.CSSProperties}
                    >
                      {isActive && (
                        <>
                          {/* Overlay de brilho animado */}
                          <div 
                            className="absolute inset-0 opacity-60"
                            style={{
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%, rgba(255,255,255,0.2) 100%)',
                              pointerEvents: 'none',
                              animation: 'shimmer 2s ease-in-out infinite'
                            }}
                          />
                          {/* Camada de brilho superior */}
                          <div 
                            className="absolute top-0 left-0 right-0 h-1/2 opacity-50"
                            style={{
                              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 100%)',
                              pointerEvents: 'none'
                            }}
                          />
                          {/* Efeito de borda brilhante */}
                          <div 
                            className="absolute inset-0 rounded-[2rem] opacity-60"
                            style={{
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent, rgba(255,255,255,0.1))',
                              pointerEvents: 'none',
                              border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}
                          />
                        </>
                      )}
                      <div 
                        className={cn(
                          "relative z-10 shrink-0 flex items-center justify-center",
                          isActive ? 'sidebar-icon-active' : 'sidebar-icon-inactive'
                        )}
                      >
                        <item.icon 
                          size={20}
                          strokeWidth={isActive ? 3 : 2.5}
                          style={{ 
                            color: isActive ? '#000000' : (theme === 'dark' ? '#60a5fa' : '#1e293b'),
                            stroke: isActive ? '#000000' : (theme === 'dark' ? '#60a5fa' : '#1e293b'),
                            fill: 'none'
                          }}
                          className="drop-shadow-sm group-data-[collapsible=icon]:!w-[24px] group-data-[collapsible=icon]:!h-[24px]"
                        />
                      </div>
                      <span 
                        className="font-black text-sm tracking-tight group-data-[collapsible=icon]:hidden relative z-10"
                        style={{ 
                          color: isActive ? '#000000' : (theme === 'dark' ? '#ffffff' : '#1e293b'),
                          textShadow: isActive ? '0 1px 2px rgba(255,255,255,0.3)' : 'none'
                        }}
                      >
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

      {/* RODAPÉ: USER & THEME (CARDS BRANCOS) */}
      <SidebarFooter className="p-4 space-y-3 bg-[#083344] group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="bg-white/10 p-4 rounded-[2rem] border border-white/10 flex items-center justify-between group hover:bg-white/20 transition-all cursor-pointer group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-auto w-full">
              <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
                <div 
                  className="h-9 w-9 rounded-xl bg-white flex items-center justify-center font-black text-xs shadow-lg group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:w-14 group-data-[collapsible=icon]:rounded-full"
                  style={{
                    color: '#0e7490',
                  }}
                >
                  {getUserInitials()}
                </div>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-xs font-black text-cyan-200 truncate leading-none mb-1">{getUserFullName()}</p>
                  <p className="text-[10px] text-cyan-300 font-bold uppercase truncate">Enterprise Plan</p>
                </div>
              </div>
              <ChevronsUpDown size={14} className="text-cyan-200 group-data-[collapsible=icon]:hidden" />
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
          className="bg-white/10 p-3 rounded-full border border-white/10 flex items-center justify-between px-6 cursor-pointer hover:bg-white/20 transition-all group-data-[collapsible=icon]:hidden"
          onClick={(e) => toggleTheme(e)}
        >
           <div className={cn("flex items-center gap-3", theme === 'dark' ? 'text-cyan-100' : 'text-slate-800')}>
              <div className="relative">
                {/* Sol - aparece no tema escuro */}
                {theme === 'dark' ? (
                  <Sun 
                    size={18} 
                    color="white" 
                    style={{
                      animation: isAnimating ? 'sunRays 0.7s ease-in-out' : undefined,
                    }}
                  />
                ) : (
                  /* Lua - aparece no tema claro */
                  <Moon 
                    size={18} 
                    color="#1e293b" 
                    style={{
                      animation: isAnimating ? 'moonRotate 0.7s ease-in-out' : undefined,
                    }}
                  />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
              </span>
           </div>
           <div 
             onClick={(e) => {
               e.stopPropagation()
               toggleTheme(e)
             }}
           >
             <Switch 
               checked={theme === 'dark'} 
               onCheckedChange={() => {
                 // O clique já foi capturado pelo onClick do container
               }}
               className="scale-75 data-[state=checked]:!bg-[#0e7490] data-[state=unchecked]:!bg-[#0e7490] [&_span]:data-[state=checked]:!bg-white [&_span]:data-[state=unchecked]:!bg-white transition-all duration-300 pointer-events-auto" 
             />
           </div>
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}
