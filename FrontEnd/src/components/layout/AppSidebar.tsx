import * as React from "react"
import {
  Bot,
  Command,
  PieChart,
  Settings2,
  ShieldCheck,
  LayoutDashboard,
  Sun,
  Laptop,
  ChevronsUpDown,
  MessageSquare,
  Database,
  GitBranch,
  Terminal
} from "lucide-react"
import { useTheme } from "next-themes"
import { useNavigation } from "../../contexts/NavigationContext"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
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
`

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme, theme } = useTheme()
  const { navigate, currentRoute } = useNavigation()

  // COR DA GOVERNANÇA (Ciano Vibrante Sonia)
  const SONIA_CYAN = "#0891b2"; 
  const SONIA_DARK_CYAN = "#0e7490";

  return (
    <>
      <style>{shimmerStyle}</style>
      <Sidebar 
        collapsible="icon" 
        {...props}
        // MARRETA: Usamos o !bg e o seletor interno para garantir que fique azul
        className="!bg-[#0e7490] [&>div]:!bg-[#0e7490] border-r-4 border-white/10 shadow-2xl"
        style={{
          backgroundColor: '#0e7490',
          "--sidebar-background": '#0e7490',
          "--sidebar-foreground": "#ffffff",
        } as React.CSSProperties}
      >
      {/* HEADER: LOGO */}
      <SidebarHeader className="p-8">
        <SidebarMenu>
          <SidebarMenuItem>
            <div 
              className="flex items-center gap-4 cursor-pointer group"
              onClick={() => navigate('cockpit')}
            >
              <div className="flex aspect-square size-10 items-center justify-center rounded-2xl bg-white shadow-xl group-hover:scale-110 transition-transform shrink-0">
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
      <SidebarContent className="px-4 space-y-10">
        {[
          { 
            label: "Operations", 
            items: [
              { id: 'cockpit', name: 'Cockpit', icon: LayoutDashboard },
              { id: 'inbox', name: 'Universal Inbox', icon: MessageSquare },
              { id: 'playground', name: 'Playground', icon: Terminal },
              { id: 'devices', name: 'IoT & Devices', icon: Laptop },
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
              { id: 'configuration', name: 'Configuration', icon: Settings2 },
            ] 
          }
        ].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.4em] mb-4 !text-cyan-100/50 group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = currentRoute === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <button 
                      onClick={() => navigate(item.id)} 
                      className={cn(
                        "h-12 transition-all duration-300 flex items-center gap-4 w-full outline-none",
                        isActive 
                          ? "rounded-[2rem] shadow-2xl scale-[1.05] relative overflow-hidden px-5 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" 
                          : "rounded-2xl text-white/70 hover:text-white hover:bg-white/10 px-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12"
                      )}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%)',
                        color: '#000000',
                        boxShadow: '0 0 30px rgba(6, 182, 212, 0.6), 0 0 60px rgba(6, 182, 212, 0.4), 0 10px 40px -10px rgba(14, 116, 144, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                      } : {
                        backgroundColor: 'transparent',
                        color: 'inherit'
                      }}
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
                      <item.icon 
                        size={20} 
                        strokeWidth={isActive ? 3 : 2.5}
                        style={{ color: isActive ? '#000000' : '#0e7490' }}
                        className={isActive ? 'relative z-10 drop-shadow-sm' : 'group-data-[collapsible=icon]:shrink-0'}
                      />
                      <span 
                        className="font-black text-sm tracking-tight group-data-[collapsible=icon]:hidden relative z-10"
                        style={{ color: isActive ? '#000000' : 'inherit', textShadow: isActive ? '0 1px 2px rgba(255,255,255,0.3)' : 'none' }}
                      >
                        {item.name}
                      </span>
                    </button>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* RODAPÉ: USER & THEME (CARDS BRANCOS) */}
      <SidebarFooter className="p-4 space-y-3 bg-[#083344]">
        <div className="bg-white/10 p-4 rounded-[2rem] border border-white/10 flex items-center justify-between group hover:bg-white/20 transition-all cursor-pointer">
           <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center font-black text-xs text-[#0e7490] shadow-lg">
                AD
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-black text-white truncate leading-none mb-1">Admin User</p>
                <p className="text-[10px] text-cyan-300 font-bold uppercase truncate">Enterprise Plan</p>
              </div>
           </div>
           <ChevronsUpDown size={14} className="text-cyan-200 group-data-[collapsible=icon]:hidden" />
        </div>

        <div className="bg-white/10 p-3 rounded-full border border-white/10 flex items-center justify-between px-6 group-data-[collapsible=icon]:hidden">
           <div className="flex items-center gap-3 text-cyan-100">
              <Sun size={18} color="white" />
              <span className="text-[10px] font-black uppercase tracking-widest">Tema Dark</span>
           </div>
           <Switch 
             checked={theme === 'dark'} 
             onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
             className="scale-75 data-[state=checked]:!bg-white [&_span]:data-[state=checked]:!bg-[#0e7490]" 
           />
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  )
}
