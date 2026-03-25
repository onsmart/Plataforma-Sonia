#!/bin/bash

# ============================================
# Script de Deploy/Atualização do Projeto
# Atualiza código, compila, reinicia serviços
# ============================================

set -e  # Parar em caso de erro (desabilitado durante rollback)

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/.backups"
DRY_RUN=false
SKIP_BUILD=false

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

# Função para exibir ajuda
show_help() {
    cat << EOF
Uso: $0 [OPÇÕES]

Script de deploy/atualização do projeto.

OPÇÕES:
    -h, --help          Exibir esta ajuda
    -d, --dry-run       Simular deploy sem executar
    -s, --skip-build    Pular compilação TypeScript
    --no-backup         Não fazer backup antes do deploy

EXEMPLOS:
    $0                  Deploy normal
    $0 --dry-run        Simular deploy
    $0 --skip-build     Deploy sem recompilar
EOF
}

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        *)
            error "Opção desconhecida: $1"
            show_help
            exit 1
            ;;
    esac
done

echo ""
echo "============================================"
echo "  DEPLOY DO PROJETO"
echo "============================================"
echo ""

if [ "$DRY_RUN" = true ]; then
    warn "MODO DRY-RUN: Nenhuma alteração será feita"
    echo ""
fi

# 1. Validar pré-requisitos
log "Validando pré-requisitos..."

check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 não encontrado. Por favor, instale $1."
        exit 1
    fi
}

check_command docker
check_command docker-compose
check_command node
check_command npm

# Verificar se Docker está rodando
if ! docker info &> /dev/null; then
    error "Docker não está rodando. Por favor, inicie o Docker."
    exit 1
fi

log "Pré-requisitos OK!"

# 2. Verificar se está no diretório correto
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    error "package.json não encontrado. Execute o script do diretório BackEnd/"
    exit 1
fi

cd "$PROJECT_DIR"

# docker-compose.yml: preferir BackEnd/; senão pasta pai (ex.: ~/plataform-backend/docker-compose.yml)
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_CAND="$(cd "$PROJECT_DIR/.." && pwd)/docker-compose.yml"
    if [ -f "$COMPOSE_CAND" ]; then
        COMPOSE_FILE="$COMPOSE_CAND"
    fi
fi

compose() {
    docker-compose -f "$COMPOSE_FILE" "$@"
}

# 3. Backup (opcional)
if [ "$NO_BACKUP" != true ] && [ "$DRY_RUN" != true ]; then
    log "Criando backup..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    tar -czf "$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.backups' \
        --exclude='.git' \
        . 2>/dev/null || true
    
    log "Backup criado: $BACKUP_FILE"
fi

# 4. Atualizar código (se Git)
if [ -d ".git" ]; then
    log "Atualizando código do Git..."
    if [ "$DRY_RUN" != true ]; then
        git pull || warn "Falha ao fazer git pull (continuando...)"
    else
        log "[DRY-RUN] git pull"
    fi
else
    warn "Diretório não é um repositório Git. Pulando atualização de código."
fi

# 5. Instalar dependências
log "Instalando dependências npm..."
if [ "$DRY_RUN" != true ]; then
    npm install
else
    log "[DRY-RUN] npm install"
fi

# 6. Compilar TypeScript
if [ "$SKIP_BUILD" != true ]; then
    log "Compilando TypeScript..."
    if [ "$DRY_RUN" != true ]; then
        npm run build
    else
        log "[DRY-RUN] npm run build"
    fi
else
    warn "Pulando compilação TypeScript (--skip-build)"
fi

# 7. Verificar arquivo .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    warn "Arquivo .env não encontrado!"
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        log "Copiando .env.example para .env..."
        if [ "$DRY_RUN" != true ]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            warn "Por favor, edite o arquivo .env com suas configurações!"
        else
            log "[DRY-RUN] cp .env.example .env"
        fi
    else
        error "Arquivo .env.example não encontrado. Crie um arquivo .env manualmente."
        exit 1
    fi
fi

# 8. Atualizar docker-compose.yml com URL do túnel (se configurado)
if [ -n "$WEBHOOK_TUNNEL_URL" ]; then
    log "Atualizando docker-compose.yml com URL do túnel..."
    if [ "$DRY_RUN" != true ]; then
        # Atualizar WEBHOOK_GLOBAL_URL no docker-compose.yml
        sed -i.bak "s|WEBHOOK_GLOBAL_URL=.*|WEBHOOK_GLOBAL_URL=$WEBHOOK_TUNNEL_URL|" "$COMPOSE_FILE" || true
        rm -f "${COMPOSE_FILE}.bak"
    else
        log "[DRY-RUN] Atualizar WEBHOOK_GLOBAL_URL=$WEBHOOK_TUNNEL_URL"
    fi
else
    warn "WEBHOOK_TUNNEL_URL não definido. Usando URL padrão do docker-compose.yml"
fi

# 9. Verificar se docker-compose.yml existe
if [ ! -f "$COMPOSE_FILE" ]; then
    error "docker-compose.yml não encontrado em $PROJECT_DIR nem em $(dirname "$PROJECT_DIR"). Copie docker-compose.yml para BackEnd/ ou para a pasta pai (plataform-backend)."
    exit 1
fi
log "Usando compose: $COMPOSE_FILE"

# 10. Parar containers (se estiverem rodando)
log "Parando containers Docker..."
if [ "$DRY_RUN" != true ]; then
    compose down || warn "Alguns containers podem não estar rodando"
else
    log "[DRY-RUN] docker-compose down"
fi

# 11. Atualizar imagens Docker
log "Atualizando imagens Docker..."
if [ "$DRY_RUN" != true ]; then
    compose pull || warn "Falha ao atualizar algumas imagens"
else
    log "[DRY-RUN] docker-compose pull"
fi

# 12. Iniciar containers
log "Iniciando containers Docker..."
if [ "$DRY_RUN" != true ]; then
    compose up -d
else
    log "[DRY-RUN] docker-compose up -d"
fi

# 13. Aguardar serviços iniciarem
log "Aguardando serviços iniciarem..."
if [ "$DRY_RUN" != true ]; then
    sleep 10
fi

# 14. Verificar saúde dos serviços
log "Verificando saúde dos serviços..."

check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if compose ps | grep -q "$service.*Up"; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    return 1
}

if [ "$DRY_RUN" != true ]; then
    SERVICES=("evolution-api" "postgres" "redis")
    for service in "${SERVICES[@]}"; do
        if check_service_health "$service"; then
            log "✅ $service está rodando"
        else
            error "❌ $service não está rodando corretamente"
            warn "Verifique os logs: docker-compose -f $COMPOSE_FILE logs $service"
        fi
    done
fi

# 15. Verificar se backend está respondendo
log "Verificando se backend está respondendo..."
if [ "$DRY_RUN" != true ]; then
    sleep 5
    if curl -f http://localhost:3333/agents &> /dev/null; then
        log "✅ Backend está respondendo"
    else
        warn "⚠️  Backend pode não estar respondendo. Verifique os logs."
    fi
fi

# 16. Testar webhook (se URL configurada)
if [ -n "$WEBHOOK_TUNNEL_URL" ] && [ "$DRY_RUN" != true ]; then
    log "Testando webhook..."
    WEBHOOK_TEST_URL="${WEBHOOK_TUNNEL_URL%/whatsapp/webhook}/whatsapp/webhook"
    
    if curl -f -X POST "$WEBHOOK_TEST_URL" \
        -H "Content-Type: application/json" \
        -d '{"test": true}' &> /dev/null; then
        log "✅ Webhook está acessível"
    else
        warn "⚠️  Webhook pode não estar acessível. Verifique a configuração do túnel."
    fi
fi

# 17. Exibir logs de erro (se houver)
if [ "$DRY_RUN" != true ]; then
    log "Verificando erros recentes..."
    
    # Verificar logs do docker-compose
    ERROR_COUNT=$(compose logs --tail=50 2>&1 | grep -i error | wc -l || echo "0")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        warn "Encontrados $ERROR_COUNT erros nos logs. Verifique:"
        echo "  docker-compose -f $COMPOSE_FILE logs"
    fi
fi

# 18. Resumo final
echo ""
echo "============================================"
echo "  DEPLOY CONCLUÍDO"
echo "============================================"
echo ""

if [ "$DRY_RUN" = true ]; then
    warn "Este foi um DRY-RUN. Nenhuma alteração foi feita."
    echo ""
fi

log "Status dos serviços:"
if [ "$DRY_RUN" != true ]; then
    compose ps
else
    log "[DRY-RUN] docker-compose ps"
fi

echo ""
log "Comandos úteis (substitua pelo mesmo -f acima):"
echo "  Ver logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  Ver logs de um serviço: docker-compose -f $COMPOSE_FILE logs -f evolution-api"
echo "  Parar tudo: docker-compose -f $COMPOSE_FILE down"
echo "  Reiniciar: docker-compose -f $COMPOSE_FILE restart"
echo ""

if [ -n "$BACKUP_FILE" ]; then
    log "Backup disponível em: $BACKUP_FILE"
    echo ""
fi

log "Deploy finalizado com sucesso! 🎉"
