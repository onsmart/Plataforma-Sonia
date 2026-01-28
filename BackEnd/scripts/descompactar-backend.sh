#!/bin/bash

# ============================================
# Script para Descompactar BackEnd.zip no Servidor
# Execute este script no servidor Linux
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  DESCOMPACTAR BACKEND.ZIP"
echo "============================================"
echo ""

# Verificar se está na pasta correta
CURRENT_DIR=$(pwd)
echo -e "${BLUE}[INFO]${NC} Diretório atual: $CURRENT_DIR"
echo ""

# Verificar se o arquivo existe
if [ ! -f "BackEnd.zip" ]; then
    echo -e "${RED}[ERRO]${NC} Arquivo BackEnd.zip não encontrado!"
    echo ""
    echo "Por favor, certifique-se de que:"
    echo "  1. Você está na pasta correta (ex: ~/plataform-backend)"
    echo "  2. O arquivo BackEnd.zip foi enviado para esta pasta"
    echo ""
    echo "Para fazer upload do arquivo, use:"
    echo "  scp BackEnd.zip servidoronsmart@seu-servidor:~/plataform-backend/"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Arquivo BackEnd.zip encontrado!"
echo ""

# Verificar se unzip está instalado
if ! command -v unzip &> /dev/null; then
    echo -e "${YELLOW}[AVISO]${NC} unzip não encontrado. Instalando..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y unzip
    elif command -v yum &> /dev/null; then
        sudo yum install -y unzip
    else
        echo -e "${RED}[ERRO]${NC} Não foi possível instalar unzip automaticamente."
        echo "Por favor, instale manualmente:"
        echo "  Ubuntu/Debian: sudo apt-get install unzip"
        echo "  CentOS/RHEL: sudo yum install unzip"
        exit 1
    fi
fi

# Mostrar tamanho do arquivo
FILE_SIZE=$(du -h BackEnd.zip | cut -f1)
echo -e "${BLUE}[INFO]${NC} Tamanho do arquivo: $FILE_SIZE"
echo ""

# Verificar se já existe conteúdo
if [ -d "BackEnd" ] && [ "$(ls -A BackEnd 2>/dev/null)" ]; then
    echo -e "${YELLOW}[AVISO]${NC} Pasta BackEnd já existe e não está vazia!"
    read -p "Deseja sobrescrever? (s/N): " OVERWRITE
    
    if [ "$OVERWRITE" != "s" ] && [ "$OVERWRITE" != "S" ]; then
        echo "Operação cancelada."
        exit 0
    fi
    
    echo "Removendo pasta BackEnd existente..."
    rm -rf BackEnd
fi

# Descompactar
echo "Descompactando BackEnd.zip..."
echo ""

unzip -o BackEnd.zip

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  DESCOMPACTAÇÃO CONCLUÍDA!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    
    # Verificar estrutura
    if [ -d "BackEnd" ]; then
        echo -e "${GREEN}[OK]${NC} Pasta BackEnd criada com sucesso!"
        echo ""
        echo "Estrutura:"
        ls -la BackEnd/ | head -20
        echo ""
        
        # Remover arquivo ZIP (opcional)
        read -p "Deseja remover o arquivo BackEnd.zip? (S/n): " REMOVE_ZIP
        if [ "$REMOVE_ZIP" != "n" ] && [ "$REMOVE_ZIP" != "N" ]; then
            rm -f BackEnd.zip
            echo -e "${GREEN}[OK]${NC} Arquivo BackEnd.zip removido!"
        fi
        
        echo ""
        echo "Próximos passos:"
        echo "  1. cd BackEnd"
        echo "  2. cp .env.example .env"
        echo "  3. nano .env"
        echo "  4. npm install"
        echo "  5. npm run build"
        echo "  6. sudo ./scripts/setup-server.sh"
        echo "  7. sudo ./scripts/setup-cloudflare-tunnel.sh"
        echo "  8. ./scripts/deploy.sh"
        echo ""
    else
        echo -e "${YELLOW}[AVISO]${NC} Arquivos descompactados, mas pasta BackEnd não encontrada."
        echo "Verifique se os arquivos foram extraídos corretamente."
        echo ""
    fi
else
    echo ""
    echo -e "${RED}[ERRO]${NC} Falha ao descompactar!"
    echo "Verifique:"
    echo "  - Se o arquivo ZIP está corrompido"
    echo "  - Se há espaço em disco suficiente"
    echo "  - Permissões de escrita na pasta"
    echo ""
    exit 1
fi
