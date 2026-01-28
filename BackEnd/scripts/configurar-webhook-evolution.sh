#!/bin/bash

# ============================================
# Script para Configurar Webhook na Evolution API
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  CONFIGURAR WEBHOOK NA EVOLUTION API"
echo "============================================"
echo ""

# URL do webhook
WEBHOOK_URL="https://webhook.onsmart.ai/whatsapp/webhook"
EVOLUTION_API_URL="http://localhost:8081"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"

echo -e "${BLUE}URL do Webhook:${NC} $WEBHOOK_URL"
echo -e "${BLUE}Evolution API:${NC} $EVOLUTION_API_URL"
echo ""

# Verificar se Evolution API está rodando
echo -e "${BLUE}[1]${NC} Verificando Evolution API..."
if curl -f -s "$EVOLUTION_API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evolution API está rodando${NC}"
else
    echo -e "${RED}❌ Evolution API não está respondendo${NC}"
    echo "   Verifique: docker-compose ps"
    exit 1
fi
echo ""

# Listar instâncias
echo -e "${BLUE}[2]${NC} Listando instâncias..."
INSTANCES=$(curl -s -X GET "$EVOLUTION_API_URL/instance/fetchInstances" \
  -H "apikey: $EVOLUTION_API_KEY" 2>/dev/null || echo "[]")

if [ "$INSTANCES" = "[]" ] || [ -z "$INSTANCES" ]; then
    echo -e "${YELLOW}⚠️  Nenhuma instância encontrada${NC}"
    echo ""
    echo "Você precisa criar uma instância primeiro."
    echo "Ou informe o nome da instância manualmente."
    echo ""
    read -p "Nome da instância (ou deixe vazio para pular): " INSTANCE_NAME
else
    echo -e "${GREEN}✅ Instâncias encontradas:${NC}"
    echo "$INSTANCES" | grep -o '"instanceName":"[^"]*"' | cut -d'"' -f4 | head -5
    echo ""
    read -p "Nome da instância para configurar webhook: " INSTANCE_NAME
fi

if [ -z "$INSTANCE_NAME" ]; then
    echo ""
    echo "Configuração manual:"
    echo "  1. Acesse: $EVOLUTION_API_URL/manager"
    echo "  2. Vá em Settings > Webhook"
    echo "  3. Configure: $WEBHOOK_URL"
    echo ""
    exit 0
fi

echo ""

# Configurar webhook
echo -e "${BLUE}[3]${NC} Configurando webhook para instância: $INSTANCE_NAME"
echo ""

RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/webhook/set/$INSTANCE_NAME" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"webhook_by_events\": true,
    \"webhook_base64\": false,
    \"events\": [
      \"MESSAGES_UPSERT\",
      \"MESSAGES_UPDATE\",
      \"MESSAGES_DELETE\",
      \"SEND_MESSAGE\",
      \"CONNECTION_UPDATE\",
      \"QRCODE_UPDATED\"
    ]
  }" 2>&1)

if echo "$RESPONSE" | grep -q "success\|200"; then
    echo -e "${GREEN}✅ Webhook configurado com sucesso!${NC}"
    echo ""
    echo "Resposta:"
    echo "$RESPONSE" | head -20
else
    echo -e "${YELLOW}⚠️  Resposta da API:${NC}"
    echo "$RESPONSE"
    echo ""
    echo "Se deu erro, configure manualmente:"
    echo "  1. Acesse: $EVOLUTION_API_URL/manager"
    echo "  2. Vá em Settings > Webhook"
    echo "  3. Configure: $WEBHOOK_URL"
fi

echo ""
echo "============================================"
echo "  CONFIGURAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "URL do Webhook: $WEBHOOK_URL"
echo ""
echo "Para verificar se está funcionando:"
echo "  1. Envie uma mensagem no WhatsApp"
echo "  2. Verifique os logs do backend:"
echo "     cd ~/plataform-backend/BackEnd"
echo "     npm run dev"
echo ""
