import * as React from "react"
import {
  Bot,
  Command,
  PieChart,
  Settings2,
  ShieldCheck,
  LayoutDashboard,
  Moon,
  Sun,
  Laptop,
  ChevronsUpDown,
  MessageSquare,
  Database,
  LogOut,
  User,
  GitBranch
} from "lucide-react"
import { useTheme } from "next-themes"
import { useNavigation } from "../../contexts/NavigationContext"
import { createClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel
} from "../ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setTheme } = useTheme()
  const { navigate, currentRoute } = useNavigation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate('cockpit')}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SONIA Platform</span>
                <span className="truncate text-xs">v3.0 Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Cockpit" 
                        onClick={() => navigate('cockpit')}
                        isActive={currentRoute === 'cockpit'}
                    >
                        <LayoutDashboard />
                        <span>Cockpit</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Universal Inbox" 
                        onClick={() => navigate('inbox')}
                        isActive={currentRoute === 'inbox'}
                    >
                        <MessageSquare />
                        <span>Inbox</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Playground" 
                        onClick={() => navigate('playground')}
                        isActive={currentRoute === 'playground'}
                    >
                        <MessageSquare />
                        <span>Playground</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="IoT & Devices" 
                        onClick={() => navigate('devices')}
                        isActive={currentRoute === 'devices'}
                    >
                        <Laptop />
                        <span>IoT & Devices</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
            <SidebarGroupLabel>AI Strategy</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Agents & Workflows" 
                        onClick={() => navigate('agents')}
                        isActive={currentRoute === 'agents'}
                    >
                        <Bot />
                        <span>Agents & Workflows</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Flows" 
                        onClick={() => navigate('flows')}
                        isActive={currentRoute === 'flows'}
                    >
                        <GitBranch />
                        <span>Flows</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Governance" 
                        onClick={() => navigate('governance')}
                        isActive={currentRoute === 'governance'}
                    >
                        <ShieldCheck />
                        <span>Governance</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
            <SidebarGroupLabel>Intelligence</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Knowledge Base" 
                        onClick={() => navigate('knowledge')}
                        isActive={currentRoute === 'knowledge'}
                    >
                        <Database />
                        <span>Knowledge Base</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Insights & Data" 
                        onClick={() => navigate('insights')}
                        isActive={currentRoute === 'insights'}
                    >
                        <PieChart />
                        <span>Insights & Data</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>

         <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                        tooltip="Configuration" 
                        onClick={() => navigate('configuration')}
                        isActive={currentRoute === 'configuration'}
                    >
                        <Settings2 />
                        <span>Configuration</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Theme</span>
                    <span className="truncate text-xs">Select mode</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Laptop className="mr-2 h-4 w-4" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground">
                    <span className="font-bold text-xs">AD</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Admin User</span>
                    <span className="truncate text-xs">admin@sonia.ai</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => navigate('profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  try {
                    const supabaseUrl = `https://${projectId}.supabase.co`
                    const supabase = createClient(supabaseUrl, publicAnonKey)
                    await supabase.auth.signOut()
                    window.location.reload()
                  } catch (error) {
                    console.error("Logout failed:", error)
                  }
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
