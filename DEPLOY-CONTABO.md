# 🚀 Deploy Contabo VPS - Sistema de Vigilância IP

## 📋 Arquitetura Contabo

- **VPS**: Ubuntu 22.04 LTS
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)
- **Containers**: Docker + Docker Compose
- **Database**: PostgreSQL (container)
- **Frontend**: Build estático servido pelo Nginx

## 💰 Especificações VPS Recomendadas

**VPS M (Recomendado):**
- 4 vCPU cores
- 8 GB RAM
- 200 GB NVMe SSD
- **€8.99/mês**

**Mínimo (VPS S):**
- 2 vCPU cores  
- 4 GB RAM
- 100 GB NVMe SSD
- **€4.99/mês**

## 🎯 Passo a Passo Completo

### 1. 🖥️ Configuração Inicial do VPS

```bash
# Conectar via SSH
ssh root@seu-ip-contabo

# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências básicas
apt install -y curl wget git nano ufw fail2ban

# Configurar firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# Criar usuário não-root
adduser vigilancia
usermod -aG sudo vigilancia
```

### 2. 🐳 Instalação Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
usermod -aG docker vigilancia

# Testar instalação
docker --version
docker-compose --version
```

### 3. 📁 Preparar Código no Servidor

```bash
# Logar como usuário vigilancia
su - vigilancia

# Clonar repositório
git clone https://github.com/seu-usuario/sistema-vigilancia-ip.git
cd sistema-vigilancia-ip

# Criar estrutura de diretórios
mkdir -p data/postgres
mkdir -p data/hls
mkdir -p data/snapshots
mkdir -p logs
```

### 4. 🐳 Docker Compose para Produção

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    container_name: vigilancia_postgres
    environment:
      POSTGRES_DB: vigilancia
      POSTGRES_USER: vigilancia
      POSTGRES_PASSWORD: sua_senha_forte_aqui
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - vigilancia-network

  # Backend API
  backend:
    build: ./backend
    container_name: vigilancia_backend
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://vigilancia:sua_senha_forte_aqui@postgres:5432/vigilancia
      SUPABASE_URL: https://mmpipjndealyromdfnoa.supabase.co
      SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      SUPABASE_SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      JWT_SECRET: sistema-vigilancia-ip-token-secreto-producao-super-forte
      FRONTEND_URL: https://seudominio.com
      WORKER_URL: http://worker:3002
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - vigilancia-network
    volumes:
      - ./logs:/app/logs

  # Worker de Streaming
  worker:
    build: ./worker
    container_name: vigilancia_worker
    environment:
      NODE_ENV: production
      PORT: 3002
      BACKEND_URL: http://backend:3001
      HLS_OUTPUT_PATH: /app/data/hls
      SNAPSHOTS_PATH: /app/data/snapshots
      HLS_SEGMENT_TIME: 4
      HLS_LIST_SIZE: 10
      FFMPEG_PATH: auto
    ports:
      - "3002:3002"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - vigilancia-network
    volumes:
      - ./data/hls:/app/data/hls
      - ./data/snapshots:/app/data/snapshots
      - ./logs:/app/logs

  # Frontend (Build)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: vigilancia_frontend
    volumes:
      - frontend_build:/app/build
    networks:
      - vigilancia-network

volumes:
  frontend_build:

networks:
  vigilancia-network:
    driver: bridge
```

### 5. 🔧 Dockerfile Otimizado para Produção

**Frontend Dockerfile.prod:**
```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Frontend nginx.conf:**
```nginx
# frontend/nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /streams {
        proxy_pass http://worker:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    gzip on;
    gzip_types text/css application/javascript text/javascript application/json;
}
```

### 6. 🌐 Configuração Nginx Principal

```nginx
# /etc/nginx/sites-available/vigilancia
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/seudominio.com/chain.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Worker/Streaming
    location /streams {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # HLS Streaming Files
    location /hls {
        alias /home/vigilancia/sistema-vigilancia-ip/data/hls;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
        
        location ~* \.(m3u8)$ {
            expires -1;
        }
        
        location ~* \.(ts)$ {
            expires 1h;
        }
    }

    # Snapshots
    location /snapshots {
        alias /home/vigilancia/sistema-vigilancia-ip/data/snapshots;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7. 🔐 SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obter certificado SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Configurar renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 8. 🚀 Deploy dos Serviços

```bash
# Ir para diretório do projeto
cd /home/vigilancia/sistema-vigilancia-ip

# Criar arquivo de environment
cp backend/.env.example .env.production
nano .env.production
# Configurar todas as variáveis

# Build e iniciar serviços
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verificar se estão rodando
docker ps
docker logs vigilancia_backend
docker logs vigilancia_worker
```

### 9. 📊 Scripts de Monitoramento

**Script de Backup (backup.sh):**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/vigilancia/backups"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec vigilancia_postgres pg_dump -U vigilancia vigilancia > $BACKUP_DIR/db_$DATE.sql

# Backup arquivos importantes
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/ logs/

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

**Script de Monitoramento (monitor.sh):**
```bash
#!/bin/bash
# monitor.sh

# Verificar se containers estão rodando
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
    # Limpar arquivos HLS antigos
    find /home/vigilancia/sistema-vigilancia-ip/data/hls -name "*.ts" -mtime +1 -delete
fi
```

### 10. ⚙️ Automatização (Crontab)

```bash
# Editar crontab
crontab -e

# Adicionar tarefas automáticas:
# Backup diário às 3h
0 3 * * * /home/vigilancia/sistema-vigilancia-ip/backup.sh

# Monitoramento a cada 5 minutos
*/5 * * * * /home/vigilancia/sistema-vigilancia-ip/monitor.sh

# Limpeza de logs semanalmente
0 2 * * 0 find /home/vigilancia/sistema-vigilancia-ip/logs -name "*.log" -mtime +30 -delete

# Renovação SSL (Certbot já configura, mas por garantia)
0 12 * * * /usr/bin/certbot renew --quiet
```

## 🎯 Resumo dos Comandos Principais

```bash
# Deploy inicial
docker-compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Reiniciar serviços
docker-compose -f docker-compose.prod.yml restart

# Atualizar código
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Backup manual
./backup.sh

# Monitoramento manual
./monitor.sh
```

## 💰 Custos Estimados Contabo

- **VPS M**: €8.99/mês
- **Domínio**: €10/ano
- **Total**: ~€9/mês

## 🎉 Vantagens Contabo

✅ **Controle total** do servidor
✅ **Custo baixo** para recursos
✅ **Localização EU** (GDPR compliant)
✅ **Backup físico** em SSD
✅ **Rede de alta qualidade**
✅ **Suporte técnico** em português

**Pronto para produção na Contabo!** 🚀 