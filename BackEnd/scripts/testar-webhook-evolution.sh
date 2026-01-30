#!/bin/bash

# ============================================
# Script para Testar se Evolution API está Enviando Webhooks
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
echo "  TESTAR WEBHOOK DA EVOLUTION API"
echo "============================================"
echo ""

EVOLUTION_API_URL="http://192.168.15.31:8081"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"
WEBHOOK_URL="https://webhook.onsmart.ai/whatsapp/webhook"

# Listar instâncias
echo -e "${BLUE}[1]${NC} Listando instâncias..."
INSTANCES_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/fetchInstances" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

INSTANCE_NAMES=$(echo "$INSTANCES_RESPONSE" | grep -o '"instanceName":"[^"]*"' | cut -d'"' -f4)

if [ -z "$INSTANCE_NAMES" ]; then
    echo -e "${RED}❌ Nenhuma instância encontrada${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Instâncias encontradas:${NC}"
for INSTANCE in $INSTANCE_NAMES; do
    echo "  - $INSTANCE"
done
echo ""

# Pegar primeira instância
FIRST_INSTANCE=$(echo "$INSTANCE_NAMES" | head -1)
echo -e "${BLUE}[2]${NC} Usando instância: $FIRST_INSTANCE"
echo ""

# Verificar webhook configurado
echo -e "${BLUE}[3]${NC} Verificando webhook configurado..."
WEBHOOK_INFO=$(curl -s -X GET "$EVOLUTION_API_URL/webhook/find/$FIRST_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

echo "Resposta da API:"
echo "$WEBHOOK_INFO" | head -20
echo ""

# Configurar webhook se necessário
if ! echo "$WEBHOOK_INFO" | grep -q "$WEBHOOK_URL"; then
    echo -e "${YELLOW}⚠️  Webhook não está configurado corretamente${NC}"
    echo -e "${BLUE}Configurando webhook...${NC}"
    echo ""
    
    CONFIG_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/webhook/set/$FIRST_INSTANCE" \
      -H "apikey: $EVOLUTION_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"url\": \"$WEBHOOK_URL\",
        \"webhook_by_events\": true,
        \"webhook_base64\": false,
        \"events\": [\"MESSAGES_UPSERT\", \"MESSAGES_UPDATE\", \"CONNECTION_UPDATE\"]
      }" 2>&1)
    
    echo "Resposta da configuração:"
    echo "$CONFIG_RESPONSE" | head -20
    echo ""
fi

# Verificar logs do Evolution API
echo -e "${BLUE}[4]${NC} Verificando logs do Evolution API..."
echo "Últimas 20 linhas dos logs:"
docker-compose logs evolution-api --tail=20 2>/dev/null || docker logs evolution-api --tail=20 2>/dev/null || echo "Não foi possível acessar os logs"

echo ""
echo "============================================"
echo "  TESTE MANUAL"
echo "============================================"
echo ""
echo "Para testar se o webhook está funcionando:"
echo ""
echo "1. Envie uma mensagem no WhatsApp para o número conectado"
echo ""
echo "2. Verifique os logs do backend (em outro terminal):"
echo "   cd ~/plataform-backend/BackEnd"
echo "   npm run dev"
echo ""
echo "3. Verifique os logs do Evolution API:"
echo "   docker-compose logs evolution-api -f"
echo ""
echo "4. Procure por mensagens como:"
echo "   - 'webhook'"
echo "   - 'MESSAGES_UPSERT'"
echo "   - 'POST' para o webhook"
echo ""
