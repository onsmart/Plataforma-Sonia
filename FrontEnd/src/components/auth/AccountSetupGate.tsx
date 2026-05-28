import React from "react"
import { AlertCircle } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { AccountSetupForm } from "./AccountSetupForm"

/**
 * Bloqueia o app até o usuário autenticado ter workspace (tb_company_users).
 */
export function AccountSetupGate({ children }: { children: React.ReactNode }) {
  const { session, loading, userId, hasCompany, refreshCompany } = useAuth()

  if (loading || !session) {
    return <>{children}</>
  }

  if (userId && hasCompany) {
    return <>{children}</>
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Carregando perfil…</CardTitle>
            <CardDescription>Aguarde enquanto validamos seu acesso.</CardDescription>
          </CardHeader>
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
            Sua conta existe, mas ainda não está vinculada a um espaço na plataforma. Escolha pessoa física ou
            jurídica para continuar (billing, agentes e inbox).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Conta sem workspace</AlertTitle>
            <AlertDescription>
              Isso costuma ocorrer quando o cadastro no Auth foi concluído, mas a criação da empresa no banco não
              finalizou. Complete abaixo — não é necessário criar outro e-mail.
            </AlertDescription>
          </Alert>
          <AccountSetupForm onSuccess={refreshCompany} />
        </CardContent>
      </Card>
    </div>
  )
}
