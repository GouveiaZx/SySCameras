# 🚀 GUIA COMPLETO DE DEPLOY - Sistema Vigilância IP

## 📋 Visão Geral

Este guia mostra como fazer o deploy completo do Sistema de Vigilância IP em produção usando:
- **VPS** (Backend + Worker + SRS) 
- **Vercel** (Frontend Next.js)
- **HTTPS/SSL** (Certbot + Nginx)
- **Monitoramento** (PM2 + Logs)

---

## 🏗️ ARQUITETURA FINAL

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │      VPS        │    │    Supabase     │
│   (Vercel)      │◄──►│   Backend API   │◄──►│   PostgreSQL    │
│   Next.js       │    │   Worker        │    │   Auth          │
│   Dashboard     │    │   SRS Streaming │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │   Wasabi S3     │
                       │   Gravações     │
                       └─────────────────┘
```

---

## 🛠️ PRÉ-REQUISITOS

### 1. VPS (DigitalOcean, Linode, AWS EC2)
- **SO**: Ubuntu 20.04+ / Debian 11+
- **RAM**: Mínimo 2GB (recomendado 4GB)
- **CPU**: 2 cores
- **Storage**: 20GB SSD
- **Portas**: 22, 80, 443, 3001, 3002, 1935, 8080

### 2. Domínio
- Domínio próprio (ex: vigilancia.seudominio.com)
- DNS apontando para IP da VPS

### 3. Contas de Serviço
- ✅ **Supabase**: Já configurado
- ✅ **Wasabi S3**: Já configurado  
- 🆕 **Vercel**: Conta gratuita
- 🆕 **VPS**: Provider de sua escolha

---

## 🚀 PASSO 1: CONFIGURAR VPS

### 1.1. Conectar na VPS
```bash
ssh root@SEU_IP_VPS
```

### 1.2. Executar Setup Automático
```bash
# Baixar scripts de deploy
wget https://raw.githubusercontent.com/seu-repo/deploy/vps-setup.sh
chmod +x vps-setup.sh

# Executar configuração (como root)
sudo bash vps-setup.sh
```

**O que o script faz:**
- ✅ Instala Node.js, NPM, PM2
- ✅ Instala Docker + Docker Compose  
- ✅ Instala FFmpeg
- ✅ Configura Nginx
- ✅ Configura Firewall (UFW)
- ✅ Cria usuário `vigilancia`
- ✅ Configura logs e backup
- ✅ Instala Certbot para SSL

---

## 🚀 PASSO 2: DEPLOY DA APLICAÇÃO

### 2.1. Fazer Deploy do Backend e Worker
```bash
# Mudar para usuário da aplicação
su - vigilancia

# Baixar script de deploy
wget https://raw.githubusercontent.com/seu-repo/deploy/deploy-app.sh
chmod +x deploy-app.sh

# Executar deploy
bash deploy-app.sh
```

**O que o script faz:**
- ✅ Clona o repositório
- ✅ Cria arquivos `.env` com configurações
- ✅ Instala dependências
- ✅ Configura SRS com Docker
- ✅ Inicia Backend e Worker com PM2
- ✅ Testa todos os serviços

### 2.2. Configurar Wasabi Secret Key
```bash
# Editar arquivo .env do worker
nano /home/vigilancia/app/worker/.env

# Substituir linha:
WASABI_SECRET_KEY=SUA_SECRET_KEY_AQUI

# Reiniciar worker
pm2 restart vigilancia-worker
```

---

## 🔒 PASSO 3: CONFIGURAR SSL/HTTPS

```bash
# Voltar para root
exit

# Baixar script SSL
wget https://raw.githubusercontent.com/seu-repo/deploy/ssl-setup.sh
chmod +x ssl-setup.sh

# Executar configuração SSL
sudo bash ssl-setup.sh
```

**Durante a execução:**
- Digite seu domínio (ex: vigilancia.seudominio.com)
- Digite seu email para notificações SSL
- Aguarde obtenção do certificado

**Resultado:**
- ✅ HTTPS configurado
- ✅ Redirecionamento HTTP → HTTPS
- ✅ Renovação automática SSL
- ✅ Headers de segurança

---

## 🌐 PASSO 4: DEPLOY DO FRONTEND

### 4.1. Preparar Frontend
```bash
# No seu computador local
cd frontend

# Baixar script de deploy
wget https://raw.githubusercontent.com/seu-repo/deploy/deploy-frontend.sh
chmod +x deploy-frontend.sh

# Executar deploy no Vercel
bash deploy-frontend.sh
```

**Durante a execução:**
- Digite o domínio da sua VPS
- Faça login no Vercel (se necessário)
- Aguarde build e deploy

### 4.2. Configurar Domínio Personalizado (Opcional)
```bash
# No dashboard da Vercel
# Settings > Domains > Add Domain
# vigilancia-frontend.seudominio.com
```

---

## 🧪 PASSO 5: VALIDAÇÃO FINAL

### 5.1. Teste Automatizado Completo
```bash
# Na VPS
wget https://raw.githubusercontent.com/seu-repo/deploy/validate-production.sh
chmod +x validate-production.sh

# Executar validação
bash validate-production.sh vigilancia.seudominio.com https://seu-app.vercel.app
```

### 5.2. Teste Manual das URLs
```bash
# Testar endpoints principais
curl https://vigilancia.seudominio.com/status
curl https://vigilancia.seudominio.com/api/health
```

---

## 📊 COMANDOS DE MONITORAMENTO

### PM2 (Processos Node.js)
```bash
pm2 status                    # Status dos processos
pm2 logs                      # Logs em tempo real
pm2 restart all               # Reiniciar todos
pm2 reload all                # Reload sem downtime
pm2 monit                     # Monitor interativo
```

### Docker (SRS Streaming)
```bash
docker ps                     # Containers rodando
docker logs srs-server        # Logs do SRS
docker stats                  # Uso de recursos
docker-compose restart        # Reiniciar SRS
```

### Sistema
```bash
htop                          # Monitor de recursos
df -h                         # Espaço em disco
free -h                       # Uso de memória
systemctl status nginx       # Status Nginx
journalctl -f                 # Logs do sistema
```

---

## 🎥 TESTE COM CÂMERA REAL

### Transmitir Câmera IP
```bash
ffmpeg -i rtsp://usuario:senha@192.168.1.100:554/stream1 \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -c:a aac -ar 44100 -ac 2 \
       -f flv rtmp://vigilancia.seudominio.com/live/STREAM_KEY
```

### Transmitir Webcam USB
```bash
ffmpeg -f v4l2 -i /dev/video0 \
       -c:v libx264 -preset ultrafast \
       -f flv rtmp://vigilancia.seudominio.com/live/STREAM_KEY
```

### Assistir Stream
```
https://vigilancia.seudominio.com/live/STREAM_KEY.m3u8
```

---

## 🔧 MANUTENÇÃO

### Atualizar Sistema
```bash
# Atualizar código
cd /home/vigilancia/app
git pull origin main

# Reinstalar dependências
cd backend && npm install
cd ../worker && npm install

# Reiniciar serviços
pm2 restart all
```

### Backup
```bash
# Backup manual
/home/vigilancia/backup.sh

# Logs de backup
tail -f /var/log/vigilancia/backup.log
```

### Logs
```bash
# Logs da aplicação
tail -f /var/log/vigilancia/backend.log
tail -f /var/log/vigilancia/worker.log

# Logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🆘 TROUBLESHOOTING

### Problemas Comuns

#### Backend não inicia
```bash
# Verificar logs
pm2 logs vigilancia-backend

# Verificar .env
cat /home/vigilancia/app/backend/.env

# Reiniciar
pm2 restart vigilancia-backend
```

#### SSL não funciona
```bash
# Verificar certificado
certbot certificates

# Renovar manualmente
certbot renew

# Verificar Nginx
nginx -t
systemctl status nginx
```

#### SRS offline
```bash
# Verificar container
docker ps
docker logs srs-server

# Reiniciar
cd /home/vigilancia/app/streaming-server
docker-compose restart
```

#### Frontend não conecta
```bash
# Verificar CORS no backend
# Verificar URLs no Vercel
# Verificar firewall da VPS
```

---

## ✅ CHECKLIST FINAL

### 🖥️ VPS
- [ ] VPS configurada com `vps-setup.sh`
- [ ] Backend rodando na porta 3001
- [ ] Worker rodando na porta 3002
- [ ] SRS rodando nas portas 1935/8080
- [ ] Nginx configurado
- [ ] Firewall ativo (UFW)

### 🔒 SSL/HTTPS
- [ ] Certificado SSL obtido
- [ ] HTTPS funcionando
- [ ] Redirecionamento HTTP→HTTPS
- [ ] Renovação automática configurada

### 🌐 Frontend
- [ ] Deploy no Vercel realizado
- [ ] Variáveis de ambiente configuradas
- [ ] Frontend conectando com backend
- [ ] Login funcionando

### 🧪 Testes
- [ ] Script `validate-production.sh` executado
- [ ] Taxa de sucesso ≥ 90%
- [ ] Autenticação funcionando
- [ ] CRUD de câmeras funcionando
- [ ] Streaming simulado funcionando

### 🎥 Streaming
- [ ] SRS respondendo
- [ ] RTMP funcionando
- [ ] HLS funcionando
- [ ] Teste com câmera real (opcional)

---

## 📱 URLs FINAIS

### Backend/API
- **Principal**: https://vigilancia.seudominio.com
- **Status**: https://vigilancia.seudominio.com/status  
- **Health**: https://vigilancia.seudominio.com/api/health
- **Streaming**: https://vigilancia.seudominio.com/live/

### Frontend
- **Dashboard**: https://seu-app.vercel.app
- **Login**: https://seu-app.vercel.app/login

---

## 🎉 CONCLUSÃO

Com este guia, você tem um **Sistema de Vigilância IP completo em produção** com:

✅ **Infraestrutura robusta** (VPS + Docker + PM2)  
✅ **Segurança avançada** (HTTPS + Firewall + Headers)  
✅ **Frontend moderno** (Next.js + Vercel)  
✅ **Streaming profissional** (SRS + HLS/RTMP)  
✅ **Monitoramento completo** (Logs + PM2 + Docker)  
✅ **Backup automático** (Configurações + Dados)

**O sistema está pronto para uso profissional!** 🚀 