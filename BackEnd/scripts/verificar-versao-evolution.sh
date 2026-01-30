#!/bin/bash

# Script para verificar a versão exata do Evolution API em execução

EVOLUTION_API_URL="${EVOLUTION_API_URL:-http://192.168.15.31:8081}"
API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"

echo "🔍 Verificando versão do Evolution API..."
echo ""

# Método 1: Verificar via Docker (se estiver rodando em Docker)
if command -v docker &> /dev/null; then
    echo "📦 Versão da imagem Docker:"
    docker images | grep evolution-api || echo "  Container não encontrado"
    echo ""
    
    echo "🐳 Containers em execução:"
    docker ps | grep evolution-api || echo "  Nenhum container Evolution API rodando"
    echo ""
fi

# Método 2: Verificar via API (endpoint de health/version se disponível)
echo "🌐 Verificando via API..."
HEALTH_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL" \
  -H "apikey: $API_KEY" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ API está respondendo"
    echo "📄 Resposta:"
    echo "$HEALTH_RESPONSE" | head -20
    echo ""
else
    echo "❌ API não está respondendo em $EVOLUTION_API_URL"
    echo ""
fi

# Método 3: Verificar logs do container (se disponível)
if command -v docker &> /dev/null; then
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep -i evolution | head -1)
    if [ ! -z "$CONTAINER_NAME" ]; then
        echo "📋 Últimas linhas dos logs (pode conter versão):"
        docker logs "$CONTAINER_NAME" 2>&1 | grep -i "version\|v[0-9]\|evolution" | tail -5 || echo "  Nenhuma informação de versão encontrada nos logs"
        echo ""
    fi
fi

echo "💡 Para ver a versão exata, você pode:"
echo "   1. Verificar o package.json dentro do container:"
echo "      docker exec evolution-api cat /evolution/package.json | grep version"
echo ""
echo "   2. Verificar os logs de inicialização:"
echo "      docker logs evolution-api | grep -i version"
echo ""
echo "   3. Acessar a interface web:"
echo "      $EVOLUTION_API_URL/manager"
