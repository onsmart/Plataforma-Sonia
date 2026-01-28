#!/bin/bash

# ============================================
# Script para Corrigir Configuração do Túnel
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
echo "  CORRIGIR CONFIGURAÇÃO DO TÚNEL"
echo "============================================"
echo ""

TUNNEL_ID="d3641f5e-5053-4a57-ba7e-bc3833b55f00"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

# Fazer backup
echo "Fazendo backup da configuração atual..."
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Criar nova configuração
echo "Criando nova configuração..."
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

# Configurar DNS
echo "Configurando DNS para webhook.onsmart.ai..."
cloudflared tunnel route dns evolution-api-onsmart webhook.onsmart.ai

echo ""
echo -e "${GREEN}✅ DNS configurado!${NC}"
echo ""

# Reiniciar serviço
echo "Reiniciando serviço cloudflared..."
sudo systemctl restart cloudflared
sleep 3

# Verificar status
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Serviço reiniciado com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao reiniciar serviço${NC}"
    echo "Verifique os logs: sudo journalctl -u cloudflared -n 20"
fi

echo ""
echo "============================================"
echo "  CONFIGURAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "Aguarde alguns segundos e teste:"
echo "  curl https://webhook.onsmart.ai/whatsapp/webhook"
echo ""
