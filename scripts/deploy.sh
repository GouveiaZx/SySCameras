#!/bin/bash

# ================================
# SCRIPT DE DEPLOY - SISTEMA DE VIGILÂNCIA IP
# ================================

set -e  # Exit on any error

echo "🚀 Iniciando deploy do Sistema de Vigilância IP..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado. Por favor, instale o Docker primeiro."
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
fi

# Verificar se arquivo .env existe
if [ ! -f ".env" ]; then
    warn "Arquivo .env não encontrado. Copiando do exemplo..."
    cp .env.example .env
    warn "Por favor, configure o arquivo .env com suas credenciais antes de continuar."
    read -p "Pressione Enter para continuar depois de configurar o .env..."
fi

# Criar diretórios necessários
log "Criando diretórios necessários..."
mkdir -p nginx/ssl
mkdir -p logs
mkdir -p data/postgres
mkdir -p data/worker
mkdir -p data/srs

# Parar containers existentes se estiverem rodando
log "Parando containers existentes..."
docker-compose down --remove-orphans 2>/dev/null || true

# Remover imagens antigas (opcional)
read -p "Deseja remover imagens antigas para rebuild completo? (y/N): " rebuild
if [[ $rebuild =~ ^[Yy]$ ]]; then
    log "Removendo imagens antigas..."
    docker-compose down --rmi all --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f
fi

# Build das imagens
log "Construindo imagens Docker..."
docker-compose build --no-cache

# Verificar se build foi bem-sucedido
if [ $? -ne 0 ]; then
    error "Falha no build das imagens Docker"
fi

# Iniciar serviços
log "Iniciando serviços..."
docker-compose up -d

# Aguardar serviços ficarem prontos
log "Aguardando serviços ficarem prontos..."
sleep 30

# Verificar health checks
log "Verificando status dos serviços..."

services=("surveillance-backend" "surveillance-worker" "surveillance-frontend" "surveillance-srs" "surveillance-nginx")

for service in "${services[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
        log "✅ $service está rodando"
    else
        error "❌ $service falhou ao iniciar"
    fi
done

# Mostrar logs dos serviços
log "Status dos containers:"
docker-compose ps

# Verificar URLs
log "Verificando conectividade..."

check_url() {
    local url=$1
    local service=$2
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302"; then
        log "✅ $service respondendo em $url"
        return 0
    else
        warn "⚠️  $service não está respondendo em $url"
        return 1
    fi
}

sleep 10  # Aguardar serviços estarem completamente prontos

check_url "http://localhost:3000" "Frontend"
check_url "http://localhost:3001/health" "Backend"
check_url "http://localhost:3002/health" "Worker"
check_url "http://localhost:80" "Nginx Proxy"

# Mostrar informações finais
echo ""
log "🎉 Deploy concluído com sucesso!"
echo ""
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}    SISTEMA DE VIGILÂNCIA IP - PRONTO!${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "🌐 Frontend:     ${GREEN}http://localhost:3000${NC}"
echo -e "🔗 Backend API:  ${GREEN}http://localhost:3001${NC}"
echo -e "⚙️  Worker API:   ${GREEN}http://localhost:3002${NC}"
echo -e "📺 SRS Server:   ${GREEN}rtmp://localhost:1935/live${NC}"
echo -e "🔄 Nginx Proxy:  ${GREEN}http://localhost:80${NC}"
echo ""
echo -e "📋 Para ver logs: ${YELLOW}docker-compose logs -f${NC}"
echo -e "🛑 Para parar:    ${YELLOW}docker-compose down${NC}"
echo -e "🔄 Para restart:  ${YELLOW}docker-compose restart${NC}"
echo ""

# Opcional: abrir browser
read -p "Deseja abrir o sistema no navegador? (Y/n): " open_browser
if [[ ! $open_browser =~ ^[Nn]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    else
        log "Abra http://localhost:3000 no seu navegador"
    fi
fi

log "Deploy finalizado! Sistema está rodando." 