import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { AgentService } from "../../services/api"
import { toast } from "sonner@2.0.3"
import { Loader2, MessageCircle, Phone } from "lucide-react"

export function Integrations() {
    const [loading, setLoading] = useState(false)
    const [twilioConfig, setTwilioConfig] = useState({
        accountSid: "",
        authToken: "",
        phoneNumber: ""
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        const config = await AgentService.getIntegrationConfig('twilio')
        if (config) {
            setTwilioConfig({
                accountSid: config.accountSid || "",
                authToken: config.authToken || "",
                phoneNumber: config.phoneNumber || ""
            })
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            await AgentService.saveIntegrationConfig('twilio', twilioConfig)
            toast.success("Twilio configuration saved")
        } catch (error) {
            toast.error("Failed to save configuration")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-emerald-500" />
                        <CardTitle>Twilio & WhatsApp</CardTitle>
                    </div>
                    <CardDescription>
                        Connect your Twilio account to enable real WhatsApp and SMS messaging.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sid">Account SID</Label>
                        <Input 
                            id="sid" 
                            placeholder="AC..." 
                            value={twilioConfig.accountSid}
                            onChange={(e) => setTwilioConfig(prev => ({ ...prev, accountSid: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="token">Auth Token</Label>
                        <Input 
                            id="token" 
                            type="password" 
                            placeholder="Enter your auth token"
                            value={twilioConfig.authToken}
                            onChange={(e) => setTwilioConfig(prev => ({ ...prev, authToken: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Twilio Phone Number (WhatsApp)</Label>
                        <Input 
                            id="phone" 
                            placeholder="+14155552671" 
                            value={twilioConfig.phoneNumber}
                            onChange={(e) => setTwilioConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Format: +14155552671. For WhatsApp sandbox, use your sandbox number.
                        </p>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSave} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-muted/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Phone className="h-5 w-5 text-blue-500" />
                        <CardTitle>Voice Integration (Vapi.ai)</CardTitle>
                    </div>
                    <CardDescription>
                        Coming soon in Enterprise Tier.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button disabled variant="outline">Connect Vapi</Button>
                </CardContent>
            </Card>
        </div>
    )
}
