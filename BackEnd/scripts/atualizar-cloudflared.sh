#!/bin/bash

# ============================================
# Script para Atualizar Cloudflared
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  ATUALIZAR CLOUDFLARED"
echo "============================================"
echo ""

# Verificar versão atual
CURRENT_VERSION=$(cloudflared --version 2>/dev/null | head -1 || echo "não encontrado")
echo -e "${YELLOW}Versão atual:${NC} $CURRENT_VERSION"
echo ""

# Parar serviço
echo "Parando serviço cloudflared..."
sudo systemctl stop cloudflared

# Baixar versão mais recente
echo "Baixando versão mais recente..."
cd /tmp
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared-latest

# Instalar
echo "Instalando..."
sudo mv cloudflared-latest /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Verificar nova versão
NEW_VERSION=$(cloudflared --version 2>/dev/null | head -1)
echo -e "${GREEN}Nova versão:${NC} $NEW_VERSION"
echo ""

# Reiniciar serviço
echo "Reiniciando serviço..."
sudo systemctl start cloudflared
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
echo "  ATUALIZAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
