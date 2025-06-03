# 🚀 Deploy Rápido Contabo - Sistema de Vigilância

## 📋 Checklist Pré-Deploy

✅ **VPS Contabo contratado** (mínimo VPS S - €4.99/mês)  
✅ **Domínio configurado** apontando para IP do VPS  
✅ **Acesso SSH** ao servidor  

## 🎯 Deploy em 5 Passos

### 1️⃣ **Setup Inicial (Execute como root)**

```bash
# Conectar via SSH
ssh root@SEU_IP_CONTABO

# Baixar e executar script de setup
wget -O setup.sh https://raw.githubusercontent.com/seu-usuario/sistema-vigilancia-ip/main/contabo-setup.sh
chmod +x setup.sh
./setup.sh
```

### 2️⃣ **Clonar Repositório**

```bash
# Trocar para usuário vigilancia
su - vigilancia

# Clonar código
git clone https://github.com/seu-usuario/sistema-vigilancia-ip.git
cd sistema-vigilancia-ip
```

### 3️⃣ **Configurar Environment**

```bash
# Copiar template
cp .env.production.template .env.production

# Editar configurações
nano .env.production
```

**📝 Configurar estas variáveis:**
```env
POSTGRES_PASSWORD=SUA_SENHA_FORTE_123
FRONTEND_URL=https://SEU_DOMINIO.com
JWT_SECRET=token-super-secreto-aqui
```

### 4️⃣ **SSL e Domínio**

```bash
# Configurar SSL (como root)
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

### 5️⃣ **Deploy dos Serviços**

```bash
# Iniciar containers
docker-compose -f docker-compose.prod.yml up -d --build

# Verificar se estão rodando
docker ps
```

## ✅ **Verificação**

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Testar endpoints
curl http://localhost:3001/health  # Backend
curl http://localhost:3002/health  # Worker
curl http://localhost:3000         # Frontend
```

## 🔧 **Comandos Úteis**

```bash
# Backup manual
./backup.sh

# Monitoramento
./monitor.sh

# Atualizar aplicação
./deploy.sh

# Reiniciar serviços
docker-compose -f docker-compose.prod.yml restart

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f worker
```

## 🚨 **Troubleshooting**

**Container não inicia:**
```bash
docker-compose -f docker-compose.prod.yml logs NOME_CONTAINER
```

**Erro de permissão:**
```bash
sudo chown -R vigilancia:vigilancia /home/vigilancia/sistema-vigilancia-ip/data
```

**Erro de SSL:**
```bash
sudo certbot renew --dry-run
```

## 📊 **Monitoramento Automático**

**Adicionar ao cron (como vigilancia):**
```bash
crontab -e

# Adicionar linhas:
0 3 * * * /home/vigilancia/backup.sh
*/5 * * * * /home/vigilancia/monitor.sh
```

## 💰 **Custos**

- **VPS S**: €4.99/mês (mínimo)
- **VPS M**: €8.99/mês (recomendado)
- **Domínio**: ~€10/ano
- **SSL**: Gratuito (Let's Encrypt)

**Total: ~€5-9/mês** 💸

## 🎉 **URLs Finais**

- **Frontend**: https://seudominio.com
- **API**: https://seudominio.com/api
- **Streaming**: https://seudominio.com/streams
- **HLS**: https://seudominio.com/hls
- **Snapshots**: https://seudominio.com/snapshots

**🚀 Sistema pronto para produção!** 