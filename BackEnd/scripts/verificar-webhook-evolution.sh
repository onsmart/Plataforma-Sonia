#!/bin/bash

# ============================================
# Script para Verificar e Configurar Webhook na Evolution API
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
echo "  VERIFICAR WEBHOOK NA EVOLUTION API"
echo "============================================"
echo ""

EVOLUTION_API_URL="http://localhost:8081"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==}"
WEBHOOK_URL="https://webhook.onsmart.ai/whatsapp/webhook"

echo -e "${BLUE}Evolution API:${NC} $EVOLUTION_API_URL"
echo -e "${BLUE}Webhook URL:${NC} $WEBHOOK_URL"
echo ""

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
    echo -e "${GREEN}✅ Instâncias encontradas:${NC}"
    echo "$INSTANCES_RESPONSE" | grep -o '"instanceName":"[^"]*"' | cut -d'"' -f4
    echo ""
    
    # Extrair nomes das instâncias
    INSTANCE_NAMES=$(echo "$INSTANCES_RESPONSE" | grep -o '"instanceName":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$INSTANCE_NAMES" ]; then
        echo -e "${YELLOW}⚠️  Nenhuma instância encontrada${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Erro ao listar instâncias${NC}"
    echo "Resposta: $INSTANCES_RESPONSE"
    exit 1
fi

# 3. Verificar webhook de cada instância
echo -e "${BLUE}[3]${NC} Verificando webhook de cada instância..."
echo ""

for INSTANCE in $INSTANCE_NAMES; do
    echo -e "${BLUE}Instância:${NC} $INSTANCE"
    
    # Buscar webhook configurado
    WEBHOOK_INFO=$(curl -s -X GET "$EVOLUTION_API_URL/webhook/find/$INSTANCE" \
      -H "apikey: $EVOLUTION_API_KEY" 2>&1)
    
    if echo "$WEBHOOK_INFO" | grep -q "url"; then
        CONFIGURED_URL=$(echo "$WEBHOOK_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1)
        echo -e "  ${GREEN}✅ Webhook configurado:${NC} $CONFIGURED_URL"
        
        if [ "$CONFIGURED_URL" = "$WEBHOOK_URL" ]; then
            echo -e "  ${GREEN}✅ URL está correta!${NC}"
        else
            echo -e "  ${YELLOW}⚠️  URL diferente da esperada${NC}"
            echo -e "  ${BLUE}Configurando webhook correto...${NC}"
            
            # Configurar webhook
            CONFIG_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/webhook/set/$INSTANCE" \
              -H "apikey: $EVOLUTION_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{
                \"url\": \"$WEBHOOK_URL\",
                \"webhook_by_events\": true,
                \"webhook_base64\": false,
                \"events\": [\"MESSAGES_UPSERT\"]
              }" 2>&1)
            
            if echo "$CONFIG_RESPONSE" | grep -q "success\|200"; then
                echo -e "  ${GREEN}✅ Webhook configurado com sucesso!${NC}"
            else
                echo -e "  ${RED}❌ Erro ao configurar:${NC}"
                echo "$CONFIG_RESPONSE" | head -5
            fi
        fi
    else
        echo -e "  ${RED}❌ Webhook NÃO está configurado${NC}"
        echo -e "  ${BLUE}Configurando webhook...${NC}"
        
        # Configurar webhook
        CONFIG_RESPONSE=$(curl -s -X POST "$EVOLUTION_API_URL/webhook/set/$INSTANCE" \
          -H "apikey: $EVOLUTION_API_KEY" \
          -H "Content-Type: application/json" \
          -d "{
            \"url\": \"$WEBHOOK_URL\",
            \"webhook_by_events\": true,
            \"webhook_base64\": false,
            \"events\": [\"MESSAGES_UPSERT\"]
          }" 2>&1)
        
        if echo "$CONFIG_RESPONSE" | grep -q "success\|200"; then
            echo -e "  ${GREEN}✅ Webhook configurado com sucesso!${NC}"
        else
            echo -e "  ${RED}❌ Erro ao configurar:${NC}"
            echo "$CONFIG_RESPONSE" | head -5
        fi
    fi
    echo ""
done

# 4. Verificar webhook global no docker-compose
echo -e "${BLUE}[4]${NC} Verificando configuração global no docker-compose..."
if [ -f docker-compose.yml ]; then
    WEBHOOK_GLOBAL=$(grep "WEBHOOK_GLOBAL_URL" docker-compose.yml | head -1)
    if echo "$WEBHOOK_GLOBAL" | grep -q "webhook.onsmart.ai"; then
        echo -e "${GREEN}✅ Webhook global configurado no docker-compose.yml${NC}"
        echo "  $WEBHOOK_GLOBAL"
    else
        echo -e "${YELLOW}⚠️  Webhook global não está configurado corretamente${NC}"
        echo "  Atual: $WEBHOOK_GLOBAL"
        echo ""
        echo "  Para corrigir, edite docker-compose.yml e altere:"
        echo "    WEBHOOK_GLOBAL_URL=https://webhook.onsmart.ai/whatsapp/webhook"
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose.yml não encontrado${NC}"
fi

echo ""
echo "============================================"
echo "  VERIFICAÇÃO CONCLUÍDA"
echo "============================================"
echo ""
echo "Próximos passos:"
echo "  1. Reinicie o Evolution API se alterou o docker-compose.yml:"
echo "     docker-compose restart evolution-api"
echo ""
echo "  2. Envie uma mensagem no WhatsApp"
echo ""
echo "  3. Verifique os logs do backend:"
echo "     cd ~/plataform-backend/BackEnd"
echo "     npm run dev"
echo ""
