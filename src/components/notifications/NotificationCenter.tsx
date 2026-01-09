import { useState, useEffect } from "react"
import { Bell, Check } from "lucide-react"
import { Button } from "../ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import { ScrollArea } from "../ui/scroll-area"
import { NotificationItem } from "./NotificationItem"
import { AgentService, Notification } from "../../services/api"
import { Badge } from "../ui/badge"
import { toast } from "sonner@2.0.3"

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [open, setOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = async () => {
        try {
            const data = await AgentService.getNotifications()
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.read).length)
        } catch (e) {
            // Silently fail
        }
    }

    useEffect(() => {
        fetchNotifications()
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleMarkRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => 
                n.id === id ? { ...n, read: true } : n
            ))
            setUnreadCount(prev => Math.max(0, prev - 1))
            
            await AgentService.markNotificationRead(id)
        } catch (e) {
            toast.error("Failed to update notification")
            fetchNotifications() // Revert on error
        }
    }

    const handleMarkAllRead = async () => {
        try {
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
            if (unreadIds.length === 0) return

            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
            
            await AgentService.markNotificationRead('all')
            toast.success("All notifications marked as read")
        } catch (e) {
            toast.error("Failed to update notifications")
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 border border-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold leading-none">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto px-2 text-xs"
                            onClick={handleMarkAllRead}
                        >
                            <Check className="mr-2 h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem 
                                    key={notification.id} 
                                    notification={notification} 
                                    onRead={handleMarkRead}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
