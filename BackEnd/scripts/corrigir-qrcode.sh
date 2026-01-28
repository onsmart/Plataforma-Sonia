#!/bin/bash

# ============================================
# Script para Corrigir Problema de QR Code
# Baseado em: https://github.com/EvolutionAPI/evolution-api/issues/2222
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
echo "  CORRIGIR PROBLEMA DE QR CODE"
echo "============================================"
echo ""

EVOLUTION_API_URL="http://localhost:8081"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"

# 1. Verificar se Evolution API está rodando
echo -e "${BLUE}[1]${NC} Verificando Evolution API..."
if curl -f -s "$EVOLUTION_API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evolution API está rodando${NC}"
else
    echo -e "${RED}❌ Evolution API não está respondendo${NC}"
    echo "   Verifique: docker-compose ps"
    exit 1
fi
echo ""

# 2. Listar instâncias
echo -e "${BLUE}[2]${NC} Listando instâncias..."
INSTANCES_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/fetchInstances" \
  -H "apikey: $EVOLUTION_API_KEY" 2>&1)

if echo "$INSTANCES_RESPONSE" | grep -q "instanceName"; then
    INSTANCE_NAMES=$(echo "$INSTANCES_RESPONSE" | grep -o '"instanceName":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$INSTANCE_NAMES" ]; then
        echo -e "${YELLOW}⚠️  Nenhuma instância encontrada${NC}"
        echo ""
        echo "Para criar uma nova instância, use o endpoint:"
        echo "  POST $EVOLUTION_API_URL/instance/create"
        exit 0
    fi
    
    echo -e "${GREEN}✅ Instâncias encontradas:${NC}"
    for INSTANCE in $INSTANCE_NAMES; do
        echo "  - $INSTANCE"
    done
else
    echo -e "${YELLOW}⚠️  Nenhuma instância encontrada ou erro na resposta${NC}"
    echo "Resposta: $INSTANCES_RESPONSE" | head -5
    exit 0
fi
echo ""

# 3. Para cada instância, verificar status e tentar obter QR Code
echo -e "${BLUE}[3]${NC} Verificando status e QR Code de cada instância..."
echo ""

for INSTANCE in $INSTANCE_NAMES; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Instância:${NC} $INSTANCE"
    echo ""
    
    # Verificar status da instância
    echo -e "${BLUE}[3.1]${NC} Verificando status..."
    STATUS_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE" \
      -H "apikey: $EVOLUTION_API_KEY" 2>&1)
    
    STATE=$(echo "$STATUS_RESPONSE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4 | head -1)
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)
    
    echo "  Estado: ${STATE:-'não encontrado'}"
    echo "  Status: ${STATUS:-'não encontrado'}"
    echo ""
    
    # Se estiver conectada, não precisa de QR Code
    if [ "$STATE" = "open" ] || [ "$STATE" = "connected" ] || [ "$STATUS" = "open" ] || [ "$STATUS" = "connected" ]; then
        echo -e "${GREEN}✅ Instância está conectada. QR Code não necessário.${NC}"
        echo ""
        continue
    fi
    
    # Tentar obter QR Code
    echo -e "${BLUE}[3.2]${NC} Tentando obter QR Code..."
    QRCODE_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/connect/$INSTANCE" \
      -H "apikey: $EVOLUTION_API_KEY" 2>&1)
    
    QRCODE=$(echo "$QRCODE_RESPONSE" | grep -o '"qrcode":"[^"]*"' | cut -d'"' -f4 | head -1)
    BASE64=$(echo "$QRCODE_RESPONSE" | grep -o '"base64":"[^"]*"' | cut -d'"' -f4 | head -1)
    
    if [ -n "$QRCODE" ] || [ -n "$BASE64" ]; then
        echo -e "${GREEN}✅ QR Code encontrado!${NC}"
        if [ -n "$BASE64" ]; then
            echo "  Base64: ${BASE64:0:50}..."
        fi
        if [ -n "$QRCODE" ]; then
            echo "  QRCode: ${QRCODE:0:50}..."
        fi
    else
        echo -e "${RED}❌ QR Code não encontrado na resposta${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Tentando soluções...${NC}"
        echo ""
        
        # Solução 1: Deletar e recriar instância
        echo -e "${BLUE}[3.3]${NC} Tentando deletar instância para recriar..."
        DELETE_RESPONSE=$(curl -s -X DELETE "$EVOLUTION_API_URL/instance/delete/$INSTANCE" \
          -H "apikey: $EVOLUTION_API_KEY" 2>&1)
        
        if echo "$DELETE_RESPONSE" | grep -q "success\|200\|deleted"; then
            echo -e "${GREEN}✅ Instância deletada com sucesso${NC}"
            echo ""
            echo -e "${BLUE}[3.4]${NC} Recriando instância..."
            sleep 2
            
            CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/instance/create" \
              -H "apikey: $EVOLUTION_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{\"instanceName\": \"$INSTANCE\", \"token\": \"\", \"qrcode\": true}" 2>&1)
            
            if echo "$CREATE_RESPONSE" | grep -q "qrcode\|base64"; then
                echo -e "${GREEN}✅ Instância recriada! QR Code deve estar disponível agora.${NC}"
            else
                echo -e "${YELLOW}⚠️  Instância recriada, mas QR Code não retornado imediatamente${NC}"
                echo "   Aguarde alguns segundos e tente novamente:"
                echo "   curl -X GET \"$EVOLUTION_API_URL/instance/connect/$INSTANCE\" -H \"apikey: $EVOLUTION_API_KEY\""
            fi
        else
            echo -e "${YELLOW}⚠️  Não foi possível deletar a instância${NC}"
            echo "   Resposta: $DELETE_RESPONSE" | head -3
            echo ""
            echo -e "${BLUE}[3.5]${NC} Tentando forçar reconexão..."
            RECONNECT_RESPONSE=$(curl -s -X GET "$EVOLUTION_API_URL/instance/restart/$INSTANCE" \
              -H "apikey: $EVOLUTION_API_KEY" 2>&1)
            
            if echo "$RECONNECT_RESPONSE" | grep -q "success\|200"; then
                echo -e "${GREEN}✅ Instância reiniciada${NC}"
                echo "   Aguarde 10 segundos e verifique o QR Code novamente"
            else
                echo -e "${RED}❌ Não foi possível reiniciar a instância${NC}"
            fi
        fi
    fi
    echo ""
done

# 4. Verificar logs do Evolution API
echo -e "${BLUE}[4]${NC} Verificando logs do Evolution API..."
echo "Últimas 20 linhas dos logs (procurando por erros ou loops):"
docker-compose logs evolution-api --tail=20 2>/dev/null | grep -i "error\|loop\|qrcode\|channel" || echo "Nenhum erro relevante encontrado"
echo ""

# 5. Verificar configuração do docker-compose.yml
echo -e "${BLUE}[5]${NC} Verificando configuração..."
if [ -f "docker-compose.yml" ]; then
    QRCODE_LIMIT=$(grep "QRCODE_LIMIT" docker-compose.yml | head -1)
    QRCODE_COLOR=$(grep "QRCODE_COLOR" docker-compose.yml | head -1)
    PHONE_VERSION=$(grep "CONFIG_SESSION_PHONE_VERSION" docker-compose.yml | head -1)
    
    echo "  QRCODE_LIMIT: ${QRCODE_LIMIT:-'não encontrado'}"
    echo "  QRCODE_COLOR: ${QRCODE_COLOR:-'não encontrado'}"
    echo "  PHONE_VERSION: ${PHONE_VERSION:-'não encontrado'}"
    echo ""
    
    if [ -z "$PHONE_VERSION" ]; then
        echo -e "${YELLOW}⚠️  CONFIG_SESSION_PHONE_VERSION não encontrado no docker-compose.yml${NC}"
        echo "   Isso pode causar problemas com o QR Code"
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose.yml não encontrado${NC}"
fi
echo ""

# 6. Recomendações
echo "============================================"
echo "  RECOMENDAÇÕES"
echo "============================================"
echo ""
echo "1. Se o QR Code ainda não aparecer, tente:"
echo "   - Deletar a instância completamente"
echo "   - Reiniciar o Evolution API: docker-compose restart evolution-api"
echo "   - Aguardar 30 segundos"
echo "   - Criar uma nova instância"
echo ""
echo "2. Verifique os logs em tempo real:"
echo "   docker-compose logs evolution-api -f"
echo ""
echo "3. Se houver loop nos logs (como no issue #2222):"
echo "   - Pare todos os containers: docker-compose down"
echo "   - Limpe volumes: docker volume rm evolution_instances evolution_store"
echo "   - Suba novamente: docker-compose up -d"
echo ""
echo "4. Atualize a versão do WhatsApp Web no docker-compose.yml:"
echo "   CONFIG_SESSION_PHONE_VERSION: 2.3000.1027934701"
echo "   (ou a versão mais recente do seu WhatsApp Web)"
echo ""
