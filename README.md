# 🎥 Sistema de Monitoramento de Câmeras IP

Sistema completo de monitoramento de câmeras IP baseado em nuvem com streaming ao vivo, gravações automáticas e gestão de múltiplos usuários.

## ✨ Funcionalidades

- 🔐 **Autenticação multi-nível**: Admin, Integrador, Cliente
- 📹 **Streaming ao vivo** via RTSP/RTMP/HLS
- 📱 **Interface responsiva** com Next.js + Tailwind
- 💾 **Gravações automáticas** com retenção configurável
- 🔔 **Sistema de alertas** e notificações
- 🎯 **Detecção de movimento** (preparado)
- ☁️ **Armazenamento em nuvem** (Wasabi S3)

## 🛠️ Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | Node.js + Fastify |
| Banco de Dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth + JWT |
| Streaming | SRS (Simple Realtime Server) |
| Armazenamento | Wasabi S3 |
| Worker | Node.js + FFmpeg |

## 🚀 Instalação Rápida

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- FFmpeg

### 1. Clonar o repositório
```bash
git clone <repo-url>
cd sistema-vigilancia-ip
```

### 2. Configurar variáveis de ambiente
```bash
# Copiar arquivos exemplo
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env

# Editar com suas configurações
nano .env
```

### 3. Instalar dependências
```bash
# Instalar dependências de todos os módulos
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd worker && npm install && cd ..
```

### 4. Iniciar serviços
```bash
# Iniciar SRS (servidor de streaming)
cd streaming-server
docker-compose up -d

# Iniciar backend
cd ../backend
npm run dev

# Iniciar worker (nova aba)
cd ../worker
npm run dev

# Iniciar frontend (nova aba)
cd ../frontend
npm run dev
```

### 5. Acessar aplicação
- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:3001
- **Streaming**: rtmp://localhost:1935/live

## 🔧 Configuração

### Supabase
1. Criar projeto no [Supabase](https://supabase.com)
2. Copiar URL e chaves para os arquivos `.env`
3. Executar migrations do banco (ver `DATABASE.md`)

### Wasabi S3
1. Criar conta no [Wasabi](https://wasabi.com)
2. Criar bucket para armazenamento
3. Configurar credenciais nos arquivos `.env`

## 📖 Documentação

- **📋 Banco de Dados**: `DATABASE.md` - Schema e configuração
- **🚀 Deploy**: `GUIA_DEPLOY_COMPLETO.md` - Deploy em produção
- **📁 Estrutura**: Veja as pastas `frontend/`, `backend/`, `worker/`

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │      Backend    │    │    Supabase     │
│   Next.js       │◄──►│   API + Auth    │◄──►│   PostgreSQL    │
│   Dashboard     │    │   Fastify       │    │   Auth          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Worker        │    │   SRS Server    │    │   Wasabi S3     │
│   Gravações     │    │   Streaming     │    │   Armazenamento │
│   FFmpeg        │    │   RTMP → HLS    │    │   Vídeos        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 👥 Níveis de Acesso

- **👑 Admin**: Controle total do sistema
- **🔧 Integrador**: Gerencia clientes e câmeras
- **👤 Cliente**: Visualiza suas câmeras e gravações

## 🎯 Uso

1. **Cadastro**: Registre-se como integrador
2. **Clientes**: Adicione seus clientes
3. **Câmeras**: Configure câmeras IP com URLs RTSP
4. **Streaming**: Inicie transmissões ao vivo
5. **Gravações**: Configure retenção e downloads

## 🔐 Segurança

- Autenticação JWT robusta
- Controle de acesso por roles
- Sanitização de inputs
- Rate limiting
- Logs de auditoria

## 📊 Monitoramento

- Dashboard em tempo real
- Status de câmeras (online/offline)
- Alertas automáticos
- Métricas de uso

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit as mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para dúvidas e suporte:
- Abra uma [issue](issues)
- Consulte a documentação
- Verifique os logs em `/logs`