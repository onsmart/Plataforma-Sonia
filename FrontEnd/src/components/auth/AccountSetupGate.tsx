import React from "react"
import { AlertCircle, Loader2, LogOut } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Button } from "../ui/button"
import { AccountSetupForm } from "./AccountSetupForm"

/**
 * Bloqueia o app até o usuário autenticado ter workspace (tb_company_users).
 * PF e PJ: ambos recebem um tenant em tb_companies após o cadastro completo.
 */
export function AccountSetupGate({ children }: { children: React.ReactNode }) {
  const { session, loading, userId, hasCompany, companyReady, refreshCompany, signOut } = useAuth()

  if (!session) {
    return <>{children}</>
  }

  if (loading || !companyReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Validando seu workspace…</p>
        </div>
      </div>
    )
  }

  if (userId && hasCompany) {
    return <>{children}</>
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Conta incompleta</CardTitle>
            <CardDescription>
              Seu login está ativo, mas ainda não há registro na plataforma para este e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cadastro não finalizado</AlertTitle>
              <AlertDescription>
                Saia da conta e conclua o cadastro (nome, CPF/CNPJ e workspace). Se o problema persistir,
                entre em contato com o suporte.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair e cadastrar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Configure seu workspace</CardTitle>
          <CardDescription>
            Para pessoa física ou jurídica, é necessário um workspace na plataforma (agentes, inbox e billing).
            Informe CPF ou CNPJ para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Workspace pendente</AlertTitle>
            <AlertDescription>
              Seu usuário já existe, mas ainda não está vinculado a um espaço. Complete abaixo — não é necessário
              outro e-mail.
            </AlertDescription>
          </Alert>
          <AccountSetupForm onSuccess={refreshCompany} />
        </CardContent>
      </Card>
    </div>
  )
}
