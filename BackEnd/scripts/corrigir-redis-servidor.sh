#!/bin/bash

# ============================================
# Script para Corrigir Erro "Redis Disconnected"
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
echo "  CORRIGIR ERRO 'REDIS DISCONNECTED'"
echo "============================================"
echo ""

# Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml não encontrado${NC}"
    echo "   Execute este script na pasta onde está o docker-compose.yml"
    echo "   Exemplo: cd ~/plataform-backend"
    exit 1
fi

# Fazer backup
cp docker-compose.yml docker-compose.yml.bak
echo -e "${GREEN}✅ Backup criado: docker-compose.yml.bak${NC}"
echo ""

# Verificar se já tem as configurações
if grep -q "REDIS_CONNECTION_TIMEOUT" docker-compose.yml; then
    echo -e "${GREEN}✅ Configurações de Redis já estão presentes${NC}"
    echo ""
    read -p "Deseja reiniciar os containers mesmo assim? (s/N): " REINICIAR
    if [ "$REINICIAR" != "s" ] && [ "$REINICIAR" != "S" ]; then
        echo "Cancelado."
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  Adicionando configurações de Redis...${NC}"
    
    # Adicionar configurações após CACHE_REDIS_SAVE_INSTANCES
    sed -i '/CACHE_REDIS_SAVE_INSTANCES: "false"/a\      # Configurações para evitar "redis disconnected" (issue #1289)\n      REDIS_CONNECTION_TIMEOUT: "10000"\n      REDIS_RETRY_STRATEGY: "exponential"\n      REDIS_MAX_RETRIES: "10"' docker-compose.yml
    
    # Adicionar start_period no serviço redis (se não existir)
    if ! grep -q "start_period" docker-compose.yml; then
        sed -i '/container_name: evolution-redis/a\    start_period: 10s' docker-compose.yml
    fi
    
    echo -e "${GREEN}✅ Configurações de Redis adicionadas${NC}"
    echo ""
fi

# Reiniciar containers
echo -e "${BLUE}[2]${NC} Reiniciando containers..."
docker-compose down
docker-compose up -d

echo ""
echo -e "${BLUE}[3]${NC} Aguardando Redis estar pronto..."
for i in {1..30}; do
    if docker exec evolution-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis está respondendo!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# Aguardar Evolution API inicializar
echo -e "${BLUE}[4]${NC} Aguardando Evolution API inicializar..."
sleep 10

# Verificar logs
echo -e "${BLUE}[5]${NC} Verificando logs do Evolution API..."
echo "Últimas 10 linhas dos logs:"
docker-compose logs evolution-api --tail=10 | grep -i redis || echo "Nenhum log de Redis encontrado"
echo ""

echo "============================================"
echo "  CORREÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "Para verificar se está funcionando:"
echo "  docker-compose logs -f evolution-api"
echo ""
