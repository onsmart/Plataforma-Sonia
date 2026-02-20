import React from "react"
import "./styles/globals.css"
import { AppSidebar } from "./components/layout/AppSidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb"
import { Separator } from "./components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar"
import { ThemeProvider } from "./components/theme-provider"
import { ModeToggle } from "./components/mode-toggle"
import { NavigationProvider, useNavigation } from "./contexts/NavigationContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { AuthPage } from "./components/auth/AuthPage"
import { Loader2 } from "lucide-react"

// New Pages
import { Cockpit } from "./pages/Cockpit"
import { AgentsHub } from "./pages/AgentsHub"
import { Playground } from "./pages/Playground"
import { KnowledgeBase } from "./pages/KnowledgeBase"
import { Governance } from "./pages/Governance"
import { Insights } from "./pages/Insights"
import { Configuration } from "./pages/Configuration"
import { Inbox } from "./pages/Inbox"
import { IoTDevices } from "./pages/IoTDevices"
import { Profile } from "./pages/Profile"
import { Flows } from "./pages/Flows"
import { AgentConfig } from "./pages/AgentConfig"
import { NotificationCenter } from "./components/notifications/NotificationCenter"

function AppContent() {
  const { currentRoute, getPageTitle, navigate } = useNavigation()
  const { session, loading, hasCompany } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  // ✅ Bloquear TODO o sistema se não tiver empresa (exceto configuração > team)
  if (!hasCompany && currentRoute !== 'configuration') {
    // Forçar navegação para configuração
    if (window.location.hash !== '#configuration') {
      navigate('configuration')
    }
    // Mostrar apenas a tela de configuração
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 pr-4">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1 text-foreground hover:bg-accent" />
              <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">SONIA Platform</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-medium">Configurações</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-hidden">
            <Configuration />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 pr-4">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 text-foreground hover:bg-accent" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">SONIA Platform</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-foreground font-medium">{getPageTitle()}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <ModeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-hidden">
          {currentRoute === 'cockpit' && <Cockpit />}
          {currentRoute === 'inbox' && <Inbox />}
          {currentRoute === 'devices' && <IoTDevices />}
          {currentRoute === 'agents' && <AgentsHub />}
          {currentRoute === 'playground' && <Playground />}
          {currentRoute === 'flows' && <Flows />}
          {currentRoute === 'knowledge' && <KnowledgeBase />}
          {currentRoute === 'governance' && <Governance />}
          {currentRoute === 'insights' && <Insights />}
          {currentRoute === 'configuration' && <Configuration />}
          {currentRoute === 'profile' && <Profile />}
          {currentRoute === 'agent-config' && <AgentConfig />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

import { SoniaCopilotProvider } from "./components/copilot/SoniaCopilotProvider"
import { Toaster } from "./components/ui/sonner"

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <NavigationProvider>
          <SoniaCopilotProvider>
            <AppContent />
            <Toaster />
          </SoniaCopilotProvider>
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
