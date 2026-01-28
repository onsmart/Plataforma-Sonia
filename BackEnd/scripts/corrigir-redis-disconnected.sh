#!/bin/bash

# ============================================
# Script para Corrigir Erro "Redis Disconnected"
# Baseado em: https://github.com/EvolutionAPI/evolution-api/issues/1289
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

# 1. Parar containers
echo -e "${BLUE}[1]${NC} Parando containers..."
docker-compose down 2>/dev/null || true
echo ""

# 2. Verificar se Redis está rodando
echo -e "${BLUE}[2]${NC} Verificando Redis..."
if docker ps -a --filter "name=evolution-redis" --format "{{.Names}}" | grep -q "evolution-redis"; then
    echo -e "${YELLOW}⚠️  Container Redis encontrado${NC}"
    echo "Removendo container antigo..."
    docker rm -f evolution-redis 2>/dev/null || true
fi

# 3. Limpar volume do Redis (opcional, descomente se necessário)
# echo -e "${BLUE}[3]${NC} Limpando volume do Redis..."
# docker volume rm evolution_redis_data 2>/dev/null || true

# 4. Verificar docker-compose.yml
echo -e "${BLUE}[3]${NC} Verificando configuração do docker-compose.yml..."
if grep -q "REDIS_CONNECTION_TIMEOUT" docker-compose.yml; then
    echo -e "${GREEN}✅ Configurações de Redis já estão atualizadas${NC}"
else
    echo -e "${YELLOW}⚠️  docker-compose.yml precisa ser atualizado${NC}"
    echo "Execute o deploy para atualizar o arquivo"
fi
echo ""

# 5. Subir containers
echo -e "${BLUE}[4]${NC} Subindo containers..."
docker-compose up -d
echo ""

# 6. Aguardar Redis estar pronto
echo -e "${BLUE}[5]${NC} Aguardando Redis estar pronto..."
for i in {1..30}; do
    if docker exec evolution-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis está respondendo!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 7. Verificar conexão do Redis
echo -e "${BLUE}[6]${NC} Verificando conexão do Redis..."
if docker exec evolution-redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis está funcionando corretamente${NC}"
else
    echo -e "${RED}❌ Redis não está respondendo${NC}"
    exit 1
fi
echo ""

# 8. Verificar logs do Evolution API
echo -e "${BLUE}[7]${NC} Verificando logs do Evolution API..."
echo "Aguardando 10 segundos para Evolution API inicializar..."
sleep 10

echo ""
echo "Últimas 20 linhas dos logs:"
docker-compose logs evolution-api --tail=20 | grep -i redis || echo "Nenhum log de Redis encontrado"
echo ""

# 9. Testar conexão do Evolution API com Redis
echo -e "${BLUE}[8]${NC} Testando conexão Evolution API -> Redis..."
if docker exec evolution-api wget -q -O- http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evolution API está respondendo${NC}"
else
    echo -e "${YELLOW}⚠️  Evolution API ainda está inicializando${NC}"
fi
echo ""

# 10. Verificar se há erros de Redis nos logs
echo -e "${BLUE}[9]${NC} Verificando erros de Redis nos logs..."
REDIS_ERRORS=$(docker-compose logs evolution-api 2>&1 | grep -i "redis.*disconnect\|redis.*error\|redis.*fail" | tail -5)

if [ -z "$REDIS_ERRORS" ]; then
    echo -e "${GREEN}✅ Nenhum erro de Redis encontrado nos logs recentes${NC}"
else
    echo -e "${YELLOW}⚠️  Erros encontrados:${NC}"
    echo "$REDIS_ERRORS"
    echo ""
    echo "Se os erros persistirem, tente:"
    echo "  1. docker-compose restart evolution-api"
    echo "  2. Verifique se Redis está acessível: docker exec evolution-redis redis-cli ping"
    echo "  3. Verifique a rede: docker network inspect evolution-network"
fi
echo ""

# 11. Status final
echo "============================================"
echo "  STATUS DOS CONTAINERS"
echo "============================================"
docker-compose ps
echo ""

echo "============================================"
echo "  VERIFICAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "Próximos passos:"
echo "  1. Monitore os logs: docker-compose logs evolution-api -f"
echo "  2. Se ainda houver erros, reinicie: docker-compose restart evolution-api"
echo "  3. Verifique a conectividade: docker exec evolution-api ping -c 2 redis"
echo ""
