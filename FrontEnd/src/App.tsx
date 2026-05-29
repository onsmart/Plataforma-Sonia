import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import i18n from "./i18n/config"
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
import { NavigationProvider, type RoutePath, useNavigation } from "./contexts/NavigationContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { AuthPage } from "./components/auth/AuthPage"
import { AccountSetupGate } from "./components/auth/AccountSetupGate"
import { WelcomeSplash } from "./components/auth/WelcomeSplash"
import {
  WELCOME_ENTER_MS,
  WELCOME_EXIT_MS,
  WELCOME_HOLD_MS,
} from "./components/auth/auth-theme"
import { Loader2 } from "lucide-react"
import { useUserLanguage } from "./hooks/useUserLanguage"
import { NotificationCenter } from "./components/notifications/NotificationCenter"
import { LanguageSelector } from "./components/ui/language-selector"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { SoniaCopilotProvider } from "./components/copilot/SoniaCopilotProvider"
import { Toaster } from "./components/ui/sonner"

const HomePage = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })))
const CockpitPage = lazy(() => import("./pages/Cockpit").then((module) => ({ default: module.Cockpit })))
const InboxPage = lazy(() => import("./pages/Inbox").then((module) => ({ default: module.Inbox })))
const IoTDevicesPage = lazy(() => import("./pages/IoTDevices").then((module) => ({ default: module.IoTDevices })))
const AgentsHubPage = lazy(() => import("./pages/AgentsHub").then((module) => ({ default: module.AgentsHub })))
const PlaygroundPage = lazy(() => import("./pages/Playground").then((module) => ({ default: module.Playground })))
const FlowsPage = lazy(() => import("./pages/Flows").then((module) => ({ default: module.Flows })))
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBase").then((module) => ({ default: module.KnowledgeBase })))
const GovernancePage = lazy(() => import("./pages/Governance").then((module) => ({ default: module.Governance })))
const InsightsPage = lazy(() => import("./pages/Insights").then((module) => ({ default: module.Insights })))
const ConfigurationPage = lazy(() => import("./pages/Configuration").then((module) => ({ default: module.Configuration })))
const IntegrationsPage = lazy(() => import("./components/configuration/Integrations").then((module) => ({ default: module.Integrations })))
const ProfilePage = lazy(() => import("./pages/Profile").then((module) => ({ default: module.Profile })))
const AgentConfigPage = lazy(() => import("./pages/AgentConfig").then((module) => ({ default: module.AgentConfig })))

const routeComponents: Record<RoutePath, React.ComponentType> = {
  home: HomePage,
  cockpit: CockpitPage,
  inbox: InboxPage,
  devices: IoTDevicesPage,
  agents: AgentsHubPage,
  playground: PlaygroundPage,
  flows: FlowsPage,
  knowledge: KnowledgeBasePage,
  governance: GovernancePage,
  insights: InsightsPage,
  configuration: ConfigurationPage,
  integrations: IntegrationsPage,
  profile: ProfilePage,
  "agent-config": AgentConfigPage,
}

type PostLoginPhase = "idle" | "welcome" | "entering" | "done"

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getWelcomeTimings() {
  const reduced = prefersReducedMotion()
  return {
    enterMs: reduced ? 0 : WELCOME_ENTER_MS,
    holdMs: reduced ? 800 : WELCOME_HOLD_MS,
    exitMs: reduced ? 0 : WELCOME_EXIT_MS,
  }
}

function FullscreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function AppShell({ currentRoute, getPageTitle }: { currentRoute: RoutePath; getPageTitle: () => string }) {
  const CurrentPage = routeComponents[currentRoute]

  return (
    <SidebarProvider className="[--sidebar-width:18rem]">
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 max-w-full overflow-hidden bg-background">
        <header
          className="sticky top-0 z-50 flex h-16 min-w-0 max-w-full shrink-0 items-center justify-between overflow-hidden border-b border-border bg-background pr-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
        >
          <div className="flex min-w-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 text-foreground hover:bg-muted" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">
                    SONIA Platform
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">{getPageTitle()}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelector />
            <NotificationCenter />
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden bg-background p-3 pt-0 sm:gap-4 sm:p-4">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <CurrentPage />
            </Suspense>
          </ErrorBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppContent() {
  const { currentRoute, getPageTitle } = useNavigation()
  const { session, loading } = useAuth()
  const { isChangingLanguage } = useUserLanguage()
  const [postLoginPhase, setPostLoginPhase] = useState<PostLoginPhase>("idle")
  const [contentVisible, setContentVisible] = useState(false)
  const prevSessionRef = useRef(session)
  const wasShowingAuthPageRef = useRef(false)
  const welcomeTimersRef = useRef<number[]>([])
  const [, setForceUpdate] = useState(0)

  const clearWelcomeTimers = useCallback(() => {
    welcomeTimersRef.current.forEach((id) => window.clearTimeout(id))
    welcomeTimersRef.current = []
  }, [])

  const scheduleWelcome = useCallback(() => {
    clearWelcomeTimers()
    const { enterMs, holdMs, exitMs } = getWelcomeTimings()

    setPostLoginPhase("welcome")
    setContentVisible(false)

    const t1 = window.setTimeout(() => {
      setPostLoginPhase("entering")
    }, enterMs + holdMs)
    welcomeTimersRef.current.push(t1)

    const t2 = window.setTimeout(() => {
      setContentVisible(true)
    }, enterMs + holdMs + 50)
    welcomeTimersRef.current.push(t2)

    const t3 = window.setTimeout(() => {
      setPostLoginPhase("done")
    }, enterMs + holdMs + exitMs)
    welcomeTimersRef.current.push(t3)
  }, [clearWelcomeTimers])

  useEffect(() => {
    const handleAdded = () => {
      setForceUpdate((prev) => prev + 1)
    }

    const handleLoaded = () => {
      setForceUpdate((prev) => prev + 1)
    }

    i18n.on("added", handleAdded)
    i18n.on("loaded", handleLoaded)

    return () => {
      i18n.off("added", handleAdded)
      i18n.off("loaded", handleLoaded)
    }
  }, [])

  useEffect(() => {
    if (loading) {
      return
    }

    const prevSession = prevSessionRef.current
    const isNewLogin = !prevSession && session && wasShowingAuthPageRef.current

    if (session) {
      if (isNewLogin) {
        scheduleWelcome()
        prevSessionRef.current = session
        wasShowingAuthPageRef.current = false
        return
      }

      if (postLoginPhase === "idle") {
        setPostLoginPhase("done")
        setContentVisible(true)
        prevSessionRef.current = session
        wasShowingAuthPageRef.current = false
      }

      return
    }

    wasShowingAuthPageRef.current = true
    clearWelcomeTimers()
    setPostLoginPhase("idle")
    setContentVisible(false)
    prevSessionRef.current = null
  }, [session, loading, postLoginPhase, scheduleWelcome, clearWelcomeTimers])

  useEffect(() => {
    return () => clearWelcomeTimers()
  }, [clearWelcomeTimers])

  if (loading) {
    return <FullscreenLoader />
  }

  if (!session) {
    return <AuthPage />
  }

  const showWelcome = postLoginPhase === "welcome" || postLoginPhase === "entering"
  const appEntering = postLoginPhase === "entering" || postLoginPhase === "done"

  return (
    <AccountSetupGate>
      <>
        <div
          style={{
            opacity: appEntering && contentVisible ? 1 : 0,
            transform:
              appEntering && contentVisible
                ? "translateY(0) scale(1)"
                : "translateY(30px) scale(0.95)",
            transition: contentVisible ? "all 0.9s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
            willChange: "opacity, transform",
            pointerEvents: appEntering && contentVisible && !isChangingLanguage ? "auto" : "none",
          }}
        >
          <AppShell currentRoute={currentRoute} getPageTitle={getPageTitle} />
        </div>

        <WelcomeSplash visible={showWelcome} exiting={postLoginPhase === "entering"} />

        {isChangingLanguage && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="animate-pulse text-sm font-medium text-muted-foreground">Carregando traducoes...</p>
            </div>
          </div>
        )}
      </>
    </AccountSetupGate>
  )
}

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
