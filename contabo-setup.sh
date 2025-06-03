#!/bin/bash
# Script de Setup Automatizado - Contabo VPS
# Sistema de Vigilância IP

echo "🚀 Iniciando setup do Sistema de Vigilância IP na Contabo..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Atualizar sistema
log "Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependências básicas
log "Instalando dependências básicas..."
apt install -y curl wget git nano ufw fail2ban htop

# 3. Configurar firewall
log "Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

# 4. Instalar Docker
log "Instalando Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# 5. Instalar Docker Compose
log "Instalando Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 6. Instalar Nginx
log "Instalando Nginx..."
apt install -y nginx

# 7. Criar usuário vigilancia
log "Criando usuário vigilancia..."
if ! id "vigilancia" &>/dev/null; then
    adduser --disabled-password --gecos "" vigilancia
    usermod -aG sudo vigilancia
    usermod -aG docker vigilancia
fi

# 8. Configurar estrutura de diretórios
log "Configurando estrutura de diretórios..."
su - vigilancia -c "
    mkdir -p /home/vigilancia/sistema-vigilancia-ip/data/postgres
    mkdir -p /home/vigilancia/sistema-vigilancia-ip/data/hls
    mkdir -p /home/vigilancia/sistema-vigilancia-ip/data/snapshots
    mkdir -p /home/vigilancia/sistema-vigilancia-ip/logs
    mkdir -p /home/vigilancia/backups
"

# 9. Instalar Certbot (Let's Encrypt)
log "Instalando Certbot..."
apt install -y snapd
snap install core; snap refresh core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# 10. Configurar Nginx básico
log "Configurando Nginx básico..."
cat > /etc/nginx/sites-available/vigilancia << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /streams {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /hls {
        alias /home/vigilancia/sistema-vigilancia-ip/data/hls;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    location /snapshots {
        alias /home/vigilancia/sistema-vigilancia-ip/data/snapshots;
        expires 1h;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/vigilancia /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 11. Criar scripts úteis
log "Criando scripts úteis..."

# Script de backup
cat > /home/vigilancia/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/vigilancia/backups"

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec vigilancia_postgres pg_dump -U vigilancia vigilancia > $BACKUP_DIR/db_$DATE.sql

# Backup arquivos importantes
tar -czf $BACKUP_DIR/data_$DATE.tar.gz -C /home/vigilancia/sistema-vigilancia-ip data/ logs/

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
EOF

# Script de monitoramento
cat > /home/vigilancia/monitor.sh << 'EOF'
#!/bin/bash
cd /home/vigilancia/sistema-vigilancia-ip

# Verificar containers
if ! docker ps | grep -q vigilancia_backend; then
    echo "Backend down - reiniciando..."
    docker-compose -f docker-compose.prod.yml restart backend
fi

if ! docker ps | grep -q vigilancia_worker; then
    echo "Worker down - reiniciando..."
    docker-compose -f docker-compose.prod.yml restart worker
fi

# Verificar espaço em disco
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "ALERTA: Disco com $DISK_USAGE% de uso"
    find /home/vigilancia/sistema-vigilancia-ip/data/hls -name "*.ts" -mtime +1 -delete
fi
EOF

# Script de deploy
cat > /home/vigilancia/deploy.sh << 'EOF'
#!/bin/bash
cd /home/vigilancia/sistema-vigilancia-ip

echo "🚀 Fazendo deploy..."

# Atualizar código
git pull

# Rebuild e restart containers
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Deploy concluído!"
EOF

# Dar permissões aos scripts
chmod +x /home/vigilancia/*.sh
chown vigilancia:vigilancia /home/vigilancia/*.sh

# 12. Criar environment file template
cat > /home/vigilancia/sistema-vigilancia-ip/.env.production.template << 'EOF'
# Contabo Production Environment

# Database
POSTGRES_PASSWORD=SUA_SENHA_FORTE_POSTGRES_123

# Supabase
SUPABASE_URL=https://mmpipjndealyromdfnoa.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDc5NzcsImV4cCI6MjA2MzQyMzk3N30.x_4ADMbr-Se1MXMRmHftDDq8Lji7rZUDUpo9Cv8b6R0
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg0Nzk3NywiZXhwIjoyMDYzNDIzOTc3fQ.gHBER4v_A1HzfaqC2YlJHrVKGDcGB0RNejktoy3TvX8

# JWT
JWT_SECRET=sistema-vigilancia-ip-token-secreto-producao-super-forte-2024

# Frontend URL (substituir pelo seu domínio)
FRONTEND_URL=https://SEU_DOMINIO.com

# Wasabi S3
WASABI_BUCKET=safe-cameras-03
WASABI_ACCESS_KEY=8WBR4YFE79UA94TBIEST
WASABI_SECRET_KEY=A9hNRDUEzcyhUtzp0SAE51IgKcJtsP1b7knZNe5W
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.wasabisys.com
EOF

log "✅ Setup básico concluído!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Configure seu domínio para apontar para este IP"
echo "2. Execute: certbot --nginx -d seudominio.com"
echo "3. Clone o repositório: git clone https://github.com/seu-usuario/sistema-vigilancia-ip.git /home/vigilancia/sistema-vigilancia-ip"
echo "4. Configure o arquivo .env.production"
echo "5. Execute: docker-compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "🔧 Scripts disponíveis:"
echo "- /home/vigilancia/backup.sh - Backup automático"
echo "- /home/vigilancia/monitor.sh - Monitoramento"
echo "- /home/vigilancia/deploy.sh - Deploy/Atualização"
echo ""
echo "💻 Para trocar para usuário vigilancia: su - vigilancia" 