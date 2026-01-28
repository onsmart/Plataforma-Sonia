#!/bin/bash

# ============================================
# Script para Limpar e Subir Containers Docker
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
echo "  LIMPAR E SUBIR CONTAINERS DOCKER"
echo "============================================"
echo ""

# 1. Parar e remover containers antigos
echo -e "${BLUE}[1]${NC} Parando containers existentes..."
docker-compose down 2>/dev/null || true

# 2. Remover containers órfãos
echo -e "${BLUE}[2]${NC} Removendo containers órfãos..."
docker rm -f evolution-redis evolution-postgres evolution-api 2>/dev/null || true

# 3. Verificar se ainda existem
echo -e "${BLUE}[3]${NC} Verificando containers restantes..."
EXISTING=$(docker ps -a --filter "name=evolution" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
    echo -e "${YELLOW}⚠️  Containers encontrados:${NC}"
    echo "$EXISTING"
    echo ""
    echo "Removendo..."
    echo "$EXISTING" | xargs -r docker rm -f
else
    echo -e "${GREEN}✅ Nenhum container antigo encontrado${NC}"
fi

echo ""

# 4. Subir containers
echo -e "${BLUE}[4]${NC} Subindo containers..."
docker-compose up -d

# 5. Aguardar inicialização
echo ""
echo -e "${BLUE}[5]${NC} Aguardando containers iniciarem..."
sleep 10

# 6. Verificar status
echo ""
echo -e "${BLUE}[6]${NC} Verificando status dos containers..."
docker-compose ps

echo ""
echo "============================================"
echo "  CONCLUÍDO"
echo "============================================"
echo ""

# Verificar se estão rodando
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)

if [ "$RUNNING" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    echo -e "${GREEN}✅ Todos os containers estão rodando!${NC}"
else
    echo -e "${YELLOW}⚠️  Alguns containers podem não estar rodando${NC}"
    echo "Verifique os logs:"
    echo "  docker-compose logs"
fi

echo ""
