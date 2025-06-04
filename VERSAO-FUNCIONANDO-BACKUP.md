# VERSÃO DE BACKUP - FUNCIONANDO ✅

**Data de Backup:** 04/06/2025 10:17
**Status:** Versão funcional confirmada no servidor Contabo

## 📁 Arquivos Sincronizados do Servidor

Os seguintes arquivos foram baixados do servidor Contabo (IP: 66.94.104.241) onde estava funcionando corretamente:

### Arquivos Principais
- ✅ `.env` - Configurações completas do ambiente
- ✅ `docker-compose.yml` - Orchestração dos containers
- ✅ `deploy-contabo.sh` - Script de deploy
- ✅ `nginx/nginx.conf` - Configuração do proxy reverso

### Package.json Atualizados
- ✅ `backend/package.json`
- ✅ `worker/package.json` 
- ✅ `frontend/package.json`

## 🔧 Configurações Funcionais

### URLs Externas (via Nginx)
- Frontend: https://nuvem.safecameras.com.br
- Backend API: https://nuvem.safecameras.com.br/api
- Worker: https://nuvem.safecameras.com.br/worker

### Portas Internas (Docker)
- Frontend: 3000
- Backend: 3001
- Worker: 3002
- SRS RTMP: 1935
- Nginx: 80/443

### Serviços Externos
- **Supabase:** https://mmpipjndealyromdfnoa.supabase.co
- **Wasabi S3:** Bucket `safe-cameras-03` (us-east-1)

## 🚀 Como Restaurar no Servidor

Se precisar restaurar essa versão funcionando no servidor:

1. **Upload dos arquivos:**
   ```bash
   tar -czf backup-funcionando.tar.gz .
   scp backup-funcionando.tar.gz root@66.94.104.241:/opt/
   ```

2. **No servidor:**
   ```bash
   cd /opt
   rm -rf vigilancia
   mkdir vigilancia
   cd vigilancia
   tar -xzf ../backup-funcionando.tar.gz
   chmod +x deploy-contabo.sh
   ./deploy-contabo.sh
   ```

## ⚠️ Problemas Conhecidos Resolvidos

- ❌ URLs incorretas (resolvido com URLs corretas do domínio)
- ❌ Configurações de SSL (resolvido com nginx proxy)
- ❌ Permissões de arquivos (resolvidas no script de deploy)
- ❌ Variáveis de ambiente (todas configuradas no .env)

## 📝 Commit de Backup
**Hash:** 1b87df5  
**Mensagem:** "Backup: Sincronização da versão funcionando do servidor Contabo"

---
**IMPORTANTE:** Esta é a versão FUNCIONANDO. Use como referência para futuras implementações! 