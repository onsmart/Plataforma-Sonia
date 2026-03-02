import React, { useState, useEffect, useRef } from "react"
import i18n from "./i18n/config" // Inicializar i18n
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
import { NavigationProvider, useNavigation } from "./contexts/NavigationContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { AuthPage } from "./components/auth/AuthPage"
import { Loader2 } from "lucide-react"
import { useUserLanguage } from "./hooks/useUserLanguage"

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
import { LanguageSelector } from "./components/ui/language-selector"

function AppContent() {
  const { currentRoute, getPageTitle, navigate } = useNavigation()
  const { session, loading, hasCompany } = useAuth()
  // Carregar idioma do usuário
  useUserLanguage()
  const [showAuthTransition, setShowAuthTransition] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)
  const prevSessionRef = useRef(session)
  const wasShowingAuthPageRef = useRef(false)
  const [, setForceUpdate] = useState(0)
  
  // Forçar re-render quando traduções forem carregadas
  useEffect(() => {
    const handleAdded = () => {
      console.log('[App] Traduções adicionadas, forçando re-render')
      setForceUpdate(prev => prev + 1)
    }
    
    const handleLoaded = () => {
      console.log('[App] Traduções carregadas, forçando re-render')
      setForceUpdate(prev => prev + 1)
    }
    
    i18n.on('added', handleAdded)
    i18n.on('loaded', handleLoaded)
    
    return () => {
      i18n.off('added', handleAdded)
      i18n.off('loaded', handleLoaded)
    }
  }, [])

  useEffect(() => {
    if (loading) {
      // Durante carregamento, não fazer nada
      return
    }
    
    const prevSession = prevSessionRef.current
    const isNewLogin = !prevSession && session && wasShowingAuthPageRef.current
    
    if (session) {
      if (isNewLogin) {
        // Login novo detectado (AuthPage estava sendo mostrado e agora temos session), mostrar transição
        console.log('[App] Novo login detectado, iniciando transição...')
        setShowAuthTransition(true)
        setContentVisible(false)
        const timer = setTimeout(() => {
          console.log('[App] Transição terminada, mostrando conteúdo...')
          setShowAuthTransition(false)
          setTimeout(() => {
            setContentVisible(true)
          }, 100)
        }, 1500)
        prevSessionRef.current = session
        wasShowingAuthPageRef.current = false
        return () => clearTimeout(timer)
      } else if (!contentVisible) {
        // Session já existia (persistida), mostrar conteúdo imediatamente
        console.log('[App] Session persistida, mostrando conteúdo imediatamente...')
        setContentVisible(true)
        prevSessionRef.current = session
        wasShowingAuthPageRef.current = false
      }
    } else {
      // Sem session, AuthPage será mostrado
      wasShowingAuthPageRef.current = true
      setShowAuthTransition(false)
      setContentVisible(false)
      prevSessionRef.current = null
    }
  }, [session, loading, contentVisible])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Renderizar AuthPage apenas se não há session OU se está em transição
  if (!session) {
    return <AuthPage />
  }

  // Durante a transição, mostrar AuthPage sobreposto
  if (showAuthTransition) {
    return (
      <>
        <div 
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
            transition: contentVisible ? 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            willChange: 'opacity, transform',
            pointerEvents: contentVisible ? 'auto' : 'none'
          }}
        >
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
                <LanguageSelector />
                <NotificationCenter />
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
        </div>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
          <AuthPage />
        </div>
      </>
    )
  }

  // Sistema sempre inicia no cockpit conforme NavigationContext
  // Removida a lógica que forçava navegação para configuration

  return (
    <div 
      style={{
        opacity: contentVisible ? 1 : 1,
        transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(0) scale(1)',
        transition: contentVisible ? 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        willChange: 'opacity, transform'
      }}
    >
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
            <LanguageSelector />
            <NotificationCenter />
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
    </div>
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
