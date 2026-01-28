#!/bin/bash

# ============================================
# Script de Setup Inicial do Servidor
# Instala dependências e configura ambiente
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

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    error "Por favor, execute como root (sudo ./setup-server.sh)"
    exit 1
fi

echo ""
echo "============================================"
echo "  SETUP INICIAL DO SERVIDOR"
echo "============================================"
echo ""

# Detectar sistema operacional
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    error "Não foi possível detectar o sistema operacional"
    exit 1
fi

log "Sistema operacional detectado: $OS $OS_VERSION"

# 1. Atualizar sistema
log "Atualizando sistema..."
case $OS in
    ubuntu|debian)
        apt-get update
        apt-get upgrade -y
        ;;
    centos|rhel|fedora)
        yum update -y || dnf update -y
        ;;
    *)
        warn "Sistema operacional não suportado automaticamente"
        ;;
esac

# 2. Instalar dependências básicas
log "Instalando dependências básicas..."

case $OS in
    ubuntu|debian)
        apt-get install -y \
            curl \
            wget \
            git \
            build-essential \
            ca-certificates \
            gnupg \
            lsb-release
        ;;
    centos|rhel|fedora)
        yum install -y \
            curl \
            wget \
            git \
            gcc \
            gcc-c++ \
            make \
            ca-certificates \
            gnupg \
        || dnf install -y \
            curl \
            wget \
            git \
            gcc \
            gcc-c++ \
            make \
            ca-certificates \
            gnupg
        ;;
esac

# 3. Instalar Docker
log "Verificando Docker..."

if ! command -v docker &> /dev/null; then
    log "Instalando Docker..."
    
    case $OS in
        ubuntu|debian)
            # Remover versões antigas
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            
            # Instalar Docker
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
            
            # Adicionar usuário ao grupo docker
            usermod -aG docker $SUDO_USER
            ;;
        centos|rhel|fedora)
            # Remover versões antigas
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            
            # Instalar Docker
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
            
            # Adicionar usuário ao grupo docker
            usermod -aG docker $SUDO_USER
            ;;
    esac
    
    # Iniciar e habilitar Docker
    systemctl start docker
    systemctl enable docker
    
    log "Docker instalado com sucesso!"
else
    log "Docker já está instalado: $(docker --version)"
fi

# 4. Instalar Docker Compose
log "Verificando Docker Compose..."

if ! command -v docker-compose &> /dev/null; then
    log "Instalando Docker Compose..."
    
    DOCKER_COMPOSE_VERSION="v2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Criar symlink para docker compose (v2)
    ln -sf /usr/local/bin/docker-compose /usr/local/bin/docker-compose-plugin
    
    log "Docker Compose instalado com sucesso!"
else
    log "Docker Compose já está instalado: $(docker-compose --version)"
fi

# 5. Instalar Node.js
log "Verificando Node.js..."

if ! command -v node &> /dev/null; then
    log "Instalando Node.js..."
    
    # Usar NodeSource para versão LTS
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    
    case $OS in
        ubuntu|debian)
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora)
            yum install -y nodejs || dnf install -y nodejs
            ;;
    esac
    
    log "Node.js instalado: $(node --version)"
    log "npm instalado: $(npm --version)"
else
    log "Node.js já está instalado: $(node --version)"
fi

# 6. Instalar cloudflared (via script específico)
log "Cloudflare Tunnel será configurado pelo script setup-cloudflare-tunnel.sh"
log "Execute: sudo ./scripts/setup-cloudflare-tunnel.sh"

# 7. Criar estrutura de diretórios
log "Criando estrutura de diretórios..."

PROJECT_DIR="$HOME/plataform-backend"
mkdir -p "$PROJECT_DIR"
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"

log "Diretório do projeto: $PROJECT_DIR"

# 8. Configurar permissões
log "Configurando permissões..."

# Garantir que usuário pode usar Docker sem sudo (após logout/login)
if ! groups $SUDO_USER | grep -q docker; then
    warn "Usuário $SUDO_USER precisa fazer logout/login para usar Docker sem sudo"
fi

# 9. Configurar firewall (opcional)
read -p "Deseja configurar firewall? (y/n): " CONFIGURE_FIREWALL

if [ "$CONFIGURE_FIREWALL" = "y" ]; then
    log "Configurando firewall..."
    
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian - UFW
        ufw allow 22/tcp   # SSH
        ufw allow 3333/tcp # Backend
        ufw allow 8081/tcp # Evolution API
        ufw --force enable
        log "UFW configurado"
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL - firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-port=3333/tcp
        firewall-cmd --permanent --add-port=8081/tcp
        firewall-cmd --reload
        log "firewalld configurado"
    else
        warn "Firewall não detectado. Configure manualmente se necessário."
    fi
fi

# 10. Resumo final
echo ""
echo "============================================"
echo "  SETUP CONCLUÍDO"
echo "============================================"
echo ""

log "Dependências instaladas:"
echo "  ✅ Docker: $(docker --version)"
echo "  ✅ Docker Compose: $(docker-compose --version)"
echo "  ✅ Node.js: $(node --version)"
echo "  ✅ npm: $(npm --version)"
echo ""

log "Próximos passos:"
echo "  1. Faça logout/login para aplicar permissões do Docker"
echo "  2. Navegue para o projeto:"
echo "     cd $PROJECT_DIR/BackEnd"
echo "  3. Configure variáveis de ambiente:"
echo "     cp .env.example .env"
echo "     nano .env"
echo "  4. Instale dependências e compile:"
echo "     npm install"
echo "     npm run build"
echo "  5. Configure Cloudflare Tunnel:"
echo "     sudo ./scripts/setup-cloudflare-tunnel.sh"
echo "  6. Execute o primeiro deploy:"
echo "     ./scripts/deploy.sh"
echo ""

warn "IMPORTANTE: Faça logout/login antes de executar docker-compose sem sudo!"
echo ""

log "Setup finalizado com sucesso! 🎉"
