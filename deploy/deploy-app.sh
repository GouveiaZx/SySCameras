#!/bin/bash

# 🚀 Script de Deploy da Aplicação - Sistema Vigilância IP
# Execute como usuário vigilancia

echo "🚀 Iniciando deploy da aplicação..."
echo "======================================"

# Verificar se está executando como usuário correto
if [[ $(whoami) != "vigilancia" ]]; then
    echo "❌ Este script deve ser executado como usuário 'vigilancia'"
    echo "Execute: su - vigilancia && bash deploy-app.sh"
    exit 1
fi

# Navegar para diretório da aplicação
cd /home/vigilancia/app

# Verificar se o repositório já existe
if [ ! -d ".git" ]; then
    echo "📦 Clonando repositório..."
    git clone https://github.com/seu-usuario/sistema-vigilancia-ip.git .
else
    echo "📦 Atualizando repositório..."
    git pull origin main
fi

# Verificar se arquivo .env existe
if [ ! -f "backend/.env" ]; then
    echo "⚙️ Criando arquivo .env para backend..."
    cat > backend/.env << 'EOF'
# Supabase
SUPABASE_URL=https://mmpipjndealyromdfnoa.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDUxNjMsImV4cCI6MjA2MzQyMTE2M30.nE6einLwJZGOHlWgJCUZeKNOFNPOo0QAGUDPUrO4OLo
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg0NTE2MywiZXhwIjoyMDYzNDIxMTYzfQ.SZp0HKKjTdYTeDfKBCbpN8nT0w-vxlECQdQ5DXUJJnY

# JWT
JWT_SECRET=sistema_vigilancia_ip_super_secret_key_2025_production

# Servidor
PORT=3001
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/vigilancia/backend.log
EOF
    echo "✅ Arquivo backend/.env criado"
fi

if [ ! -f "worker/.env" ]; then
    echo "⚙️ Criando arquivo .env para worker..."
    cat > worker/.env << 'EOF'
# Supabase
SUPABASE_URL=https://mmpipjndealyromdfnoa.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg0NTE2MywiZXhwIjoyMDYzNDIxMTYzfQ.SZp0HKKjTdYTeDfKBCbpN8nT0w-vxlECQdQ5DXUJJnY

# Wasabi S3
WASABI_ACCESS_KEY=8WBR4YFE79UA94TBIEST
WASABI_SECRET_KEY=COLOQUE_SUA_SECRET_KEY_WASABI_AQUI
WASABI_BUCKET=safe-cameras-03
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.us-east-1.wasabisys.com

# Worker
PORT=3002
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/vigilancia/worker.log

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
RECORDINGS_DIR=/home/vigilancia/recordings
TEMP_DIR=/home/vigilancia/temp
EOF
    echo "✅ Arquivo worker/.env criado"
    echo "⚠️  IMPORTANTE: Edite worker/.env e adicione sua WASABI_SECRET_KEY"
fi

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p /home/vigilancia/recordings
mkdir -p /home/vigilancia/temp
mkdir -p /home/vigilancia/logs

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
cd backend
npm install --production --silent

# Instalar dependências do worker
echo "📦 Instalando dependências do worker..."
cd ../worker
npm install --production --silent

# Configurar SRS (Streaming Server)
echo "🎥 Configurando servidor SRS..."
cd /home/vigilancia/app

if [ ! -d "streaming-server" ]; then
    mkdir -p streaming-server
    cd streaming-server
    
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  srs:
    image: registry.cn-hangzhou.aliyuncs.com/ossrs/srs:5
    container_name: srs-server
    restart: unless-stopped
    ports:
      - "1935:1935"    # RTMP
      - "8080:8080"    # HTTP API/HLS
      - "1985:1985"    # HTTP API
    volumes:
      - ./srs.conf:/usr/local/srs/conf/srs.conf
      - srs_data:/usr/local/srs/objs
    environment:
      - CANDIDATE=$(hostname -I | awk '{print $1}')
    networks:
      - srs-network

volumes:
  srs_data:

networks:
  srs-network:
    driver: bridge
EOF

    cat > srs.conf << 'EOF'
# SRS Configuration for IP Surveillance System

listen              1935;
max_connections     1000;
srs_log_tank        file;
srs_log_file        /usr/local/srs/objs/srs.log;

http_api {
    enabled         on;
    listen          1985;
    crossdomain     on;
}

http_server {
    enabled         on;
    listen          8080;
    dir             /usr/local/srs/objs/nginx/html;
}

rtc_server {
    enabled on;
    listen 8000;
    candidate $CANDIDATE;
}

vhost __defaultVhost__ {
    http_remux {
        enabled     on;
        mount       [vhost]/[app]/[stream].flv;
    }
    
    hls {
        enabled         on;
        hls_fragment    2;
        hls_window      12;
        hls_path        /usr/local/srs/objs/nginx/html;
        hls_m3u8_file   [app]/[stream].m3u8;
        hls_ts_file     [app]/[stream]-[seq].ts;
    }
    
    http_hooks {
        enabled         on;
        on_publish      http://localhost:3001/api/streams/hook/publish;
        on_unpublish    http://localhost:3001/api/streams/hook/unpublish;
        on_play         http://localhost:3001/api/streams/hook/play;
        on_stop         http://localhost:3001/api/streams/hook/stop;
    }
}
EOF
    
    echo "✅ Configuração SRS criada"
fi

# Iniciar SRS
echo "🚀 Iniciando servidor SRS..."
cd /home/vigilancia/app/streaming-server
docker-compose up -d

# Aguardar SRS inicializar
echo "⏳ Aguardando SRS inicializar..."
sleep 10

# Parar processos PM2 existentes
echo "🔄 Parando processos existentes..."
pm2 delete all 2>/dev/null || true

# Configurar e iniciar backend com PM2
echo "🚀 Iniciando backend..."
cd /home/vigilancia/app/backend

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'vigilancia-backend',
    script: 'src/server.js',
    cwd: '/home/vigilancia/app/backend',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_file: '/var/log/vigilancia/backend.log',
    error_file: '/var/log/vigilancia/backend-error.log',
    out_file: '/var/log/vigilancia/backend-out.log',
    pid_file: '/home/vigilancia/logs/backend.pid',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
EOF

pm2 start ecosystem.config.js

# Configurar e iniciar worker com PM2
echo "🚀 Iniciando worker..."
cd /home/vigilancia/app/worker

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'vigilancia-worker',
    script: 'src/server.js',
    cwd: '/home/vigilancia/app/worker',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    log_file: '/var/log/vigilancia/worker.log',
    error_file: '/var/log/vigilancia/worker-error.log',
    out_file: '/var/log/vigilancia/worker-out.log',
    pid_file: '/home/vigilancia/logs/worker.pid',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'recordings', 'temp']
  }]
};
EOF

pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

# Aguardar serviços iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 15

# Verificar status dos serviços
echo "📊 Verificando status dos serviços..."
echo ""
echo "🐳 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "⚙️ PM2 Processes:"
pm2 list

echo ""
echo "🌐 Testando endpoints:"

# Testar backend
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Backend (3001): Online"
else
    echo "❌ Backend (3001): Offline"
fi

# Testar worker
if curl -s http://localhost:3002/status > /dev/null; then
    echo "✅ Worker (3002): Online"
else
    echo "❌ Worker (3002): Offline"
fi

# Testar SRS
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ SRS HLS (8080): Online"
else
    echo "❌ SRS HLS (8080): Offline"
fi

# Testar RTMP
if netstat -ln | grep -q ":1935"; then
    echo "✅ SRS RTMP (1935): Online"
else
    echo "❌ SRS RTMP (1935): Offline"
fi

echo ""
echo "🎉 Deploy da aplicação concluído!"
echo "=================================="
echo ""
echo "📋 Serviços rodando:"
echo "   - Backend API: http://localhost:3001"
echo "   - Worker: http://localhost:3002"
echo "   - SRS HLS: http://localhost:8080"
echo "   - SRS RTMP: rtmp://localhost:1935"
echo ""
echo "📝 Logs disponíveis em:"
echo "   - Backend: /var/log/vigilancia/backend.log"
echo "   - Worker: /var/log/vigilancia/worker.log"
echo "   - PM2: pm2 logs"
echo ""
echo "🔧 Comandos úteis:"
echo "   - pm2 status              # Status dos processos"
echo "   - pm2 restart all         # Reiniciar todos"
echo "   - pm2 logs                # Ver logs em tempo real"
echo "   - docker-compose logs srs # Logs do SRS"
echo ""
echo "⚠️  LEMBRE-SE:"
echo "   1. Editar worker/.env com WASABI_SECRET_KEY"
echo "   2. Configurar SSL com certbot"
echo "   3. Atualizar DNS do domínio"
echo "" 