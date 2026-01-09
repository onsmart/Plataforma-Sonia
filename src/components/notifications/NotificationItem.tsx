import { Notification } from "../../services/api"
import { cn } from "../../lib/utils"
import { Info, AlertTriangle, AlertOctagon, CheckCircle2, X } from "lucide-react"
import { Button } from "../ui/button"

interface NotificationItemProps {
    notification: Notification
    onRead: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
    const icons = {
        info: <Info className="h-4 w-4 text-blue-500" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        error: <AlertOctagon className="h-4 w-4 text-red-500" />,
        success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    }

    return (
        <div className={cn(
            "relative flex gap-4 p-4 transition-colors hover:bg-muted/50",
            !notification.read && "bg-muted/20"
        )}>
            <div className="mt-1">
                {icons[notification.type] || icons.info}
            </div>
            <div className="flex-1 space-y-1">
                <p className={cn("text-sm font-medium leading-none", !notification.read && "font-semibold")}>
                    {notification.title}
                </p>
                <p className="text-sm text-muted-foreground">
                    {notification.message}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                    {notification.timeAgo}
                </p>
            </div>
            {!notification.read && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRead(notification.id)
                    }}
                >
                    <span className="sr-only">Mark as read</span>
                    <div className="h-2 w-2 rounded-full bg-primary" />
                </Button>
            )}
            {!notification.read && (
                 <div className="h-2 w-2 rounded-full bg-primary absolute top-4 right-4" />
            )}
        </div>
    )
}
