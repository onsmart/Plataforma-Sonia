#!/bin/bash

# ============================================
# Script para Corrigir Webhook no Servidor
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
echo "  CORRIGIR WEBHOOK NO SERVIDOR"
echo "============================================"
echo ""

# Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml não encontrado${NC}"
    echo "   Execute este script na pasta onde está o docker-compose.yml"
    echo "   Exemplo: cd ~/plataform-backend"
    exit 1
fi

echo -e "${BLUE}[1]${NC} Verificando configuração atual do webhook..."
CURRENT_WEBHOOK=$(grep "WEBHOOK_GLOBAL_URL" docker-compose.yml | head -1)
echo "   Atual: $CURRENT_WEBHOOK"
echo ""

# Verificar se já está correto
if echo "$CURRENT_WEBHOOK" | grep -q "webhook.onsmart.ai"; then
    echo -e "${GREEN}✅ Webhook já está configurado corretamente${NC}"
    echo ""
    read -p "Deseja reiniciar o Evolution API mesmo assim? (s/N): " REINICIAR
    if [ "$REINICIAR" != "s" ] && [ "$REINICIAR" != "S" ]; then
        echo "Cancelado."
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  Webhook não está configurado corretamente${NC}"
    echo -e "${BLUE}Corrigindo...${NC}"
    
    # Fazer backup
    cp docker-compose.yml docker-compose.yml.bak
    echo -e "${GREEN}✅ Backup criado: docker-compose.yml.bak${NC}"
    
    # Corrigir webhook
    sed -i 's|WEBHOOK_GLOBAL_URL:.*|WEBHOOK_GLOBAL_URL: https://webhook.onsmart.ai/whatsapp/webhook|' docker-compose.yml
    
    echo -e "${GREEN}✅ Webhook corrigido no docker-compose.yml${NC}"
    echo ""
fi

# Verificar configurações de Redis
echo -e "${BLUE}[1.5]${NC} Verificando configurações de Redis..."
if ! grep -q "REDIS_CONNECTION_TIMEOUT" docker-compose.yml; then
    echo -e "${YELLOW}⚠️  Configurações de Redis não encontradas, adicionando...${NC}"
    
    # Adicionar configurações de Redis após CACHE_REDIS_SAVE_INSTANCES
    sed -i '/CACHE_REDIS_SAVE_INSTANCES: "false"/a\      # Configurações para evitar "redis disconnected" (issue #1289)\n      REDIS_CONNECTION_TIMEOUT: "10000"\n      REDIS_RETRY_STRATEGY: "exponential"\n      REDIS_MAX_RETRIES: "10"' docker-compose.yml
    
    # Adicionar start_period no serviço redis
    if ! grep -q "start_period" docker-compose.yml; then
        sed -i '/container_name: evolution-redis/a\    start_period: 10s' docker-compose.yml
    fi
    
    echo -e "${GREEN}✅ Configurações de Redis adicionadas${NC}"
else
    echo -e "${GREEN}✅ Configurações de Redis já estão presentes${NC}"
fi
echo ""

# Verificar se Evolution API está rodando
echo -e "${BLUE}[2]${NC} Verificando Evolution API..."
if docker-compose ps evolution-api | grep -q "Up"; then
    echo -e "${GREEN}✅ Evolution API está rodando${NC}"
    echo ""
    echo -e "${BLUE}[3]${NC} Reiniciando Evolution API..."
    docker-compose restart evolution-api
    echo -e "${GREEN}✅ Evolution API reiniciado${NC}"
else
    echo -e "${YELLOW}⚠️  Evolution API não está rodando${NC}"
    echo -e "${BLUE}Iniciando Evolution API...${NC}"
    docker-compose up -d evolution-api
    echo -e "${GREEN}✅ Evolution API iniciado${NC}"
fi

echo ""
echo "============================================"
echo "  CORREÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "Webhook configurado: https://webhook.onsmart.ai/whatsapp/webhook"
echo ""
echo "Para verificar se está funcionando:"
echo "  1. Envie uma mensagem no WhatsApp"
echo "  2. Verifique os logs: docker-compose logs -f evolution-api"
echo "  3. Verifique os logs do backend: cd ~/plataform-backend/BackEnd && npm run dev"
echo ""
