#!/bin/bash

# ============================================
# Script para Upload do BackEnd para Servidor
# Linux/Mac Shell Script
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  UPLOAD PARA SERVIDOR"
echo "============================================"
echo ""

# Configurações
read -p "Digite o endereço do servidor (ex: servidoronsmart@192.168.1.100): " SERVER

if [ -z "$SERVER" ]; then
    echo -e "${RED}[ERRO]${NC} Servidor não informado!"
    exit 1
fi

REMOTE_PATH="~/plataform-backend"

echo ""
echo "Configuração:"
echo "  Servidor: $SERVER"
echo "  Pasta remota: $REMOTE_PATH"
echo ""

# Verificar se rsync está disponível
if ! command -v rsync &> /dev/null; then
    echo -e "${YELLOW}[AVISO]${NC} rsync não encontrado. Instalando..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y rsync
    elif command -v yum &> /dev/null; then
        sudo yum install -y rsync
    elif command -v brew &> /dev/null; then
        brew install rsync
    else
        echo -e "${RED}[ERRO]${NC} Não foi possível instalar rsync automaticamente."
        echo "Por favor, instale manualmente:"
        echo "  Ubuntu/Debian: sudo apt-get install rsync"
        echo "  CentOS/RHEL: sudo yum install rsync"
        echo "  Mac: brew install rsync"
        exit 1
    fi
fi

# Verificar se está no diretório correto
if [ ! -d "BackEnd" ]; then
    echo -e "${RED}[ERRO]${NC} Pasta BackEnd não encontrada!"
    echo "Execute o script da raiz do projeto."
    exit 1
fi

# Fazer upload
echo "Fazendo upload do BackEnd..."
echo "Excluindo: node_modules, dist, .env, .git"
echo ""

rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.git' \
  --exclude '*.log' \
  BackEnd/ "$SERVER:$REMOTE_PATH/"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  UPLOAD CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Próximos passos no servidor:"
    echo "  1. ssh $SERVER"
    echo "  2. cd $REMOTE_PATH"
    echo "  3. cp .env.example .env"
    echo "  4. nano .env"
    echo "  5. npm install"
    echo "  6. npm run build"
    echo "  7. sudo ./scripts/setup-server.sh"
    echo "  8. sudo ./scripts/setup-cloudflare-tunnel.sh"
    echo "  9. ./scripts/deploy.sh"
    echo ""
else
    echo ""
    echo -e "${RED}[ERRO]${NC} Falha no upload!"
    echo "Verifique:"
    echo "  - Conexão com o servidor"
    echo "  - Credenciais SSH"
    echo "  - Permissões da pasta remota"
    echo ""
    exit 1
fi
