import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { useAuth } from "../contexts/AuthContext"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Shield, Key, Mail, User as UserIcon, Lock, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "../components/ui/utils"

export function Profile() {
    const { session, firstName, lastName } = useAuth()
    const user = session?.user
    
    // Estados para feedback de save
    const [savingPersonal, setSavingPersonal] = useState(false)
    const [savedPersonal, setSavedPersonal] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [savedPassword, setSavedPassword] = useState(false)
    
    // Estados para senha
    const [newPassword, setNewPassword] = useState("")
    const [passwordStrength, setPasswordStrength] = useState(0) // 0-4
    
    // Função para calcular força da senha
    const calculatePasswordStrength = (password: string) => {
        if (!password) return 0
        let strength = 0
        if (password.length >= 8) strength++
        if (password.length >= 12) strength++
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
        if (/\d/.test(password)) strength++
        if (/[^a-zA-Z\d]/.test(password)) strength++
        return Math.min(strength, 4)
    }
    
    const handlePasswordChange = (value: string) => {
        setNewPassword(value)
        setPasswordStrength(calculatePasswordStrength(value))
    }
    
    const handleSavePersonal = async () => {
        setSavingPersonal(true)
        setSavedPersonal(false)
        // Simula salvamento
        await new Promise(resolve => setTimeout(resolve, 1500))
        setSavingPersonal(false)
        setSavedPersonal(true)
        toast.success("Personal information updated successfully!")
        setTimeout(() => setSavedPersonal(false), 3000)
    }
    
    const handleSavePassword = async () => {
        setSavingPassword(true)
        setSavedPassword(false)
        // Simula salvamento
        await new Promise(resolve => setTimeout(resolve, 1500))
        setSavingPassword(false)
        setSavedPassword(true)
        toast.success("Password updated successfully!")
        setTimeout(() => setSavedPassword(false), 3000)
    }
    
    const getPasswordStrengthColor = () => {
        if (passwordStrength === 0) return 'bg-slate-200'
        if (passwordStrength <= 1) return 'bg-red-500'
        if (passwordStrength <= 2) return 'bg-yellow-500'
        if (passwordStrength <= 3) return 'bg-blue-500'
        return 'bg-green-500'
    }
    
    const getPasswordStrengthLabel = () => {
        if (passwordStrength === 0) return ''
        if (passwordStrength <= 1) return 'Weak'
        if (passwordStrength <= 2) return 'Fair'
        if (passwordStrength <= 3) return 'Good'
        return 'Strong'
    }

    return (
        <>
            <style>{`
                /* Input focus com brilho ciano e ring */
                .profile-input:focus {
                    border-color: #06b6d4 !important;
                    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1), 0 0 20px rgba(6, 182, 212, 0.2) !important;
                    outline: none !important;
                    ring: 2px !important;
                    ring-color: #06b6d4 !important;
                }
                
                /* Card hover effect */
                .profile-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 2px solid rgba(6, 182, 212, 0.3) !important;
                }
                
                .profile-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1), 0 0 0 1px rgba(6, 182, 212, 0.3);
                    border-color: rgba(6, 182, 212, 0.5) !important;
                }
                
                /* Badge energy effect */
                @keyframes energy-pulse {
                    0%, 100% {
                        box-shadow: 0 0 10px rgba(6, 182, 212, 0.4),
                                    0 0 20px rgba(6, 182, 212, 0.3),
                                    0 0 30px rgba(6, 182, 212, 0.2),
                                    inset 0 0 10px rgba(6, 182, 212, 0.1);
                    }
                    50% {
                        box-shadow: 0 0 20px rgba(6, 182, 212, 0.6),
                                    0 0 30px rgba(6, 182, 212, 0.4),
                                    0 0 40px rgba(6, 182, 212, 0.3),
                                    inset 0 0 15px rgba(6, 182, 212, 0.2);
                    }
                }
                
                .energy-badge {
                    animation: energy-pulse 2s ease-in-out infinite;
                    position: relative;
                }
                
                .energy-badge::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    bottom: -2px;
                    background: linear-gradient(45deg, 
                        rgba(6, 182, 212, 0.8) 0%,
                        rgba(34, 211, 238, 0.6) 25%,
                        rgba(6, 182, 212, 0.8) 50%,
                        rgba(34, 211, 238, 0.6) 75%,
                        rgba(6, 182, 212, 0.8) 100%);
                    background-size: 200% 200%;
                    border-radius: inherit;
                    z-index: -1;
                    animation: energy-shimmer 3s linear infinite;
                    opacity: 0.6;
                }
                
                @keyframes energy-shimmer {
                    0% {
                        background-position: 0% 50%;
                    }
                    100% {
                        background-position: 200% 50%;
                    }
                }
                
            `}</style>
            <div className="space-y-6 max-w-4xl mx-auto bg-[#F8FAFC] min-h-screen -m-4 p-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
                    <p className="text-muted-foreground">Manage your account settings and preferences.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-[250px_1fr]">
                    <Card className="h-fit profile-card">
                        <CardHeader>
                            <div className="flex flex-col items-center gap-4">
                                <Avatar className="h-24 w-24 relative" style={{ borderRadius: '50%' }}>
                                    <AvatarImage src="" />
                                    <AvatarFallback 
                                        className="text-2xl font-black text-white"
                                        style={{
                                            background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%)',
                                            border: '3px solid rgba(255, 255, 255, 0.3)',
                                            boxShadow: '0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.2)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '50%',
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {user?.email?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="text-center">
                                    <p className="font-semibold text-lg">
                                        {firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || "Admin User"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 energy-badge relative">
                                    Super Admin
                                </Badge>
                            </div>
                        </CardHeader>
                    </Card>

                <div className="space-y-6">
                    <Card className="profile-card">
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
                                    <Input 
                                        defaultValue={firstName || ""} 
                                        className="profile-input h-12 rounded-xl border-2 transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input 
                                        defaultValue={lastName || ""} 
                                        className="profile-input h-12 rounded-xl border-2 transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground z-10" />
                                    <Lock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground z-10" />
                                    <Input 
                                        value={user?.email} 
                                        disabled 
                                        className="pl-9 pr-9 bg-muted h-12 rounded-xl border-2"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button 
                                    onClick={handleSavePersonal}
                                    disabled={savingPersonal || savedPersonal}
                                    className={cn(
                                        "h-12 px-8 rounded-xl font-black text-sm uppercase tracking-wider transition-all text-white",
                                        savedPersonal 
                                            ? "bg-green-500 hover:bg-green-600" 
                                            : ""
                                    )}
                                    style={savedPersonal ? {} : {
                                        background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)',
                                        boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.2)',
                                        border: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!savedPersonal) {
                                            e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!savedPersonal) {
                                            e.currentTarget.style.background = 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)'
                                        }
                                    }}
                                >
                                    {savingPersonal ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : savedPersonal ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Saved!
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="profile-card">
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
                                <Input 
                                    type="password" 
                                    className="profile-input h-12 rounded-xl border-2 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>New Password</Label>
                                    <Input 
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        className="profile-input h-12 rounded-xl border-2 transition-all"
                                    />
                                    {/* Barra de força da senha */}
                                    {newPassword && (
                                        <div className="space-y-1">
                                            <div className="flex gap-1 h-1.5">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "flex-1 rounded-full transition-all duration-300",
                                                            i < passwordStrength 
                                                                ? getPasswordStrengthColor()
                                                                : 'bg-slate-200'
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            {passwordStrength > 0 && (
                                                <p className={cn(
                                                    "text-xs font-medium",
                                                    passwordStrength <= 1 ? 'text-red-500' :
                                                    passwordStrength <= 2 ? 'text-yellow-500' :
                                                    passwordStrength <= 3 ? 'text-blue-500' :
                                                    'text-green-500'
                                                )}>
                                                    {getPasswordStrengthLabel()}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <Input 
                                        type="password" 
                                        className="profile-input h-12 rounded-xl border-2 transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button 
                                    onClick={handleSavePassword}
                                    disabled={savingPassword || savedPassword}
                                    className={cn(
                                        "h-12 px-8 rounded-xl font-black text-sm uppercase tracking-wider transition-all text-white",
                                        savedPassword 
                                            ? "bg-green-500 hover:bg-green-600" 
                                            : ""
                                    )}
                                    style={savedPassword ? {} : {
                                        background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)',
                                        boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.2)',
                                        border: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!savedPassword) {
                                            e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!savedPassword) {
                                            e.currentTarget.style.background = 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)'
                                        }
                                    }}
                                >
                                    {savingPassword ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : savedPassword ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Updated!
                                        </>
                                    ) : (
                                        'Update Password'
                                    )}
                                </Button>
                            </div>
                            
                            <Separator />
                            
                            <div className="flex items-center justify-between pt-4 opacity-70">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-base">Two-Factor Authentication</Label>
                                        <Badge 
                                            variant="outline" 
                                            className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            Soon
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    disabled
                                    className="opacity-60 cursor-not-allowed"
                                >
                                    Enable 2FA (Coming Soon)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="profile-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Sessions
                            </CardTitle>
                            <CardDescription>Manage your active sessions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-cyan-300 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Current Session</p>
                                        <p className="text-sm text-muted-foreground">San Francisco, US • Chrome on macOS</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10">Active Now</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        </>
    )
}
