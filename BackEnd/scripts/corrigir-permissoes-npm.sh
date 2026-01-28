#!/bin/bash

# ============================================
# Script para Corrigir Permissões do npm/node_modules
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
echo "  CORRIGIR PERMISSÕES NPM"
echo "============================================"
echo ""

PROJECT_DIR="$(pwd)"

if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${RED}❌ package.json não encontrado${NC}"
    echo "Execute este script da pasta BackEnd/"
    exit 1
fi

echo -e "${BLUE}[1]${NC} Corrigindo permissões do node_modules..."
chmod -R 755 node_modules/.bin 2>/dev/null || true
chmod -R u+w node_modules 2>/dev/null || true
echo -e "${GREEN}✅ Permissões corrigidas${NC}"
echo ""

echo -e "${BLUE}[2]${NC} Verificando permissões do tsc..."
if [ -f "node_modules/.bin/tsc" ]; then
    chmod +x node_modules/.bin/tsc
    echo -e "${GREEN}✅ tsc tem permissão de execução${NC}"
else
    echo -e "${YELLOW}⚠️  tsc não encontrado, pode precisar reinstalar${NC}"
fi
echo ""

echo -e "${BLUE}[3]${NC} Testando tsc..."
if node_modules/.bin/tsc --version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ tsc está funcionando!${NC}"
    node_modules/.bin/tsc --version
else
    echo -e "${YELLOW}⚠️  tsc ainda não funciona, tentando reinstalar...${NC}"
    echo ""
    echo "Removendo node_modules e reinstalando..."
    rm -rf node_modules package-lock.json
    npm install
fi
echo ""

echo "============================================"
echo "  CONCLUÍDO"
echo "============================================"
echo ""
echo "Agora tente novamente:"
echo "  npm run build"
echo ""
