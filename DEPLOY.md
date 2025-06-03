# 🚀 Guia de Deploy - Sistema de Vigilância IP

## 📋 Arquitetura de Deploy

- **Frontend (Next.js)**: Vercel
- **Backend (Node.js)**: Railway
- **Worker (Node.js)**: Railway
- **Database**: Supabase (já configurado)

## 🎯 Passo a Passo

### 1. 📱 Deploy Frontend no Vercel

```bash
# 1. Fazer push do código para GitHub
git add .
git commit -m "Ready for deploy"
git push origin main
```

**No Vercel Dashboard:**
1. Acesse [vercel.com](https://vercel.com)
2. Conecte com GitHub
3. Import Repository
4. **Root Directory**: `frontend`
5. **Framework**: Next.js (detectado automaticamente)
6. **Environment Variables**: (se necessário)
   ```
   NEXT_PUBLIC_API_URL=https://backend-production.up.railway.app
   NEXT_PUBLIC_WORKER_URL=https://worker-production.up.railway.app
   ```
7. Deploy!

### 2. 🔧 Deploy Backend no Railway

**Criar novo projeto Railway:**
1. Acesse [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Selecione seu repositório
4. **Service Name**: `backend`
5. **Root Directory**: `backend`

**Configurar Variáveis de Ambiente:**
```env
NODE_ENV=production
PORT=$PORT
DATABASE_URL=$DATABASE_URL
SUPABASE_URL=https://mmpipjndealyromdfnoa.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=sistema-vigilancia-ip-token-secreto-producao
FRONTEND_URL=https://seu-app.vercel.app
WORKER_URL=https://worker-production.up.railway.app
```

**Adicionar PostgreSQL:**
1. Add service → Database → PostgreSQL
2. Railway automaticamente configura `DATABASE_URL`

### 3. ⚙️ Deploy Worker no Railway

**Criar segundo serviço:**
1. Add service → GitHub repo (mesmo repo)
2. **Service Name**: `worker`
3. **Root Directory**: `worker`

**Configurar Variáveis de Ambiente:**
```env
NODE_ENV=production
PORT=$PORT
BACKEND_URL=https://backend-production.up.railway.app
HLS_OUTPUT_PATH=/tmp/hls
SNAPSHOTS_PATH=/tmp/snapshots
HLS_SEGMENT_TIME=4
HLS_LIST_SIZE=10
FFMPEG_PATH=auto
```

### 4. 🔗 Configurar URLs Cross-Services

**Após deploy, atualizar URLs:**

1. **Backend ENV** (adicionar URL real do worker):
   ```env
   WORKER_URL=https://worker-production-abc123.up.railway.app
   ```

2. **Worker ENV** (adicionar URL real do backend):
   ```env
   BACKEND_URL=https://backend-production-def456.up.railway.app
   ```

3. **Frontend ENV** (no Vercel):
   ```env
   NEXT_PUBLIC_API_URL=https://backend-production-def456.up.railway.app
   NEXT_PUBLIC_WORKER_URL=https://worker-production-abc123.up.railway.app
   ```

## 📊 Monitoramento

### Railway:
- Logs em tempo real no dashboard
- Métricas de CPU/RAM
- Deploy automático via GitHub

### Vercel:
- Analytics incluído
- Core Web Vitals
- Edge Functions

## 💰 Custos Estimados

**Railway (por mês):**
- Backend: ~$5
- Worker: ~$5  
- PostgreSQL: ~$5
- **Total: ~$15/mês**

**Vercel:**
- Frontend: **Gratuito** (Hobby plan)

**Total: ~$15/mês** 🎯

## 🆘 Troubleshooting

### Common Issues:

1. **CORS Error**: Verificar `FRONTEND_URL` no backend
2. **Database Connection**: Verificar `DATABASE_URL` 
3. **FFmpeg Error**: Worker usa `ffmpeg-static` automaticamente
4. **Build Error**: Verificar `package.json` scripts

### Health Checks:
- Backend: `GET /health`
- Worker: `GET /health`
- Frontend: Automático (Vercel)

## 🎉 Vantagens desta Arquitetura

✅ **Deploy automático** via GitHub push
✅ **Escalabilidade** automática
✅ **SSL/HTTPS** automático
✅ **Logs centralizados**
✅ **Backup automático** do DB
✅ **CDN global** (Vercel)
✅ **Custo baixo** para começar

## 📞 Próximos Passos

1. Deploy frontend no Vercel ✅
2. Deploy backend no Railway ✅
3. Deploy worker no Railway ✅
4. Configurar domínio custom (opcional)
5. Configurar monitoramento (opcional)

**Pronto para produção!** 🚀 