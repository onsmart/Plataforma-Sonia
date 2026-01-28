#!/bin/bash

# ============================================
# Script para Debug do Webhook
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
echo "  DEBUG DO WEBHOOK"
echo "============================================"
echo ""

# 1. Verificar se backend está rodando
echo -e "${BLUE}[1]${NC} Verificando se backend está rodando..."
if curl -f -s http://localhost:3333/agents > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está rodando${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${RED}❌ Backend NÃO está rodando${NC}"
    echo ""
    echo "Para iniciar:"
    echo "  cd ~/plataform-backend/BackEnd"
    echo "  npm run dev"
    BACKEND_RUNNING=false
fi
echo ""

# 2. Verificar processo do backend
echo -e "${BLUE}[2]${NC} Verificando processo do backend..."
PROCESS=$(ps aux | grep -E "node.*index|ts-node.*index" | grep -v grep || echo "")
if [ -n "$PROCESS" ]; then
    echo -e "${GREEN}✅ Processo encontrado:${NC}"
    echo "$PROCESS" | head -1
else
    echo -e "${RED}❌ Nenhum processo do backend encontrado${NC}"
fi
echo ""

# 3. Testar backend local diretamente
echo -e "${BLUE}[3]${NC} Testando backend local (POST)..."
LOCAL_RESPONSE=$(curl -s -X POST http://localhost:3333/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "ERROR")

if echo "$LOCAL_RESPONSE" | grep -q "HTTP_CODE:200\|HTTP_CODE:404"; then
    HTTP_CODE=$(echo "$LOCAL_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    echo -e "${GREEN}✅ Backend local respondeu com HTTP $HTTP_CODE${NC}"
    echo "Resposta:"
    echo "$LOCAL_RESPONSE" | grep -v "HTTP_CODE"
else
    echo -e "${RED}❌ Backend local não respondeu${NC}"
    echo "Resposta: $LOCAL_RESPONSE"
fi
echo ""

# 4. Testar túnel
echo -e "${BLUE}[4]${NC} Testando túnel (POST)..."
TUNNEL_RESPONSE=$(curl -s -X POST https://webhook.onsmart.ai/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "ERROR")

HTTP_CODE=$(echo "$TUNNEL_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2 || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Túnel respondeu com HTTP 200${NC}"
    echo "Resposta:"
    echo "$TUNNEL_RESPONSE" | grep -v "HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  Túnel respondeu com HTTP 404${NC}"
    echo "Isso significa que o túnel está funcionando, mas:"
    echo "  - Backend não está rodando, OU"
    echo "  - Rota não existe"
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ Túnel não respondeu${NC}"
    echo "Resposta: $TUNNEL_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Túnel respondeu com HTTP $HTTP_CODE${NC}"
    echo "Resposta:"
    echo "$TUNNEL_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# 5. Verificar configuração do túnel
echo -e "${BLUE}[5]${NC} Verificando configuração do túnel..."
if [ -f ~/.cloudflared/config.yml ]; then
    WEBHOOK_CONFIG=$(grep -A 1 "webhook.onsmart.ai" ~/.cloudflared/config.yml || echo "")
    if [ -n "$WEBHOOK_CONFIG" ]; then
        echo -e "${GREEN}✅ Configuração encontrada:${NC}"
        echo "$WEBHOOK_CONFIG"
    else
        echo -e "${RED}❌ webhook.onsmart.ai não encontrado na configuração${NC}"
        echo ""
        echo "Adicione ao ~/.cloudflared/config.yml:"
        echo "  - hostname: webhook.onsmart.ai"
        echo "    service: http://localhost:3333"
    fi
else
    echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
fi
echo ""

# 6. Verificar rota no código
echo -e "${BLUE}[6]${NC} Verificando se a rota existe no código..."
if [ -f ~/plataform-backend/BackEnd/src/api/routes/whatsapp.routes.ts ]; then
    if grep -q "/webhook" ~/plataform-backend/BackEnd/src/api/routes/whatsapp.routes.ts; then
        echo -e "${GREEN}✅ Rota /webhook encontrada no código${NC}"
    else
        echo -e "${RED}❌ Rota /webhook não encontrada no código${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo de rotas não encontrado${NC}"
fi
echo ""

# Resumo
echo "============================================"
echo "  RESUMO"
echo "============================================"
echo ""

if [ "$BACKEND_RUNNING" = true ] && [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}🎉 TUDO FUNCIONANDO!${NC}"
    echo ""
    echo "O webhook está recebendo e processando requisições!"
elif [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${RED}❌ Backend não está rodando${NC}"
    echo ""
    echo "Para iniciar:"
    echo "  cd ~/plataform-backend/BackEnd"
    echo "  npm run dev"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  Túnel funciona, mas backend não está processando${NC}"
    echo ""
    echo "Verifique:"
    echo "  1. Backend está rodando? (npm run dev)"
    echo "  2. Rota /whatsapp/webhook existe?"
    echo "  3. Backend está na porta 3333?"
else
    echo -e "${YELLOW}⚠️  Verifique os problemas acima${NC}"
fi

echo ""
