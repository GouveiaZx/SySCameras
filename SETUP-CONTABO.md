# 🚀 Setup Contabo - Sistema de Vigilância IP

## 📋 **Pré-requisitos**
- **Servidor**: Contabo VPS (mínimo 4GB RAM)
- **Sistema**: Ubuntu 20.04+ 
- **Domínio**: Configurado apontando para o IP do servidor
- **SSL**: Certificado SSL (Let's Encrypt)

## ⚡ **Setup Rápido**

### **1. Preparar Servidor**
```bash
# Fazer upload do projeto para /opt/vigilancia/
scp -r . root@seu-servidor:/opt/vigilancia/

# Conectar ao servidor
ssh root@seu-servidor

# Navegar para o projeto
cd /opt/vigilancia
```

### **2. Executar Setup Automático**
```bash
# Tornar executável
chmod +x contabo-setup.sh

# Executar setup
./contabo-setup.sh
```

### **3. Configurar Ambiente**
```bash
# Copiar e configurar .env
cp .env.example .env

# Editar com seus dados
nano .env
```

**Configurações obrigatórias:**
```env
# Alterar domínio
PUBLIC_BACKEND_URL=https://seu-dominio.com.br/api
PUBLIC_WORKER_URL=https://seu-dominio.com.br/worker
PUBLIC_FRONTEND_URL=https://seu-dominio.com.br

# Alterar JWT secret
JWT_SECRET=sua_chave_jwt_super_segura_aqui

# Configurar SSL (se tiver)
SSL_CERT_PATH=/etc/letsencrypt/live/seu-dominio.com.br/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/seu-dominio.com.br/privkey.pem
```

### **4. Deploy**
```bash
# Executar deploy
./scripts/deploy.sh
```

## 🔗 **URLs de Acesso**
- **Sistema**: https://seu-dominio.com.br
- **API**: https://seu-dominio.com.br/api/health
- **Worker**: https://seu-dominio.com.br/worker/health

## 🛠️ **Comandos Úteis**

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Restart serviços
docker-compose restart

# Parar tudo
docker-compose down

# Update e restart
git pull && docker-compose up -d --build
```

## 🔧 **Troubleshooting**

### **Frontend não carrega**
```bash
# Verificar logs
docker-compose logs frontend

# Rebuild
docker-compose up -d --build frontend
```

### **Backend/Worker não conecta**
```bash
# Verificar rede Docker
docker network ls
docker network inspect vigilancia_default

# Verificar DNS interno
docker exec backend ping worker
```

### **SSL não funciona**
```bash
# Verificar certificados
ls -la /etc/letsencrypt/live/seu-dominio.com.br/

# Renovar certificado
certbot renew --nginx
```

## 📊 **Monitoramento**
```bash
# CPU/Memória
htop

# Espaço em disco
df -h

# Logs do sistema
journalctl -f

# Status dos containers
docker stats
```

**Deploy simplificado e direto para Contabo! 🎉** 