# 🚀 GUIA COMPLETO DE DEPLOY - SISTEMA DE VIGILÂNCIA IP

## 📋 **ÍNDICE**
1. [Pré-requisitos](#pré-requisitos)
2. [Configuração do Servidor](#configuração-do-servidor)
3. [Deploy com Docker](#deploy-com-docker)
4. [Configuração SSL/HTTPS](#configuração-ssl-https)
5. [Monitoramento](#monitoramento)
6. [Backup e Manutenção](#backup-e-manutenção)
7. [Troubleshooting](#troubleshooting)

---

## 🛠️ **PRÉ-REQUISITOS**

### **SERVIDOR MÍNIMO RECOMENDADO:**
- **CPU:** 4+ cores (para FFmpeg)
- **RAM:** 8GB+ (processamento de vídeo)
- **Storage:** 100GB+ SSD
- **Banda:** Unlimited (upload para S3)
- **OS:** Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### **DEPENDÊNCIAS NECESSÁRIAS:**
```bash
# Docker e Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

sudo apt install docker-compose-plugin
# ou
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update && sudo apt install git curl

# Nginx (se não usar container)
sudo apt install nginx certbot python3-certbot-nginx
```

### **PORTAS NECESSÁRIAS:**
- **80** - HTTP (Nginx)
- **443** - HTTPS (Nginx) 
- **3000** - Frontend (interno)
- **3001** - Backend (interno)
- **3002** - Worker (interno)
- **1935** - RTMP (SRS)
- **8080** - SRS HTTP

---

## 🏗️ **CONFIGURAÇÃO DO SERVIDOR**

### **1. CLONE DO REPOSITÓRIO:**
```bash
cd /opt
sudo git clone https://github.com/seu-usuario/sistema-vigilancia-ip.git
sudo chown -R $USER:$USER sistema-vigilancia-ip
cd sistema-vigilancia-ip
```

### **2. CONFIGURAÇÃO DE AMBIENTE:**
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

### **3. EXEMPLO DE .env PARA PRODUÇÃO:**
```env
# Ambiente
NODE_ENV=production

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_ANON_KEY=sua-anon-key

# JWT
JWT_SECRET=sua-chave-jwt-super-secreta-256bits

# Resend
RESEND_API_KEY=re_sua_api_key_aqui

# Wasabi S3
WASABI_ACCESS_KEY=sua-access-key
WASABI_SECRET_KEY=sua-secret-key
WASABI_BUCKET=seu-bucket
WASABI_REGION=us-east-1

# URLs para produção
NEXT_PUBLIC_API_URL=https://seudominio.com/api
NEXT_PUBLIC_WORKER_URL=https://seudominio.com/worker

# Configurações de vídeo
SEGMENT_DURATION=1800
MAX_CONCURRENT_RECORDINGS=10
```

### **4. CONFIGURAÇÃO DE FIREWALL:**
```bash
# UFW (Ubuntu)
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 1935
sudo ufw allow 8080
sudo ufw enable

# Ou iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 1935 -j ACCEPT
```

---

## 🐳 **DEPLOY COM DOCKER**

### **1. DEPLOY AUTOMATIZADO:**
```bash
# Dar permissão de execução
chmod +x scripts/deploy.sh

# Executar deploy
./scripts/deploy.sh
```

### **2. DEPLOY MANUAL:**
```bash
# Criar diretórios necessários
mkdir -p nginx/ssl logs data/{postgres,worker,srs}

# Build e inicialização
docker-compose build --no-cache
docker-compose up -d

# Verificar status
docker-compose ps
```

### **3. CONFIGURAÇÃO ESPECÍFICA POR AMBIENTE:**

#### **PRODUÇÃO:**
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

#### **DESENVOLVIMENTO:**
```yaml
# docker-compose.dev.yml  
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend:/app
      - /app/node_modules
```

---

## 🔒 **CONFIGURAÇÃO SSL/HTTPS**

### **1. CERTIFICADO LET'S ENCRYPT (RECOMENDADO):**
```bash
# Instalar Certbot
sudo snap install --classic certbot

# Gerar certificado
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Auto-renovação
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

### **2. CONFIGURAÇÃO NGINX PARA SSL:**
```nginx
# /etc/nginx/sites-available/vigilancia
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

    # Configurações SSL modernas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Headers de segurança
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy para containers Docker
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        # ... headers similares
    }

    location /worker/ {
        proxy_pass http://localhost:3002;
        # ... headers similares
    }
}
```

### **3. ATIVAR CONFIGURAÇÃO:**
```bash
sudo ln -s /etc/nginx/sites-available/vigilancia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 **MONITORAMENTO**

### **1. MONITORAMENTO BÁSICO:**
```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Uso de recursos
docker stats

# Script de monitoramento automático
chmod +x scripts/monitor.sh
./scripts/monitor.sh
```

### **2. MONITORAMENTO AVANÇADO COM PROMETHEUS:**
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
```

### **3. ALERTAS AUTOMÁTICOS:**
```bash
# Script de verificação (cron a cada 5 min)
*/5 * * * * /opt/sistema-vigilancia-ip/scripts/health-check.sh
```

---

## 💾 **BACKUP E MANUTENÇÃO**

### **1. BACKUP DOS DADOS:**
```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/vigilancia-$DATE"

mkdir -p $BACKUP_DIR

# Backup dos volumes Docker
docker run --rm -v surveillance_worker_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/worker-data.tar.gz -C /data .

# Backup do banco Supabase (se necessário)
pg_dump $DATABASE_URL > $BACKUP_DIR/database.sql

# Backup das configurações
cp -r /opt/sistema-vigilancia-ip/.env $BACKUP_DIR/
cp -r /opt/sistema-vigilancia-ip/nginx/ $BACKUP_DIR/

echo "Backup salvo em: $BACKUP_DIR"
```

### **2. LIMPEZA AUTOMÁTICA:**
```bash
#!/bin/bash
# scripts/cleanup.sh

# Limpar containers parados
docker container prune -f

# Limpar imagens não utilizadas  
docker image prune -f

# Limpar volumes órfãos
docker volume prune -f

# Limpar arquivos antigos (>30 dias)
find /opt/sistema-vigilancia-ip/data/worker -name "*.mp4" -mtime +30 -delete

# Rotar logs do Nginx
logrotate /etc/logrotate.d/nginx
```

### **3. AUTOMATIZAR LIMPEZA:**
```bash
# Cron job para limpeza semanal
0 2 * * 0 /opt/sistema-vigilancia-ip/scripts/cleanup.sh
```

---

## 🔧 **TROUBLESHOOTING**

### **PROBLEMAS COMUNS:**

#### **1. Container não inicia:**
```bash
# Verificar logs
docker-compose logs backend

# Verificar configurações
docker-compose config

# Rebuild sem cache
docker-compose build --no-cache backend
```

#### **2. FFmpeg não funciona:**
```bash
# Verificar se FFmpeg está instalado no container
docker exec surveillance-worker ffmpeg -version

# Testar RTSP manualmente
docker exec surveillance-worker ffmpeg -i rtsp://camera-url -t 5 test.mp4
```

#### **3. Problemas de rede:**
```bash
# Verificar redes Docker
docker network ls
docker network inspect surveillance-network

# Testar conectividade entre containers
docker exec surveillance-backend ping surveillance-worker
```

#### **4. Alto uso de CPU/Memória:**
```bash
# Verificar recursos
docker stats

# Limitar recursos do container
# No docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
```

#### **5. Problemas de SSL:**
```bash
# Verificar certificado
sudo certbot certificates

# Renovar manualmente
sudo certbot renew

# Testar configuração Nginx
sudo nginx -t
```

### **LOGS IMPORTANTES:**

```bash
# Logs dos containers
docker-compose logs -f backend
docker-compose logs -f worker
docker-compose logs -f frontend

# Logs do sistema
sudo journalctl -u docker
sudo tail -f /var/log/nginx/error.log

# Logs do Worker (FFmpeg)
docker exec surveillance-worker tail -f /app/logs/ffmpeg.log
```

### **COMANDOS ÚTEIS:**

```bash
# Restart específico de serviço
docker-compose restart backend

# Rebuild e restart
docker-compose up -d --build backend

# Acessar container para debug
docker exec -it surveillance-backend bash

# Verificar variáveis de ambiente
docker exec surveillance-backend printenv

# Monitoring em tempo real
watch docker-compose ps
```

---

## 🎯 **CHECKLIST FINAL DE DEPLOY**

- [ ] ✅ Servidor configurado (4+ CPU, 8GB+ RAM)
- [ ] ✅ Docker e Docker Compose instalados
- [ ] ✅ Firewall configurado (portas 80, 443, 1935)
- [ ] ✅ Arquivo .env configurado com credenciais
- [ ] ✅ DNS apontando para o servidor
- [ ] ✅ Certificado SSL configurado
- [ ] ✅ Containers rodando sem erros
- [ ] ✅ URLs funcionando (frontend, API, worker)
- [ ] ✅ Streaming RTMP testado
- [ ] ✅ Upload para S3 funcionando
- [ ] ✅ Sistema de monitoramento ativo
- [ ] ✅ Backup automatizado configurado
- [ ] ✅ Limpeza automática agendada

---

## 🚨 **CONTATOS DE EMERGÊNCIA**

```bash
# Para problemas críticos:
./scripts/monitor.sh restart    # Restart automático
./scripts/backup.sh             # Backup de emergência
docker-compose down && docker-compose up -d  # Restart completo
```

**🎉 Seu Sistema de Vigilância IP está pronto para produção!**

---

*Última atualização: 02/06/2025 - Guia completo de deploy em produção* 