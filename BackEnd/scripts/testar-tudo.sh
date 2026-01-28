#!/bin/bash

# ============================================
# Script para Testar Tudo - Verificação Completa
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
echo "  TESTE COMPLETO DO SISTEMA"
echo "============================================"
echo ""

SUCCESS=0
FAIL=0

# 1. Verificar Backend Local
echo -e "${BLUE}[1]${NC} Verificando Backend Local (localhost:3333)..."
if curl -f -s http://localhost:3333/agents > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está rodando em http://localhost:3333${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}❌ Backend NÃO está rodando em http://localhost:3333${NC}"
    echo "   Execute: cd ~/plataform-backend/BackEnd && npm run dev"
    ((FAIL++))
fi
echo ""

# 2. Verificar Túnel Cloudflare
echo -e "${BLUE}[2]${NC} Verificando Túnel Cloudflare..."
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Serviço cloudflared está ATIVO${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}❌ Serviço cloudflared está INATIVO${NC}"
    ((FAIL++))
fi
echo ""

# 3. Verificar URL do Túnel
echo -e "${BLUE}[3]${NC} Testando URL do Túnel (https://webhook.onsmart.ai/whatsapp/webhook)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://webhook.onsmart.ai/whatsapp/webhook || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ URL responde com HTTP 200 (SUCESSO!)${NC}"
    ((SUCCESS++))
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  URL responde com HTTP 404${NC}"
    echo "   Isso significa que o túnel está funcionando, mas:"
    echo "   - Backend não está rodando, OU"
    echo "   - Rota não existe"
    ((SUCCESS++)) # Túnel funciona, só falta backend
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ URL não responde (erro de conexão)${NC}"
    ((FAIL++))
else
    echo -e "${YELLOW}⚠️  URL responde com HTTP $HTTP_CODE${NC}"
    ((SUCCESS++)) # Túnel funciona
fi
echo ""

# 4. Verificar Evolution API
echo -e "${BLUE}[4]${NC} Verificando Evolution API (localhost:8081)..."
if curl -f -s http://localhost:8081 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evolution API está rodando em http://localhost:8081${NC}"
    ((SUCCESS++))
else
    echo -e "${YELLOW}⚠️  Evolution API não está respondendo${NC}"
    echo "   Verifique: docker-compose ps"
fi
echo ""

# 5. Verificar Docker Containers
echo -e "${BLUE}[5]${NC} Verificando Containers Docker..."
if command -v docker-compose &> /dev/null; then
    cd ~/plataform-backend/BackEnd 2>/dev/null || cd ~/plataform-backend
    if [ -f docker-compose.yml ]; then
        RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
        TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)
        if [ "$RUNNING" -gt 0 ]; then
            echo -e "${GREEN}✅ $RUNNING de $TOTAL containers estão rodando${NC}"
            docker-compose ps
            ((SUCCESS++))
        else
            echo -e "${RED}❌ Nenhum container está rodando${NC}"
            echo "   Execute: docker-compose up -d"
            ((FAIL++))
        fi
    else
        echo -e "${YELLOW}⚠️  docker-compose.yml não encontrado${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose não encontrado${NC}"
fi
echo ""

# 6. Testar Webhook com POST
echo -e "${BLUE}[6]${NC} Testando Webhook com POST..."
TEST_RESPONSE=$(curl -s -X POST https://webhook.onsmart.ai/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP_CODE:%{http_code}" 2>/dev/null || echo "ERROR")

if echo "$TEST_RESPONSE" | grep -q "HTTP_CODE:200\|HTTP_CODE:404"; then
    HTTP_CODE=$(echo "$TEST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Webhook respondeu com HTTP 200!${NC}"
        ((SUCCESS++))
    else
        echo -e "${YELLOW}⚠️  Webhook respondeu com HTTP $HTTP_CODE${NC}"
        echo "   (Túnel funciona, mas backend precisa processar)"
    fi
else
    echo -e "${RED}❌ Erro ao testar webhook${NC}"
    ((FAIL++))
fi
echo ""

# Resumo Final
echo "============================================"
echo "  RESUMO"
echo "============================================"
echo ""
echo -e "✅ Testes bem-sucedidos: ${GREEN}$SUCCESS${NC}"
echo -e "❌ Testes com falha: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 TUDO ESTÁ FUNCIONANDO PERFEITAMENTE!${NC}"
    echo ""
    echo "Seu sistema está pronto para receber webhooks do WhatsApp!"
elif [ $SUCCESS -gt 2 ]; then
    echo -e "${YELLOW}⚠️  Sistema parcialmente funcional${NC}"
    echo ""
    echo "O túnel está funcionando, mas alguns serviços precisam ser iniciados."
else
    echo -e "${RED}❌ Sistema não está funcionando corretamente${NC}"
    echo ""
    echo "Verifique os erros acima e corrija os problemas."
fi

echo ""
echo "============================================"
echo ""
