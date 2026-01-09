import { useEffect, useState } from "react"
import { 
    Activity, 
    Video, 
    Thermometer, 
    Lock, 
    Wifi, 
    WifiOff, 
    Plus, 
    Settings, 
    Power,
    ShieldCheck,
    RefreshCw
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { AgentService, Device } from "../services/api"
import { toast } from "sonner@2.0.3"
import { motion } from "motion/react"

export function IoTDevices() {
    const [devices, setDevices] = useState<Device[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSentinelActive, setIsSentinelActive] = useState(false)
    const [newDevice, setNewDevice] = useState<Partial<Device>>({
        name: "",
        type: "sensor",
        location: "Meeting Room A",
        status: "online"
    })

    useEffect(() => {
        loadDevices()
        checkSentinelStatus()
    }, [])

    const checkSentinelStatus = async () => {
        try {
            const data = await AgentService.listAgents()
            const sentinel = data.agents.find((a: any) => a.name === "Sentinel One")
            if (sentinel) setIsSentinelActive(true)
        } catch (e) {}
    }

    const loadDevices = async () => {
        setIsLoading(true)
        try {
            const data = await AgentService.listDevices()
            setDevices(data)
            
            // If empty, seed some demos
            if (data.length === 0) {
                await seedDemoDevices()
            }
        } catch (e) {
            toast.error("Failed to load devices")
        } finally {
            setIsLoading(false)
        }
    }

    const seedDemoDevices = async () => {
        const demos: Partial<Device>[] = [
            { name: "Lobby Camera 01", type: "camera", location: "Lobby", status: "online", capabilities: ["video_stream", "face_detection"] },
            { name: "Executive Room Sensor", type: "thermostat", location: "Boardroom", status: "online", capabilities: ["temperature", "humidity", "occupancy"] },
            { name: "Main Entrance Lock", type: "lock", location: "Entrance", status: "online", capabilities: ["lock", "unlock", "access_log"] }
        ]
        
        for (const d of demos) {
            await AgentService.createDevice(d)
        }
        const data = await AgentService.listDevices()
        setDevices(data)
    }

    const handleCreate = async () => {
        try {
            await AgentService.createDevice(newDevice)
            toast.success("Device connected successfully")
            setIsCreateOpen(false)
            loadDevices()
        } catch (e) {
            toast.error("Failed to connect device")
        }
    }

    const handleAction = async (id: string, action: string) => {
        const promise = AgentService.triggerDeviceAction(id, action, {})
        
        toast.promise(promise, {
            loading: 'Sending command to device...',
            success: (data: any) => {
                if (action === 'snapshot' && data.imageUrl) {
                    return (
                        <div className="space-y-2">
                            <span className="font-bold block">Snapshot Analyzed</span>
                            <div className="relative aspect-video w-full rounded-md overflow-hidden">
                                <img src={data.imageUrl} alt="Snapshot" className="object-cover w-full h-full" />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-3">
                                {data.analysis}
                            </p>
                        </div>
                    )
                }
                return 'Command executed successfully'
            },
            error: 'Device not responding'
        })
    }

    const getIcon = (type: string) => {
        switch(type) {
            case 'camera': return <Video className="h-5 w-5" />
            case 'thermostat': return <Thermometer className="h-5 w-5" />
            case 'lock': return <Lock className="h-5 w-5" />
            case 'display': return <Activity className="h-5 w-5" />
            default: return <Activity className="h-5 w-5" />
        }
    }

    return (
        <div className="flex-1 space-y-6 overflow-y-auto p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">IoT & Physical Devices</h2>
                    <p className="text-muted-foreground mt-2">
                        Manage connected sensors, cameras, and physical actuators.
                    </p>
                </div>
                {isSentinelActive && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-purple-500/10 border border-purple-500/20 text-purple-600 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Sentinel One Active Protection
                        <span className="relative flex h-2 w-2 ml-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                        </span>
                    </motion.div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                     <Button variant="outline" size="icon" onClick={loadDevices} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Connect Device
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Connect New Device</DialogTitle>
                                <DialogDescription>
                                    Register a physical device to the SONIA platform gateway.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Name</Label>
                                    <Input 
                                        className="col-span-3" 
                                        value={newDevice.name}
                                        onChange={e => setNewDevice({...newDevice, name: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Type</Label>
                                    <Select 
                                        value={newDevice.type} 
                                        onValueChange={(val: any) => setNewDevice({...newDevice, type: val})}
                                    >
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="camera">Camera (Vision)</SelectItem>
                                            <SelectItem value="sensor">Sensor</SelectItem>
                                            <SelectItem value="lock">Smart Lock</SelectItem>
                                            <SelectItem value="thermostat">Thermostat</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Location</Label>
                                    <Input 
                                        className="col-span-3" 
                                        value={newDevice.location}
                                        onChange={e => setNewDevice({...newDevice, location: e.target.value})}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreate}>Connect</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {devices.map((device) => (
                    <motion.div 
                        key={device.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/20">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {getIcon(device.type)}
                                    {device.name}
                                </CardTitle>
                                {device.status === 'online' ? (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 gap-1">
                                        <Wifi className="h-3 w-3" /> Online
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="gap-1">
                                        <WifiOff className="h-3 w-3" /> Offline
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="grid gap-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Location:</span>
                                        <span className="font-medium">{device.location}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Type:</span>
                                        <span className="capitalize">{device.type}</span>
                                    </div>
                                    <div className="mt-4">
                                        <span className="text-xs text-muted-foreground mb-2 block">Live Telemetry</span>
                                        <div className="bg-slate-950 rounded-md p-3 font-mono text-[10px] text-green-500 h-20 overflow-hidden">
                                            {device.type === 'camera' && (
                                                <>
                                                    &gt; stream_status: active<br/>
                                                    &gt; fps: 30<br/>
                                                    &gt; objects_detected: [person, laptop]
                                                </>
                                            )}
                                            {device.type === 'thermostat' && (
                                                <>
                                                    &gt; temp: 22.5°C<br/>
                                                    &gt; humidity: 45%<br/>
                                                    &gt; mode: eco
                                                </>
                                            )}
                                            {device.type === 'lock' && (
                                                <>
                                                    &gt; state: locked<br/>
                                                    &gt; battery: 87%<br/>
                                                    &gt; last_access: 14:02 by Admin
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 p-2 flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-8">
                                    <Settings className="h-3 w-3 mr-1" /> Config
                                </Button>
                                {device.type === 'lock' && (
                                    <Button size="sm" className="h-8" onClick={() => handleAction(device.id, 'unlock')}>
                                        Unlock
                                    </Button>
                                )}
                                {device.type === 'camera' && (
                                    <Button size="sm" className="h-8" onClick={() => handleAction(device.id, 'snapshot')}>
                                        Snapshot
                                    </Button>
                                )}
                                {device.type !== 'lock' && device.type !== 'camera' && (
                                    <Button variant="destructive" size="sm" className="h-8" onClick={() => handleAction(device.id, 'simulate_failure')}>
                                        <Power className="h-3 w-3 mr-1" /> Fail
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
