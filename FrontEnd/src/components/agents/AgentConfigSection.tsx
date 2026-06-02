import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"
import {
  agentConfigHeading,
  agentConfigPanel,
  agentConfigPanelPadding,
  agentConfigSectionIcon,
  agentConfigSubheading,
} from "../../lib/agent-config-layout"

interface AgentConfigSectionProps {
  icon?: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
  headerExtra?: ReactNode
}

export function AgentConfigSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  headerExtra,
}: AgentConfigSectionProps) {
  return (
    <section className={cn(agentConfigPanel, agentConfigPanelPadding, "space-y-6", className)}>
      <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon ? (
            <div className={agentConfigSectionIcon}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className={agentConfigHeading}>{title}</h2>
            {description ? <p className={agentConfigSubheading}>{description}</p> : null}
          </div>
        </div>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      {children}
    </section>
  )
}
