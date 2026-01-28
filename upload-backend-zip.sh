#!/bin/bash

# ============================================
# Script para Upload do BackEnd.zip para Servidor
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
echo "  UPLOAD BACKEND.ZIP PARA SERVIDOR"
echo "============================================"
echo ""

# Verificar se o arquivo existe
if [ ! -f "BackEnd.zip" ]; then
    echo -e "${RED}[ERRO]${NC} Arquivo BackEnd.zip não encontrado!"
    echo ""
    echo "Por favor, crie o arquivo BackEnd.zip primeiro:"
    echo "  zip -r BackEnd.zip BackEnd/"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Arquivo BackEnd.zip encontrado!"
echo ""

# Solicitar informações do servidor
read -p "Digite o endereço do servidor (ex: servidoronsmart@192.168.1.100): " SERVER

if [ -z "$SERVER" ]; then
    echo -e "${RED}[ERRO]${NC} Servidor não informado!"
    exit 1
fi

read -p "Digite o caminho remoto (padrão: ~/plataform-backend): " REMOTE_PATH
REMOTE_PATH=${REMOTE_PATH:-~/plataform-backend}

echo ""
echo "Configuração:"
echo "  Arquivo: BackEnd.zip"
echo "  Servidor: $SERVER"
echo "  Caminho remoto: $REMOTE_PATH"
echo ""

# Verificar se SCP está disponível
if ! command -v scp &> /dev/null; then
    echo -e "${RED}[ERRO]${NC} SCP não encontrado!"
    echo ""
    echo "Por favor, instale:"
    echo "  Ubuntu/Debian: sudo apt-get install openssh-client"
    echo "  CentOS/RHEL: sudo yum install openssh-clients"
    echo "  Mac: Já vem instalado"
    echo ""
    exit 1
fi

# Mostrar tamanho do arquivo
FILE_SIZE=$(du -h BackEnd.zip | cut -f1)
echo "Tamanho do arquivo: $FILE_SIZE"
echo ""

# Fazer upload
echo "Fazendo upload do BackEnd.zip..."
echo ""

scp -v BackEnd.zip "$SERVER:$REMOTE_PATH/"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  UPLOAD CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Próximos passos no servidor:"
    echo "  1. ssh $SERVER"
    echo "  2. cd $REMOTE_PATH"
    echo "  3. unzip -o BackEnd.zip"
    echo "  4. rm BackEnd.zip"
    echo "  5. cp .env.example .env"
    echo "  6. nano .env"
    echo "  7. npm install"
    echo "  8. npm run build"
    echo "  9. sudo ./scripts/setup-server.sh"
    echo " 10. sudo ./scripts/setup-cloudflare-tunnel.sh"
    echo " 11. ./scripts/deploy.sh"
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
