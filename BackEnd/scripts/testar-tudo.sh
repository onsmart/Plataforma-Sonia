#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  TESTE COMPLETO DO SISTEMA"
echo "============================================"
echo ""

SUCCESS=0
FAIL=0

echo -e "${BLUE}[1]${NC} Verificando Backend Local (localhost:3333)..."
if curl -f -s http://localhost:3333/agents > /dev/null 2>&1; then
    echo -e "${GREEN}Backend está rodando em http://localhost:3333${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}Backend não está rodando em http://localhost:3333${NC}"
    echo "   Execute: cd ~/plataform-backend/BackEnd && npm run dev"
    ((FAIL++))
fi
echo ""

echo -e "${BLUE}[2]${NC} Verificando Túnel Cloudflare..."
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}Serviço cloudflared está ativo${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}Serviço cloudflared está inativo${NC}"
    ((FAIL++))
fi
echo ""

echo -e "${BLUE}[3]${NC} Testando URL do webhook..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://webhook.onsmart.ai/whatsapp/webhook || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}Webhook respondeu com HTTP 200${NC}"
    ((SUCCESS++))
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}Webhook respondeu com HTTP 404${NC}"
    echo "   O túnel pode estar funcional, mas o backend ou a rota precisam ser revisados"
    ((SUCCESS++))
else
    echo -e "${RED}Webhook não respondeu corretamente (HTTP $HTTP_CODE)${NC}"
    ((FAIL++))
fi
echo ""

echo -e "${BLUE}[4]${NC} Verificando containers Docker..."
if command -v docker-compose &> /dev/null; then
    cd ~/plataform-backend/BackEnd 2>/dev/null || cd ~/plataform-backend
    if [ -f docker-compose.yml ]; then
        RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
        TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)
        if [ "$RUNNING" -gt 0 ]; then
            echo -e "${GREEN}$RUNNING de $TOTAL containers estão rodando${NC}"
            docker-compose ps
            ((SUCCESS++))
        else
            echo -e "${YELLOW}Nenhum container está rodando${NC}"
            echo "   Execute: docker-compose up -d"
        fi
    else
        echo -e "${YELLOW}docker-compose.yml não encontrado${NC}"
    fi
else
    echo -e "${YELLOW}docker-compose não encontrado${NC}"
fi
echo ""

echo -e "${BLUE}[5]${NC} Testando webhook com POST..."
TEST_RESPONSE=$(curl -s -X POST https://webhook.onsmart.ai/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP_CODE:%{http_code}" 2>/dev/null || echo "ERROR")

if echo "$TEST_RESPONSE" | grep -q "HTTP_CODE:200\|HTTP_CODE:404"; then
    HTTP_CODE=$(echo "$TEST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    echo -e "${GREEN}Webhook respondeu ao POST com HTTP $HTTP_CODE${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}Erro ao testar webhook com POST${NC}"
    ((FAIL++))
fi
echo ""

echo "============================================"
echo "  RESUMO"
echo "============================================"
echo ""
echo -e "Sucessos: ${GREEN}$SUCCESS${NC}"
echo -e "Falhas: ${RED}$FAIL${NC}"
echo ""
