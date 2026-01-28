#!/bin/bash

# ============================================
# Script para Verificar DNS do Túnel
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
echo "  VERIFICAR DNS DO TÚNEL"
echo "============================================"
echo ""

# 1. Verificar configuração do túnel
echo -e "${BLUE}[1]${NC} Verificando configuração do túnel..."
if [ -f ~/.cloudflared/config.yml ]; then
    echo -e "${GREEN}✅ Arquivo de configuração encontrado${NC}"
    echo ""
    cat ~/.cloudflared/config.yml
    echo ""
    
    # Extrair domínio
    DOMAIN=$(grep -A 1 "hostname:" ~/.cloudflared/config.yml | grep -v "hostname:" | head -1 | sed 's/.*hostname: //' | tr -d ' ')
    TUNNEL_ID=$(grep "tunnel:" ~/.cloudflared/config.yml | head -1 | sed 's/.*tunnel: //' | tr -d ' ')
    
    if [ -n "$DOMAIN" ]; then
        echo -e "${BLUE}Domínio configurado:${NC} $DOMAIN"
        echo -e "${BLUE}Tunnel ID:${NC} $TUNNEL_ID"
        echo ""
        
        # 2. Verificar DNS
        echo -e "${BLUE}[2]${NC} Verificando DNS..."
        DNS_RECORD=$(dig +short $DOMAIN CNAME)
        
        if [ -n "$DNS_RECORD" ]; then
            echo -e "${GREEN}✅ Registro DNS encontrado:${NC}"
            echo "  $DOMAIN -> $DNS_RECORD"
            
            # Verificar se aponta para o túnel correto
            if echo "$DNS_RECORD" | grep -q "$TUNNEL_ID"; then
                echo -e "${GREEN}✅ DNS aponta para o túnel correto${NC}"
            else
                echo -e "${YELLOW}⚠️  DNS pode não estar apontando para o túnel correto${NC}"
            fi
        else
            echo -e "${RED}❌ Registro DNS não encontrado${NC}"
            echo ""
            echo "O DNS precisa ser configurado no Cloudflare:"
            echo "  Tipo: CNAME"
            echo "  Nome: webhook (ou o subdomínio que você configurou)"
            echo "  Conteúdo: $TUNNEL_ID.cfargotunnel.com"
        fi
    else
        echo -e "${YELLOW}⚠️  Domínio não encontrado na configuração${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
fi

echo ""
echo ""

# 3. Listar túneis
echo -e "${BLUE}[3]${NC} Listando túneis configurados..."
cloudflared tunnel list 2>/dev/null || echo "Erro ao listar túneis"

echo ""
echo ""

# 4. Verificar rotas DNS
echo -e "${BLUE}[4]${NC} Verificando rotas DNS configuradas..."
cloudflared tunnel route dns list 2>/dev/null || echo "Erro ao listar rotas DNS"

echo ""
echo "============================================"
echo "  VERIFICAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
