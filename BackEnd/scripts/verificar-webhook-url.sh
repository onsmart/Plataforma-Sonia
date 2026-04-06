#!/bin/bash

# ============================================
# Script para Verificar Configuração do Webhook
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
echo "  VERIFICAR CONFIGURAÇÃO DO WEBHOOK"
echo "============================================"
echo ""

WEBHOOK_URL="https://webhook.onsmart.ai/whatsapp/webhook"
BACKEND_LOCAL="http://localhost:3333/whatsapp/webhook"
BACKEND_IP="http://192.168.15.31:3333/whatsapp/webhook"

echo -e "${BLUE}URLs configuradas:${NC}"
echo "  Webhook público: $WEBHOOK_URL"
echo "  Backend local: $BACKEND_LOCAL"
echo "  Backend IP: $BACKEND_IP"
echo ""

# 1. Verificar se backend está rodando localmente
echo -e "${BLUE}[1]${NC} Verificando backend local..."
if curl -f -s "$BACKEND_LOCAL" -X POST -H "Content-Type: application/json" -d '{"test": true}' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está respondendo localmente${NC}"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_LOCAL" -H "Content-Type: application/json" -d '{"test": true}' 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ Backend não está rodando na porta 3333${NC}"
        echo "   Execute: cd ~/plataform-backend/BackEnd && npm run dev"
    else
        echo -e "${YELLOW}⚠️  Backend respondeu com código HTTP: $HTTP_CODE${NC}"
    fi
fi
echo ""

# 2. Verificar se Cloudflare Tunnel está rodando
echo -e "${BLUE}[2]${NC} Verificando Cloudflare Tunnel..."
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Cloudflare Tunnel está rodando${NC}"
else
    echo -e "${RED}❌ Cloudflare Tunnel não está rodando${NC}"
    echo "   Execute: sudo systemctl status cloudflared"
fi
echo ""

# 3. Verificar configuração do túnel
echo -e "${BLUE}[3]${NC} Verificando configuração do túnel..."
if [ -f ~/.cloudflared/config.yml ]; then
    echo "Configuração encontrada:"
    cat ~/.cloudflared/config.yml | grep -A 5 "webhook.onsmart.ai" || echo "  webhook.onsmart.ai não encontrado na configuração"
    
    # Verificar se aponta para localhost:3333
    if grep -q "webhook.onsmart.ai" ~/.cloudflared/config.yml && grep -q "localhost:3333" ~/.cloudflared/config.yml; then
        echo -e "${GREEN}✅ Túnel configurado corretamente para localhost:3333${NC}"
    else
        echo -e "${YELLOW}⚠️  Verifique se o túnel aponta para localhost:3333${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo de configuração não encontrado${NC}"
fi
echo ""

# 4. Testar webhook público
echo -e "${BLUE}[4]${NC} Testando webhook público..."
TEST_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true, "event": "test"}' 2>&1)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' 2>&1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || echo "$TEST_RESPONSE" | grep -q "received\|test"; then
    echo -e "${GREEN}✅ Webhook público está acessível (HTTP $HTTP_CODE)${NC}"
    echo "   Resposta: $TEST_RESPONSE" | head -3
else
    if [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ Webhook público não está acessível${NC}"
        echo "   Verifique:"
        echo "   1. DNS está configurado? (webhook.onsmart.ai)"
        echo "   2. Cloudflare Tunnel está rodando?"
        echo "   3. Túnel está configurado para webhook.onsmart.ai?"
    else
        echo -e "${YELLOW}⚠️  Webhook respondeu com HTTP $HTTP_CODE${NC}"
        echo "   Resposta: $TEST_RESPONSE" | head -3
    fi
fi
echo ""

# 5. Verificar docker-compose.yml
echo -e "${BLUE}[5]${NC} Verificando docker-compose.yml..."
if [ -f docker-compose.yml ]; then
    WEBHOOK_CONFIG=$(grep "WEBHOOK_GLOBAL_URL" docker-compose.yml | head -1)
    echo "  Configuração: $WEBHOOK_CONFIG"
    
    if echo "$WEBHOOK_CONFIG" | grep -q "webhook.onsmart.ai"; then
        echo -e "${GREEN}✅ docker-compose.yml está configurado corretamente${NC}"
    else
        echo -e "${YELLOW}⚠️  WEBHOOK_GLOBAL_URL pode não estar configurado corretamente${NC}"
        echo "   Deve ser: WEBHOOK_GLOBAL_URL: https://webhook.onsmart.ai/whatsapp/webhook"
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose.yml não encontrado${NC}"
fi
echo ""

# 6. Resumo
echo "============================================"
echo "  RESUMO"
echo "============================================"
echo ""
echo "URL do webhook: $WEBHOOK_URL"
echo ""
echo "Para configurar na Meta Cloud API:"
echo "  1. A URL está correta: $WEBHOOK_URL"
echo "  2. Certifique-se de que:"
echo "     - Backend está rodando na porta 3333"
echo "     - Cloudflare Tunnel está rodando"
echo "     - DNS webhook.onsmart.ai aponta para o túnel"
echo "     - Túnel está configurado para localhost:3333"
echo ""
echo "Para testar manualmente:"
echo "  curl -X POST \"$WEBHOOK_URL\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"test\": true}'"
echo ""
