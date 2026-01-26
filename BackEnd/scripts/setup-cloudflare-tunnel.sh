#!/bin/bash

# ============================================
# Script para configurar Cloudflare Tunnel Permanente
# Configura túnel com domínio próprio e serviço systemd
# ============================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root (necessário para instalar serviço)
if [ "$EUID" -ne 0 ]; then 
    error "Por favor, execute como root (sudo ./setup-cloudflare-tunnel.sh)"
    exit 1
fi

echo ""
echo "============================================"
echo "  CONFIGURAR CLOUDFLARE TUNNEL PERMANENTE"
echo "============================================"
echo ""

# 1. Verificar/Instalar cloudflared
log "Verificando cloudflared..."

if ! command -v cloudflared &> /dev/null; then
    warn "cloudflared não encontrado. Instalando..."
    
    # Detectar sistema operacional
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        error "Não foi possível detectar o sistema operacional"
        exit 1
    fi
    
    case $OS in
        ubuntu|debian)
            log "Instalando cloudflared para Ubuntu/Debian..."
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
            chmod +x /usr/local/bin/cloudflared
            ;;
        centos|rhel|fedora)
            log "Instalando cloudflared para CentOS/RHEL/Fedora..."
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
            chmod +x /usr/local/bin/cloudflared
            ;;
        *)
            warn "Sistema operacional não suportado automaticamente. Por favor, instale cloudflared manualmente:"
            echo "  wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
            echo "  chmod +x cloudflared-linux-amd64"
            echo "  sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared"
            exit 1
            ;;
    esac
    
    log "cloudflared instalado com sucesso!"
else
    log "cloudflared já está instalado: $(cloudflared --version)"
fi

# 2. Solicitar informações do usuário
echo ""
log "Configuração do Túnel"
echo ""

read -p "Nome do túnel (padrão: sonia-platform-webhook): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-sonia-platform-webhook}

read -p "Domínio do túnel (ex: webhook.seudominio.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    error "Domínio é obrigatório para túnel permanente!"
    exit 1
fi

read -p "Porta do backend (padrão: 3333): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-3333}

# 3. Autenticar no Cloudflare (se ainda não autenticado)
log "Verificando autenticação no Cloudflare..."

if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    warn "Não autenticado no Cloudflare. Abrindo navegador para autenticação..."
    log "Por favor, faça login e autorize o acesso."
    
    # Executar como usuário não-root para autenticação
    sudo -u $SUDO_USER cloudflared tunnel login
else
    log "Já autenticado no Cloudflare."
fi

# 4. Criar túnel
log "Criando túnel: $TUNNEL_NAME..."

# Executar como usuário não-root
sudo -u $SUDO_USER cloudflared tunnel create "$TUNNEL_NAME" || {
    warn "Túnel pode já existir. Continuando..."
}

# 5. Obter Tunnel ID
TUNNEL_ID=$(sudo -u $SUDO_USER cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}' | head -1)

if [ -z "$TUNNEL_ID" ]; then
    error "Não foi possível obter o Tunnel ID. Verifique se o túnel foi criado corretamente."
    exit 1
fi

log "Tunnel ID: $TUNNEL_ID"

# 6. Criar diretório de configuração
CLOUDFLARED_DIR="$HOME/.cloudflared"
mkdir -p "$CLOUDFLARED_DIR"

# 7. Criar arquivo de configuração
log "Criando arquivo de configuração..."

cat > "$CLOUDFLARED_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CLOUDFLARED_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:$BACKEND_PORT
  - service: http_status:404
EOF

log "Configuração criada em: $CLOUDFLARED_DIR/config.yml"

# 8. Configurar DNS
log "Configurando DNS para $DOMAIN..."

sudo -u $SUDO_USER cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || {
    warn "Falha ao configurar DNS automaticamente. Configure manualmente no painel do Cloudflare:"
    echo "  Tipo: CNAME"
    echo "  Nome: $(echo $DOMAIN | cut -d. -f1)"
    echo "  Conteúdo: $TUNNEL_ID.cfargotunnel.com"
}

# 9. Instalar como serviço systemd
log "Instalando como serviço systemd..."

# Criar arquivo de serviço
cat > /etc/systemd/system/cloudflared.service << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=$SUDO_USER
ExecStart=/usr/local/bin/cloudflared tunnel --config $CLOUDFLARED_DIR/config.yml run $TUNNEL_ID
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
systemctl daemon-reload

# Habilitar serviço para iniciar no boot
systemctl enable cloudflared

# Iniciar serviço
log "Iniciando serviço cloudflared..."
systemctl start cloudflared

# Aguardar um pouco para o serviço iniciar
sleep 3

# Verificar status
if systemctl is-active --quiet cloudflared; then
    log "Serviço cloudflared iniciado com sucesso!"
else
    error "Falha ao iniciar serviço cloudflared. Verifique os logs:"
    echo "  sudo journalctl -u cloudflared -f"
    exit 1
fi

# 10. Exibir informações finais
echo ""
echo "============================================"
echo "  CONFIGURAÇÃO CONCLUÍDA!"
echo "============================================"
echo ""
log "Túnel configurado:"
echo "  Nome: $TUNNEL_NAME"
echo "  ID: $TUNNEL_ID"
echo "  Domínio: $DOMAIN"
echo "  URL do Webhook: https://$DOMAIN/whatsapp/webhook"
echo ""
log "Serviço systemd:"
echo "  Status: $(systemctl is-active cloudflared)"
echo "  Habilitado: $(systemctl is-enabled cloudflared)"
echo ""
log "Comandos úteis:"
echo "  Ver status: sudo systemctl status cloudflared"
echo "  Ver logs: sudo journalctl -u cloudflared -f"
echo "  Reiniciar: sudo systemctl restart cloudflared"
echo "  Parar: sudo systemctl stop cloudflared"
echo ""
log "Próximos passos:"
echo "  1. Atualize docker-compose.yml com a URL: https://$DOMAIN/whatsapp/webhook"
echo "  2. Execute o script de deploy: ./scripts/deploy.sh"
echo ""
