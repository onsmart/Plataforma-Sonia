import { useState } from 'react'
import { Ban, Building2, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { AgentService } from '../../services/api'
import { toast } from 'sonner'

type SubscriptionManageActionsProps = {
  visible: boolean
  cancelAtPeriodEnd?: boolean
  planTitle?: string
  periodEndLabel?: string | null
  busy?: boolean
  onBusyChange?: (busy: boolean) => void
  onSnapshot?: (usage: Record<string, unknown>) => void
  onRefresh?: () => Promise<void>
  className?: string
  portalLabel?: string
  cancelLabel?: string
  reactivateLabel?: string
}

export function SubscriptionManageActions({
  visible,
  cancelAtPeriodEnd = false,
  planTitle = 'seu plano',
  periodEndLabel,
  busy: busyProp,
  onBusyChange,
  onSnapshot,
  onRefresh,
  className,
  portalLabel = 'Portal Stripe',
  cancelLabel = 'Cancelar assinatura',
  reactivateLabel = 'Reativar renovação',
}: SubscriptionManageActionsProps) {
  const [internalBusy, setInternalBusy] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const busy = busyProp ?? internalBusy

  const setBusy = (value: boolean) => {
    onBusyChange?.(value)
    setInternalBusy(value)
  }

  if (!visible) return null

  const handlePortal = async () => {
    setBusy(true)
    try {
      const { url, error } = await AgentService.createPortalSession()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir portal de cobrança')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelRenewal = async () => {
    setBusy(true)
    try {
      const result = await AgentService.cancelSubscriptionRenewal()
      onSnapshot?.(result)
      await onRefresh?.()
      toast.success(
        result.message ||
          (result.stripe_sync?.cancel_at_period_end
            ? 'Cancelamento confirmado no Stripe. Benefícios mantidos até o fim do ciclo.'
            : 'Assinatura cancelada. Você mantém os benefícios até o fim do ciclo ou até esgotar os atendimentos do mês.')
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar assinatura')
    } finally {
      setBusy(false)
      setCancelDialogOpen(false)
    }
  }

  const handleReactivateRenewal = async () => {
    setBusy(true)
    try {
      const result = await AgentService.reactivateSubscriptionRenewal()
      onSnapshot?.(result)
      await onRefresh?.()
      toast.success(result.message || 'Renovação automática reativada.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reativar renovação')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={className}>
        <Button variant="outline" className="rounded-[8px]" disabled={busy} onClick={() => void handlePortal()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          {portalLabel}
        </Button>
        {cancelAtPeriodEnd ? (
          <Button
            variant="outline"
            className="rounded-[8px]"
            disabled={busy}
            onClick={() => void handleReactivateRenewal()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {reactivateLabel}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="rounded-[8px] border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            disabled={busy}
            onClick={() => setCancelDialogOpen(true)}
          >
            <Ban className="h-4 w-4" />
            {cancelLabel}
          </Button>
        )}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Você continuará com o plano <strong>{planTitle}</strong> e todos os benefícios já pagos até:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    a data de fim do ciclo
                    {periodEndLabel ? ` (${periodEndLabel})` : ''}, ou
                  </li>
                  <li>esgotar o limite de atendimentos do mês — o que ocorrer primeiro.</li>
                </ul>
                <p>Depois disso a conta volta ao plano gratuito, sem novas cobranças.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Manter assinatura</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                void handleCancelRenewal()
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
