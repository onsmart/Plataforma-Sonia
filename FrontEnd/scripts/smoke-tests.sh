#!/bin/bash

# ============================================
# SMOKE TESTS - Testes Básicos do Frontend
# ============================================
# Este script verifica se o frontend está funcionando corretamente

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SUCCESS=0
FAIL=0

echo ""
echo "============================================"
echo "  SMOKE TESTS - FRONTEND"
echo "============================================"
echo ""

# ============================================
# TESTE 1: Verificar se o código compila
# ============================================
echo -e "${BLUE}[1]${NC} Verificando compilação (Vite Build)..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend compila com sucesso${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}❌ Erro ao compilar frontend${NC}"
    npm run build
    ((FAIL++))
fi
echo ""

# ============================================
# TESTE 2: Verificar estrutura de arquivos
# ============================================
echo -e "${BLUE}[2]${NC} Verificando estrutura de arquivos..."
CRITICAL_FILES=(
    "src/main.tsx"
    "src/App.tsx"
    "src/pages/Insights.tsx"
    "src/pages/Cockpit.tsx"
    "src/pages/AgentsHub.tsx"
    "src/services/api.ts"
    "vite.config.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✅${NC} $file existe"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} $file NÃO existe"
        ((FAIL++))
    fi
done
echo ""

# ============================================
# TESTE 3: Verificar dependências instaladas
# ============================================
echo -e "${BLUE}[3]${NC} Verificando dependências críticas..."
if [ -d "node_modules" ]; then
    CRITICAL_DEPS=(
        "react"
        "react-dom"
        "vite"
        "@supabase/supabase-js"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            echo -e "  ${GREEN}✅${NC} $dep instalado"
            ((SUCCESS++))
        else
            echo -e "  ${RED}❌${NC} $dep NÃO instalado"
            ((FAIL++))
        fi
    done
else
    echo -e "${RED}❌ node_modules não existe. Execute: npm install${NC}"
    ((FAIL++))
fi
echo ""

# ============================================
# TESTE 4: Verificar build gerado
# ============================================
echo -e "${BLUE}[4]${NC} Verificando build gerado..."
if [ -d "build" ]; then
    if [ -f "build/index.html" ]; then
        echo -e "  ${GREEN}✅${NC} build/index.html existe"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} build/index.html NÃO existe"
        ((FAIL++))
    fi
    
    if [ -d "build/assets" ]; then
        echo -e "  ${GREEN}✅${NC} build/assets existe"
        ((SUCCESS++))
    else
        echo -e "  ${YELLOW}⚠️${NC} build/assets não existe (pode ser esperado)"
    fi
else
    echo -e "${RED}❌ Diretório build não existe${NC}"
    ((FAIL++))
fi
echo ""

# ============================================
# TESTE 5: Verificar componentes críticos
# ============================================
echo -e "${BLUE}[5]${NC} Verificando componentes críticos..."
CRITICAL_COMPONENTS=(
    "src/components/ui"
    "src/pages"
    "src/services"
    "src/contexts"
)

for component in "${CRITICAL_COMPONENTS[@]}"; do
    if [ -d "$component" ]; then
        echo -e "  ${GREEN}✅${NC} $component existe"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} $component NÃO existe"
        ((FAIL++))
    fi
done
echo ""

# ============================================
# RESUMO
# ============================================
echo "============================================"
echo "  RESUMO"
echo "============================================"
echo -e "${GREEN}✅ Sucessos: $SUCCESS${NC}"
if [ $FAIL -gt 0 ]; then
    echo -e "${RED}❌ Falhas: $FAIL${NC}"
    echo ""
    echo -e "${RED}❌ SMOKE TESTS FALHARAM${NC}"
    exit 1
else
    echo -e "${GREEN}✅ SMOKE TESTS PASSARAM${NC}"
    exit 0
fi
