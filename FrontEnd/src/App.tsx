import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import i18n from "./i18n/config"
import "./styles/globals.css"
import "./components/auth/WelcomeSplash.css"
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
  SidebarRail,
  SidebarTrigger,
} from "./components/ui/sidebar"
import { ThemeProvider } from "./components/theme-provider"
import { NavigationProvider, type RoutePath, useNavigation } from "./contexts/NavigationContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { AuthPage } from "./components/auth/AuthPage"
import { AccountSetupGate } from "./components/auth/AccountSetupGate"
import { WelcomeSplash } from "./components/auth/WelcomeSplash"
import { LogoutOverlay } from "./components/auth/LogoutOverlay"
import { getWelcomeTimings } from "./components/auth/auth-theme"
import { Loader2 } from "lucide-react"
import { useUserLanguage } from "./hooks/useUserLanguage"
import { NotificationCenter } from "./components/notifications/NotificationCenter"
import { LanguageSelector } from "./components/ui/language-selector"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { SoniaCopilotProvider } from "./components/copilot/SoniaCopilotProvider"
import { Toaster } from "./components/ui/sonner"
import { cn } from "./components/ui/utils"
import Aurora from "./components/ui/Aurora"
import { useTheme } from "next-themes"

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
const PlatformHealthPage = lazy(() => import("./pages/PlatformHealth").then((module) => ({ default: module.PlatformHealth })))
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
  "platform-health": PlatformHealthPage,
  profile: ProfilePage,
  "agent-config": AgentConfigPage,
}

type PostLoginPhase = "idle" | "welcome" | "entering" | "done"

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
    <SidebarProvider className="[--sidebar-width:18rem] [--sidebar-width-icon:4.75rem]">
      <AppSidebar />
      <SidebarRail className="hidden md:flex" />
      <SidebarInset className="min-h-0 min-w-0 max-w-full overflow-hidden bg-transparent">
        {/* Header completamente transparente — sem fundo, sem blur, integrado ao background */}
        <header
          className="sticky top-0 z-50 flex h-14 min-w-0 max-w-full shrink-0 items-center justify-between overflow-hidden bg-transparent pr-4 transition-[height,padding,margin] duration-[var(--sidebar-transition-duration,420ms)] ease-[var(--sidebar-transition-ease,cubic-bezier(0.22,1,0.36,1))] group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 sm:h-16"
        >
          <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 text-foreground hover:bg-muted/60" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-border/30" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink
                    href="#"
                    className="font-medium text-foreground/75 hover:text-foreground"
                    style={{ textShadow: "0 0 12px rgba(255,255,255,0.6)" }}
                  >
                    SONIA Platform
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-foreground/30" />
                <BreadcrumbItem>
                  <BreadcrumbPage
                    className="font-semibold text-foreground"
                    style={{ textShadow: "0 0 12px rgba(255,255,255,0.6)" }}
                  >
                    {getPageTitle()}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSelector />
            <NotificationCenter />
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden p-3 pt-0 sm:gap-4 sm:p-4">
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
  const { session, loading, signingOut } = useAuth()
  const { isChangingLanguage } = useUserLanguage()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const auroraColors = isDark
    ? ["#0c1a3a", "#1e40af", "#4f46e5"]
    : ["#93c5fd", "#2563eb", "#7c3aed"]
  const [postLoginPhase, setPostLoginPhase] = useState<PostLoginPhase>("idle")
  const [contentVisible, setContentVisible] = useState(false)
  const [authPageEntering, setAuthPageEntering] = useState(false)
  const prevSessionRef = useRef(session)
  const prevSigningOutRef = useRef(false)
  const wasShowingAuthPageRef = useRef(false)
  const welcomeTimersRef = useRef<number[]>([])
  const [, setForceUpdate] = useState(0)

  const clearWelcomeTimers = useCallback(() => {
    welcomeTimersRef.current.forEach((id) => window.clearTimeout(id))
    welcomeTimersRef.current = []
  }, [])

  const scheduleWelcome = useCallback(() => {
    clearWelcomeTimers()
    const { enterMs, holdMs, exitMs, appOverlapMs } = getWelcomeTimings()

    setPostLoginPhase("welcome")
    setContentVisible(false)

    const enteringAt = enterMs + holdMs
    const contentAt = Math.max(0, enteringAt - appOverlapMs)

    const tContent = window.setTimeout(() => {
      setContentVisible(true)
    }, contentAt)
    welcomeTimersRef.current.push(tContent)

    const tEntering = window.setTimeout(() => {
      setPostLoginPhase("entering")
    }, enteringAt)
    welcomeTimersRef.current.push(tEntering)

    const tDone = window.setTimeout(() => {
      setPostLoginPhase("done")
    }, enteringAt + exitMs)
    welcomeTimersRef.current.push(tDone)
  }, [clearWelcomeTimers])

  useEffect(() => {
    const handleAdded = () => setForceUpdate((prev) => prev + 1)
    const handleLoaded = () => setForceUpdate((prev) => prev + 1)

    i18n.on("added", handleAdded)
    i18n.on("loaded", handleLoaded)

    return () => {
      i18n.off("added", handleAdded)
      i18n.off("loaded", handleLoaded)
    }
  }, [])

  useEffect(() => {
    if (prevSigningOutRef.current && !signingOut && !session) {
      setAuthPageEntering(true)
    }
    prevSigningOutRef.current = signingOut
  }, [signingOut, session])

  useEffect(() => {
    if (loading || signingOut) {
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
  }, [session, loading, signingOut, postLoginPhase, scheduleWelcome, clearWelcomeTimers])

  useEffect(() => {
    return () => clearWelcomeTimers()
  }, [clearWelcomeTimers])

  if (loading && !signingOut) {
    return <FullscreenLoader />
  }

  if (signingOut) {
    return <LogoutOverlay />
  }

  if (!session) {
    return (
      <AuthPage
        entering={authPageEntering}
        onEnterAnimationEnd={() => setAuthPageEntering(false)}
      />
    )
  }

  const showWelcome = postLoginPhase === "welcome" || postLoginPhase === "entering"
  const appShouldShow = postLoginPhase === "entering" || postLoginPhase === "done"

  return (
    <AccountSetupGate>
      <>
        {/* Aurora WebGL — apenas no tema escuro */}
        {isDark && (
          <div
            className="pointer-events-none fixed inset-0"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <Aurora
              colorStops={auroraColors}
              blend={0.5}
              amplitude={0.8}
              speed={0.3}
            />
          </div>
        )}

        {/* Conteúdo principal em z:1 — sempre acima da Aurora */}
        <div
          className={cn(
            "app-shell-enter",
            appShouldShow && contentVisible && "app-shell-enter--visible"
          )}
          style={{
            position: "relative",
            zIndex: 1,
            pointerEvents:
              appShouldShow && contentVisible && !isChangingLanguage ? "auto" : "none",
          }}
        >
          <AppShell currentRoute={currentRoute} getPageTitle={getPageTitle} />
        </div>

        <WelcomeSplash visible={showWelcome} exiting={postLoginPhase === "entering"} />

        {isChangingLanguage && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="animate-pulse text-sm font-medium text-muted-foreground">
                Carregando traducoes...
              </p>
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
