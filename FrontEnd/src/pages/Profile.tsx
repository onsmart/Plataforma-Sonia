import { useState, useEffect } from "react"
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
import { useTranslation } from "react-i18next"
import { loadTranslationsFromDatabase } from "../i18n/config"
import i18n from "../i18n/config"

export function Profile() {
    const { session, firstName, lastName, companiesId } = useAuth()
    const user = session?.user
    const { t } = useTranslation('profile')
    const [translationsReady, setTranslationsReady] = useState(false)
    
    // Estados para feedback de save
    const [savingPersonal, setSavingPersonal] = useState(false)
    const [savedPersonal, setSavedPersonal] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [savedPassword, setSavedPassword] = useState(false)
    
    // Estados para senha
    const [newPassword, setNewPassword] = useState("")
    const [passwordStrength, setPasswordStrength] = useState(0) // 0-4

    // Carregar traduções do namespace profile
    useEffect(() => {
        const loadProfileTranslations = async () => {
            const currentLanguage = i18n.language || 'pt-BR'
            const companiesIdToUse = companiesId || localStorage.getItem('companies_id')
            
            // Verificar se as traduções já estão carregadas
            const hasTranslations = i18n.hasResourceBundle(currentLanguage, 'profile')
            
            if (!hasTranslations) {
                await loadTranslationsFromDatabase(currentLanguage, companiesIdToUse)
            }
            
            setTranslationsReady(true)
        }

        loadProfileTranslations()

        // Ouvir eventos de mudança de idioma e adição de traduções
        const handleLanguageChanged = () => {
            setTranslationsReady(false)
            loadProfileTranslations()
        }

        const handleTranslationsAdded = () => {
            setTranslationsReady(true)
        }

        i18n.on('languageChanged', handleLanguageChanged)
        i18n.on('added', handleTranslationsAdded)

        return () => {
            i18n.off('languageChanged', handleLanguageChanged)
            i18n.off('added', handleTranslationsAdded)
        }
    }, [companiesId])
    
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
        toast.success(t('personalInfo.success'))
        setTimeout(() => setSavedPersonal(false), 3000)
    }
    
    const handleSavePassword = async () => {
        setSavingPassword(true)
        setSavedPassword(false)
        // Simula salvamento
        await new Promise(resolve => setTimeout(resolve, 1500))
        setSavingPassword(false)
        setSavedPassword(true)
        toast.success(t('security.success'))
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
        if (passwordStrength <= 1) return t('security.strength.weak')
        if (passwordStrength <= 2) return t('security.strength.fair')
        if (passwordStrength <= 3) return t('security.strength.good')
        return t('security.strength.strong')
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
                    <h2 className="text-2xl font-bold tracking-tight">{t('header.title')}</h2>
                    <p className="text-muted-foreground">{t('header.description')}</p>
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
                                        {firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || t('userInfo.defaultName')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 energy-badge relative">
                                    {t('userInfo.badge')}
                                </Badge>
                            </div>
                        </CardHeader>
                    </Card>

                <div className="space-y-6">
                    <Card className="profile-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5" />
                                {t('personalInfo.title')}
                            </CardTitle>
                            <CardDescription>{t('personalInfo.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('personalInfo.firstName')}</Label>
                                    <Input 
                                        defaultValue={firstName || ""} 
                                        className="profile-input h-12 rounded-xl border-2 transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('personalInfo.lastName')}</Label>
                                    <Input 
                                        defaultValue={lastName || ""} 
                                        className="profile-input h-12 rounded-xl border-2 transition-all focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('personalInfo.email')}</Label>
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
                                            {t('personalInfo.saving')}
                                        </>
                                    ) : savedPersonal ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            {t('personalInfo.saved')}
                                        </>
                                    ) : (
                                        t('personalInfo.save')
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="profile-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                {t('security.title')}
                            </CardTitle>
                            <CardDescription>{t('security.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('security.currentPassword')}</Label>
                                <Input 
                                    type="password" 
                                    className="profile-input h-12 rounded-xl border-2 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('security.newPassword')}</Label>
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
                                    <Label>{t('security.confirmPassword')}</Label>
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
                                            {t('security.updating')}
                                        </>
                                    ) : savedPassword ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            {t('security.updated')}
                                        </>
                                    ) : (
                                        t('security.update')
                                    )}
                                </Button>
                            </div>
                            
                            <Separator />
                            
                            <div className="flex items-center justify-between pt-4 opacity-70">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-base">{t('security.twoFactor.title')}</Label>
                                        <Badge 
                                            variant="outline" 
                                            className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            {t('security.twoFactor.badge')}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{t('security.twoFactor.description')}</p>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    disabled
                                    className="opacity-60 cursor-not-allowed"
                                >
                                    {t('security.twoFactor.button')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="profile-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                {t('sessions.title')}
                            </CardTitle>
                            <CardDescription>{t('sessions.description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-cyan-300 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{t('sessions.current')}</p>
                                        <p className="text-sm text-muted-foreground">{t('sessions.location')}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10">{t('sessions.active')}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        </>
    )
}
