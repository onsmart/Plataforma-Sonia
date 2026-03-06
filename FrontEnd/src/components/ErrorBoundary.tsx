import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log do erro para debugging
    console.error('[ErrorBoundary] Erro capturado:', error)
    console.error('[ErrorBoundary] Error Info:', errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Aqui você pode enviar o erro para um serviço de monitoramento
    // Ex: Sentry, LogRocket, etc.
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } })
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleGoHome = () => {
    this.handleReset()
    // Navegar para cockpit usando hash (compatível com NavigationContext)
    window.location.hash = '#cockpit'
    // Forçar reload se necessário
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  render() {
    if (this.state.hasError) {
      // Se tiver um fallback customizado, usar ele
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Tela de erro padrão
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>Ops! Algo deu errado</CardTitle>
                  <CardDescription>
                    Ocorreu um erro inesperado. Não se preocupe, seus dados estão seguros.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-semibold mb-2">Detalhes do erro (modo desenvolvimento):</p>
                  <pre className="text-xs overflow-auto max-h-48 bg-background p-3 rounded border">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\n'}
                        Component Stack:
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={this.handleReset} variant="default" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Ir para Início
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Se o problema persistir, entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
