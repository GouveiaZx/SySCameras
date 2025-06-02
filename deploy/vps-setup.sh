#!/bin/bash

# 🚀 Script de Setup VPS - Sistema Vigilância IP
# Autor: Sistema IA Claude Sonnet
# Data: 28/05/2025

echo "🚀 Iniciando configuração da VPS para Sistema Vigilância IP..."
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script deve ser executado como root"
   echo "Execute: sudo bash vps-setup.sh"
   exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema operacional..."
apt update && apt upgrade -y

# Instalar dependências essenciais
echo "📦 Instalando dependências..."
apt install -y curl wget git nginx software-properties-common ufw

# Instalar Node.js (LTS)
echo "📦 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Verificar versões
echo "✅ Verificando versões instaladas:"
node --version
npm --version

# Instalar PM2
echo "📦 Instalando PM2..."
npm install -g pm2

# Instalar FFmpeg
echo "📦 Instalando FFmpeg..."
apt install -y ffmpeg

# Instalar Docker
echo "📦 Instalando Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Instalar Docker Compose
echo "📦 Instalando Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configurar firewall
echo "🛡️ Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Portas essenciais
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 3001/tcp # Backend API
ufw allow 3002/tcp # Worker
ufw allow 1935/tcp # RTMP
ufw allow 8080/tcp # HLS

# Ativar firewall
ufw --force enable

# Criar usuário para aplicação
echo "👤 Criando usuário da aplicação..."
useradd -m -s /bin/bash vigilancia
usermod -aG docker vigilancia

# Criar diretórios
echo "📁 Criando estrutura de diretórios..."
mkdir -p /home/vigilancia/app
mkdir -p /home/vigilancia/logs
mkdir -p /var/log/vigilancia

# Configurar Nginx básico
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/vigilancia << 'EOF'
server {
    listen 80;
    server_name _;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Backend API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_timeout 30s;
    }

    # Worker API (interno)
    location /worker/ {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # HLS Streaming
    location /live/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Headers para streaming
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, Authorization, Accept";
    }

    # Status da aplicação
    location /status {
        return 200 '{"status":"online","service":"vigilancia-ip"}';
        add_header Content-Type application/json;
    }

    # Página padrão
    location / {
        return 200 '<!DOCTYPE html>
<html>
<head><title>Sistema Vigilância IP</title></head>
<body>
<h1>🎥 Sistema Vigilância IP</h1>
<p>Servidor rodando com sucesso!</p>
<ul>
<li><a href="/api/health">API Health</a></li>
<li><a href="/status">Server Status</a></li>
</ul>
</body>
</html>';
        add_header Content-Type text/html;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/vigilancia /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
nginx -t

# Configurar logrotate
echo "📝 Configurando rotação de logs..."
cat > /etc/logrotate.d/vigilancia << 'EOF'
/var/log/vigilancia/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 vigilancia vigilancia
    postrotate
        pm2 reload all > /dev/null 2>&1 || true
    endscript
}
EOF

# Configurar systemd para PM2
echo "⚙️ Configurando serviços systemd..."
pm2 startup systemd -u vigilancia --hp /home/vigilancia

# Instalar certificado SSL/TLS (Certbot)
echo "🔒 Instalando Certbot para SSL..."
apt install -y certbot python3-certbot-nginx

# Criar script de backup
echo "💾 Criando script de backup..."
cat > /home/vigilancia/backup.sh << 'EOF'
#!/bin/bash
# Backup automático do sistema

BACKUP_DIR="/home/vigilancia/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configurações
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /home/vigilancia/app/.env \
    /etc/nginx/sites-available/vigilancia \
    /home/vigilancia/logs

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +7 -delete

echo "✅ Backup criado: config_$DATE.tar.gz"
EOF

chmod +x /home/vigilancia/backup.sh

# Configurar cron para backup diário
echo "📅 Configurando backup automático..."
(crontab -u vigilancia -l 2>/dev/null; echo "0 2 * * * /home/vigilancia/backup.sh >> /var/log/vigilancia/backup.log 2>&1") | crontab -u vigilancia -

# Alterar propriedade dos arquivos
chown -R vigilancia:vigilancia /home/vigilancia
chown -R vigilancia:vigilancia /var/log/vigilancia

# Reiniciar serviços
systemctl enable nginx
systemctl restart nginx
systemctl enable docker
systemctl start docker

echo ""
echo "🎉 Configuração da VPS concluída com sucesso!"
echo "=================================================="
echo ""
echo "✅ Serviços instalados:"
echo "   - Node.js $(node --version)"
echo "   - NPM $(npm --version)"
echo "   - PM2 $(pm2 --version)"
echo "   - FFmpeg $(ffmpeg -version 2>&1 | head -1)"
echo "   - Docker $(docker --version)"
echo "   - Nginx $(nginx -v 2>&1)"
echo ""
echo "🛡️ Firewall configurado:"
echo "   - SSH (22), HTTP (80), HTTPS (443)"
echo "   - Backend (3001), Worker (3002)"
echo "   - RTMP (1935), HLS (8080)"
echo ""
echo "📋 Próximos passos:"
echo "   1. Clone o repositório em /home/vigilancia/app"
echo "   2. Configure variáveis .env"
echo "   3. Execute deploy-app.sh"
echo "   4. Configure SSL com certbot"
echo ""
echo "🔑 Para configurar SSL:"
echo "   certbot --nginx -d seu-dominio.com"
echo "" 