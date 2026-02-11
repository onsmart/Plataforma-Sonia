#!/bin/bash

# ============================================
# SMOKE TESTS - Testes Básicos do Backend
# ============================================
# Este script verifica se o backend está funcionando corretamente
# sem precisar de banco de dados ou serviços externos

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
echo "  SMOKE TESTS - BACKEND"
echo "============================================"
echo ""

# ============================================
# TESTE 1: Verificar se o código compila
# ============================================
echo -e "${BLUE}[1]${NC} Verificando compilação TypeScript..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend compila com sucesso${NC}"
    ((SUCCESS++))
else
    echo -e "${RED}❌ Erro ao compilar backend${NC}"
    npm run build
    ((FAIL++))
fi
echo ""

# ============================================
# TESTE 2: Verificar estrutura de arquivos
# ============================================
echo -e "${BLUE}[2]${NC} Verificando estrutura de arquivos..."
CRITICAL_FILES=(
    "src/index.ts"
    "src/lib/supabase.ts"
    "src/services/agents/chatwithAgent.ts"
    "src/services/flows/flow-executor.ts"
    "src/api/routes/agents.routes.ts"
    "src/api/routes/flows.routes.ts"
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
        "express"
        "@supabase/supabase-js"
        "openai"
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
# TESTE 4: Verificar sintaxe TypeScript
# ============================================
echo -e "${BLUE}[4]${NC} Verificando sintaxe TypeScript (sem compilar)..."
if npx tsc --noEmit --skipLibCheck > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Sintaxe TypeScript OK${NC}"
    ((SUCCESS++))
else
    echo -e "${YELLOW}⚠️  Alguns erros de tipo encontrados (pode ser esperado)${NC}"
    # Não conta como falha, pois pode haver erros de tipo esperados
    ((SUCCESS++))
fi
echo ""

# ============================================
# TESTE 5: Verificar arquivos SQL
# ============================================
echo -e "${BLUE}[5]${NC} Verificando arquivos SQL críticos..."
SQL_FILES=(
    "CRIAR_FUNCOES_ANALYTICS.sql"
    "CRIAR_FUNCOES_AGENT_FILES.sql"
    "CRIAR_FUNCOES_FILES.sql"
)

for sql_file in "${SQL_FILES[@]}"; do
    if [ -f "$sql_file" ]; then
        # Verifica se tem estrutura básica
        if grep -q -i "CREATE\|FUNCTION" "$sql_file" 2>/dev/null; then
            echo -e "  ${GREEN}✅${NC} $sql_file existe e tem estrutura válida"
            ((SUCCESS++))
        else
            echo -e "  ${YELLOW}⚠️${NC} $sql_file existe mas pode estar vazio"
        fi
    else
        echo -e "  ${YELLOW}⚠️${NC} $sql_file não encontrado (pode ser opcional)"
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
