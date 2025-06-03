#!/bin/bash

# ================================
# SCRIPT DE MONITORAMENTO - SISTEMA DE VIGILÂNCIA IP
# ================================

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Função para verificar saúde do container
check_container_health() {
    local container_name=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null)
    
    if [ "$status" = "healthy" ]; then
        echo -e "✅ ${GREEN}$container_name: Saudável${NC}"
        return 0
    elif [ "$status" = "unhealthy" ]; then
        echo -e "❌ ${RED}$container_name: Não saudável${NC}"
        return 1
    elif [ -z "$status" ]; then
        # Container sem health check - verificar se está rodando
        if docker ps --filter "name=$container_name" --filter "status=running" | grep -q $container_name; then
            echo -e "🟡 ${YELLOW}$container_name: Rodando (sem health check)${NC}"
            return 0
        else
            echo -e "❌ ${RED}$container_name: Parado${NC}"
            return 1
        fi
    else
        echo -e "🟡 ${YELLOW}$container_name: $status${NC}"
        return 0
    fi
}

# Função para verificar uso de recursos
check_resources() {
    echo -e "\n${BLUE}📊 USO DE RECURSOS:${NC}"
    
    # CPU e Memória dos containers
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -6
    
    echo -e "\n${BLUE}💾 ESPAÇO EM DISCO:${NC}"
    df -h | grep -E "(Filesystem|/dev/)"
    
    echo -e "\n${BLUE}🐳 VOLUMES DOCKER:${NC}"
    docker system df
}

# Função para verificar logs de erro
check_error_logs() {
    echo -e "\n${BLUE}🔍 VERIFICANDO LOGS DE ERRO (últimas 10 linhas):${NC}"
    
    containers=("surveillance-backend" "surveillance-worker" "surveillance-frontend" "surveillance-srs")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" | grep -q $container; then
            echo -e "\n${YELLOW}📋 $container:${NC}"
            docker logs --tail 10 $container 2>&1 | grep -i error || echo "Nenhum erro encontrado"
        fi
    done
}

# Função para verificar conectividade de rede
check_network_connectivity() {
    echo -e "\n${BLUE}🌐 VERIFICANDO CONECTIVIDADE:${NC}"
    
    urls=(
        "http://localhost:3000|Frontend"
        "http://localhost:3001/health|Backend"
        "http://localhost:3002/health|Worker"
        "http://localhost:80|Nginx"
    )
    
    for url_info in "${urls[@]}"; do
        IFS='|' read -r url service <<< "$url_info"
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302"; then
            echo -e "✅ ${GREEN}$service: OK${NC}"
        else
            echo -e "❌ ${RED}$service: Falha${NC}"
        fi
    done
}

# Função para backup de logs
backup_logs() {
    echo -e "\n${BLUE}💾 FAZENDO BACKUP DE LOGS:${NC}"
    
    backup_dir="./backups/logs-$(date +'%Y%m%d-%H%M%S')"
    mkdir -p $backup_dir
    
    containers=("surveillance-backend" "surveillance-worker" "surveillance-frontend" "surveillance-srs" "surveillance-nginx")
    
    for container in "${containers[@]}"; do
        if docker ps -a --filter "name=$container" | grep -q $container; then
            docker logs $container > "$backup_dir/$container.log" 2>&1
            echo -e "📄 ${GREEN}$container.log salvo${NC}"
        fi
    done
    
    echo -e "📦 ${GREEN}Backup salvo em: $backup_dir${NC}"
}

# Função principal de monitoramento
monitor_system() {
    clear
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  MONITOR - SISTEMA VIGILÂNCIA${NC}"
    echo -e "${BLUE}================================${NC}"
    
    echo -e "\n${BLUE}🏥 STATUS DOS CONTAINERS:${NC}"
    
    containers=("surveillance-backend" "surveillance-worker" "surveillance-frontend" "surveillance-srs" "surveillance-nginx")
    all_healthy=true
    
    for container in "${containers[@]}"; do
        if ! check_container_health $container; then
            all_healthy=false
        fi
    done
    
    if $all_healthy; then
        echo -e "\n🎉 ${GREEN}Todos os serviços estão funcionando corretamente!${NC}"
    else
        echo -e "\n⚠️  ${YELLOW}Alguns serviços precisam de atenção!${NC}"
    fi
    
    check_resources
    check_network_connectivity
    
    # Verificar se há muitos containers parados
    stopped_containers=$(docker ps -a --filter "status=exited" | wc -l)
    if [ $stopped_containers -gt 5 ]; then
        warn "Muitos containers parados ($stopped_containers). Execute 'docker system prune' para limpeza."
    fi
}

# Função para restart automático de serviços com falha
auto_restart() {
    echo -e "\n${BLUE}🔄 VERIFICANDO SERVIÇOS PARA RESTART:${NC}"
    
    containers=("surveillance-backend" "surveillance-worker" "surveillance-frontend")
    
    for container in "${containers[@]}"; do
        if ! docker ps --filter "name=$container" --filter "status=running" | grep -q $container; then
            warn "$container está parado. Tentando restart..."
            docker-compose restart $container
            sleep 10
            if docker ps --filter "name=$container" --filter "status=running" | grep -q $container; then
                log "✅ $container reiniciado com sucesso"
            else
                error "❌ Falha ao reiniciar $container"
            fi
        fi
    done
}

# Menu principal
show_menu() {
    echo -e "\n${BLUE}OPÇÕES DE MONITORAMENTO:${NC}"
    echo "1. Status geral"
    echo "2. Logs de erro"
    echo "3. Restart automático"
    echo "4. Backup de logs"
    echo "5. Monitor contínuo"
    echo "6. Sair"
    echo ""
}

# Monitor contínuo
continuous_monitor() {
    echo -e "${BLUE}Iniciando monitor contínuo (Ctrl+C para parar)...${NC}"
    
    while true; do
        monitor_system
        echo -e "\n${YELLOW}Próxima verificação em 30 segundos...${NC}"
        sleep 30
    done
}

# Script principal
case "${1:-menu}" in
    "status")
        monitor_system
        ;;
    "logs")
        check_error_logs
        ;;
    "restart")
        auto_restart
        ;;
    "backup")
        backup_logs
        ;;
    "continuous")
        continuous_monitor
        ;;
    "menu"|*)
        while true; do
            monitor_system
            show_menu
            read -p "Escolha uma opção (1-6): " choice
            
            case $choice in
                1) monitor_system ;;
                2) check_error_logs ;;
                3) auto_restart ;;
                4) backup_logs ;;
                5) continuous_monitor ;;
                6) echo "Saindo..."; exit 0 ;;
                *) echo "Opção inválida" ;;
            esac
            
            echo ""
            read -p "Pressione Enter para continuar..."
        done
        ;;
esac 