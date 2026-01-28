#!/bin/bash

# ============================================
# Script para Atualizar TUDO Automaticamente
# Recebe BackEnd.zip, descompacta e faz deploy
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
echo "  ATUALIZAR TUDO AUTOMATICAMENTE"
echo "============================================"
echo ""

PROJECT_DIR="$HOME/plataform-backend"
BACKEND_DIR="$PROJECT_DIR/BackEnd"
ZIP_FILE="$PROJECT_DIR/BackEnd.zip"

# 1. Verificar se BackEnd.zip existe
echo -e "${BLUE}[1]${NC} Verificando se BackEnd.zip existe..."
if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}❌ BackEnd.zip não encontrado em: $ZIP_FILE${NC}"
    echo ""
    echo "Por favor:"
    echo "  1. No seu PC, compacte: Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip"
    echo "  2. Envie para o servidor: .\upload-backend-zip.bat"
    echo "  3. Execute este script novamente"
    exit 1
fi

echo -e "${GREEN}✅ BackEnd.zip encontrado!${NC}"
echo ""

# 2. Criar diretório se não existir
echo -e "${BLUE}[2]${NC} Verificando diretórios..."
mkdir -p "$PROJECT_DIR"
mkdir -p "$BACKEND_DIR"
echo -e "${GREEN}✅ Diretórios OK${NC}"
echo ""

# 3. Fazer backup (opcional)
echo -e "${BLUE}[3]${NC} Criando backup..."
BACKUP_DIR="$PROJECT_DIR/.backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"

if [ -d "$BACKEND_DIR" ] && [ "$(ls -A $BACKEND_DIR 2>/dev/null)" ]; then
    echo "Criando backup do código atual..."
    tar -czf "$BACKUP_FILE" \
        -C "$PROJECT_DIR" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.backups' \
        --exclude='.git' \
        BackEnd/ 2>/dev/null || true
    
    if [ -f "$BACKUP_FILE" ]; then
        echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  Não foi possível criar backup (continuando...)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Nenhum código anterior para fazer backup${NC}"
fi
echo ""

# 4. Descompactar BackEnd.zip
echo -e "${BLUE}[4]${NC} Descompactando BackEnd.zip..."
cd "$PROJECT_DIR"

if unzip -o "$ZIP_FILE" -d "$PROJECT_DIR" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Descompactado com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao descompactar${NC}"
    exit 1
fi
echo ""

# 5. Remover zip (opcional)
read -p "Deseja remover o BackEnd.zip? (s/N): " REMOVE_ZIP
if [[ "$REMOVE_ZIP" =~ ^[Ss]$ ]]; then
    rm -f "$ZIP_FILE"
    echo -e "${GREEN}✅ BackEnd.zip removido${NC}"
else
    echo -e "${YELLOW}⚠️  BackEnd.zip mantido${NC}"
fi
echo ""

# 6. Verificar se está no diretório correto
if [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo -e "${RED}❌ package.json não encontrado após descompactar${NC}"
    echo "Verifique se o BackEnd.zip está correto"
    exit 1
fi

# 7. Executar deploy.sh
echo -e "${BLUE}[5]${NC} Executando deploy..."
echo ""
cd "$BACKEND_DIR"

if [ -f "scripts/deploy.sh" ]; then
    chmod +x scripts/deploy.sh
    bash scripts/deploy.sh
else
    echo -e "${RED}❌ scripts/deploy.sh não encontrado${NC}"
    echo ""
    echo "Executando comandos manualmente..."
    
    # Instalar dependências
    echo "Instalando dependências..."
    npm install
    
    # Compilar
    echo "Compilando TypeScript..."
    npm run build
    
    # Reiniciar Docker
    echo "Reiniciando containers Docker..."
    if [ -f "docker-compose.yml" ]; then
        docker-compose down
        docker-compose up -d
    fi
fi

echo ""
echo "============================================"
echo "  ATUALIZAÇÃO CONCLUÍDA!"
echo "============================================"
echo ""
echo "Próximos passos:"
echo "  - Verificar logs: docker-compose logs -f"
echo "  - Verificar status: docker-compose ps"
echo ""
