#!/bin/bash

# ============================================
# Script para Corrigir Configuração do Túnel para Webhook
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
echo "  CORRIGIR TÚNEL PARA WEBHOOK"
echo "============================================"
echo ""

TUNNEL_ID="d3641f5e-5053-4a57-ba7e-bc3833b55f00"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

# Verificar configuração atual
echo -e "${BLUE}[1]${NC} Verificando configuração atual..."
if [ -f "$CONFIG_FILE" ]; then
    echo "Configuração atual:"
    cat "$CONFIG_FILE"
    echo ""
    
    # Verificar se webhook.onsmart.ai está configurado
    if grep -q "webhook.onsmart.ai" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ webhook.onsmart.ai já está na configuração${NC}"
        
        # Verificar se aponta para porta 3333
        if grep -A 1 "webhook.onsmart.ai" "$CONFIG_FILE" | grep -q "localhost:3333"; then
            echo -e "${GREEN}✅ Já está apontando para localhost:3333${NC}"
        else
            echo -e "${YELLOW}⚠️  Não está apontando para localhost:3333${NC}"
            NEED_UPDATE=true
        fi
    else
        echo -e "${RED}❌ webhook.onsmart.ai não está na configuração${NC}"
        NEED_UPDATE=true
    fi
else
    echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
    NEED_UPDATE=true
fi

echo ""

# Atualizar se necessário
if [ "$NEED_UPDATE" = true ]; then
    echo -e "${BLUE}[2]${NC} Atualizando configuração..."
    
    # Fazer backup
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Criar nova configuração
    cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: api.onsmart.ai
    service: http://localhost:80
  - hostname: evolution.onsmart.ai
    service: http://localhost:8081
  - hostname: webhook.onsmart.ai
    service: http://localhost:3333
  - service: http_status:404
EOF
    
    echo -e "${GREEN}✅ Configuração atualizada!${NC}"
    echo ""
    echo "Nova configuração:"
    cat "$CONFIG_FILE"
    echo ""
    
    # Reiniciar serviço
    echo -e "${BLUE}[3]${NC} Reiniciando serviço cloudflared..."
    sudo systemctl restart cloudflared
    sleep 5
    
    # Verificar status
    if systemctl is-active --quiet cloudflared; then
        echo -e "${GREEN}✅ Serviço reiniciado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao reiniciar serviço${NC}"
        echo "Verifique os logs: sudo journalctl -u cloudflared -n 20"
    fi
else
    echo -e "${GREEN}✅ Configuração já está correta!${NC}"
    echo ""
    echo "Se ainda está dando 404, verifique:"
    echo "  1. Backend está rodando? (npm run dev)"
    echo "  2. Backend está na porta 3333?"
    echo "  3. Rota /whatsapp/webhook existe?"
fi

echo ""
echo "============================================"
echo "  VERIFICAÇÃO ADICIONAL"
echo "============================================"
echo ""

# Verificar se backend está rodando
echo -e "${BLUE}[4]${NC} Verificando backend..."
if curl -f -s http://localhost:3333/agents > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend está respondendo em localhost:3333${NC}"
else
    echo -e "${RED}❌ Backend NÃO está respondendo em localhost:3333${NC}"
    echo "   Execute: cd ~/plataform-backend/BackEnd && npm run dev"
fi

echo ""

# Testar webhook local
echo -e "${BLUE}[5]${NC} Testando webhook local..."
LOCAL_TEST=$(curl -s -X POST http://localhost:3333/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "ERROR")

HTTP_CODE=$(echo "$LOCAL_TEST" | grep "HTTP_CODE" | cut -d: -f2 || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Webhook local funciona!${NC}"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ Webhook local retorna 404${NC}"
    echo "   Verifique se a rota /whatsapp/webhook existe no código"
else
    echo -e "${YELLOW}⚠️  Webhook local retornou HTTP $HTTP_CODE${NC}"
fi

echo ""
echo "============================================"
echo "  PRÓXIMOS PASSOS"
echo "============================================"
echo ""
echo "1. Aguarde alguns segundos após reiniciar o túnel"
echo "2. Teste novamente:"
echo "   curl -X POST https://webhook.onsmart.ai/whatsapp/webhook \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"test\": true}'"
echo ""
echo "3. Verifique os logs do backend quando fizer o teste"
echo ""
