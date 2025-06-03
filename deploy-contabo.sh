#!/bin/bash

# ================================
# DEPLOY CONTABO - SISTEMA VIGILÂNCIA IP
# ================================

echo "🚀 Iniciando deploy no Contabo..."

# Verificar se está no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Execute este script na raiz do projeto!"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado. Copiando do exemplo..."
    cp .env.example .env
    echo "📝 Configure o arquivo .env antes de continuar!"
    echo "   - Altere seu domínio"
    echo "   - Configure JWT_SECRET"
    echo "   - Configure SSL_CERT_PATH e SSL_KEY_PATH"
    read -p "Pressione Enter após configurar..."
fi

# Parar containers existentes
echo "⏹️  Parando containers existentes..."
docker-compose down

# Build e start
echo "🔨 Fazendo build e iniciando containers..."
docker-compose up -d --build

# Aguardar serviços
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 30

# Verificar status
echo "✅ Verificando status dos serviços..."
docker-compose ps

echo ""
echo "🎉 Deploy concluído!"
echo ""
echo "📍 Acesse: https://seu-dominio.com.br"
echo "🔍 Logs: docker-compose logs -f"
echo "🛑 Parar: docker-compose down"
echo "" 