#!/bin/bash

# ============================================
# Script para configurar Cloudflare Tunnel
# Linux/Mac Shell Script
# ============================================

echo ""
echo "============================================"
echo " CONFIGURAR CLOUDFLARE TUNNEL"
echo "============================================"
echo ""

# Verificar se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "[ERRO] cloudflared não encontrado!"
    echo ""
    echo "Por favor, instale o cloudflared:"
    echo "  Mac:   brew install cloudflare/cloudflare/cloudflared"
    echo "  Linux: wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    echo "         chmod +x cloudflared-linux-amd64"
    echo "         sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared"
    echo ""
    exit 1
fi

echo "[OK] cloudflared encontrado!"
echo ""

# Passo 1: Autenticar
echo "============================================"
echo "PASSO 1: Autenticar no Cloudflare"
echo "============================================"
echo ""
echo "Isso vai abrir o navegador para fazer login..."
read -p "Pressione Enter para continuar..."

cloudflared tunnel login
if [ $? -ne 0 ]; then
    echo "[ERRO] Falha na autenticação"
    exit 1
fi

echo ""
echo "[OK] Autenticado com sucesso!"
echo ""

# Passo 2: Criar túnel
echo "============================================"
echo "PASSO 2: Criar Túnel"
echo "============================================"
echo ""
read -p "Nome do túnel (padrão: whatsapp-webhook): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-whatsapp-webhook}

cloudflared tunnel create "$TUNNEL_NAME"
if [ $? -ne 0 ]; then
    echo "[ERRO] Falha ao criar túnel"
    exit 1
fi

echo ""
echo "[OK] Túnel criado: $TUNNEL_NAME"
echo ""
echo "IMPORTANTE: Anote o Tunnel ID que apareceu acima!"
echo ""
read -p "Pressione Enter para continuar..."

# Passo 3: Configurar
echo "============================================"
echo "PASSO 3: Configurar Túnel"
echo "============================================"
echo ""

CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

echo ""
echo "Criando arquivo de configuração..."
echo ""
read -p "Domínio (ou deixe vazio para URL aleatória): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo ""
    echo "Usando URL aleatória do Cloudflare..."
    echo ""
    cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_NAME

ingress:
  - service: http://localhost:3333
  - service: http_status:404
EOF
else
    echo ""
    echo "Configurando domínio: $DOMAIN"
    echo ""
    cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_NAME

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3333
  - service: http_status:404
EOF
    
    echo "Configurando DNS..."
    cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"
fi

echo ""
echo "[OK] Configuração criada em: $CONFIG_DIR/config.yml"
echo ""

# Passo 4: Testar
echo "============================================"
echo "PASSO 4: Testar Túnel"
echo "============================================"
echo ""
echo "Iniciando túnel em modo teste..."
echo ""
echo "IMPORTANTE: A URL pública aparecerá abaixo!"
echo "Pressione Ctrl+C para parar o teste."
echo ""
read -p "Pressione Enter para iniciar..."

cloudflared tunnel run "$TUNNEL_NAME"

echo ""
echo "============================================"
echo "CONFIGURAÇÃO CONCLUÍDA!"
echo "============================================"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Anote a URL pública que apareceu acima"
echo "2. Atualize docker-compose.yml com a URL"
echo "3. Reinicie o Evolution API: docker-compose down && docker-compose up -d"
echo "4. Para rodar como serviço: cloudflared service install"
echo ""
