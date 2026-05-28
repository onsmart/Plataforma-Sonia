import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { useAuth } from "../contexts/AuthContext"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import {
    Key,
    Mail,
    User as UserIcon,
    Lock,
    Loader2,
    CheckCircle2,
    Shield,
    Monitor,
    Check,
    X,
    RefreshCw,
    CalendarClock,
    AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "../components/ui/utils"
import { useTranslation } from "react-i18next"
import { loadTranslationsFromDatabase } from "../i18n/config"
import i18n from "../i18n/config"
import { supabase } from "../utils/supabase/client"
import { AgentService } from "../services/api"
import { usePlanCapabilities } from "../hooks/usePlanCapabilities"
import { normalizePlanId, planTitle, type PlanId } from "../lib/plan-catalog"
import {
    buildPlanFeatureList,
    buildSubscriptionTimeline,
    subscriptionStatusLabel,
} from "../lib/plan-features"
import { useNavigation } from "../contexts/NavigationContext"
import { Progress } from "../components/ui/progress"

const panelClass =
    "rounded-xl border border-border/80 bg-card/30 shadow-sm transition-shadow hover:shadow-md"

type BillingUsageDetails = {
    catalog_plan?: string
    effective_plan?: string
    subscription_status?: string
    current_period_start?: string | null
    current_period_end?: string | null
    canceled_at?: string | null
    cancel_at_period_end?: boolean
    has_paid_access?: boolean
    subscribed_at?: string | null
    volume_label?: string
    has_stripe_subscription?: boolean
}

export function Profile() {
    const { session, firstName, lastName, companiesId } = useAuth()
    const user = session?.user
    const { t } = useTranslation("profile")
    const { navigate } = useNavigation()
    const planCaps = usePlanCapabilities()

    const [name, setName] = useState(firstName || "")
    const [lastNameState, setLastNameState] = useState(lastName || "")
    const [billingExtra, setBillingExtra] = useState<BillingUsageDetails | null>(null)

    const [savingPersonal, setSavingPersonal] = useState(false)
    const [savedPersonal, setSavedPersonal] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [savedPassword, setSavedPassword] = useState(false)

    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [passwordStrength, setPasswordStrength] = useState(0)

    const displayName = useMemo(() => {
        const full = [firstName, lastName].filter(Boolean).join(" ").trim()
        if (full) return full
        if (name || lastNameState) return [name, lastNameState].filter(Boolean).join(" ").trim()
        return t("userInfo.defaultName")
    }, [firstName, lastName, name, lastNameState, t])

    const avatarInitials = useMemo(() => {
        if (firstName && lastName) {
            return `${firstName[0]}${lastName[0]}`.toUpperCase()
        }
        if (firstName) return firstName.substring(0, 2).toUpperCase()
        return user?.email?.substring(0, 2).toUpperCase() || "?"
    }, [firstName, lastName, user?.email])

    useEffect(() => {
        if (firstName) setName(firstName)
        if (lastName) setLastNameState(lastName)
    }, [firstName, lastName])

    useEffect(() => {
        const loadProfileTranslations = async () => {
            const currentLanguage = i18n.language || "pt-BR"
            const companiesIdToUse = companiesId || localStorage.getItem("companies_id")
            if (!i18n.hasResourceBundle(currentLanguage, "profile")) {
                await loadTranslationsFromDatabase(currentLanguage, companiesIdToUse)
            }
        }
        void loadProfileTranslations()
    }, [companiesId])

    const loadBillingDetails = async (sync = false) => {
        try {
            const usage = await AgentService.getBillingUsage(sync)
            if (usage) {
                setBillingExtra({
                    catalog_plan: usage.catalog_plan,
                    effective_plan: usage.effective_plan,
                    subscription_status: usage.subscription_status,
                    current_period_start: usage.current_period_start,
                    current_period_end: usage.current_period_end,
                    canceled_at: usage.canceled_at,
                    cancel_at_period_end: usage.cancel_at_period_end,
                    has_paid_access: usage.has_paid_access,
                    subscribed_at: usage.subscribed_at,
                    volume_label: usage.volume_label,
                    has_stripe_subscription: usage.has_stripe_subscription,
                })
            }
        } catch {
            setBillingExtra(null)
        }
    }

    useEffect(() => {
        void loadBillingDetails()
    }, [])

    const refreshPlanData = async () => {
        await Promise.all([planCaps.refresh(true), loadBillingDetails(true)])
        toast.success(t("plan.refreshDone"))
    }

    const subscriptionStatus = billingExtra?.subscription_status ?? planCaps.status
    const hasPaidAccess = Boolean(billingExtra?.has_paid_access ?? planCaps.plan !== "free")
    const isPaid = hasPaidAccess
    const catalogPlan = normalizePlanId(billingExtra?.catalog_plan) as PlanId
    const effectivePlan = planCaps.plan
    const planMismatch =
        Boolean(billingExtra?.catalog_plan) && catalogPlan !== effectivePlan

    const subscriptionTimeline = buildSubscriptionTimeline({
        subscriptionStatus,
        subscribedAt: billingExtra?.subscribed_at ?? null,
        currentPeriodStart: billingExtra?.current_period_start ?? null,
        currentPeriodEnd: billingExtra?.current_period_end ?? null,
        canceledAt: billingExtra?.canceled_at ?? null,
        cancelAtPeriodEnd: Boolean(billingExtra?.cancel_at_period_end),
        hasPaidAccess: isPaid,
        locale: i18n.language,
    })

    const statusBadgeLabel = billingExtra?.cancel_at_period_end
        ? "Cancelamento agendado"
        : subscriptionStatusLabel(subscriptionStatus)

    const features = buildPlanFeatureList({
        plan: effectivePlan,
        agentsLimit: planCaps.agentsLimit,
        conversationsLimit: planCaps.conversationsLimit,
        hasRag: planCaps.hasRag,
        hasGovernance: planCaps.hasGovernance,
        hasActiveOutbound: planCaps.hasActiveOutbound,
        isPaid,
    })

    const conversationsPercent =
        planCaps.conversationsLimit != null && planCaps.conversationsLimit > 0
            ? Math.min(100, (planCaps.conversationsUsed / planCaps.conversationsLimit) * 100)
            : 0

    const agentsPercent =
        planCaps.agentsLimit != null && planCaps.agentsLimit > 0
            ? Math.min(100, (planCaps.agentsUsed / planCaps.agentsLimit) * 100)
            : 0

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
        if (!user?.email) {
            toast.error(t("errors.emailNotFound"))
            return
        }

        setSavingPersonal(true)
        setSavedPersonal(false)

        try {
            const { error } = await supabase
                .from("tb_users")
                .update({
                    name: name.trim() || null,
                    last_name: lastNameState.trim() || null,
                })
                .eq("email", user.email)

            if (error) {
                toast.error(t("errors.savePersonal"))
                return
            }

            setSavedPersonal(true)
            toast.success(t("personalInfo.success"))
            setTimeout(() => setSavedPersonal(false), 3000)
        } catch {
            toast.error(t("errors.savePersonal"))
        } finally {
            setSavingPersonal(false)
        }
    }

    const handleSavePassword = async () => {
        if (!user?.email) {
            toast.error(t("errors.emailNotFound"))
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error(t("errors.passwordMismatch"))
            return
        }

        if (newPassword.length < 6) {
            toast.error(t("errors.passwordTooShort"))
            return
        }

        if (!currentPassword) {
            toast.error(t("errors.currentPasswordRequired"))
            return
        }

        setSavingPassword(true)
        setSavedPassword(false)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            })

            if (authError) {
                toast.error(t("errors.wrongCurrentPassword"))
                return
            }

            const { error: updateAuthError } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (updateAuthError) {
                toast.error(t("errors.updatePassword"))
                return
            }

            const { data } = await supabase.rpc("sp_change_password", {
                p_email: user.email,
                p_current_password: currentPassword,
                p_new_password: newPassword,
            })

            if (data && !data.success) {
                toast.warning(t("errors.passwordPartial"))
            }

            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setPasswordStrength(0)
            setSavedPassword(true)
            toast.success(t("security.success"))
            setTimeout(() => setSavedPassword(false), 3000)
        } catch {
            toast.error(t("errors.updatePassword"))
        } finally {
            setSavingPassword(false)
        }
    }

    const strengthBarClass = (index: number) => {
        if (index >= passwordStrength) return "bg-muted"
        if (passwordStrength <= 1) return "bg-destructive"
        if (passwordStrength <= 2) return "bg-amber-500"
        if (passwordStrength <= 3) return "bg-teal-600"
        return "bg-emerald-600"
    }

    const strengthLabel = () => {
        if (passwordStrength === 0) return ""
        if (passwordStrength <= 1) return t("security.strength.weak")
        if (passwordStrength <= 2) return t("security.strength.fair")
        if (passwordStrength <= 3) return t("security.strength.good")
        return t("security.strength.strong")
    }

    return (
        <div className="mx-auto w-full max-w-5xl animate-in fade-in space-y-6 px-4 py-6 text-foreground duration-500 sm:px-6 lg:space-y-8 lg:px-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {t("header.title")}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t("header.description")}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
                <div className="space-y-4">
                    <Card className={panelClass}>
                        <CardContent className="flex flex-col items-center gap-4 pt-6 pb-4">
                            <Avatar className="h-20 w-20 border border-border">
                                <AvatarFallback className="bg-teal-500/10 text-lg font-semibold text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                                    {avatarInitials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 text-center">
                                <p className="font-semibold text-foreground">{displayName}</p>
                                <p className="break-all text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={panelClass}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base">{t("plan.title")}</CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-[8px]"
                                    onClick={() => void refreshPlanData()}
                                    disabled={planCaps.loading}
                                    title={t("plan.refresh")}
                                >
                                    <RefreshCw
                                        className={cn("h-4 w-4", planCaps.loading && "animate-spin")}
                                    />
                                </Button>
                            </div>
                            {planCaps.loading ? (
                                <p className="text-xs text-muted-foreground">{t("plan.loading")}</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="rounded-[8px] bg-teal-500/10 text-teal-800 dark:text-teal-300">
                                        {planCaps.planTitle}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-[8px]">
                                        {statusBadgeLabel}
                                    </Badge>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                            {planMismatch ? (
                                <div className="flex gap-2 rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p>
                                        {t("plan.mismatchHint", {
                                            catalog: planTitle(catalogPlan),
                                            effective: planCaps.planTitle,
                                        })}
                                    </p>
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                {subscriptionTimeline.map((item) => (
                                    <div
                                        key={`${item.label}-${item.dateText}`}
                                        className="flex gap-2 rounded-[8px] border border-border bg-muted/20 p-3"
                                    >
                                        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                {item.label}
                                            </p>
                                            <p
                                                className={cn(
                                                    "text-sm font-medium",
                                                    item.tone === "success" &&
                                                        "text-emerald-600 dark:text-emerald-400",
                                                    item.tone === "warning" &&
                                                        "text-amber-700 dark:text-amber-300",
                                                    item.tone === "muted" && "text-muted-foreground"
                                                )}
                                            >
                                                {item.dateText}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {billingExtra?.volume_label ? (
                                <p className="text-xs text-muted-foreground">{billingExtra.volume_label}</p>
                            ) : null}

                            {isPaid && planCaps.conversationsLimit != null ? (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">{t("plan.usageConversations")}</span>
                                        <span className="font-medium">
                                            {planCaps.conversationsUsed} / {planCaps.conversationsLimit}
                                        </span>
                                    </div>
                                    <Progress value={conversationsPercent} className="h-1.5" />
                                </div>
                            ) : null}

                            {isPaid && planCaps.agentsLimit != null ? (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">{t("plan.usageAgents")}</span>
                                        <span className="font-medium">
                                            {planCaps.agentsUsed} / {planCaps.agentsLimit}
                                        </span>
                                    </div>
                                    <Progress value={agentsPercent} className="h-1.5" />
                                </div>
                            ) : null}

                            <Separator />

                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t("plan.capabilitiesTitle")}
                                </p>
                                <ul className="space-y-1.5">
                                    {features.map((feature) => (
                                        <li
                                            key={feature.id}
                                            className="flex items-start gap-2 text-xs leading-relaxed"
                                        >
                                            {feature.enabled ? (
                                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                            ) : (
                                                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                                            )}
                                            <span
                                                className={cn(
                                                    feature.enabled
                                                        ? "text-foreground"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {feature.label}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {billingExtra?.catalog_plan && billingExtra.catalog_plan !== effectivePlan ? (
                                <p className="text-[11px] text-muted-foreground">
                                    {t("plan.dbPlanLabel")}: {planTitle(catalogPlan)}
                                </p>
                            ) : null}

                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full rounded-[8px]"
                                onClick={() => navigate("configuration?tab=billing")}
                            >
                                {t("plan.manageBilling")}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className={panelClass}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <UserIcon className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                                {t("personalInfo.title")}
                            </CardTitle>
                            <CardDescription>{t("personalInfo.description")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="profile-first-name">{t("personalInfo.firstName")}</Label>
                                    <Input
                                        id="profile-first-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-last-name">{t("personalInfo.lastName")}</Label>
                                    <Input
                                        id="profile-last-name"
                                        value={lastNameState}
                                        onChange={(e) => setLastNameState(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="profile-email">{t("personalInfo.email")}</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="profile-email"
                                        value={user?.email ?? ""}
                                        disabled
                                        className="bg-muted/50 pl-9 pr-9"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">{t("personalInfo.emailHint")}</p>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSavePersonal}
                                    disabled={savingPersonal || savedPersonal}
                                    className={cn(
                                        "rounded-[8px]",
                                        savedPersonal && "bg-emerald-600 hover:bg-emerald-600"
                                    )}
                                >
                                    {savingPersonal ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {t("personalInfo.saving")}
                                        </>
                                    ) : savedPersonal ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            {t("personalInfo.saved")}
                                        </>
                                    ) : (
                                        t("personalInfo.save")
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={panelClass}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Key className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                                {t("security.title")}
                            </CardTitle>
                            <CardDescription>{t("security.description")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="profile-current-password">{t("security.currentPassword")}</Label>
                                <Input
                                    id="profile-current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="profile-new-password">{t("security.newPassword")}</Label>
                                    <Input
                                        id="profile-new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                    {newPassword ? (
                                        <div className="space-y-1">
                                            <div className="flex gap-1 h-1.5">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "flex-1 rounded-full transition-colors",
                                                            strengthBarClass(i)
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            {passwordStrength > 0 ? (
                                                <p className="text-xs text-muted-foreground">{strengthLabel()}</p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-confirm-password">{t("security.confirmPassword")}</Label>
                                    <Input
                                        id="profile-confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className={cn(
                                            confirmPassword &&
                                                newPassword &&
                                                confirmPassword !== newPassword &&
                                                "border-destructive focus-visible:ring-destructive/30"
                                        )}
                                    />
                                    {confirmPassword && newPassword && confirmPassword !== newPassword ? (
                                        <p className="text-xs text-destructive">{t("errors.passwordMismatch")}</p>
                                    ) : null}
                                    {confirmPassword && newPassword && confirmPassword === newPassword ? (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            {t("security.passwordMatch")}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSavePassword}
                                    disabled={savingPassword || savedPassword}
                                    className={cn(
                                        "rounded-[8px]",
                                        savedPassword && "bg-emerald-600 hover:bg-emerald-600"
                                    )}
                                >
                                    {savingPassword ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {t("security.updating")}
                                        </>
                                    ) : savedPassword ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            {t("security.updated")}
                                        </>
                                    ) : (
                                        t("security.update")
                                    )}
                                </Button>
                            </div>

                            <Separator />

                            <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Label className="text-base">{t("security.twoFactor.title")}</Label>
                                        <Badge variant="outline" className="rounded-[8px] text-[10px] uppercase tracking-wide">
                                            {t("security.twoFactor.badge")}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t("security.twoFactor.description")}
                                    </p>
                                </div>
                                <Button variant="outline" disabled className="shrink-0 rounded-[8px]">
                                    {t("security.twoFactor.button")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={panelClass}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Shield className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                                {t("sessions.title")}
                            </CardTitle>
                            <CardDescription>{t("sessions.description")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-muted/20 p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-teal-500/10">
                                        <Monitor className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground">{t("sessions.current")}</p>
                                        <p className="text-sm text-muted-foreground">{t("sessions.location")}</p>
                                    </div>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className="shrink-0 rounded-[8px] border border-teal-500/20 bg-teal-500/10 text-teal-800 dark:text-teal-300"
                                >
                                    {t("sessions.active")}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
