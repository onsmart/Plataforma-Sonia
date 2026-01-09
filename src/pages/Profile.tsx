import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { useAuth } from "../contexts/AuthContext"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Shield, Key, Mail, User as UserIcon } from "lucide-react"

export function Profile() {
    const { session } = useAuth()
    const user = session?.user

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-[250px_1fr]">
                <Card className="h-fit">
                    <CardHeader>
                        <div className="flex flex-col items-center gap-4">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src="" />
                                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                                    {user?.email?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="font-semibold text-lg">Admin User</p>
                                <p className="text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                Super Admin
                            </Badge>
                        </div>
                    </CardHeader>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5" />
                                Personal Information
                            </CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>First Name</Label>
                                    <Input defaultValue="Admin" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input defaultValue="User" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={user?.email} disabled className="pl-9 bg-muted" />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button>Save Changes</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                Security
                            </CardTitle>
                            <CardDescription>Manage your password and security preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Current Password</Label>
                                <Input type="password" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>New Password</Label>
                                    <Input type="password" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <Input type="password" />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button variant="outline">Update Password</Button>
                            </div>
                            
                            <Separator />
                            
                            <div className="flex items-center justify-between pt-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                </div>
                                <Button variant="secondary" disabled>Enable 2FA (Coming Soon)</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Sessions
                            </CardTitle>
                            <CardDescription>Manage your active sessions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Current Session</p>
                                        <p className="text-sm text-muted-foreground">San Francisco, US • Chrome on macOS</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-green-600 bg-green-50">Active Now</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
