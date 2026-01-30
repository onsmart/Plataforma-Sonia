#!/bin/bash

# ============================================
# Script para Corrigir Problema de QR Code
# Versão simplificada para servidor
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
echo "  CORRIGIR PROBLEMA DE QR CODE"
echo "============================================"
echo ""

EVOLUTION_API_URL="http://192.168.15.31:8081"
EVOLUTION_API_KEY="dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=="

# 1. Listar instâncias
echo -e "${BLUE}[1]${NC} Listando instâncias..."
echo ""

INSTANCES_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/fetchInstances" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

echo "Resposta completa:"
echo "$INSTANCES_RESPONSE"
echo ""

# Tentar extrair IDs das instâncias
INSTANCE_IDS=$(echo "$INSTANCES_RESPONSE" | grep -o '"[a-f0-9-]\{36\}"' | tr -d '"' | sort -u)

if [ -z "$INSTANCE_IDS" ]; then
    echo -e "${YELLOW}⚠️  Nenhuma instância encontrada ou formato diferente${NC}"
    echo ""
    echo "Tente usar o ID diretamente do Evolution Manager:"
    echo "  Exemplo: 528d1d39-342e-460d-b1cc-c601452cc0fb"
    echo ""
    read -p "Digite o ID da instância: " INSTANCE_ID
else
    echo -e "${GREEN}✅ Instâncias encontradas:${NC}"
    for ID in $INSTANCE_IDS; do
        echo "  - $ID"
    done
    echo ""
    read -p "Digite o ID da instância (ou Enter para usar a primeira): " INSTANCE_ID
    
    if [ -z "$INSTANCE_ID" ]; then
        INSTANCE_ID=$(echo "$INSTANCE_IDS" | head -1)
        echo "Usando: $INSTANCE_ID"
    fi
fi

if [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ ID da instância não informado!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Instância:${NC} $INSTANCE_ID"
echo ""

# 2. Verificar status atual
echo -e "${BLUE}[2]${NC} Verificando status atual..."
STATUS_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE_ID" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

echo "Resposta:"
echo "$STATUS_RESPONSE" | head -20
echo ""

# Verificar se está conectada
if echo "$STATUS_RESPONSE" | grep -q '"state":"open"\|"state":"connected"\|"status":"open"\|"status":"connected"'; then
    echo -e "${GREEN}✅ Instância está conectada. QR Code não necessário.${NC}"
    exit 0
fi

# 3. Tentar obter QR Code
echo -e "${BLUE}[3]${NC} Tentando obter QR Code..."
QRCODE_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE_ID" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

QRCODE=$(echo "$QRCODE_RESPONSE" | grep -o '"qrcode":"[^"]*"' | cut -d'"' -f4 | head -1)
BASE64=$(echo "$QRCODE_RESPONSE" | grep -o '"base64":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$QRCODE" ] || [ -n "$BASE64" ]; then
    echo -e "${GREEN}✅ QR Code encontrado!${NC}"
    echo ""
    if [ -n "$BASE64" ]; then
        echo "Base64 (primeiros 100 caracteres):"
        echo "${BASE64:0:100}..."
        echo ""
        echo "QR Code completo salvo acima. Use este base64 para gerar a imagem."
    fi
    exit 0
fi

# 4. Se não encontrou QR Code, deletar e recriar
echo -e "${YELLOW}⚠️  QR Code não encontrado. Tentando deletar e recriar...${NC}"
echo ""

echo -e "${BLUE}[4]${NC} Deletando instância..."
DELETE_RESPONSE=$(curl -s -X DELETE "$EVOLUTION_API_URL/instance/delete/$INSTANCE_ID" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

echo "Resposta:"
echo "$DELETE_RESPONSE" | head -5
echo ""

echo "Aguardando 5 segundos..."
sleep 5
echo ""

# 5. Recriar instância
echo -e "${BLUE}[5]${NC} Recriando instância..."
CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"instanceName\": \"$INSTANCE_ID\", \"token\": \"\", \"qrcode\": true}" 2>&1)

echo "Resposta:"
echo "$CREATE_RESPONSE" | head -20
echo ""

# 6. Aguardar e verificar QR Code novamente
echo "Aguardando 10 segundos..."
sleep 10
echo ""

echo -e "${BLUE}[6]${NC} Verificando QR Code novamente..."
FINAL_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE_ID" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

FINAL_QRCODE=$(echo "$FINAL_RESPONSE" | grep -o '"qrcode":"[^"]*"' | cut -d'"' -f4 | head -1)
FINAL_BASE64=$(echo "$FINAL_RESPONSE" | grep -o '"base64":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$FINAL_QRCODE" ] || [ -n "$FINAL_BASE64" ]; then
    echo -e "${GREEN}✅ QR Code encontrado!${NC}"
    echo ""
    if [ -n "$FINAL_BASE64" ]; then
        echo "Base64 completo:"
        echo "$FINAL_BASE64"
    fi
else
    echo -e "${RED}❌ QR Code ainda não disponível${NC}"
    echo ""
    echo "Tente:"
    echo "  1. Verificar logs: docker-compose logs evolution-api -f"
    echo "  2. Reiniciar: docker-compose restart evolution-api"
    echo "  3. Acessar Evolution Manager: http://192.168.15.31:8081/manager"
fi

echo ""
echo "============================================"
echo "  CONCLUÍDO"
echo "============================================"
echo ""
