import React, { useState } from "react"
import { Building2, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { AgentService } from "../../services/api"
import {
  ACCOUNT_TYPE_OPTIONS,
  type AccountType,
  validateDocument,
  digitsOnly,
} from "../../lib/account-types"

type AccountSetupFormProps = {
  onSuccess?: () => void | Promise<void>
  submitLabel?: string
  compact?: boolean
}

export function AccountSetupForm({
  onSuccess,
  submitLabel = "Criar workspace",
  compact = false,
}: AccountSetupFormProps) {
  const [accountType, setAccountType] = useState<AccountType>("individual")
  const [companyName, setCompanyName] = useState("")
  const [document, setDocument] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const docError = validateDocument(accountType, document)
    if (docError) {
      toast.error(docError)
      return
    }
    if (accountType === "company" && !companyName.trim()) {
      toast.error("Informe o nome da empresa para pessoa jurídica.")
      return
    }

    const docDigits = digitsOnly(document)
    if (!docDigits) {
      toast.error(accountType === "individual" ? "CPF é obrigatório." : "CNPJ é obrigatório.")
      return
    }

    setLoading(true)
    try {
      const result = await AgentService.createCompany({
        companyName: companyName.trim(),
        accountType,
        document: docDigits,
      })
      if (result?.success === false) {
        throw new Error(result?.error || result?.message || "Não foi possível criar o workspace.")
      }
      toast.success(result?.message || "Workspace configurado com sucesso!")
      setCompanyName("")
      setDocument("")
      await onSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao configurar conta."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-5"}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tipo de conta</Label>
        <RadioGroup
          value={accountType}
          onValueChange={(v) => setAccountType(v as AccountType)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                accountType === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {opt.value === "individual" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {accountType === "company" && (
        <div className="space-y-2">
          <Label htmlFor="setup-company-name">Nome da empresa</Label>
          <Input
            id="setup-company-name"
            placeholder="Ex.: Clínica Exemplo Ltda"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="setup-document">
          {accountType === "individual" ? "CPF" : "CNPJ"}
        </Label>
        <Input
          id="setup-document"
          inputMode="numeric"
          required
          placeholder={accountType === "individual" ? "000.000.000-00" : "00.000.000/0000-00"}
          value={document}
          onChange={(e) => setDocument(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Configurando…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}
