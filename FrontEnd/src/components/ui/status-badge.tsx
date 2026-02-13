import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./utils"

const statusBadgeVariants = cva(
  "gap-1 border",
  {
    variants: {
      status: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
        warning: "border-yellow-500/20 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
        error: "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20",
        neutral: "border-muted bg-muted/50 text-muted-foreground hover:bg-muted",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
      icon?: React.ElementType;
    }

function StatusBadge({ className, status, icon: Icon, children, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ status }), "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)} {...props}>
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {children}
    </div>
  )
}

export { StatusBadge, statusBadgeVariants }
