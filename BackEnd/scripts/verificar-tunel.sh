#!/bin/bash

# ============================================
# Script para Verificar Status do Cloudflare Tunnel
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  VERIFICAR CLOUDFLARE TUNNEL"
echo "============================================"
echo ""

# 1. Verificar se o serviço está rodando
echo -e "${BLUE}[1]${NC} Verificando serviço systemd..."
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Serviço cloudflared está ATIVO${NC}"
    systemctl status cloudflared --no-pager -l | head -10
else
    echo -e "${RED}❌ Serviço cloudflared está INATIVO${NC}"
    echo ""
    echo "Para iniciar:"
    echo "  sudo systemctl start cloudflared"
    echo "  sudo systemctl enable cloudflared"
fi

echo ""

# 2. Verificar logs recentes
echo -e "${BLUE}[2]${NC} Logs recentes do túnel:"
echo ""
sudo journalctl -u cloudflared -n 20 --no-pager | tail -10

echo ""
echo ""

# 3. Verificar processo
echo -e "${BLUE}[3]${NC} Verificando processo cloudflared:"
if pgrep -x cloudflared > /dev/null; then
    echo -e "${GREEN}✅ Processo cloudflared está rodando${NC}"
    ps aux | grep cloudflared | grep -v grep
else
    echo -e "${RED}❌ Processo cloudflared não está rodando${NC}"
fi

echo ""
echo ""

# 4. Verificar configuração
echo -e "${BLUE}[4]${NC} Verificando configuração:"
if [ -f ~/.cloudflared/config.yml ]; then
    echo -e "${GREEN}✅ Arquivo de configuração encontrado${NC}"
    echo ""
    echo "Configuração:"
    cat ~/.cloudflared/config.yml
else
    echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
    echo "  Esperado em: ~/.cloudflared/config.yml"
fi

echo ""
echo ""

# 5. Testar URL do túnel (se configurada)
echo -e "${BLUE}[5]${NC} Testando URL do túnel:"
if [ -f ~/.cloudflared/config.yml ]; then
    # Extrair domínio da configuração
    DOMAIN=$(grep -A 1 "hostname:" ~/.cloudflared/config.yml | grep -v "hostname:" | head -1 | sed 's/.*hostname: //' | tr -d ' ')
    
    if [ -n "$DOMAIN" ]; then
        WEBHOOK_URL="https://$DOMAIN/whatsapp/webhook"
        echo "Testando: $WEBHOOK_URL"
        echo ""
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL" || echo "000")
        
        if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ Túnel está respondendo (HTTP $HTTP_CODE)${NC}"
            echo "  URL: $WEBHOOK_URL"
        elif [ "$HTTP_CODE" = "000" ]; then
            echo -e "${RED}❌ Túnel não está respondendo${NC}"
            echo "  Verifique se o túnel está rodando e se o domínio está configurado corretamente"
        else
            echo -e "${YELLOW}⚠️  Túnel respondeu com código HTTP $HTTP_CODE${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Domínio não encontrado na configuração${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Não é possível testar URL sem configuração${NC}"
fi

echo ""
echo ""

# 6. Verificar se backend está rodando
echo -e "${BLUE}[6]${NC} Verificando se backend está acessível localmente:"
if curl -f http://localhost:3333/agents &> /dev/null; then
    echo -e "${GREEN}✅ Backend está respondendo em http://localhost:3333${NC}"
else
    echo -e "${RED}❌ Backend não está respondendo em http://localhost:3333${NC}"
    echo "  Verifique se o backend está rodando:"
    echo "    npm run dev"
    echo "    ou"
    echo "    npm start"
fi

echo ""
echo "============================================"
echo "  VERIFICAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
