#!/bin/bash

# 🔒 Script de Configuração SSL - Sistema Vigilância IP
# Configuração HTTPS com Certbot

echo "🔒 Configurando SSL/HTTPS para o Sistema Vigilância IP..."
echo "======================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script deve ser executado como root"
   echo "Execute: sudo bash ssl-setup.sh"
   exit 1
fi

# Solicitar domínio
read -p "🌐 Digite seu domínio (ex: vigilancia.seudominio.com): " DOMAIN
read -p "📧 Digite seu email para notificações SSL: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Domínio e email são obrigatórios"
    exit 1
fi

echo "📋 Configurando SSL para: $DOMAIN"
echo "📧 Email de notificações: $EMAIL"
echo ""

# Verificar se Certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot não encontrado. Execute vps-setup.sh primeiro"
    exit 1
fi

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    echo "🚀 Iniciando Nginx..."
    systemctl start nginx
fi

# Atualizar configuração Nginx com domínio
echo "🌐 Atualizando configuração Nginx..."
cat > /etc/nginx/sites-available/vigilancia << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration (será atualizado pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # SSL Security Headers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' https: blob:;" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=20r/s;

    # Backend API
    location /api/ {
        limit_req zone=api burst=30 nodelay;
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_timeout 30s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Worker API (apenas localhost)
    location /worker/ {
        allow 127.0.0.1;
        allow ::1;
        deny all;
        proxy_pass http://localhost:3002/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # HLS Streaming
    location /live/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Headers para streaming
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma no-cache;
        add_header Expires 0;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, Authorization, Accept, Content-Type";
        
        # CORS preflight
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, Authorization, Accept, Content-Type";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }

    # WebSocket para streaming ao vivo
    location /ws/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Status da aplicação
    location /status {
        access_log off;
        return 200 '{"status":"online","service":"vigilancia-ip","ssl":"enabled","domain":"$DOMAIN"}';
        add_header Content-Type application/json;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:3001/api/health;
        proxy_set_header Host \$host;
    }

    # Página padrão
    location / {
        return 200 '<!DOCTYPE html>
<html>
<head>
    <title>🎥 Sistema Vigilância IP</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { color: green; }
        .ssl { color: #0066cc; }
    </style>
</head>
<body>
    <h1>🎥 Sistema Vigilância IP</h1>
    <p class="status">✅ Servidor rodando com HTTPS</p>
    <p class="ssl">🔒 SSL/TLS configurado para: <strong>$DOMAIN</strong></p>
    
    <h3>🔗 Links da API:</h3>
    <ul>
        <li><a href="/api/health">🏥 API Health</a></li>
        <li><a href="/status">📊 Server Status</a></li>
        <li><a href="/live/">📺 HLS Streaming</a></li>
    </ul>
    
    <h3>📱 Frontend:</h3>
    <p>Acesse o painel de controle através do frontend deployado no Vercel.</p>
    
    <hr>
    <small>Sistema Vigilância IP v1.0.0 - Produção</small>
</body>
</html>';
        add_header Content-Type text/html;
    }
}
EOF

# Testar configuração Nginx
echo "🔍 Testando configuração Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
systemctl reload nginx

# Criar diretório para challenge
mkdir -p /var/www/html/.well-known/acme-challenge/

# Obter certificado SSL
echo "🔒 Obtendo certificado SSL..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/html \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ Certificado SSL obtido com sucesso!"
    
    # Configurar renovação automática
    echo "⚙️ Configurando renovação automática..."
    
    # Criar script de renovação
    cat > /usr/local/bin/renew-ssl.sh << 'EOF'
#!/bin/bash
# Script de renovação SSL

# Renovar certificados
certbot renew --quiet

# Recarregar Nginx se necessário
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "$(date): SSL renovado com sucesso" >> /var/log/ssl-renewal.log
else
    echo "$(date): Erro na renovação SSL" >> /var/log/ssl-renewal.log
fi
EOF
    
    chmod +x /usr/local/bin/renew-ssl.sh
    
    # Adicionar ao cron
    (crontab -l 2>/dev/null; echo "0 2 * * 0 /usr/local/bin/renew-ssl.sh") | crontab -
    
    # Recarregar Nginx com SSL
    echo "🔄 Recarregando Nginx com SSL..."
    systemctl reload nginx
    
    echo ""
    echo "🎉 SSL configurado com sucesso!"
    echo "=============================="
    echo ""
    echo "✅ Certificado SSL ativo para: $DOMAIN"
    echo "🔒 HTTPS habilitado"
    echo "🔄 Renovação automática configurada"
    echo ""
    echo "🌐 URLs disponíveis:"
    echo "   - HTTPS: https://$DOMAIN"
    echo "   - API: https://$DOMAIN/api/"
    echo "   - Streaming: https://$DOMAIN/live/"
    echo "   - Status: https://$DOMAIN/status"
    echo ""
    echo "🔧 Comandos úteis:"
    echo "   - certbot certificates          # Ver certificados"
    echo "   - certbot renew --dry-run      # Testar renovação"
    echo "   - systemctl status nginx       # Status Nginx"
    echo ""
    
    # Testar HTTPS
    echo "🧪 Testando conexão HTTPS..."
    if curl -s -k https://$DOMAIN/status > /dev/null; then
        echo "✅ HTTPS funcionando!"
    else
        echo "⚠️ Teste HTTPS falhou - verifique configuração"
    fi
    
else
    echo "❌ Erro ao obter certificado SSL"
    echo "Verifique:"
    echo "   1. DNS do domínio está apontando para este servidor"
    echo "   2. Firewall permite conexões nas portas 80 e 443"
    echo "   3. Nginx está rodando"
    exit 1
fi