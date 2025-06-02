#!/bin/bash

# 🌐 Script de Deploy Frontend - Sistema Vigilância IP
# Deploy no Vercel

echo "🌐 Iniciando deploy do frontend no Vercel..."
echo "============================================="

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script no diretório frontend/"
    exit 1
fi

# Verificar se Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "📦 Instalando Vercel CLI..."
    npm install -g vercel
fi

# Verificar se está logado no Vercel
echo "🔐 Verificando autenticação Vercel..."
vercel whoami || {
    echo "⚠️ Faça login no Vercel:"
    vercel login
}

# Solicitar domínio da API
read -p "🌐 Digite o domínio da sua VPS (ex: vigilancia.seudominio.com): " API_DOMAIN

if [ -z "$API_DOMAIN" ]; then
    echo "❌ Domínio é obrigatório"
    exit 1
fi

# Criar arquivo .env.local para build
echo "⚙️ Configurando variáveis de ambiente..."
cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://$API_DOMAIN
NEXT_PUBLIC_STREAMING_URL=https://$API_DOMAIN

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://mmpipjndealyromdfnoa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDUxNjMsImV4cCI6MjA2MzQyMTE2M30.nE6einLwJZGOHlWgJCUZeKNOFNPOo0QAGUDPUrO4OLo

# Streaming Configuration
NEXT_PUBLIC_HLS_BASE_URL=https://$API_DOMAIN/live
NEXT_PUBLIC_RTMP_URL=rtmp://$API_DOMAIN:1935

# Application
NEXT_PUBLIC_APP_NAME=Sistema Vigilância IP
NEXT_PUBLIC_APP_VERSION=1.0.0
EOF

# Criar configuração Vercel
echo "📋 Criando configuração Vercel..."
cat > vercel.json << EOF
{
  "name": "sistema-vigilancia-ip",
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "https://$API_DOMAIN",
    "NEXT_PUBLIC_SUPABASE_URL": "https://mmpipjndealyromdfnoa.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDUxNjMsImV4cCI6MjA2MzQyMTE2M30.nE6einLwJZGOHlWgJCUZeKNOFNPOo0QAGUDPUrO4OLo",
    "NEXT_PUBLIC_STREAMING_URL": "https://$API_DOMAIN",
    "NEXT_PUBLIC_HLS_BASE_URL": "https://$API_DOMAIN/live"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/api/(.*)",
      "destination": "https://$API_DOMAIN/api/\$1",
      "permanent": false
    }
  ]
}
EOF

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Build do projeto
echo "🔨 Buildando projeto..."
npm run build

# Deploy no Vercel
echo "🚀 Fazendo deploy no Vercel..."
vercel --prod --yes

# Verificar se deploy foi bem-sucedido
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deploy do frontend concluído com sucesso!"
    echo "==========================================="
    echo ""
    
    # Obter URL do deploy
    VERCEL_URL=$(vercel ls | grep "sistema-vigilancia-ip" | head -1 | awk '{print $2}')
    
    echo "✅ Frontend disponível em:"
    echo "   🌐 URL: https://$VERCEL_URL"
    echo ""
    
    echo "📋 Configurações aplicadas:"
    echo "   - API Base URL: https://$API_DOMAIN"
    echo "   - Supabase URL: https://mmpipjndealyromdfnoa.supabase.co"
    echo "   - Streaming URL: https://$API_DOMAIN/live"
    echo ""
    
    echo "🔧 Próximos passos:"
    echo "   1. Configure domínio personalizado no Vercel (opcional)"
    echo "   2. Teste a aplicação completa"
    echo "   3. Configure CORS no backend se necessário"
    echo ""
    
    echo "📱 URLs de teste:"
    echo "   - Dashboard: https://$VERCEL_URL/dashboard"
    echo "   - Login: https://$VERCEL_URL/login"
    echo "   - Câmeras: https://$VERCEL_URL/dashboard/cameras"
    echo ""
    
else
    echo "❌ Erro no deploy. Verifique os logs acima."
    exit 1
fi 