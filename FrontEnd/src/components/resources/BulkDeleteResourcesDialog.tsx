import React, { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Loader2, Trash2 } from "lucide-react"
import { cn } from "../ui/utils"

export type BulkDeleteResourceItem = {
  id: string
  label: string
  blocked: boolean
  blockReason?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  items: BulkDeleteResourceItem[]
  loading?: boolean
  confirmBusy?: boolean
  onConfirm: (selectedIds: string[]) => Promise<void>
}

export function BulkDeleteResourcesDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  loading = false,
  confirmBusy = false,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectableIds = useMemo(
    () => items.filter((i) => !i.blocked).map((i) => i.id),
    [items]
  )

  useEffect(() => {
    if (open) setSelected(new Set())
  }, [open, items])

  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someSelected = selectableIds.some((id) => selected.has(id))

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(selectableIds))
    else setSelected(new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedCount = selected.size
  const blockedCount = items.filter((i) => i.blocked).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,640px)] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left">{description}</DialogDescription>
        </DialogHeader>

        <div className="border-y border-border px-6 py-3 bg-muted/30 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="bulk-delete-select-all"
              checked={allSelectableChecked}
              disabled={loading || confirmBusy || selectableIds.length === 0}
              onCheckedChange={(v) => toggleAll(v === true)}
            />
            <Label htmlFor="bulk-delete-select-all" className="text-sm font-medium cursor-pointer">
              Selecionar todos disponíveis
            </Label>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedCount} selecionado(s)
            {blockedCount > 0 ? ` · ${blockedCount} bloqueado(s)` : ""}
          </span>
        </div>

        <div className="flex-1 min-h-[200px] max-h-[min(52vh,420px)] overflow-y-auto px-6 py-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Carregando dependências…</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nada para listar aqui.</p>
          ) : (
            items.map((item) => {
              const id = `bulk-del-${item.id}`
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex gap-3 rounded-lg border p-3 text-left",
                    item.blocked ? "opacity-75 bg-muted/20" : "bg-background"
                  )}
                >
                  <div className="pt-0.5">
                    <Checkbox
                      id={id}
                      checked={selected.has(item.id)}
                      disabled={item.blocked || confirmBusy}
                      onCheckedChange={(v) => toggleOne(item.id, v === true)}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label
                      htmlFor={id}
                      className={cn(
                        "text-sm font-medium leading-snug cursor-pointer",
                        item.blocked && "cursor-not-allowed text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </Label>
                    {item.blocked && item.blockReason ? (
                      <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                        {item.blockReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="px-6 py-4 shrink-0 border-t border-border gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={confirmBusy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || !someSelected || confirmBusy}
            onClick={() => void onConfirm(Array.from(selected))}
          >
            {confirmBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Excluir selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
