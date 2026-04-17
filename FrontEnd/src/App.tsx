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
import { Home } from "./pages/Home"
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
import { ErrorBoundary } from "./components/ErrorBoundary"

function AppContent() {
  const { currentRoute, getPageTitle, navigate } = useNavigation()
  const { session, loading, hasCompany } = useAuth()
  // Carregar idioma do usuário
  const { isChangingLanguage } = useUserLanguage()
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

  // Mostrar loading apenas durante autenticação inicial
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
          <SidebarProvider className="[--sidebar-width:18rem]">
            <AppSidebar />
            <SidebarInset className="min-h-0 bg-background">
            <header
              className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background pr-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
            >
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1 text-foreground hover:bg-muted" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">SONIA Platform</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium text-foreground">{getPageTitle()}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <NotificationCenter />
              </div>
            </header>
            <div
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-3 pt-0 sm:gap-4 sm:p-4"
            >
              <ErrorBoundary>
                {currentRoute === 'home' && <Home />}
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
              </ErrorBoundary>
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

  // Rota inicial: #home (NavigationContext)
  // Removida a lógica que forçava navegação para configuration

  return (
    <>
      <div 
        style={{
          transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(0) scale(1)',
          transition: contentVisible ? 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'opacity, transform',
          // Deixar conteúdo invisível durante mudança de idioma
          opacity: isChangingLanguage ? 0.3 : (contentVisible ? 1 : 1),
          pointerEvents: isChangingLanguage ? 'none' : 'auto'
        }}
      >
        <SidebarProvider className="[--sidebar-width:18rem]">
          <AppSidebar />
          <SidebarInset className="min-h-0 bg-background">
          <header
            className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background pr-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
          >
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1 text-foreground hover:bg-muted" />
              <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">SONIA Platform</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium text-foreground">{getPageTitle()}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <NotificationCenter />
            </div>
          </header>
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-3 pt-0 sm:gap-4 sm:p-4"
          >
            <ErrorBoundary>
              {currentRoute === 'home' && <Home />}
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
            </ErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
      </div>
      
      {/* Overlay de loading durante mudança de idioma */}
      {isChangingLanguage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando traduções...
            </p>
          </div>
        </div>
      )}
    </>
  )
}

import { SoniaCopilotProvider } from "./components/copilot/SoniaCopilotProvider"
import { Toaster } from "./components/ui/sonner"

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}
