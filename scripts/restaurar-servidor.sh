#!/bin/bash

# ===============================================
# SCRIPT PARA RESTAURAR VERSÃO FUNCIONANDO NO SERVIDOR
# ===============================================

echo "🔄 Iniciando restauração da versão funcionando no servidor Contabo..."

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script a partir da raiz do projeto"
    exit 1
fi

# Configurações
SERVER_IP="66.94.104.241"
SERVER_USER="root"
SERVER_PATH="/opt/vigilancia"
BACKUP_NAME="backup-funcionando-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "📦 Criando arquivo comprimido do projeto..."
tar -czf "$BACKUP_NAME" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude="*.log" \
    --exclude="backup-*.tar.gz" \
    .

echo "📤 Enviando arquivo para o servidor..."
scp "$BACKUP_NAME" "$SERVER_USER@$SERVER_IP:/opt/"

echo "🔧 Configurando no servidor..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    cd /opt
    
    # Backup da versão atual (se existir)
    if [ -d "vigilancia" ]; then
        echo "📁 Fazendo backup da versão atual..."
        mv vigilancia vigilancia-backup-\$(date +%Y%m%d-%H%M%S)
    fi
    
    # Criar novo diretório
    mkdir -p vigilancia
    cd vigilancia
    
    # Extrair arquivos
    echo "📂 Extraindo arquivos..."
    tar -xzf "../$BACKUP_NAME"
    
    # Dar permissões
    chmod +x deploy-contabo.sh
    chmod +x scripts/*.sh
    
    # Parar containers se estiverem rodando
    echo "🛑 Parando containers existentes..."
    docker-compose down 2>/dev/null || true
    
    # Limpar containers e imagens órfãs
    echo "🧹 Limpando containers órfãos..."
    docker system prune -f
    
    # Executar deploy
    echo "🚀 Iniciando deploy..."
    ./deploy-contabo.sh
    
    echo "✅ Restauração concluída!"
    echo "🌐 Acesse: https://nuvem.safecameras.com.br"
EOF

# Remover arquivo local temporário
rm "$BACKUP_NAME"

echo ""
echo "✅ RESTAURAÇÃO CONCLUÍDA!"
echo "🌐 Sistema disponível em: https://nuvem.safecameras.com.br"
echo ""
echo "📊 Para verificar status dos containers:"
echo "   ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose ps'"
echo ""
echo "📋 Para ver logs:"
echo "   ssh root@66.94.104.241 'cd /opt/vigilancia && docker-compose logs -f'" 