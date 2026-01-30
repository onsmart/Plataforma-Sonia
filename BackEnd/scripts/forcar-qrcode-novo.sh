#!/bin/bash

# ============================================
# Script para Forçar Novo QR Code
# Deleta instância e recria para gerar novo QR Code
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
echo "  FORÇAR NOVO QR CODE"
echo "============================================"
echo ""

EVOLUTION_API_URL="http://192.168.15.31:8081"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"

# Solicitar nome da instância
read -p "Digite o nome da instância (número do WhatsApp, ex: 11943687794): " INSTANCE_NAME

if [ -z "$INSTANCE_NAME" ]; then
    echo -e "${RED}❌ Nome da instância não informado!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Instância:${NC} $INSTANCE_NAME"
echo ""

# 1. Deletar instância
echo -e "${BLUE}[1]${NC} Deletando instância..."
DELETE_RESPONSE=$(curl -s -X DELETE "$EVOLUTION_API_URL/instance/delete/$INSTANCE_NAME" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

if echo "$DELETE_RESPONSE" | grep -q "success\|200\|deleted"; then
    echo -e "${GREEN}✅ Instância deletada com sucesso${NC}"
else
    echo -e "${YELLOW}⚠️  Resposta ao deletar:${NC}"
    echo "$DELETE_RESPONSE" | head -5
    echo ""
    echo -e "${YELLOW}Continuando mesmo assim...${NC}"
fi
echo ""

# 2. Aguardar alguns segundos
echo -e "${BLUE}[2]${NC} Aguardando 5 segundos..."
sleep 5
echo ""

# 3. Recriar instância
echo -e "${BLUE}[3]${NC} Recriando instância..."
CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"token\": \"\",
    \"qrcode\": true
  }" 2>&1)

echo "Resposta:"
echo "$CREATE_RESPONSE" | head -10
echo ""

# 4. Verificar se QR Code foi gerado
if echo "$CREATE_RESPONSE" | grep -q "qrcode\|base64"; then
    echo -e "${GREEN}✅ QR Code gerado!${NC}"
    echo ""
    echo "Para obter o QR Code, execute:"
    echo "  curl -X GET \"$EVOLUTION_API_URL/instance/connect/$INSTANCE_NAME\" -H \"apikey: $EVOLUTION_API_KEY\""
else
    echo -e "${YELLOW}⚠️  QR Code não retornado imediatamente${NC}"
    echo ""
    echo "Aguardando 10 segundos e tentando novamente..."
    sleep 10
    
    CONNECT_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE_NAME" \
      -H "apikey: $EVOLUTION_API_KEY" 2>&1)
    
    if echo "$CONNECT_RESPONSE" | grep -q "qrcode\|base64"; then
        echo -e "${GREEN}✅ QR Code encontrado!${NC}"
        echo ""
        echo "$CONNECT_RESPONSE" | grep -o '"qrcode":"[^"]*"' | head -1 || \
        echo "$CONNECT_RESPONSE" | grep -o '"base64":"[^"]*"' | head -1
    else
        echo -e "${RED}❌ QR Code ainda não disponível${NC}"
        echo ""
        echo "Tente:"
        echo "  1. Verificar logs: docker-compose logs evolution-api -f"
        echo "  2. Reiniciar Evolution API: docker-compose restart evolution-api"
        echo "  3. Aguardar mais 30 segundos e tentar novamente"
    fi
fi

echo ""
echo "============================================"
echo "  CONCLUÍDO"
echo "============================================"
echo ""
