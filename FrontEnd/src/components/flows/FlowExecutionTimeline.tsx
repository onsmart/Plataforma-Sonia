import React, { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle, QrCode, ExternalLink } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface ExecutionStep {
  nodeId: string
  agentId?: string
  success: boolean
  output?: any
  error?: string
  qrCode?: string // QR code em base64 quando disponível
  timestamp?: number
  duration?: number
}

interface FlowExecutionTimelineProps {
  executionHistory: ExecutionStep[]
  isExecuting: boolean
  currentStepIndex?: number
}

// Função para detectar e extrair base64 de QR code
function extractQRCodeBase64(text: string): string | null {
  if (!text || typeof text !== 'string') return null
  
  try {
    // Padrão 1: Procura por "CÓDIGO BASE64 DO QR CODE:" seguido de data:image/png;base64,...
    // Este é o formato mais comum que vem do backend
    const qrCodeHeaderPattern = /CÓDIGO BASE64 DO QR CODE:[\s\S]*?data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+?)(?:\n|$|════|CÓDIGO|base64|QR)/gi
    let match = qrCodeHeaderPattern.exec(text)
    if (match && match[1]) {
      const cleanBase64 = match[1].replace(/[\s\n\r─═]/g, '').trim()
      if (cleanBase64.length > 100) {
        console.log('[QRCodeDetection] QR code encontrado via padrão 1 (header)', { length: cleanBase64.length })
        return `data:image/png;base64,${cleanBase64}`
      }
    }
    
    // Padrão 2: Procura diretamente por data:image/png;base64,... (pode estar em qualquer lugar)
    // Captura tudo após data:image/png;base64, até encontrar algo que não seja base64 válido
    const dataUrlPattern = /data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+)/gi
    const allMatches = [...text.matchAll(dataUrlPattern)]
    for (const match of allMatches) {
      if (match && match[1]) {
        const cleanBase64 = match[1].replace(/[\s\n\r─═]/g, '').trim()
        // QR codes geralmente têm pelo menos 300 caracteres em base64 (reduzido de 500 para capturar mais casos)
        if (cleanBase64.length >= 300) {
          console.log('[QRCodeDetection] QR code encontrado via padrão 2 (data URL)', { length: cleanBase64.length })
          return `data:image/png;base64,${cleanBase64}`
        }
      }
    }
    
    // Padrão 3: Procura por strings muito longas de base64 (mínimo 300 caracteres)
    // Remove quebras de linha e espaços primeiro, mas mantém a estrutura
    const cleanedText = text.replace(/[\s\n\r─═]/g, '')
    const longBase64Pattern = /([A-Za-z0-9+/=]{300,})/g
    match = longBase64Pattern.exec(cleanedText)
    if (match && match[1]) {
      console.log('[QRCodeDetection] QR code encontrado via padrão 3 (long base64)', { length: match[1].length })
      return `data:image/png;base64,${match[1]}`
    }
    
    // Padrão 4: Procura por base64 sem o prefixo data:image/png;base64,
    // mas que seja uma string longa válida de base64
    const base64OnlyPattern = /([A-Za-z0-9+/=]{300,})/g
    const base64Matches = [...text.matchAll(base64OnlyPattern)]
    for (const match of base64Matches) {
      if (match && match[1]) {
        const cleanBase64 = match[1].trim()
        // Verifica se é base64 válido (contém apenas caracteres válidos e tem padding correto)
        if (cleanBase64.length >= 300 && /^[A-Za-z0-9+/]+=*$/.test(cleanBase64)) {
          console.log('[QRCodeDetection] QR code encontrado via padrão 4 (base64 puro)', { length: cleanBase64.length })
          return `data:image/png;base64,${cleanBase64}`
        }
      }
    }
    
    // Padrão 5: Procura por QR code mencionado no texto e tenta extrair de qualquer lugar
    if (text.includes('QR') || text.includes('QR Code') || text.includes('qrcode') || text.includes('QRCODE')) {
      // Tenta encontrar qualquer string base64 longa próxima à menção de QR
      const qrContextPattern = /(?:QR|QR Code|qrcode|QRCODE)[\s\S]{0,500}([A-Za-z0-9+/=\s\n\r─═]{300,})/gi
      const qrMatches = [...text.matchAll(qrContextPattern)]
      for (const match of qrMatches) {
        if (match && match[1]) {
          const cleanBase64 = match[1].replace(/[\s\n\r─═]/g, '').trim()
          if (cleanBase64.length >= 300 && /^[A-Za-z0-9+/]+=*$/.test(cleanBase64)) {
            console.log('[QRCodeDetection] QR code encontrado via padrão 5 (contexto QR)', { length: cleanBase64.length })
            return `data:image/png;base64,${cleanBase64}`
          }
        }
      }
    }
    
    console.log('[QRCodeDetection] Nenhum QR code detectado no texto', { textLength: text.length, preview: text.substring(0, 200) })
    return null
  } catch (error) {
    console.error('[QRCodeDetection] Erro ao processar texto:', error)
    return null
  }
}

// Componente para renderizar QR code
function QRCodeDisplay({ base64String }: { base64String: string }) {
  return (
    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed border-primary/30">
      <div className="flex items-center gap-2 mb-2">
        <QrCode className="h-4 w-4 text-primary" />
        <p className="text-xs font-medium text-primary">QR Code Detectado</p>
      </div>
      <div className="flex justify-center">
        <img 
          src={base64String} 
          alt="QR Code" 
          className="max-w-[200px] max-h-[200px] border rounded"
          onError={(e) => {
            // Se a imagem não carregar, esconde o componente
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Escaneie com seu dispositivo móvel
      </p>
    </div>
  )
}

// Função para extrair integration_id da mensagem de erro
function extractIntegrationId(text: string): string | null {
  // Procura por integration_id= seguido de um UUID ou string
  const pattern = /integration_id[=:]\s*([a-f0-9-]{36}|[a-f0-9-]+)/gi
  const match = pattern.exec(text)
  return match ? match[1] : null
}

// Função para buscar QR code via API e abrir em nova janela
async function fetchAndOpenQRCode(integrationId: string) {
  try {
    const response = await fetch(`http://192.168.15.31:3333/whatsapp/qrcode?integration_id=${integrationId}`)
    const data = await response.json()
    
    if (data.success && data.qrCode) {
      // Cria uma nova janela com o QR code
      const qrWindow = window.open('', '_blank', 'width=500,height=600')
      if (qrWindow) {
        const qrCodeBase64 = data.qrCode.startsWith('data:image') 
          ? data.qrCode 
          : `data:image/png;base64,${data.qrCode}`
        
        qrWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code WhatsApp</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 20px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                }
                .container {
                  background: white;
                  border-radius: 20px;
                  padding: 30px;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  text-align: center;
                  max-width: 400px;
                }
                h1 {
                  color: #333;
                  margin-bottom: 10px;
                  font-size: 24px;
                }
                .subtitle {
                  color: #666;
                  margin-bottom: 30px;
                  font-size: 14px;
                }
                .qr-container {
                  background: #f5f5f5;
                  padding: 20px;
                  border-radius: 10px;
                  margin: 20px 0;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 10px;
                }
                .instructions {
                  color: #333;
                  margin-top: 20px;
                  font-size: 14px;
                  line-height: 1.6;
                }
                .instructions ol {
                  text-align: left;
                  margin: 10px 0;
                  padding-left: 20px;
                }
                .instructions li {
                  margin: 8px 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>📱 QR Code WhatsApp</h1>
                <p class="subtitle">Escaneie com seu dispositivo móvel</p>
                <div class="qr-container">
                  <img src="${qrCodeBase64}" alt="QR Code WhatsApp" />
                </div>
                <div class="instructions">
                  <p><strong>Como escanear:</strong></p>
                  <ol>
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Vá em <strong>Configurações</strong> → <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Aponte a câmera para este QR Code</li>
                  </ol>
                </div>
              </div>
            </body>
          </html>
        `)
        qrWindow.document.close()
      }
    } else {
      alert('QR Code não disponível. O WhatsApp pode já estar conectado.')
    }
  } catch (error) {
    console.error('[FlowExecutionTimeline] Erro ao buscar QR code:', error)
    alert('Erro ao buscar QR code. Verifique a conexão com o servidor.')
  }
}

export function FlowExecutionTimeline({ 
  executionHistory, 
  isExecuting, 
  currentStepIndex 
}: FlowExecutionTimelineProps) {
  if (executionHistory.length === 0 && !isExecuting) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma execução ainda</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* Timeline vertical */}
      <div className="relative w-full max-w-full">
        {/* Linha vertical da timeline */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
        
        <div className="space-y-4 w-full max-w-full">
          {executionHistory.map((step, index) => {
            const isCurrent = isExecuting && index === currentStepIndex
            const isCompleted = step.success && !isCurrent
            const isError = !step.success
            const isPending = !isCompleted && !isError && !isCurrent

            return (
              <div key={step.nodeId || index} className="relative flex gap-4 min-w-0 max-w-full">
                {/* Ícone de status */}
                <div className={cn(
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background",
                  isCurrent && "border-primary bg-primary/10 animate-pulse",
                  isCompleted && "border-green-500 bg-green-500/10",
                  isError && "border-red-500 bg-red-500/10",
                  isPending && "border-muted bg-muted/50"
                )}>
                  {isCurrent ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isError ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Card de detalhes */}
                <Card className={cn(
                  "flex-1 p-4 transition-all min-w-0 max-w-full",
                  isCurrent && "ring-2 ring-primary shadow-lg",
                  isError && "border-red-500/50 bg-red-50 dark:bg-red-950/20",
                  isCompleted && "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                )}>
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <div className="flex-1 space-y-2 min-w-0 max-w-full">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm" style={{ color: '#0f172a' }}>
                          {step.nodeId || `Node ${index + 1}`}
                        </h4>
                        {step.agentId && (
                          <Badge variant="outline" className="text-xs" style={{ color: '#0f172a' }}>
                            Agent: {step.agentId.substring(0, 8)}...
                          </Badge>
                        )}
                      </div>

                      {(() => {
                        // Verifica tanto error quanto output para QR codes (sempre, não apenas em erro)
                        const errorText = step.error || ''
                        const outputText = step.output 
                          ? (typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2))
                          : ''
                        const combinedText = (errorText + '\n' + outputText).trim()
                        
                        // PRIORIDADE 1: Se o backend já enviou o QR code no campo qrCode, usa diretamente
                        let qrCodeBase64: string | null = null
                        if (step.qrCode) {
                          // Garante que tem o prefixo data:image se não tiver
                          qrCodeBase64 = step.qrCode.startsWith('data:image') 
                            ? step.qrCode 
                            : `data:image/png;base64,${step.qrCode}`
                          console.log('[FlowExecutionTimeline] QR code encontrado no campo qrCode do step', { 
                            nodeId: step.nodeId,
                            hasPrefix: step.qrCode.startsWith('data:image'),
                            length: qrCodeBase64.length 
                          })
                        }
                        
                        // PRIORIDADE 2: Se não encontrou no campo qrCode, tenta extrair do texto
                        if (!qrCodeBase64) {
                          qrCodeBase64 = extractQRCodeBase64(combinedText)
                          if (qrCodeBase64) {
                            console.log('[FlowExecutionTimeline] QR code extraído do texto', { nodeId: step.nodeId })
                          }
                        }
                        
                        const hasQRCode = qrCodeBase64 !== null
                        
                        // Remove o código base64 do texto se houver QR code
                        let displayError = errorText
                        let displayOutput = outputText
                        
                        if (hasQRCode && qrCodeBase64) {
                          // Remove padrões de QR code do texto de exibição
                          const qrPatterns = [
                            /CÓDIGO BASE64 DO QR CODE:[\s\S]*?data:image\/png;base64,[A-Za-z0-9+/=\s\n\r─═]+/gi,
                            /data:image\/png;base64,[A-Za-z0-9+/=\s\n\r─═]+/g,
                            /═══════════════════════════════════════════════════════════════/g,
                            // Remove também strings longas de base64 que possam ser QR codes
                            /([A-Za-z0-9+/=]{300,})/g
                          ]
                          
                          qrPatterns.forEach(pattern => {
                            displayError = displayError.replace(pattern, '').trim()
                            displayOutput = displayOutput.replace(pattern, '').trim()
                          })
                        }
                        
                        // Log para debug
                        if (hasQRCode && qrCodeBase64) {
                          console.log('[FlowExecutionTimeline] ✅ QR code detectado e será renderizado', {
                            nodeId: step.nodeId,
                            qrCodeLength: qrCodeBase64.length,
                            qrCodePreview: qrCodeBase64.substring(0, 50) + '...',
                            source: step.qrCode ? 'backend field' : 'extracted from text'
                          })
                        } else if (step.qrCode || combinedText.includes('QR') || combinedText.includes('CÓDIGO BASE64')) {
                          console.warn('[FlowExecutionTimeline] ⚠️ QR code não detectado, mas há indicações', {
                            nodeId: step.nodeId,
                            hasQrCodeField: !!step.qrCode,
                            qrCodeFieldValue: step.qrCode ? step.qrCode.substring(0, 50) + '...' : null,
                            hasQRInText: combinedText.includes('QR'),
                            hasCodigoBase64: combinedText.includes('CÓDIGO BASE64'),
                            combinedTextLength: combinedText.length,
                            combinedTextPreview: combinedText.substring(0, 300)
                          })
                        }
                        
                        return (
                          <div className="space-y-2">
                            {hasQRCode && qrCodeBase64 && (
                              <QRCodeDisplay base64String={qrCodeBase64} />
                            )}
                            {isError && step.error && (() => {
                              // Verifica se é erro de WhatsApp desconectado
                              const isWhatsAppError = displayError.includes('WhatsApp não está conectado') || 
                                                      displayError.includes('QR Code') ||
                                                      displayError.includes('integration_id')
                              const integrationId = isWhatsAppError ? extractIntegrationId(displayError) : null
                              
                              return (
                                <div className="rounded-md bg-red-100 dark:bg-red-900/30 p-3 border border-red-200 dark:border-red-800">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-red-950 dark:text-red-100" style={{ color: '#0f172a' }}>
                                          Erro na execução
                                        </p>
                                        {isWhatsAppError && integrationId && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            onClick={() => fetchAndOpenQRCode(integrationId)}
                                          >
                                            <QrCode className="h-3 w-3 mr-1" />
                                            Abrir QR Code
                                          </Button>
                                        )}
                                      </div>
                                      <ScrollArea className="max-h-96 w-full">
                                        <pre className="text-xs whitespace-pre-wrap break-words break-all max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', color: '#0f172a' }}>
                                          {displayError}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            {(isCompleted || isError) && displayOutput && displayOutput.length > 0 && (() => {
                              // Verifica se o output contém erro de WhatsApp desconectado
                              const isWhatsAppErrorInOutput = displayOutput.includes('WhatsApp não está conectado') || 
                                                              displayOutput.includes('QR Code') ||
                                                              displayOutput.includes('integration_id')
                              const integrationIdFromOutput = isWhatsAppErrorInOutput ? extractIntegrationId(displayOutput) : null
                              
                              return (
                                <div className="rounded-md bg-muted/50 p-3 border min-w-0 max-w-full">
                                  <div className="flex items-center justify-between mb-2 min-w-0">
                                    <p className="text-xs" style={{ color: '#0f172a' }}>Output:</p>
                                    {isWhatsAppErrorInOutput && integrationIdFromOutput && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => fetchAndOpenQRCode(integrationIdFromOutput)}
                                      >
                                        <QrCode className="h-3 w-3 mr-1" />
                                        Abrir QR Code
                                      </Button>
                                    )}
                                  </div>
                                  <ScrollArea className="max-h-96 w-full">
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-words break-all max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', color: '#0f172a' }}>
                                      {displayOutput}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })()}

                      {/* Mostra output quando completado com sucesso (sem erro) */}
                      {isCompleted && !isError && step.output && (() => {
                        const outputText = typeof step.output === 'string' 
                          ? step.output 
                          : JSON.stringify(step.output, null, 2)
                        
                        const qrCodeBase64 = extractQRCodeBase64(outputText)
                        const hasQRCode = qrCodeBase64 !== null
                        
                        // Remove o código base64 do texto se houver QR code
                        let displayText = outputText
                        if (hasQRCode && qrCodeBase64) {
                          // Remove o padrão do QR code do texto
                          displayText = displayText
                            .replace(/CÓDIGO BASE64 DO QR CODE:[\s\S]*?data:image\/png;base64,[A-Za-z0-9+/=\s\n\r─═]+/gi, '')
                            .replace(/data:image\/png;base64,[A-Za-z0-9+/=\s\n\r─═]+/g, '')
                            .replace(/═══════════════════════════════════════════════════════════════/g, '')
                            .trim()
                        }
                        
                        return (
                          <div className="space-y-2">
                            {hasQRCode && qrCodeBase64 && (
                              <QRCodeDisplay base64String={qrCodeBase64} />
                            )}
                            {displayText && displayText.length > 0 && (
                              <div className="rounded-md bg-muted/50 p-2 border">
                                <p className="text-xs mb-1" style={{ color: '#0f172a' }}>Output:</p>
                                <ScrollArea className="max-h-96 w-full">
                                  <pre className="text-xs font-mono whitespace-pre-wrap break-words" style={{ color: '#0f172a' }}>
                                    {displayText}
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {step.duration && (
                        <p className="text-xs" style={{ color: '#0f172a' }}>
                          Duração: {step.duration}ms
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground animate-pulse">
                          Executando
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-500 text-white">
                          Sucesso
                        </Badge>
                      )}
                      {isError && (
                        <Badge className="bg-red-500 text-white">
                          Erro
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="outline">
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )
          })}

          {/* Indicador de execução atual (se ainda estiver executando) */}
          {isExecuting && currentStepIndex !== undefined && currentStepIndex >= executionHistory.length && (
            <div className="relative flex gap-4">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-primary/10 animate-pulse">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <Card className="flex-1 p-4 ring-2 ring-primary shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">Processando...</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Executando próximo passo do flow
                    </p>
                  </div>
                  <Badge className="bg-primary text-primary-foreground animate-pulse">
                    Executando
                  </Badge>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
